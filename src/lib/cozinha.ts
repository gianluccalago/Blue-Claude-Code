import type {
  CozinhaEscala,
  CozinhaFuncionario,
  FuncaoCozinha,
  GrupoCozinha,
  TurnoCozinha,
} from "@/types/database";

// ===========================================================================
// Escala da cozinha (BLOCO N5) — regras do domínio.
//
// IMPORTANTE: esta escala é INDEPENDENTE do módulo de Escalas assistenciais
// (cuidadores) e do PONTO. Serve só ao controle interno da Nutricionista; o
// campo `presente` é opcional e NÃO é ponto CLT.
//
// Operação fixa: dois grupos por paridade do dia (pares × ímpares), 5 pessoas
// por dia, em turnos fixos. Como turno e grupo são fixos por pessoa, a escala
// se monta sozinha a partir do cadastro.
// ===========================================================================

export const TURNOS_COZINHA: TurnoCozinha[] = ["06:30-18:30", "09:30-21:30", "08:00-20:00"];

export const FUNCAO_COZINHA_LABEL: Record<FuncaoCozinha, string> = {
  cozinheiro: "Cozinheiro",
  auxiliar: "Auxiliar",
};

export const GRUPO_COZINHA_LABEL: Record<GrupoCozinha, string> = {
  par: "Dias pares",
  impar: "Dias ímpares",
};

/** Necessidade FIXA de cada turno (quantos de cada função o turno exige). */
export const NECESSIDADE_TURNO: Record<TurnoCozinha, Record<FuncaoCozinha, number>> = {
  "06:30-18:30": { cozinheiro: 1, auxiliar: 1 },
  "09:30-21:30": { cozinheiro: 1, auxiliar: 1 },
  "08:00-20:00": { cozinheiro: 1, auxiliar: 0 },
};

/** Início/fim de um turno "HH:MM-HH:MM". */
export function partesTurno(turno: string): { inicio: string; fim: string } {
  const [inicio = "", fim = ""] = turno.split("-");
  return { inicio, fim };
}

/** Paridade do DIA DO MÊS → grupo que trabalha (par/ímpar). */
export function grupoDoDia(dataISO: string): GrupoCozinha {
  const dia = Number(dataISO.slice(8, 10));
  return dia % 2 === 0 ? "par" : "impar";
}

/** Linha de escala que ainda não existe e precisaria ser criada para um dia. */
export interface NovaEscala {
  funcionario_id: string;
  data: string;
  inicio: string;
  fim: string;
}

/**
 * Gera as linhas de escala FALTANTES para um período [de, ate] (datas ISO,
 * inclusivas). Para cada dia, escala o grupo cuja paridade casa com o dia, cada
 * funcionário ativo no seu turno padrão. Não duplica o que já existe.
 */
export function gerarEscalaPeriodo(
  de: string,
  ate: string,
  funcionarios: CozinhaFuncionario[],
  existentes: CozinhaEscala[],
): NovaEscala[] {
  const jaTem = new Set(existentes.map((e) => `${e.funcionario_id}|${e.data}`));
  const ativos = funcionarios.filter((f) => f.ativo);
  const novas: NovaEscala[] = [];

  for (const data of diasNoIntervalo(de, ate)) {
    const grupo = grupoDoDia(data);
    for (const f of ativos) {
      if (f.grupo !== grupo) continue;
      if (jaTem.has(`${f.id}|${data}`)) continue;
      const { inicio, fim } = partesTurno(f.turno_padrao);
      novas.push({ funcionario_id: f.id, data, inicio, fim });
    }
  }
  return novas;
}

/** Lista de datas ISO (YYYY-MM-DD) de `de` até `ate`, inclusivas. */
export function diasNoIntervalo(de: string, ate: string): string[] {
  const out: string[] = [];
  const [ay, am, ad] = de.split("-").map(Number);
  const cursor = new Date(ay, am - 1, ad);
  const fim = (() => {
    const [by, bm, bd] = ate.split("-").map(Number);
    return new Date(by, bm - 1, bd);
  })();
  while (cursor <= fim) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface CoberturaTurno {
  turno: TurnoCozinha;
  /** Escalas presentes neste turno, por função (exclui faltas marcadas). */
  contagem: Record<FuncaoCozinha, number>;
  /** Quantos faltam para cobrir a necessidade, por função. */
  faltam: Record<FuncaoCozinha, number>;
  descoberto: boolean;
}

export interface CoberturaDia {
  data: string;
  grupo: GrupoCozinha;
  turnos: CoberturaTurno[];
  /** Algum turno obrigatório ficou descoberto. */
  algumDescoberto: boolean;
}

/**
 * Cobertura de um dia: cruza as escalas (com a função do funcionário) contra a
 * necessidade fixa de cada turno. Quem está marcado como FALTA (presente=false)
 * não conta para a cobertura — é o alerta visual de turno descoberto.
 */
export function coberturaDoDia(
  data: string,
  escalas: CozinhaEscala[],
  funcionarioPorId: Map<string, CozinhaFuncionario>,
): CoberturaDia {
  const doDia = escalas.filter((e) => e.data === data);
  const turnos = TURNOS_COZINHA.map((turno) => {
    const { inicio } = partesTurno(turno);
    const contagem: Record<FuncaoCozinha, number> = { cozinheiro: 0, auxiliar: 0 };
    for (const e of doDia) {
      if (e.inicio !== inicio) continue;
      if (e.presente === false) continue; // falta marcada não cobre
      const func = funcionarioPorId.get(e.funcionario_id)?.funcao;
      if (func) contagem[func] += 1;
    }
    const need = NECESSIDADE_TURNO[turno];
    const faltam: Record<FuncaoCozinha, number> = {
      cozinheiro: Math.max(0, need.cozinheiro - contagem.cozinheiro),
      auxiliar: Math.max(0, need.auxiliar - contagem.auxiliar),
    };
    return {
      turno,
      contagem,
      faltam,
      descoberto: faltam.cozinheiro > 0 || faltam.auxiliar > 0,
    };
  });
  return {
    data,
    grupo: grupoDoDia(data),
    turnos,
    algumDescoberto: turnos.some((t) => t.descoberto),
  };
}
