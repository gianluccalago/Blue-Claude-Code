export const CONSISTENCIAS = [
  "Normal/livre",
  "Branda",
  "Pastosa",
  "Líquida",
  "Líquido-pastosa (espessada)",
] as const;

export const RESTRICOES_DIETA = [
  "Diabético",
  "Hipossódica",
  "Hipoproteica",
  "Hiperproteica",
  "Hipocalórica",
  "Hipercalórica",
  "Disfagia (espessante)",
  "Enteral (sonda)",
  "Sem lactose",
  "Sem glúten",
] as const;

export const REFEICOES_NUTRI = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
] as const;

export const NIVEIS_ACEITACAO = ["Nada", "Pouco", "Metade", "Quase tudo", "Tudo"] as const;

/** Níveis de aceitação considerados sinal de atenção. */
export const NIVEIS_BAIXOS = new Set<string>(["Nada", "Pouco"]);

/** Mapeia nível de aceitação para variant do Badge. */
export const NIVEL_BADGE: Record<string, "destructive" | "warning" | "muted" | "secondary" | "success"> = {
  Nada: "destructive",
  Pouco: "warning",
  Metade: "muted",
  "Quase tudo": "secondary",
  Tudo: "success",
};

/** Extrai {refeicao, nivel} de uma tarefa "Aceitação <refeição>: <nível>". */
export function parseAceitacao(tarefa: string): { refeicao: string; nivel: string } | null {
  const m = tarefa.match(/^Aceitação (.+): (.+)$/);
  if (!m) return null;
  return { refeicao: m[1], nivel: m[2] };
}
