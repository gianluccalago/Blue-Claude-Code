import { intervaloDoMes } from "@/lib/mensalidade";
import type {
  RhAfastamento,
  RhAusencia,
  RhDesligamento,
  TipoAusencia,
  Turno,
  Usuario,
} from "@/types/database";

// ===========================================================================
// Agregações dos PAINÉIS DE RH (turnover, absenteísmo, cobertura). Lê dos
// registros de RH (rh_ausencia/afastamento/desligamento) e da escala (turnos).
// Todas as fórmulas estão DOCUMENTADAS abaixo.
//
// METAS/TETOS — baliza configurável (edite aqui; comentado):
//   META_TURNOVER_PCT     = turnover mensal aceitável (linha no gráfico).
//   TETO_ABSENTEISMO_PCT  = absenteísmo mensal aceitável (linha no gráfico).
// ===========================================================================
export const META_TURNOVER_PCT = 3;
export const TETO_ABSENTEISMO_PCT = 5;

function noMes(dataISO: string | null, mes: string): boolean {
  return !!dataISO && dataISO.slice(0, 7) === mes;
}
function diasNoMes(mes: string): number {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m, 0).getDate();
}

// ─── Headcount ───────────────────────────────────────────────────────────────
// "Presente numa data" = admitido até a data e não desligado até ela.
export function headcountEm(profissionais: Usuario[], desligamentos: RhDesligamento[], dateISO: string): number {
  const desligadoAte = new Map<string, string>();
  for (const d of desligamentos) {
    const cur = desligadoAte.get(d.profissional_id);
    if (!cur || d.data_desligamento < cur) desligadoAte.set(d.profissional_id, d.data_desligamento);
  }
  let n = 0;
  for (const p of profissionais) {
    if (p.data_admissao && p.data_admissao > dateISO) continue; // admitido depois
    const dl = desligadoAte.get(p.id);
    if (dl && dl <= dateISO) continue; // já desligado
    n++;
  }
  return n;
}

/** Headcount médio do mês = (presentes no início + presentes no fim) / 2. */
export function headcountMedioMes(profissionais: Usuario[], desligamentos: RhDesligamento[], mes: string): number {
  const { inicio, fim } = intervaloDoMes(mes);
  return (headcountEm(profissionais, desligamentos, inicio) + headcountEm(profissionais, desligamentos, fim)) / 2;
}

// ─── A) Cobertura de escala ───────────────────────────────────────────────────

export interface MetricasCobertura {
  mes: string;
  funcionarios: number; // ativos (headcount fim do mês)
  plantoes: number; // turnos escalados no mês
  descobertos: number; // turnos sem profissional (profissional_id null)
  coberturasPorTipo: Record<TipoAusencia, number>; // ausências com gerou_cobertura, por tipo
  totalCoberturas: number;
  diasAtestado: number;
  pctAtestadosSobrePlantoes: number | null; // dias de atestado ÷ plantões
  pctCoberturasSobrePlantoes: number | null; // coberturas ÷ plantões
}

export function coberturaDoMes(
  mes: string,
  profissionais: Usuario[],
  desligamentos: RhDesligamento[],
  turnos: Turno[],
  ausencias: RhAusencia[],
): MetricasCobertura {
  const { fim } = intervaloDoMes(mes);
  const turnosMes = turnos.filter((t) => noMes(t.data, mes));
  const plantoes = turnosMes.length;
  const descobertos = turnosMes.filter((t) => !t.profissional_id).length;

  const ausMes = ausencias.filter((a) => noMes(a.data_inicio, mes));
  const coberturasPorTipo = {
    atestado: 0, falta_sem_atestado: 0, ferias: 0, licenca_maternidade: 0, licenca_inss: 0, evento: 0, outro: 0,
  } as Record<TipoAusencia, number>;
  for (const a of ausMes) if (a.gerou_cobertura) coberturasPorTipo[a.tipo] += 1;
  const totalCoberturas = Object.values(coberturasPorTipo).reduce((s, n) => s + n, 0);
  const diasAtestado = ausMes.filter((a) => a.tipo === "atestado").reduce((s, a) => s + a.dias, 0);

  return {
    mes,
    funcionarios: headcountEm(profissionais, desligamentos, fim),
    plantoes,
    descobertos,
    coberturasPorTipo,
    totalCoberturas,
    diasAtestado,
    pctAtestadosSobrePlantoes: plantoes > 0 ? (diasAtestado / plantoes) * 100 : null,
    pctCoberturasSobrePlantoes: plantoes > 0 ? (totalCoberturas / plantoes) * 100 : null,
  };
}

// ─── B) Turnover ──────────────────────────────────────────────────────────────
// Turnover do mês = (nº desligamentos no mês ÷ headcount médio no mês) × 100.
export function turnoverMes(mes: string, profissionais: Usuario[], desligamentos: RhDesligamento[]): number | null {
  const media = headcountMedioMes(profissionais, desligamentos, mes);
  if (media <= 0) return null;
  const saidas = desligamentos.filter((d) => noMes(d.data_desligamento, mes)).length;
  return Math.round((saidas / media) * 100 * 10) / 10;
}

// ─── C) Absenteísmo ───────────────────────────────────────────────────────────
// Absenteísmo do mês = (dias perdidos por afastamento + faltas/atestados ÷
//   dias trabalháveis do mês) × 100, onde dias trabalháveis = headcount médio ×
//   dias do mês (operação 7 dias). Documentado.
export function diasPerdidosMes(mes: string, afastamentos: RhAfastamento[], ausencias: RhAusencia[]): number {
  const afa = afastamentos.filter((a) => noMes(a.data_inicio, mes)).reduce((s, a) => s + a.dias_perdidos, 0);
  const aus = ausencias
    .filter((a) => noMes(a.data_inicio, mes) && (a.tipo === "falta_sem_atestado" || a.tipo === "atestado"))
    .reduce((s, a) => s + a.dias, 0);
  return afa + aus;
}

export function absenteismoMes(
  mes: string,
  profissionais: Usuario[],
  desligamentos: RhDesligamento[],
  afastamentos: RhAfastamento[],
  ausencias: RhAusencia[],
): number | null {
  const media = headcountMedioMes(profissionais, desligamentos, mes);
  const trabalhaveis = media * diasNoMes(mes);
  if (trabalhaveis <= 0) return null;
  return Math.round((diasPerdidosMes(mes, afastamentos, ausencias) / trabalhaveis) * 100 * 10) / 10;
}

// ─── Agregações tabulares ─────────────────────────────────────────────────────

/** Cargo (funcao) de um profissional. */
export function cargoDe(profissionais: Usuario[], id: string): string {
  return profissionais.find((p) => p.id === id)?.funcao || "Não informado";
}

/** Afastamento por CID (grupo) no período: dias perdidos + nº de colaboradores. */
export function afastamentoPorCid(afastamentos: RhAfastamento[]): { grupo: string; dias: number; colaboradores: number }[] {
  const m = new Map<string, { dias: number; profs: Set<string> }>();
  for (const a of afastamentos) {
    const g = a.cid_grupo || "Não informado";
    const reg = m.get(g) ?? { dias: 0, profs: new Set() };
    reg.dias += a.dias_perdidos;
    reg.profs.add(a.profissional_id);
    m.set(g, reg);
  }
  return [...m.entries()]
    .map(([grupo, v]) => ({ grupo, dias: v.dias, colaboradores: v.profs.size }))
    .sort((a, b) => b.dias - a.dias);
}

/** Absenteísmo por cargo × mês (dias de afastamento). */
export function absenteismoCargoMes(
  meses: string[],
  profissionais: Usuario[],
  afastamentos: RhAfastamento[],
): { cargo: string; porMes: number[]; total: number }[] {
  const cargos = [...new Set(profissionais.map((p) => p.funcao || "Não informado"))].sort();
  return cargos
    .map((cargo) => {
      const ids = new Set(profissionais.filter((p) => (p.funcao || "Não informado") === cargo).map((p) => p.id));
      const porMes = meses.map((mes) =>
        afastamentos
          .filter((a) => ids.has(a.profissional_id) && noMes(a.data_inicio, mes))
          .reduce((s, a) => s + a.dias_perdidos, 0),
      );
      return { cargo, porMes, total: porMes.reduce((s, n) => s + n, 0) };
    })
    .filter((l) => l.total > 0);
}
