import type { PerfilUsuario } from "@/types/database";
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
  Users,
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
      { label: "Painel estratégico", to: "/app/master" },
      { label: "Visão do hóspede (360°)", to: "/app/master/hospede" },
      { label: "Painel operacional", to: "/app/master/operacional" },
      { label: "Supervisão clínica", to: "/app/master/clinica" },
      { label: "Usuários e acessos", to: "/app/master/usuarios" },
      { label: "Residentes", to: "/app/master/residentes" },
      { label: "Equipe", to: "/app/master/equipe" },
      { label: "Profissionais", to: "/app/master/profissionais" },
    ],
    // O Painel estratégico (Visão geral inicial) já é tela real; as demais
    // sub-rotas do Master serão construídas nas próximas etapas (MASTER-2+).
    emConstrucao: false,
  },
  {
    id: "medico",
    nome: "Médico Geriatra",
    descricao: "Prescrições e evolução clínica",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/medico",
    menu: [
      { label: "Visão geral", to: "/app/medico" },
      { label: "Prescrições", to: "/app/medico/prescricoes" },
      { label: "Evolução", to: "/app/medico/evolucao" },
    ],
    emConstrucao: true,
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
      { label: "Profissionais", to: "/app/coordenacao/profissionais" },
      { label: "Escalas", to: "/app/coordenacao/escalas" },
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
    ],
    emConstrucao: false,
  },
  {
    // Enfermagem é um perfil de login (Téc. de Enfermagem / Enfermeira). As
    // telas próprias ainda serão construídas; por ora cai em "Em construção".
    id: "enfermagem",
    nome: "Enfermagem",
    descricao: "Procedimentos e administração de medicação",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/enfermagem",
    menu: [{ label: "Visão geral", to: "/app/enfermagem" }],
    emConstrucao: true,
  },
  {
    id: "multidisciplinar",
    nome: "Equipe Multidisciplinar",
    descricao: "Fisio, fono, nutrição e psicologia",
    icon: Activity,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/multidisciplinar",
    menu: [
      { label: "Visão geral", to: "/app/multidisciplinar" },
      { label: "Atendimentos", to: "/app/multidisciplinar/atendimentos" },
    ],
    emConstrucao: true,
  },
  {
    id: "nutricionista",
    nome: "Nutricionista",
    descricao: "Dietas e avaliação nutricional",
    icon: Apple,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/nutricionista",
    menu: [
      { label: "Visão geral", to: "/app/nutricionista" },
      { label: "Dietas", to: "/app/nutricionista/dietas" },
    ],
    emConstrucao: true,
  },
  {
    id: "farmacia",
    nome: "Farmácia",
    descricao: "Dispensação e modelo caixinha",
    icon: Pill,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/farmacia",
    menu: [
      { label: "Visão geral", to: "/app/farmacia" },
      { label: "Dispensação", to: "/app/farmacia/dispensacao" },
    ],
    emConstrucao: true,
  },
  {
    id: "administracao",
    nome: "Administração",
    descricao: "Financeiro e contratos",
    icon: Building2,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/administracao",
    menu: [
      { label: "Visão geral", to: "/app/administracao" },
      { label: "Financeiro", to: "/app/administracao/financeiro" },
      { label: "Profissionais", to: "/app/administracao/profissionais" },
    ],
    emConstrucao: true,
  },
  {
    id: "hotelaria",
    nome: "Hotelaria",
    descricao: "Limpeza, rouparia e inspeção",
    icon: BedDouble,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/hotelaria",
    menu: [
      { label: "Visão geral", to: "/app/hotelaria" },
      { label: "Inspeção de suítes", to: "/app/hotelaria/inspecao" },
    ],
    emConstrucao: true,
  },
  {
    id: "familia",
    nome: "Família / Hóspede",
    descricao: "Portal de acompanhamento",
    icon: Users,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/familia",
    menu: [
      { label: "Visão geral", to: "/app/familia" },
      { label: "Acompanhamento", to: "/app/familia/acompanhamento" },
    ],
    emConstrucao: true,
  },
];

export function getPerfil(id: string | undefined): PerfilDef | undefined {
  return PERFIS.find((p) => p.id === id);
}

/**
 * Identidade do usuário atual usada pelos registros (feito_por, registrado_por,
 * ponto/plantão etc.). Antes era a Ana Paula fixa; agora aponta para o objeto
 * mutável que o AuthProvider sincroniza com o usuário AUTENTICADO. Os hooks que
 * já liam CUIDADOR_ATUAL.id/.nome passam a registrar o usuário logado.
 */
export { usuarioAtual as CUIDADOR_ATUAL } from "@/auth/usuarioAtual";
