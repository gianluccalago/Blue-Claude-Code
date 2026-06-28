import type { PeriodoMedicacao, ViaMedicacao } from "@/types/database";

// ===========================================================================
// EVOLUÇÃO DE ADMISSÃO — avaliação geriátrica inicial estruturada. Modelo dos
// dados (jsonb) + constantes + narrativa (para o histórico de evoluções e PDF).
// ===========================================================================

export interface MedAdmissao {
  medicamento: string;
  dose: string;
  via: ViaMedicacao;
  posologia: string;
  periodos: PeriodoMedicacao[];
  quantidade: string; // quantidade por administração (ex.: "1 comprimido")
}

export interface DadosAdmissao {
  // 1 · Identificação e motivo
  dataAdmissao: string;
  motivoOrigem: string;
  encaminhadoPor: string;
  motivoTexto: string;
  // 2 · História clínica
  hma: string;
  comorbidades: string[];
  cirurgiasPrevias: string;
  alergias: string;
  internacoesRecentes: string;
  // 3 · Medicações em uso contínuo
  medicacoes: MedAdmissao[];
  // 4 · História funcional prévia
  deambulacao: string;
  avds: string;
  continencia: string;
  comunicacao: string;
  dispositivos: string[];
  dispositivosOutros: string;
  // 5 · Avaliação por sistemas / exame físico
  sisCardio: string;
  sisResp: string;
  sisGi: string;
  sisGu: string;
  sisNeuro: string;
  sisMusculo: string;
  sisPele: string;
  pa: string;
  fc: string;
  fr: string;
  temp: string;
  satO2: string;
  peso: string;
  altura: string;
  // 6 · Cognitiva e humor
  cognitivoGeral: string;
  testesCognitivos: string;
  humorComportamento: string;
  // 7 · Social e familiar
  suporteFamiliar: string;
  redeApoio: string;
  aspectosSociais: string;
  // 8 · Impressão e plano
  impressaoDiagnostica: string;
  hipoteses: string;
  condutaPlano: string;
  encaminhamentos: string;
}

export const MOTIVO_ORIGEM: { value: string; label: string }[] = [
  { value: "domicilio", label: "Domicílio" },
  { value: "alta_hospitalar", label: "Alta hospitalar (pós-internação/cirurgia)" },
  { value: "outro_residencial", label: "Outro residencial / ILPI" },
  { value: "outro", label: "Outro" },
];

export const DISPOSITIVOS = [
  "Bengala", "Andador", "Cadeira de rodas", "Óculos", "Aparelho auditivo", "Prótese dentária", "Prótese (membro)", "Sonda", "Fralda",
];

export const VIA_LABEL: Record<ViaMedicacao, string> = {
  oral: "Oral", injetavel: "Injetável", insulina: "Insulina (SC)", sonda: "Sonda",
};

export const PERIODO_LABEL: Record<PeriodoMedicacao, string> = {
  jejum: "Jejum", manha: "Manhã", almoco: "Almoço", apos_almoco: "Após almoço", tarde: "Tarde", noite: "Noite",
};
export const PERIODOS_ORDEM: PeriodoMedicacao[] = ["jejum", "manha", "almoco", "apos_almoco", "tarde", "noite"];

export function medVazia(): MedAdmissao {
  return { medicamento: "", dose: "", via: "oral", posologia: "1x/dia", periodos: ["manha"], quantidade: "1 comprimido" };
}

export function dadosAdmissaoVazios(dataAdmissao: string): DadosAdmissao {
  return {
    dataAdmissao, motivoOrigem: "domicilio", encaminhadoPor: "", motivoTexto: "",
    hma: "", comorbidades: [], cirurgiasPrevias: "", alergias: "", internacoesRecentes: "",
    medicacoes: [],
    deambulacao: "", avds: "", continencia: "", comunicacao: "", dispositivos: [], dispositivosOutros: "",
    sisCardio: "", sisResp: "", sisGi: "", sisGu: "", sisNeuro: "", sisMusculo: "", sisPele: "",
    pa: "", fc: "", fr: "", temp: "", satO2: "", peso: "", altura: "",
    cognitivoGeral: "", testesCognitivos: "", humorComportamento: "",
    suporteFamiliar: "", redeApoio: "", aspectosSociais: "",
    impressaoDiagnostica: "", hipoteses: "", condutaPlano: "", encaminhamentos: "",
  };
}

const ni = (s: string | null | undefined) => (s && s.trim() ? s.trim() : "Não informado");

/** IMC a partir de peso (kg) e altura (m) em texto. null se faltar/ inválido. */
export function imcDeTexto(peso: string, altura: string): number | null {
  const p = Number(String(peso).replace(",", "."));
  const a = Number(String(altura).replace(",", "."));
  if (!Number.isFinite(p) || !Number.isFinite(a) || p <= 0 || a <= 0) return null;
  return Math.round((p / (a * a)) * 10) / 10;
}

/** Narrativa textual da admissão (histórico de evoluções e corpo do PDF). */
export function montarTextoAdmissao(d: DadosAdmissao): string {
  const linhas: string[] = [];
  const sec = (t: string) => linhas.push(`\n${t.toUpperCase()}`);
  const campo = (r: string, v: string) => linhas.push(`${r}: ${ni(v)}`);

  sec("1. Identificação e motivo da admissão");
  campo("Data da avaliação", d.dataAdmissao);
  campo("Origem", MOTIVO_ORIGEM.find((m) => m.value === d.motivoOrigem)?.label ?? d.motivoOrigem);
  campo("Encaminhado por", d.encaminhadoPor);
  campo("Motivo", d.motivoTexto);

  sec("2. História clínica");
  campo("HMA / condição atual", d.hma);
  campo("Comorbidades", d.comorbidades.length ? d.comorbidades.join("; ") : "");
  campo("Cirurgias prévias", d.cirurgiasPrevias);
  campo("Alergias", d.alergias);
  campo("Internações recentes", d.internacoesRecentes);

  sec("3. Medicações em uso contínuo");
  if (d.medicacoes.length === 0) linhas.push("Não informado");
  else
    d.medicacoes.forEach((m) =>
      linhas.push(
        `• ${m.medicamento}${m.dose ? ` ${m.dose}` : ""} — ${VIA_LABEL[m.via]} — ${ni(m.posologia)} (${m.periodos.map((p) => PERIODO_LABEL[p]).join(", ")})`,
      ),
    );

  sec("4. História funcional prévia");
  campo("Deambulação", d.deambulacao);
  campo("AVDs", d.avds);
  campo("Continência", d.continencia);
  campo("Comunicação", d.comunicacao);
  campo("Dispositivos", [...d.dispositivos, d.dispositivosOutros].filter(Boolean).join(", "));

  sec("5. Avaliação por sistemas / exame físico");
  campo("Cardiovascular", d.sisCardio);
  campo("Respiratório", d.sisResp);
  campo("Gastrointestinal", d.sisGi);
  campo("Geniturinário", d.sisGu);
  campo("Neurológico", d.sisNeuro);
  campo("Musculoesquelético", d.sisMusculo);
  campo("Pele / feridas", d.sisPele);
  const imc = imcDeTexto(d.peso, d.altura);
  linhas.push(
    `Sinais vitais: PA ${ni(d.pa)} · FC ${ni(d.fc)} · FR ${ni(d.fr)} · Tax ${ni(d.temp)} · SatO2 ${ni(d.satO2)}`,
  );
  linhas.push(`Peso ${ni(d.peso)}kg · Altura ${ni(d.altura)}m · IMC ${imc ?? "Não informado"}`);

  sec("6. Avaliação cognitiva e de humor");
  campo("Cognição (geral)", d.cognitivoGeral);
  campo("Testes (MEEM/MoCA/IVCF)", d.testesCognitivos);
  campo("Humor / comportamento", d.humorComportamento);

  sec("7. Avaliação social e familiar");
  campo("Suporte familiar", d.suporteFamiliar);
  campo("Rede de apoio", d.redeApoio);
  campo("Aspectos relevantes", d.aspectosSociais);

  sec("8. Impressão diagnóstica e plano inicial");
  campo("Impressão diagnóstica", d.impressaoDiagnostica);
  campo("Hipóteses / diagnósticos", d.hipoteses);
  campo("Conduta e plano inicial", d.condutaPlano);
  campo("Encaminhamentos", d.encaminhamentos);

  return linhas.join("\n").trim();
}
