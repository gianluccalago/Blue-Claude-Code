import type { PerfilUsuario } from "@/types/database";
import {
  Shield,
  Stethoscope,
  ClipboardList,
  HeartHandshake,
  Activity,
  Pill,
  Building2,
  Users,
  BedDouble,
  Apple,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  label: string;
  /** rota dentro do app, ex "/app/cuidador/checklist" */
  to: string;
}

export interface PerfilDef {
  id: PerfilUsuario;
  nome: string;
  descricao: string;
  icon: LucideIcon;
  /** classes tailwind para o "splash" de cor do cartão/ícone */
  cor: string;
  /** rota base ao entrar no app com este perfil */
  rotaInicial: string;
  menu: MenuItem[];
  /** se false, telas reais; se true, mostra "Em construção" */
  emConstrucao: boolean;
}

export const PERFIS: PerfilDef[] = [
  {
    id: "master",
    nome: "Master",
    descricao: "Acesso total ao sistema",
    icon: Shield,
    cor: "bg-secondary text-secondary-foreground",
    rotaInicial: "/app/master",
    menu: [
      { label: "Visão geral", to: "/app/master" },
      { label: "Residentes", to: "/app/master/residentes" },
      { label: "Equipe", to: "/app/master/equipe" },
      { label: "Profissionais", to: "/app/master/profissionais" },
      { label: "Abrir chamado de manutenção", to: "/app/master/chamado-manutencao" },
    ],
    emConstrucao: true,
  },
  {
    id: "medico",
    nome: "Médico Geriatra",
    descricao: "Prescrições e evolução clínica",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/medico/prescricoes",
    menu: [
      { label: "Prescrições", to: "/app/medico/prescricoes" },
      { label: "Painel clínico", to: "/app/medico/escalados" },
      { label: "Evolução", to: "/app/medico/evolucao" },
      { label: "Estoque de resgate", to: "/app/medico/resgate" },
      { label: "Solicitações da família", to: "/app/medico/solicitacoes-familia" },
    ],
    emConstrucao: false,
  },
  {
    id: "coordenacao",
    nome: "Coordenação Assistencial",
    descricao: "Planos de cuidado e equipe",
    icon: ClipboardList,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/coordenacao",
    menu: [
      { label: "Visão geral", to: "/app/coordenacao" },
      { label: "Planos de cuidado", to: "/app/coordenacao/planos" },
      { label: "Modelos de rotina", to: "/app/coordenacao/modelos" },
      { label: "Medicação (enfermagem)", to: "/app/coordenacao/medicacao-enfermagem" },
      { label: "Intercorrências", to: "/app/coordenacao/intercorrencias" },
      { label: "Estoque de resgate", to: "/app/coordenacao/resgate" },
      { label: "Profissionais", to: "/app/coordenacao/profissionais" },
      { label: "Escalas", to: "/app/coordenacao/escalas" },
      { label: "Solicitações da família", to: "/app/coordenacao/solicitacoes-familia" },
      { label: "Abrir chamado de manutenção", to: "/app/coordenacao/chamado-manutencao" },
    ],
    emConstrucao: false,
  },
  {
    id: "cuidador",
    nome: "Cuidadores",
    descricao: "Registro diário à beira do leito",
    icon: HeartHandshake,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/cuidador/checklist",
    menu: [
      { label: "Checklist do turno", to: "/app/cuidador/checklist" },
      { label: "Medicação", to: "/app/cuidador/medicacao" },
      { label: "Compromissos externos", to: "/app/cuidador/compromissos" },
      { label: "Registrar intercorrência", to: "/app/cuidador/intercorrencia" },
      { label: "Meus hóspedes", to: "/app/cuidador/hospedes" },
      { label: "Minha escala", to: "/app/cuidador/minha-escala" },
      { label: "Abrir chamado de manutenção", to: "/app/cuidador/chamado-manutencao" },
    ],
    emConstrucao: false,
  },
  {
    id: "multidisciplinar",
    nome: "Equipe Multidisciplinar",
    descricao: "Fisio, fono, nutrição e psicologia",
    icon: Activity,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/multidisciplinar/atividades",
    menu: [{ label: "Atividades", to: "/app/multidisciplinar/atividades" }],
    emConstrucao: false,
  },
  {
    id: "farmacia",
    nome: "Farmácia",
    descricao: "Dispensação e modelo caixinha",
    icon: Pill,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/farmacia/painel",
    menu: [
      { label: "Painel da farmácia", to: "/app/farmacia/painel" },
      { label: "Estoque por hóspede", to: "/app/farmacia/estoque" },
      { label: "Estoque de resgate", to: "/app/farmacia/resgate" },
      { label: "Dispensação", to: "/app/farmacia/dispensacao" },
    ],
    emConstrucao: false,
  },
  {
    id: "hotelaria",
    nome: "Hotelaria",
    descricao: "Inspeção, manutenção e rouparia",
    icon: BedDouble,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/hotelaria/visao-dia",
    menu: [
      { label: "Painel da Hotelaria", to: "/app/hotelaria/visao-dia" },
      { label: "Inspeção de suítes", to: "/app/hotelaria/inspecao-suites" },
      { label: "Manutenção", to: "/app/hotelaria/manutencao" },
      { label: "Rouparia", to: "/app/hotelaria/rouparia" },
    ],
    emConstrucao: false,
  },
  {
    id: "administracao",
    nome: "Administração",
    descricao: "Financeiro e contratos",
    icon: Building2,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/administracao",
    menu: [
      { label: "Painel da Administração", to: "/app/administracao" },
      { label: "Tabela de preços", to: "/app/administracao/tabela-precos" },
      { label: "Mensalidades", to: "/app/administracao/mensalidades" },
      { label: "Upselling", to: "/app/administracao/upselling" },
      { label: "Demonstrativo mensal", to: "/app/administracao/demonstrativo" },
      { label: "Remuneração da equipe", to: "/app/administracao/remuneracao-equipe" },
      { label: "Custos de pessoal", to: "/app/administracao/custos-pessoal" },
      { label: "Profissionais", to: "/app/administracao/profissionais" },
      { label: "Solicitações da família", to: "/app/administracao/solicitacoes-familia" },
    ],
    emConstrucao: false,
  },
  {
    id: "nutricionista",
    nome: "Nutricionista",
    descricao: "Dietas e acompanhamento nutricional",
    icon: Apple,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/nutricionista/dietas",
    menu: [
      { label: "Dietas", to: "/app/nutricionista/dietas" },
      { label: "Acompanhamento", to: "/app/nutricionista/acompanhamento-nutricional" },
      { label: "Evolução nutricional", to: "/app/nutricionista/evolucao-nutricional" },
    ],
    emConstrucao: false,
  },
  {
    id: "familia",
    nome: "Família / Hóspede",
    descricao: "Portal de acompanhamento",
    icon: Users,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/familia",
    menu: [
      { label: "Início", to: "/app/familia" },
      { label: "Fotos", to: "/app/familia/fotos" },
      { label: "Mensalidade e extras", to: "/app/familia/mensalidade-familia" },
      { label: "Solicitações", to: "/app/familia/solicitacoes" },
      { label: "Câmera do quarto", to: "/app/familia/camera-quarto" },
      { label: "Sinais vitais", to: "/app/familia/sinais-vitais" },
    ],
    emConstrucao: false,
  },
];

export function getPerfil(id: string | undefined): PerfilDef | undefined {
  return PERFIS.find((p) => p.id === id);
}

/** Cuidador padrão da demo (Ana Paula) — id alinhado ao seed SQL. */
export const CUIDADOR_ATUAL = {
  id: "b0000000-0000-0000-0000-000000000004",
  nome: "Ana Paula",
} as const;

/**
 * Colaborador atual da Equipe Multidisciplinar (placeholder até a
 * autenticação por login). Fisioterapeuta, Educador Físico e Terapeuta
 * Ocupacional compartilham as mesmas telas; quando a autenticação por
 * perfil for implementada, cada login usará seu próprio nome aqui.
 */
export const MULTI_ATUAL = {
  nome: "Equipe Multi",
} as const;

/** Nutricionista atual (login próprio, separado da Equipe Multidisciplinar). */
export const NUTRI_ATUAL = {
  nome: "Nutricionista",
} as const;

/** Colaborador atual da Administração (placeholder até a autenticação por login). */
export const ADMIN_ATUAL = {
  nome: "Administração",
} as const;

/**
 * Família/hóspede atual (placeholder até a autenticação por login).
 *
 * SEGURANÇA — LEIA ANTES DE IR A PRODUÇÃO:
 * Hoje o Portal da Família está fixo em UM hóspede (a Profª Alzira, abaixo)
 * apenas para fins de demonstração. A trava real — cada conta de família
 * enxergar SOMENTE o(s) hóspede(s) vinculados a ela — depende da
 * autenticação por login (perfil "familia" + vínculo família↔residente no
 * banco). NÃO HABILITAR ESTE PORTAL EM PRODUÇÃO sem essa trava: sem ela,
 * qualquer família autenticada veria os dados de TODOS os hóspedes
 * (proteção de dados pessoais e de saúde do idoso).
 */
export const FAMILIA_ATUAL = {
  nome: "Família Bittencourt",
  residenteId: "a0000000-0000-0000-0000-000000000001",
} as const;
