import { useState } from "react";
import { toast } from "sonner";
import {
  Gauge, Wallet, CalendarClock, AlertTriangle, CircleDollarSign, CalendarCheck2,
  ArrowRight, Play, CheckCircle2, Hourglass,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useObraConfig } from "@/hooks/useObraMedicoes";
import {
  useDisciplinas,
  useMarcos,
  useBimRodadas,
  useAtualizarMarco,
  usePagarMarco,
} from "@/hooks/useObraProjetos";
import { ModalDisciplina } from "@/routes/obra/ObraProjetos";
import { somarDiasISO, arred } from "@/lib/obraCalc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { formatarMoeda, formatarMesReferencia } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraDisciplina, ObraDisciplinaMarco } from "@/types/database";

// ===========================================================================
// MÓDULO OBRA · CENTRAL — o centro de CONTROLE do dia a dia (master/direção).
// Fase atual do empreendimento: desenvolvimento de projetos (TRÍADE). Aqui o
// cronograma, o financeiro e o ciclo de cada atividade se encontram:
//   · Ações pendentes: pagar entrada, aprovar entrega, pagar marco aprovado;
//   · Esta semana: o que começa, termina, está em andamento ou atrasado;
//   · Desembolso mês a mês: previsto × pago dos R$ 500.000 de projetos.
// Toda linha abre o WORKSPACE da atividade (progresso, entregas, pagamentos).
// ===========================================================================

/** Segunda-feira da semana da data. */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dia = d.getUTCDay(); // 0=dom
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

export function ObraCentral() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const disciplinas = useDisciplinas();
  const marcos = useMarcos();
  const bim = useBimRodadas();
  const config = useObraConfig();
  const aprovarMarco = useAtualizarMarco();
  const pagarMarco = usePagarMarco();

  const [aberta, setAberta] = useState<ObraDisciplina | null>(null);

  if (disciplinas.isLoading || marcos.isLoading) return <LoadingState />;
  if (disciplinas.isError) return <ErrorState error={disciplinas.error} />;

  const hoje = hojeISO();
  const listaDisc = disciplinas.data ?? [];
  const listaMarcos = marcos.data ?? [];
  const compatFinal = (bim.data ?? []).some((r) => r.final && !!r.ifc_url);
  const multaCfg = {
    multaDiaPct: parseFloat(config.data?.multa_projeto_dia_pct ?? "0.15"),
    tetoPct: parseFloat(config.data?.multa_projeto_teto_pct ?? "10"),
  };

  const discPorId = new Map(listaDisc.map((d) => [d.id, d]));
  const marcosPorDisc = new Map<string, ObraDisciplinaMarco[]>();
  for (const m of listaMarcos) {
    const arr = marcosPorDisc.get(m.disciplina_id) ?? [];
    arr.push(m);
    marcosPorDisc.set(m.disciplina_id, arr);
  }
  const fimDe = (d: ObraDisciplina) => somarDiasISO(d.data_base, d.prazo_dias);

  // ── KPIs ──
  const pagasComValor = listaDisc.filter((d) => d.valor > 0);
  const totalContratado = arred(pagasComValor.reduce((s, d) => s + d.valor, 0));
  const totalPago = arred(listaMarcos.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor, 0));
  const avancoProjetos = totalContratado > 0
    ? pagasComValor.reduce((s, d) => s + d.valor * d.progresso_pct, 0) / totalContratado
    : 0;
  const atrasadas = listaDisc.filter((d) => {
    const fim = fimDe(d);
    return d.status !== "Concluído" && d.progresso_pct < 100 && fim != null && fim < hoje;
  });

  // ── Ações pendentes (o que precisa de VOCÊ agora) ──
  const entradasAPagar = listaMarcos
    .filter((m) => m.chave === "inicio" && (m.status === "Pendente" || m.status === "Aprovado"))
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc?.data_base && x.disc.data_base <= somarDiasISO(hoje, 7)!)
    .sort((a, b) => a.disc.data_base!.localeCompare(b.disc.data_base!));
  const entregasEmAnalise = listaMarcos
    .filter((m) => m.status === "Em análise")
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc);
  const aprovadosAPagar = listaMarcos
    .filter((m) => m.status === "Aprovado" && m.chave !== "inicio")
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc);
  const totalAcoes = entradasAPagar.length + entregasEmAnalise.length + aprovadosAPagar.length;

  // ── Esta semana ──
  const segunda = segundaDaSemana(hoje);
  const domingo = somarDiasISO(segunda, 6)!;
  const naSemana = (iso: string | null) => !!iso && iso >= segunda && iso <= domingo;
  const comecamSemana = listaDisc.filter((d) => naSemana(d.data_base) && d.status !== "Concluído");
  const terminamSemana = listaDisc.filter((d) => naSemana(fimDe(d)) && d.status !== "Concluído");
  const emAndamento = listaDisc.filter((d) => {
    const fim = fimDe(d);
    return d.status !== "Concluído" && d.data_base && d.data_base <= hoje && (!fim || fim >= hoje) && d.progresso_pct < 100;
  });

  // ── Desembolso mês a mês (previsto × pago) ──
  // Previsto: entrada no mês do INÍCIO; R00/R01/entrega no mês do FIM previsto.
  // Pago: pelo mês do pagamento efetivo.
  const porMes = new Map<string, { previsto: number; pago: number }>();
  const soma = (mes: string | null | undefined, campo: "previsto" | "pago", v: number) => {
    if (!mes) return;
    const chave = mes.slice(0, 7);
    const atual = porMes.get(chave) ?? { previsto: 0, pago: 0 };
    atual[campo] += v;
    porMes.set(chave, atual);
  };
  for (const m of listaMarcos) {
    const d = discPorId.get(m.disciplina_id);
    if (!d) continue;
    soma(m.chave === "inicio" ? d.data_base : fimDe(d), "previsto", m.valor);
    if (m.status === "Pago") soma(m.data_pagamento ?? hoje, "pago", m.valor);
  }
  const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMes = Math.max(1, ...meses.map(([, v]) => Math.max(v.previsto, v.pago)));

  function abrir(d: ObraDisciplina) { setAberta(d); }

  async function pagarEntrada(x: { marco: ObraDisciplinaMarco; disc: ObraDisciplina }) {
    try {
      if (x.marco.status === "Pendente") await aprovarMarco.mutateAsync({ id: x.marco.id, status: "Aprovado" });
      await pagarMarco.mutateAsync(x.marco.id);
      toast.success(`Entrada de ${x.disc.nome} paga (${formatarMoeda(x.marco.valor)}).`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar."); }
  }
  async function pagar(x: { marco: ObraDisciplinaMarco; disc: ObraDisciplina }) {
    try {
      await pagarMarco.mutateAsync(x.marco.id);
      toast.success(`${x.marco.rotulo} de ${x.disc.nome} pago.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar."); }
  }

  const ocupado = aprovarMarco.isPending || pagarMarco.isPending;

  return (
    <div className="space-y-6 pb-8">
      {/* KPIs da fase atual (projetos) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icone={<Gauge className="size-5" />} rotulo="Avanço dos projetos (por valor)" valor={`${avancoProjetos.toFixed(1)}%`} />
        <Kpi icone={<Wallet className="size-5" />} rotulo={`Pago de ${formatarMoeda(totalContratado)}`} valor={formatarMoeda(totalPago)} tom="success" />
        <Kpi icone={<CalendarClock className="size-5" />} rotulo="Ações pendentes" valor={String(totalAcoes)} tom={totalAcoes > 0 ? "warning" : "secondary"} />
        <Kpi icone={<AlertTriangle className="size-5" />} rotulo="Atividades atrasadas" valor={String(atrasadas.length)} tom={atrasadas.length > 0 ? "destructive" : "secondary"} />
      </div>

      {/* Ações pendentes — o que precisa de decisão AGORA */}
      <Card>
        <CardContent className="space-y-1 p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-secondary">
            <CircleDollarSign className="size-5 text-primary" /> Ações pendentes
            {totalAcoes > 0 && <Badge variant="warning">{totalAcoes}</Badge>}
          </h2>
          {totalAcoes === 0 ? (
            <p className="text-sm text-muted-foreground">Nada aguardando decisão. ✔</p>
          ) : (
            <div className="divide-y">
              {entradasAPagar.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`Entrada (50%) · vence ${formatarDataBR(x.disc.data_base!)}${x.disc.data_base! < hoje ? " — VENCIDA" : ""}`}
                  valor={x.marco.valor}
                  vencida={x.disc.data_base! < hoje}
                  acao={podeEditar && <Button size="sm" onClick={() => pagarEntrada(x)} disabled={ocupado}><Play className="size-4" /> Pagar entrada</Button>}
                />
              ))}
              {entregasEmAnalise.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`${x.marco.rotulo} entregue — aguardando sua análise`}
                  valor={x.marco.valor}
                  acao={podeEditar && (
                    <Button size="sm" variant="outline" onClick={() => abrir(x.disc)}>
                      Analisar <ArrowRight className="size-4" />
                    </Button>
                  )}
                />
              ))}
              {aprovadosAPagar.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`${x.marco.rotulo} aprovado — liberado para pagamento`}
                  valor={x.marco.valor}
                  acao={podeEditar && <Button size="sm" onClick={() => pagar(x)} disabled={ocupado}><CircleDollarSign className="size-4" /> Pagar</Button>}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Esta semana */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <CalendarCheck2 className="size-5 text-primary" /> Esta semana
            <span className="text-xs font-normal text-muted-foreground">{formatarDataBR(segunda)} – {formatarDataBR(domingo)}</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <GrupoSemana titulo="Começam" icone={<Play className="size-4 text-primary" />} vazio="Nada começa esta semana.">
              {comecamSemana.map((d) => <LinhaSemana key={d.id} d={d} extra={formatarDataBR(d.data_base!)} onAbrir={() => abrir(d)} />)}
            </GrupoSemana>
            <GrupoSemana titulo="Terminam (prazo)" icone={<Hourglass className="size-4 text-warning" />} vazio="Nenhum prazo vence esta semana.">
              {terminamSemana.map((d) => <LinhaSemana key={d.id} d={d} extra={formatarDataBR(fimDe(d)!)} onAbrir={() => abrir(d)} />)}
            </GrupoSemana>
            <GrupoSemana titulo={`Em andamento (${emAndamento.length})`} icone={<CheckCircle2 className="size-4 text-success" />} vazio="Nada em andamento.">
              {emAndamento.slice(0, 8).map((d) => <LinhaSemana key={d.id} d={d} onAbrir={() => abrir(d)} />)}
              {emAndamento.length > 8 && <p className="text-[11px] text-muted-foreground">+ {emAndamento.length - 8} na aba Projetos</p>}
            </GrupoSemana>
          </div>
          {atrasadas.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 text-sm font-bold text-destructive">Atrasadas ({atrasadas.length})</p>
              <div className="space-y-1">
                {atrasadas.map((d) => (
                  <button key={d.id} onClick={() => abrir(d)} className="flex w-full items-center justify-between gap-2 text-left text-sm hover:underline">
                    <span className="text-secondary">{d.nome}</span>
                    <span className="shrink-0 tabular-nums text-destructive">{d.progresso_pct}% · prazo {formatarDataBR(fimDe(d)!)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desembolso mês a mês */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Wallet className="size-5 text-primary" /> Desembolso dos projetos — mês a mês
          </h2>
          <div className="space-y-2">
            {meses.map(([mes, v]) => (
              <div key={mes} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-semibold capitalize text-secondary">{formatarMesReferencia(mes)}</span>
                <div className="space-y-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-secondary/30" style={{ width: `${(v.previsto / maxMes) * 100}%` }} />
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(v.pago / maxMes) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-xs text-muted-foreground">prev. {formatarMoeda(arred(v.previsto))}</p>
                  <p className="text-xs font-semibold text-secondary">pago {formatarMoeda(arred(v.pago))}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-secondary/30" /> Previsto (entrada no início · R00/R01 no prazo)</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-brand-gradient" /> Pago</span>
          </p>
        </CardContent>
      </Card>

      {aberta && (
        <ModalDisciplina
          disciplina={listaDisc.find((d) => d.id === aberta.id) ?? aberta}
          marcos={(marcosPorDisc.get(aberta.id) ?? []).sort((a, b) => a.ordem - b.ordem)}
          compatFinal={compatFinal}
          podeEditar={podeEditar}
          multaCfg={multaCfg}
          onFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Kpi({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "warning" | "success" | "destructive" }) {
  const cor = tom === "warning" ? "text-warning" : tom === "success" ? "text-success" : tom === "destructive" ? "text-destructive" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div><p className={cn("text-xl font-extrabold tabular-nums", cor)}>{valor}</p><p className="text-xs text-muted-foreground">{rotulo}</p></div>
    </div>
  );
}

function LinhaAcao({ titulo, detalhe, valor, vencida = false, acao, onAbrir }: {
  titulo: string; detalhe: string; valor: number; vencida?: boolean; acao?: React.ReactNode; onAbrir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold text-secondary hover:underline">{titulo}</p>
        <p className={cn("text-xs", vencida ? "font-semibold text-destructive" : "text-muted-foreground")}>{detalhe}</p>
      </button>
      <span className="shrink-0 font-bold tabular-nums text-secondary">{formatarMoeda(valor)}</span>
      {acao}
    </div>
  );
}

function GrupoSemana({ titulo, icone, vazio, children }: { titulo: string; icone: React.ReactNode; vazio: string; children: React.ReactNode }) {
  const temFilhos = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-secondary">{icone} {titulo}</p>
      {temFilhos ? <div className="space-y-1.5">{children}</div> : <p className="text-xs text-muted-foreground">{vazio}</p>}
    </div>
  );
}

function LinhaSemana({ d, extra, onAbrir }: { d: ObraDisciplina; extra?: string; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="block w-full text-left">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-secondary hover:underline">{d.nome}</span>
        {extra && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{extra}</span>}
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
      </div>
    </button>
  );
}
