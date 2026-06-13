import {
  Shield,
  Stethoscope,
  ClipboardList,
  HeartHandshake,
  Activity,
  Apple,
  Pill,
  Building2,
  BedDouble,
  Wrench,
  Shirt,
  Users,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// MASTER-3 · Metadados dos perfis do sistema para a gestão de usuários.
//
// Este módulo descreve OS 12 PERFIS que o Master cria/edita e os campos
// condicionais de cada um. É a base da autenticação que será ligada depois:
// o email será o login e cada perfil cairá direto nas suas telas (sem a tela
// de seleção de perfil). Mantém compatibilidade com o schema atual — o grupo
// "Cuidadores / Enfermagem" deriva o perfil de banco da função escolhida
// (Cuidadora → cuidador; Téc. Enfermagem / Enfermeira → enfermagem), como já
// faz o módulo de Escalas.
// ===========================================================================

/**
 * Valor do SELETOR de perfil no formulário (12 opções). Para o grupo de
 * cuidados usamos "cuidador" como base; o perfil real ('cuidador' ou
 * 'enfermagem') é derivado da função na hora de salvar.
 */
export type PerfilSeletor =
  | "master"
  | "medico"
  | "coordenacao"
  | "cuidador"
  | "multidisciplinar"
  | "nutricionista"
  | "farmacia"
  | "administracao"
  | "direcao"
  | "hotelaria"
  | "servicos_gerais"
  | "lavanderia"
  | "familia";

export interface ConfigPerfil {
  value: PerfilSeletor;
  label: string;
  icon: LucideIcon;
  /** Opções de função (quando há seletor de função). */
  funcoes?: string[];
  /** Função fixa/implícita (sem seletor), ex: Nutricionista. */
  funcaoFixa?: string;
  /** Cargos sugeridos no combobox (além de funcoes/funcaoFixa). Não restringem:
   *  o Master pode escolher um destes OU digitar um cargo novo. */
  cargosSugeridos?: string[];
  /** Rótulo do campo de registro profissional (CRM/COREN/CREFITO/CRN…). */
  registroLabel?: string;
  /** No grupo de cuidados, o COREN só vale para enfermagem (não p/ Cuidadora). */
  registroSomenteEnfermagem?: boolean;
  mostraVinculo?: boolean;
  mostraRemuneracao?: boolean;
  mostraIsentoPonto?: boolean;
  /** Família: vincula a um residente (obrigatório). */
  vinculaResidente?: boolean;
}

/** Os 12 perfis, na ordem do seletor. */
export const PERFIS_SISTEMA: ConfigPerfil[] = [
  { value: "master", label: "Master", icon: Shield, cargosSugeridos: ["Diretor Geral", "Administrador"] },
  {
    value: "medico",
    label: "Médico Geriatra",
    icon: Stethoscope,
    registroLabel: "Registro (CRM)",
    cargosSugeridos: ["Médico Geriatra", "Médica Geriatra", "Clínico Geral", "Psiquiatra"],
  },
  {
    value: "coordenacao",
    label: "Coordenação Assistencial",
    icon: ClipboardList,
    cargosSugeridos: ["Coordenadora Assistencial", "Coordenador Assistencial", "Enfermeira Coordenadora"],
  },
  {
    value: "cuidador",
    label: "Cuidadores / Enfermagem",
    icon: HeartHandshake,
    funcoes: ["Cuidadora", "Técnica de Enfermagem", "Enfermeira"],
    cargosSugeridos: ["Cuidador", "Cuidadora Líder", "Técnico de Enfermagem", "Enfermeiro"],
    registroLabel: "Registro (COREN)",
    registroSomenteEnfermagem: true,
    mostraVinculo: true,
    mostraRemuneracao: true,
    mostraIsentoPonto: true,
  },
  {
    value: "multidisciplinar",
    label: "Equipe Multidisciplinar",
    icon: Activity,
    funcoes: ["Fisioterapeuta", "Educador Físico", "Terapeuta Ocupacional"],
    cargosSugeridos: ["Fonoaudióloga", "Fonoaudiólogo", "Psicóloga", "Psicólogo", "Assistente Social"],
    registroLabel: "Registro (CREFITO / CREF)",
    mostraVinculo: true,
    mostraRemuneracao: true,
  },
  {
    value: "nutricionista",
    label: "Nutricionista",
    icon: Apple,
    funcaoFixa: "Nutricionista",
    cargosSugeridos: ["Nutricionista", "Nutricionista Clínica"],
    registroLabel: "Registro (CRN)",
    mostraVinculo: true,
    mostraRemuneracao: true,
  },
  {
    value: "farmacia",
    label: "Farmácia",
    icon: Pill,
    cargosSugeridos: ["Farmacêutico", "Farmacêutica", "Auxiliar de Farmácia"],
  },
  {
    value: "administracao",
    label: "Administração",
    icon: Building2,
    cargosSugeridos: ["Administradora", "Administrador", "Financeiro", "Recepcionista"],
  },
  {
    value: "direcao",
    label: "Direção",
    icon: Briefcase,
    cargosSugeridos: ["Diretor", "Diretora", "Diretor Executivo", "Sócio-Diretor"],
  },
  {
    value: "hotelaria",
    label: "Hotelaria",
    icon: BedDouble,
    cargosSugeridos: ["Supervisor de Hotelaria", "Governanta", "Camareira", "Cozinha"],
  },
  {
    value: "servicos_gerais",
    label: "Serviços Gerais",
    icon: Wrench,
    cargosSugeridos: ["Manutenção Predial", "Técnico de Manutenção", "Zelador", "Eletricista", "Encanador"],
  },
  {
    value: "lavanderia",
    label: "Lavanderia",
    icon: Shirt,
    cargosSugeridos: ["Lavanderia", "Rouparia", "Auxiliar de Lavanderia", "Passadeira"],
  },
  { value: "familia", label: "Família / Hóspede", icon: Users, vinculaResidente: true },
];

/** Config do seletor pelo valor. */
export function configPerfil(value: PerfilSeletor): ConfigPerfil {
  return PERFIS_SISTEMA.find((p) => p.value === value) ?? PERFIS_SISTEMA[0];
}

/** Rótulo amigável para QUALQUER perfil do banco (inclui 'enfermagem'). */
export const PERFIL_LABEL: Record<PerfilUsuario, string> = {
  master: "Master",
  medico: "Médico Geriatra",
  coordenacao: "Coordenação Assistencial",
  cuidador: "Cuidador(a)",
  enfermagem: "Enfermagem",
  multidisciplinar: "Equipe Multidisciplinar",
  nutricionista: "Nutricionista",
  farmacia: "Farmácia",
  administracao: "Administração",
  direcao: "Direção",
  hotelaria: "Hotelaria",
  servicos_gerais: "Serviços Gerais",
  lavanderia: "Lavanderia",
  familia: "Família / Hóspede",
};

/**
 * Mapeia o perfil do banco para o VALOR do seletor (grupo). Usado ao abrir um
 * usuário existente no formulário: 'enfermagem' volta para o grupo "cuidador".
 */
export function perfilParaSeletor(perfil: PerfilUsuario): PerfilSeletor {
  if (perfil === "enfermagem") return "cuidador";
  return perfil as PerfilSeletor;
}

/**
 * Deriva o perfil REAL do banco a partir do seletor + função. Só o grupo de
 * cuidados se desdobra em dois perfis: cargos de ENFERMAGEM (enfermeira(o),
 * enfermagem, técnico(a) de enfermagem) → 'enfermagem'; os demais (cuidadora,
 * cuidador, cuidadora líder, cargos personalizados…) → 'cuidador'. A heurística
 * por palavra-chave permite CARGOS PERSONALIZADOS sem quebrar a separação e é
 * compatível com os cargos antigos (Cuidadora→cuidador; Téc./Enfermeira→enfermagem).
 */
export function perfilDoBanco(seletor: PerfilSeletor, funcao: string | null): PerfilUsuario {
  if (seletor === "cuidador") {
    return /enferm|t[eé]c/i.test(funcao ?? "") ? "enfermagem" : "cuidador";
  }
  return seletor;
}

/** Perfis do banco que pertencem ao grupo "Cuidadores / Enfermagem". */
export const PERFIS_GRUPO_CUIDADO: PerfilUsuario[] = ["cuidador", "enfermagem"];
