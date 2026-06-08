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
    ],
    emConstrucao: true,
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
      { label: "Alertas", to: "/app/coordenacao/alertas" },
    ],
    emConstrucao: true,
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
    ],
    emConstrucao: false,
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

/** Cuidador padrão da demo (Ana Paula) — id alinhado ao seed SQL. */
export const CUIDADOR_ATUAL = {
  id: "b0000000-0000-0000-0000-000000000004",
  nome: "Ana Paula",
} as const;
