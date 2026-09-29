import { parseQuarto } from "@/lib/quarto";

// ===========================================================================
// ROTAÇÃO SEMANAL DE CUIDADORAS — regras puras.
//
// A cada semana cada cuidadora fica responsável por um grupo diferente de
// hóspedes, sempre geograficamente próximos: primeiro por ANDAR dentro do
// módulo (hoje só o módulo 5, com 2 andares); quando houver mais módulos, o
// mesmo módulo. Objetivo: todas conhecem a rotina de todos e ninguém se
// vincula demais (para o bem ou para o mal) a um hóspede. A Coordenação segue
// livre para ajustar — o que ela designa à mão prevalece sobre a rotação.
//
// Como a rotação funciona (determinística, sem sorteio):
//   1. O ELENCO da semana são as cuidadoras escaladas no turno naquela semana,
//      em ordem fixa (id) e ROTACIONADA pelo número da semana.
//   2. Os andares recebem cuidadoras na proporção do número de hóspedes
//      (maior resto; pelo menos 1 por andar enquanto houver cuidadora).
//   3. Dentro do andar, os hóspedes (em ordem de quarto) são divididos em
//      fatias contíguas, uma por cuidadora.
//   Como o elenco gira uma posição por semana, cada cuidadora troca de andar
//   e de fatia até ter passado por todos os grupos.
// ===========================================================================

export interface HospedeRotacao {
  id: string;
  nome: string;
  quarto: string | null;
}
export interface CuidadoraRotacao {
  id: string;
  nome: string;
}
export interface GrupoRotacao {
  cuidadora: CuidadoraRotacao;
  /** Andar principal do grupo (null = hóspedes sem localização). */
  modulo: number | null;
  andar: number | null;
  hospedes: HospedeRotacao[];
}

/** Segunda-feira da semana de uma data (YYYY-MM-DD). */
export function segundaDaSemana(dataISO: string): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Domingo da semana de uma data. */
export function domingoDaSemana(dataISO: string): string {
  const d = new Date(`${segundaDaSemana(dataISO)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Índice da semana (semanas inteiras desde 2024-01-01, uma segunda-feira). */
export function indiceSemana(dataISO: string): number {
  const base = Date.UTC(2024, 0, 1);
  const d = new Date(`${segundaDaSemana(dataISO)}T00:00:00Z`).getTime();
  return Math.floor((d - base) / (7 * 86400000));
}

/** Dias YYYY-MM-DD da semana (segunda a domingo). */
export function diasDaSemana(dataISO: string): string[] {
  const seg = new Date(`${segundaDaSemana(dataISO)}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(seg);
    d.setUTCDate(seg.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function chaveAndar(h: HospedeRotacao): { modulo: number | null; andar: number | null } {
  const p = parseQuarto(h.quarto);
  return { modulo: p.bloco, andar: p.andar };
}

/** Maior resto: reparte `total` itens entre `pesos` (proporcional), garantindo ≥1 onde `minimoUm`. */
export function repartirProporcional(total: number, pesos: number[], minimoUm: boolean): number[] {
  const n = pesos.length;
  if (n === 0 || total <= 0) return pesos.map(() => 0);
  const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1;
  const cotas = pesos.map((p) => (p / somaPesos) * total);
  const base = cotas.map((c) => Math.floor(c));
  if (minimoUm && total >= n) for (let i = 0; i < n; i++) if (base[i] === 0 && pesos[i] > 0) base[i] = 1;
  let sobra = total - base.reduce((a, b) => a + b, 0);
  const ordem = cotas.map((c, i) => ({ i, resto: c - Math.floor(c) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  let k = 0;
  while (sobra > 0) { base[ordem[k % n].i] += 1; sobra -= 1; k += 1; }
  while (sobra < 0) {
    // (só quando o mínimo de 1 estourou o total) tira de quem tem mais.
    const maior = base.indexOf(Math.max(...base));
    base[maior] -= 1; sobra += 1;
  }
  return base;
}

/**
 * Plano da semana: cada cuidadora → um grupo de hóspedes do mesmo andar.
 * `semana` = indiceSemana(data). Determinístico: a mesma entrada dá o mesmo plano.
 */
export function planejarRotacao(
  hospedes: HospedeRotacao[],
  cuidadoras: CuidadoraRotacao[],
  semana: number,
): GrupoRotacao[] {
  if (cuidadoras.length === 0 || hospedes.length === 0) return [];
  // 1 · elenco em ordem fixa, girado pela semana.
  const fixo = [...cuidadoras].sort((a, b) => a.id.localeCompare(b.id));
  const giro = ((semana % fixo.length) + fixo.length) % fixo.length;
  const elenco = [...fixo.slice(giro), ...fixo.slice(0, giro)];

  // 2 · hóspedes por andar (módulo, andar), em ordem de quarto; sem localização à parte.
  const porAndar = new Map<string, { modulo: number; andar: number; hospedes: HospedeRotacao[] }>();
  const semLocal: HospedeRotacao[] = [];
  for (const h of [...hospedes].sort((a, b) => (a.quarto ?? "").localeCompare(b.quarto ?? "") || a.nome.localeCompare(b.nome, "pt-BR"))) {
    const { modulo, andar } = chaveAndar(h);
    if (modulo == null || andar == null) { semLocal.push(h); continue; }
    const k = `${modulo}-${andar}`;
    if (!porAndar.has(k)) porAndar.set(k, { modulo, andar, hospedes: [] });
    porAndar.get(k)!.hospedes.push(h);
  }
  const andares = [...porAndar.values()].sort((a, b) => a.modulo - b.modulo || a.andar - b.andar);

  const grupos: GrupoRotacao[] = [];
  let proxima = 0;
  if (andares.length > 0) {
    // 3 · cuidadoras por andar, proporcional ao número de hóspedes.
    const cotas = repartirProporcional(elenco.length, andares.map((a) => a.hospedes.length), true);
    andares.forEach((a, i) => {
      const n = cotas[i];
      if (n === 0) return; // andar sem cuidadora própria: hóspedes vão para o andar vizinho (abaixo)
      const fatias = repartirProporcional(a.hospedes.length, Array(n).fill(1), false);
      let ini = 0;
      for (let j = 0; j < n; j++) {
        grupos.push({ cuidadora: elenco[proxima++], modulo: a.modulo, andar: a.andar, hospedes: a.hospedes.slice(ini, ini + fatias[j]) });
        ini += fatias[j];
      }
    });
    // Andares que ficaram sem cuidadora (menos cuidadoras que andares): anexa ao
    // grupo do mesmo módulo com menos hóspedes; senão ao menor grupo geral.
    andares.forEach((a, i) => {
      if (cotas[i] !== 0) return;
      const candidatos = grupos.filter((g) => g.modulo === a.modulo);
      const alvo = (candidatos.length ? candidatos : grupos).reduce((m, g) => (g.hospedes.length < m.hospedes.length ? g : m));
      alvo.hospedes.push(...a.hospedes);
    });
  }
  // Hóspedes sem localização: um a um no menor grupo (ou, sem andares, elenco em rodízio).
  if (grupos.length === 0) for (const c of elenco) grupos.push({ cuidadora: c, modulo: null, andar: null, hospedes: [] });
  for (const h of semLocal) {
    const alvo = grupos.reduce((m, g) => (g.hospedes.length < m.hospedes.length ? g : m));
    alvo.hospedes.push(h);
  }
  return grupos;
}

/**
 * Num dia em que parte do elenco não está escalada, os hóspedes das ausentes
 * vão para as presentes — preferindo o mesmo andar, depois o menor grupo.
 */
export function redistribuirAusentes(plano: GrupoRotacao[], presentesIds: Set<string>): GrupoRotacao[] {
  const presentes = plano.filter((g) => presentesIds.has(g.cuidadora.id)).map((g) => ({ ...g, hospedes: [...g.hospedes] }));
  if (presentes.length === 0) return [];
  for (const g of plano) {
    if (presentesIds.has(g.cuidadora.id)) continue;
    for (const h of g.hospedes) {
      const mesmoAndar = presentes.filter((p) => p.modulo === g.modulo && p.andar === g.andar);
      const alvo = (mesmoAndar.length ? mesmoAndar : presentes).reduce((m, p) => (p.hospedes.length < m.hospedes.length ? p : m));
      alvo.hospedes.push(h);
    }
  }
  return presentes;
}

/** Linhas para gravar (residente → cuidadora) a partir do plano do dia. */
export function itensDoPlano(plano: GrupoRotacao[]): { residente_id: string; cuidador_id: string }[] {
  return plano.flatMap((g) => g.hospedes.map((h) => ({ residente_id: h.id, cuidador_id: g.cuidadora.id })));
}
