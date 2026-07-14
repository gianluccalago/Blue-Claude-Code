import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { hojeISO, inicioDoDiaISO, dataISO, somarDias } from "@/lib/utils";
import { mesAtual } from "@/lib/mensalidade";
import { periodosAteAgora, minutosAgoraSP } from "@/lib/periodos";
import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// SERVIÇO CENTRAL DE NOTIFICAÇÕES (badges da sidebar) — por PERFIL.
//
// Dado o perfil logado, retorna a contagem por ITEM DE MENU (rota). Só conta o
// que EXIGE AÇÃO de quem vê (nunca informação passiva). Recalcula ao navegar /
// montar (React Query, sem realtime — a sidebar invalida a chave a cada troca
// de tela).
//
// FORMATO: número nos perfis operacionais críticos (Farmácia, Coordenação,
// Serviços Gerais, Médico, Hotelaria, Enfermagem); ponto ("há algo") nos
// demais. `dot` decide a renderização; `count` alimenta o aria-label e o número.
//
// PERFORMANCE: consultas leves e AGREGADAS (count/head onde dá; senão colunas
// mínimas). Cada perfil só consulta o que lhe pertence (a RLS reforça). Se um
// dia virar gargalo, migrar para CONTADORES materializados / realtime.
//
// REUSO: as regras de "atrasado/vencido/emergência" seguem as mesmas dos
// módulos (períodos do dia, status do pagamento, status do chamado) — sem
// reimplementar telas, só recontando o mesmo critério.
// ===========================================================================

export type TomBadge = "destructive" | "primary" | "warning";

export interface Badge {
  /** Quantidade de itens pendentes (para o número e o aria-label). */
  count: number;
  /** true → renderiza PONTO; false → renderiza NÚMERO. */
  dot: boolean;
  /** Cor semântica: vermelho (crítico/atrasado/emergência), neutro/azul, âmbar. */
  tom: TomBadge;
}

/** Mapa rota-do-menu → badge. Rotas ausentes = sem badge. */
export type MapaNotificacoes = Record<string, Badge>;

/** Perfis com badge NUMÉRICO (operacionais críticos); os demais usam PONTO. */
const PERFIS_NUMERO: ReadonlySet<PerfilUsuario> = new Set([
  "medico",
  "coordenacao",
  "enfermagem",
  "farmacia",
  "hotelaria",
  "servicos_gerais",
]);

// ─── Helpers de contagem (leves, à prova de erro) ──────────────────────────────

/** Conta linhas (head + count exato). Em erro/RLS, retorna 0 (não quebra a UI). */
async function contar(
  builder: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await builder;
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

/** Medicação pendente do período: prescrições devidas até agora sem "sim" hoje. */
async function medicacaoPendente(
  residenteIds: string[] | null,
  enfermagem: boolean,
): Promise<number> {
  const periodos = periodosAteAgora();
  if (periodos.length === 0) return 0;
  try {
    let pq = supabase
      .from("prescricao")
      .select("residente_id, periodo")
      .eq("ativa", true)
      .in("periodo", periodos);
    pq = enfermagem
      ? pq.in("via", ["injetavel", "insulina", "sonda"])
      : pq.not("via", "in", "(injetavel,insulina,sonda)");
    if (residenteIds) {
      if (residenteIds.length === 0) return 0;
      pq = pq.in("residente_id", residenteIds);
    }
    const { data: presc, error } = await pq;
    if (error || !presc) return 0;

    const { data: adm } = await supabase
      .from("administracao")
      .select("residente_id, periodo")
      .eq("status", "sim")
      .gte("administrado_em", inicioDoDiaISO());
    const feito = new Set((adm ?? []).map((a) => `${a.residente_id}|${a.periodo}`));
    return presc.filter((p) => !feito.has(`${p.residente_id}|${p.periodo}`)).length;
  } catch {
    return 0;
  }
}

/** Intercorrências em aberto (sem tratamento "resolvido"), últimos 30 dias. */
async function intercorrenciasAbertas(): Promise<number> {
  try {
    const limite = dataISO(somarDias(new Date(), -30));
    const [{ data: inter }, { data: trat }] = await Promise.all([
      supabase.from("intercorrencia").select("id").gte("registrado_em", limite),
      supabase
        .from("pendencia_tratamento")
        .select("referencia_id, acao")
        .eq("tipo_origem", "intercorrencia")
        .eq("acao", "resolvido"),
    ]);
    const resolvidas = new Set((trat ?? []).map((t) => t.referencia_id));
    return (inter ?? []).filter((i) => !resolvidas.has(i.id)).length;
  } catch {
    return 0;
  }
}

const SEIS_MESES_MS = 183 * 24 * 60 * 60 * 1000;

/** Hóspedes com IVCF vencido (>6 meses) ou sem avaliação. */
async function ivcfVencidos(): Promise<number> {
  try {
    const [{ data: res }, { data: avs }] = await Promise.all([
      supabase.from("residentes").select("id").eq("status_hospede", "ativo").neq("modalidade", "day_care"),
      supabase.from("avaliacao_ivcf").select("residente_id, registrado_em"),
    ]);
    const maisRecente = new Map<string, number>();
    for (const a of avs ?? []) {
      const t = new Date(a.registrado_em).getTime();
      if (t > (maisRecente.get(a.residente_id) ?? 0)) maisRecente.set(a.residente_id, t);
    }
    const agora = Date.now();
    return (res ?? []).filter((r) => {
      const t = maisRecente.get(r.id);
      return t == null || agora - t > SEIS_MESES_MS;
    }).length;
  } catch {
    return 0;
  }
}

// ─── Cálculo por perfil ────────────────────────────────────────────────────────

async function calcular(
  perfil: PerfilUsuario,
  ids: { usuarioId: string; residente: string | null },
): Promise<MapaNotificacoes> {
  const numero = PERFIS_NUMERO.has(perfil);
  const m: MapaNotificacoes = {};
  const set = (rota: string, count: number, tom: TomBadge) => {
    if (count > 0) m[rota] = { count, dot: !numero, tom };
  };
  const hoje = hojeISO();

  switch (perfil) {
    // ─── SERVIÇOS GERAIS (número) ─────────────────────────────────────────────
    case "servicos_gerais": {
      const [abertos, emergencias] = await Promise.all([
        contar(headCount("chamado_manutencao").eq("destino", "servicos_gerais").neq("status", "resolvido")),
        contar(headCount("chamado_manutencao").eq("destino", "servicos_gerais").eq("urgencia", "emergencia").neq("status", "resolvido")),
      ]);
      set("/app/servicos_gerais/manutencao", abertos, emergencias > 0 ? "destructive" : "primary");
      break;
    }

    // ─── HOTELARIA (número) ───────────────────────────────────────────────────
    case "hotelaria": {
      const [comQuarto, { data: inspHoje }, abertosHt, emergHt] = await Promise.all([
        contar(headCount("residentes").eq("status_hospede", "ativo").not("quarto", "is", null)),
        supabase.from("inspecao_suite").select("residente_id").eq("tipo", "diaria").eq("data", hoje),
        contar(headCount("chamado_manutencao").eq("destino", "hotelaria").neq("status", "resolvido")),
        contar(headCount("chamado_manutencao").eq("destino", "hotelaria").eq("urgencia", "emergencia").neq("status", "resolvido")),
      ]);
      const inspecionados = new Set((inspHoje ?? []).map((i) => i.residente_id));
      const pendentes = Math.max(0, comQuarto - inspecionados.size);
      set("/app/hotelaria/inspecao-suites", pendentes, "warning");
      set("/app/hotelaria/manutencao", abertosHt, emergHt > 0 ? "destructive" : "primary");
      break;
    }

    // ─── FARMÁCIA (número) ────────────────────────────────────────────────────
    case "farmacia": {
      const mes = mesAtual();
      const [estoqueBaixo, resgateBaixo, totalRes, { data: prov }, dispPend] = await Promise.all([
        contar(headCount("estoque_hospede").eq("mes_referencia", mes).lte("quantidade_atual", 5)),
        contar(headCount("estoque_resgate").lte("quantidade_atual", 5)),
        contar(headCount("residentes").eq("status_hospede", "ativo").neq("modalidade", "day_care")),
        supabase.from("estoque_hospede").select("residente_id").eq("mes_referencia", mes),
        dispensacaoPendente(),
      ]);
      const provisionados = new Set((prov ?? []).map((p) => p.residente_id));
      const semProvisionamento = Math.max(0, totalRes - provisionados.size);
      set("/app/farmacia/estoque", estoqueBaixo, "destructive");
      set("/app/farmacia/resgate", resgateBaixo, "destructive");
      set("/app/farmacia/pedidos-mensais", semProvisionamento, "warning");
      set("/app/farmacia/dispensacao", dispPend, "primary");
      break;
    }

    // ─── MÉDICO (número) ──────────────────────────────────────────────────────
    case "medico": {
      const [escalados, ivcf, solic] = await Promise.all([
        escaladosAoMedico(),
        ivcfVencidos(),
        contar(headCount("solicitacao_familia").eq("destino", "medico").eq("status", "aberta")),
      ]);
      set("/app/medico/escalados", escalados, "destructive");
      set("/app/medico/ficha", ivcf, "destructive");
      set("/app/medico/solicitacoes-familia", solic, "primary");
      break;
    }

    // ─── ENFERMAGEM (número) ──────────────────────────────────────────────────
    case "enfermagem": {
      const medEnf = await medicacaoPendente(null, true);
      set("/app/enfermagem/medicacao-enfermagem", medEnf, "destructive");
      break;
    }

    // ─── COORDENAÇÃO (número) ─────────────────────────────────────────────────
    case "coordenacao": {
      const amanha = dataISO(somarDias(new Date(), 1));
      const [inter, medEnf, solic, vagos] = await Promise.all([
        intercorrenciasAbertas(),
        medicacaoPendente(null, true),
        contar(headCount("solicitacao_familia").eq("destino", "coordenacao").eq("status", "aberta")),
        contar(headCount("turnos").is("profissional_id", null).gte("data", hoje).lte("data", amanha)),
      ]);
      set("/app/coordenacao/intercorrencias", inter, "destructive");
      set("/app/coordenacao/medicacao-enfermagem", medEnf, "destructive");
      set("/app/coordenacao/solicitacoes-familia", solic, "primary");
      set("/app/coordenacao/escalas", vagos, "warning");
      break;
    }

    // ─── CUIDADORES (ponto) ───────────────────────────────────────────────────
    case "cuidador": {
      const designados = await idsDesignados(ids.usuarioId);
      if (designados.length === 0) break;
      const [med, comprom] = await Promise.all([
        medicacaoPendente(designados, false),
        contar(
          headCount("compromisso_externo")
            .in("residente_id", designados)
            .eq("data", hoje)
            .is("ciente_em", null),
        ),
      ]);
      const checklist = await checklistAtrasado(designados);
      set("/app/cuidador/checklist", checklist, "primary");
      set("/app/cuidador/medicacao", med, "primary");
      set("/app/cuidador/compromissos", comprom, "primary");
      break;
    }

    // ─── MULTIDISCIPLINAR (ponto) ─────────────────────────────────────────────
    case "multidisciplinar": {
      const pend = await atividadesNaoRegistradas();
      set("/app/multidisciplinar/atividades", pend, "primary");
      break;
    }

    // ─── NUTRICIONISTA (ponto) ────────────────────────────────────────────────
    case "nutricionista": {
      const semDieta = await residentesSemDieta();
      set("/app/nutricionista/dietas", semDieta, "primary");
      break;
    }

    // ─── ADMINISTRAÇÃO (ponto) ────────────────────────────────────────────────
    case "administracao": {
      const [vencidas, solic, cobrados] = await Promise.all([
        cobrancasVencidas(),
        contar(headCount("solicitacao_familia").eq("destino", "administracao").eq("status", "aberta")),
        contar(headCount("chamado_manutencao").eq("cobrado_gestao", true).neq("status", "resolvido")),
      ]);
      set("/app/administracao/cobranca", vencidas, "destructive");
      set("/app/administracao/solicitacoes-familia", solic, "primary");
      set("/app/administracao/servicos", cobrados, "primary");
      break;
    }

    // ─── MASTER (ponto contido) — só emergências ativas ───────────────────────
    case "master": {
      const emerg = await contar(
        headCount("chamado_manutencao").eq("urgencia", "emergencia").neq("status", "resolvido"),
      );
      set("/app/master", emerg, "destructive");
      break;
    }

    // ─── FAMÍLIA (ponto contido) — só respostas novas às solicitações dela ─────
    case "familia": {
      if (!ids.residente) break;
      const limite = dataISO(somarDias(new Date(), -7));
      const respostas = await contar(
        headCount("solicitacao_familia")
          .eq("residente_id", ids.residente)
          .eq("status", "respondida")
          .gte("respondida_em", limite),
      );
      set("/app/familia/solicitacoes", respostas, "primary");
      break;
    }

    // LAVANDERIA e demais: sem badge (rouparia não tem pendência acionável).
    default:
      break;
  }

  return m;
}

// ─── Subconsultas específicas ──────────────────────────────────────────────────

// Builder de contagem por cabeçalho (sem trazer linhas). O cast evita o atrito
// de tipos do nome de tabela dinâmico — todas as colunas usadas existem.
// eslint-disable-next-line
function headCount(tabela: string): any {
  return supabase.from(tabela as never).select("id", { count: "exact", head: true });
}

/**
 * Residentes designados ao cuidador NO TURNO CORRENTE (0081). Antes era o
 * vínculo fixo cuidador_residente; agora deriva do turno ativo dele na escala
 * e da designacao_cuidado daquele data+turno.
 */
async function idsDesignados(cuidadorId: string): Promise<string[]> {
  try {
    const now = new Date();
    const agora = now.getTime();
    const ini = new Date(now); ini.setDate(ini.getDate() - 1);
    const fim = new Date(now); fim.setDate(fim.getDate() + 1);
    const { data: turnos } = await supabase
      .from("turnos")
      .select("data, inicio, fim, tag")
      .eq("profissional_id", cuidadorId)
      .gte("data", dataISO(ini))
      .lte("data", dataISO(fim));
    const lista = turnos ?? [];
    const turno =
      lista.find((t) => +new Date(t.inicio) <= agora && agora <= +new Date(t.fim)) ??
      lista
        .filter((t) => +new Date(t.inicio) > agora)
        .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))[0] ??
      lista
        .filter((t) => +new Date(t.fim) < agora)
        .sort((a, b) => +new Date(b.fim) - +new Date(a.fim))[0];
    if (!turno) return [];
    const { data } = await supabase
      .from("designacao_cuidado")
      .select("residente_id")
      .eq("cuidador_id", cuidadorId)
      .eq("data", turno.data)
      .eq("turno", turno.tag);
    return [...new Set((data ?? []).map((r) => r.residente_id))];
  } catch {
    return [];
  }
}

/** Tarefas do plano com horário já vencido hoje e sem registro "feito". */
async function checklistAtrasado(residenteIds: string[]): Promise<number> {
  if (residenteIds.length === 0) return 0;
  try {
    const minAgora = minutosAgoraSP();
    const [{ data: itens }, { data: regs }] = await Promise.all([
      supabase
        .from("plano_cuidado_item")
        .select("residente_id, tarefa, horario")
        .eq("ativa", true)
        .in("residente_id", residenteIds),
      supabase
        .from("tarefa_registro")
        .select("residente_id, tarefa")
        .eq("data", hojeISO())
        .in("residente_id", residenteIds),
    ]);
    const feito = new Set((regs ?? []).map((r) => `${r.residente_id}|${r.tarefa}`));
    return (itens ?? []).filter((it) => {
      if (!it.horario) return false;
      const [h, mm] = String(it.horario).split(":").map(Number);
      const venc = h * 60 + (mm || 0) <= minAgora;
      return venc && !feito.has(`${it.residente_id}|${it.tarefa}`);
    }).length;
  } catch {
    return 0;
  }
}

/** Dispensações pendentes no período atual (residentes com prescrição devida). */
async function dispensacaoPendente(): Promise<number> {
  const periodos = periodosAteAgora();
  if (periodos.length === 0) return 0;
  try {
    const { data: presc } = await supabase
      .from("prescricao")
      .select("residente_id, periodo")
      .eq("ativa", true)
      .in("periodo", periodos);
    const { data: disp } = await supabase
      .from("dispensacao")
      .select("residente_id, periodo")
      .gte("dispensado_em", inicioDoDiaISO());
    const feito = new Set((disp ?? []).map((d) => `${d.residente_id}|${d.periodo}`));
    const pendentes = new Set(
      (presc ?? [])
        .filter((p) => !feito.has(`${p.residente_id}|${p.periodo}`))
        .map((p) => p.residente_id),
    );
    return pendentes.size;
  } catch {
    return 0;
  }
}

/** Escalamentos ao médico ainda não resolvidos. */
async function escaladosAoMedico(): Promise<number> {
  try {
    const { data } = await supabase
      .from("pendencia_tratamento")
      .select("tipo_origem, referencia_id, acao");
    const escalado = new Set<string>();
    const resolvido = new Set<string>();
    for (const t of data ?? []) {
      const k = `${t.tipo_origem}|${t.referencia_id}`;
      if (t.acao === "escalado_medico") escalado.add(k);
      if (t.acao === "resolvido") resolvido.add(k);
    }
    let n = 0;
    for (const k of escalado) if (!resolvido.has(k)) n++;
    return n;
  } catch {
    return 0;
  }
}

/** Atividades de hoje ainda sem execução registrada. */
async function atividadesNaoRegistradas(): Promise<number> {
  try {
    const [{ data: ativ }, { data: exec }] = await Promise.all([
      supabase.from("atividade").select("id, data, recorrente").or(`data.eq.${hojeISO()},recorrente.eq.true`),
      supabase.from("atividade_execucao").select("atividade_id").eq("data", hojeISO()),
    ]);
    const feitas = new Set((exec ?? []).map((e) => e.atividade_id));
    return (ativ ?? []).filter((a) => !feitas.has(a.id)).length;
  } catch {
    return 0;
  }
}

/** Residentes sem nenhuma dieta ativa (ex.: hóspede novo sem dieta definida). */
async function residentesSemDieta(): Promise<number> {
  try {
    const [{ data: res }, { data: dietas }] = await Promise.all([
      supabase.from("residentes").select("id").eq("status_hospede", "ativo").neq("modalidade", "day_care"),
      supabase.from("dieta").select("residente_id").eq("ativa", true),
    ]);
    const comDieta = new Set((dietas ?? []).map((d) => d.residente_id));
    return (res ?? []).filter((r) => !comDieta.has(r.id)).length;
  } catch {
    return 0;
  }
}

/** Mensalidades vencidas no mês corrente (mesma regra do Painel de Cobrança). */
async function cobrancasVencidas(): Promise<number> {
  try {
    const { data } = await supabase
      .from("pagamento_mensalidade")
      .select("status, data_vencimento")
      .eq("mes_referencia", mesAtual());
    const hoje = hojeISO();
    return (data ?? []).filter((p) => {
      if (p.status === "vencida") return true;
      const aberto = p.status === "em_aberto" || p.status === "enviada";
      return aberto && p.data_vencimento != null && p.data_vencimento < hoje;
    }).length;
  } catch {
    return 0;
  }
}

// ─── Hook público ──────────────────────────────────────────────────────────────

/**
 * Notificações (badges) do perfil informado. Recalcula no mount e quando a
 * sidebar invalida ["notificacoes"] ao navegar (sem realtime).
 */
export function useNotificacoes(perfilId: string | undefined): MapaNotificacoes {
  const { usuarioEfetivo } = useAuth();
  const usuarioId = usuarioEfetivo?.id ?? "";
  const residente = usuarioEfetivo?.residente_vinculado ?? null;

  const q = useQuery({
    queryKey: ["notificacoes", perfilId, usuarioId],
    enabled: !!perfilId && !!usuarioEfetivo,
    staleTime: 0,
    queryFn: () => calcular(perfilId as PerfilUsuario, { usuarioId, residente }),
  });

  return q.data ?? {};
}
