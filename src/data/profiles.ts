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
  Wrench,
  Shirt,
  Users,
  Briefcase,
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
      { label: "Hóspedes", to: "/app/master/residentes" },
      { label: "Equipe", to: "/app/master/equipe" },
      { label: "Tabela de preços", to: "/app/master/tabela-precos" },
      { label: "Serviços", to: "/app/master/servicos" },
      { label: "Resultados NPS", to: "/app/master/resultados-nps" },
      { label: "CRM", to: "/app/master/crm" },
      { label: "Profissionais", to: "/app/master/profissionais" },
      { label: "Abrir chamado de manutenção", to: "/app/master/chamado-manutencao" },
    ],
    emConstrucao: false,
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
      { label: "Hóspedes", to: "/app/medico/ficha" },
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
    // Ordenado por frequência de uso no dia a dia da coordenação.
    menu: [
      { label: "Visão geral", to: "/app/coordenacao" },
      { label: "Hóspedes", to: "/app/coordenacao/ficha" },
      { label: "Medicação (enfermagem)", to: "/app/coordenacao/medicacao-enfermagem" },
      { label: "Intercorrências", to: "/app/coordenacao/intercorrencias" },
      { label: "Solicitações da família", to: "/app/coordenacao/solicitacoes-familia" },
      { label: "Escalas", to: "/app/coordenacao/escalas" },
      { label: "Planos de cuidado", to: "/app/coordenacao/planos" },
      { label: "Modelos de rotina", to: "/app/coordenacao/modelos" },
      { label: "Pesquisa NPS", to: "/app/coordenacao/pesquisa-nps" },
      { label: "Estoque de resgate", to: "/app/coordenacao/resgate" },
      { label: "Profissionais", to: "/app/coordenacao/profissionais" },
      { label: "Abrir chamado de manutenção", to: "/app/coordenacao/chamado-manutencao" },
    ],
    emConstrucao: false,
  },
  {
    // ENFERMEIRA: versão OPERACIONAL (reduzida) da Coordenação. Mesmo poder de
    // ação no assistencial do dia (pendências/alertas, medicação de enfermagem,
    // baixa de resgate), mas SEM chefia: planos só leitura; sem escalas,
    // modelos, profissionais, solicitações da família, NPS nem financeiro.
    // Reaproveita as telas/rotas flat da Coordenação.
    id: "enfermeira",
    nome: "Enfermeira",
    descricao: "Assistencial do dia (sem funções de gestão)",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/enfermeira",
    menu: [
      { label: "Visão geral", to: "/app/enfermeira" },
      { label: "Hóspedes", to: "/app/enfermeira/ficha" },
      { label: "Medicação (enfermagem)", to: "/app/enfermeira/medicacao-enfermagem" },
      { label: "Intercorrências", to: "/app/enfermeira/intercorrencias" },
      { label: "Planos de cuidado", to: "/app/enfermeira/planos" },
      { label: "Estoque de resgate", to: "/app/enfermeira/resgate" },
      { label: "Abrir chamado de manutenção", to: "/app/enfermeira/chamado-manutencao" },
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
    // Enfermagem (Téc. de Enfermagem / Enfermeira): mesmo fluxo de ponta da
    // cuidadora (checklist, medicação oral, compromissos, intercorrências,
    // hóspedes, escala) E TAMBÉM a administração das medicações exclusivas de
    // enfermagem (injetável, insulina SC, sonda) — a mesma tela já usada pela
    // Coordenação. Reaproveita as rotas existentes (roteamento por $perfil).
    id: "enfermagem",
    nome: "Enfermagem",
    descricao: "Procedimentos e administração de medicação",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/enfermagem/checklist",
    menu: [
      { label: "Checklist do turno", to: "/app/enfermagem/checklist" },
      { label: "Medicação", to: "/app/enfermagem/medicacao" },
      { label: "Medicação de enfermagem", to: "/app/enfermagem/medicacao-enfermagem" },
      { label: "Compromissos externos", to: "/app/enfermagem/compromissos" },
      { label: "Registrar intercorrência", to: "/app/enfermagem/intercorrencia" },
      { label: "Meus hóspedes", to: "/app/enfermagem/hospedes" },
      { label: "Minha escala", to: "/app/enfermagem/minha-escala" },
      { label: "Abrir chamado de manutenção", to: "/app/enfermagem/chamado-manutencao" },
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
    menu: [
      { label: "Atividades", to: "/app/multidisciplinar/atividades" },
      { label: "Hóspedes", to: "/app/multidisciplinar/ficha" },
      { label: "Pesquisa NPS", to: "/app/multidisciplinar/pesquisa-nps" },
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
      { label: "Hóspedes", to: "/app/nutricionista/ficha" },
      { label: "Acompanhamento", to: "/app/nutricionista/acompanhamento-nutricional" },
      { label: "Evolução nutricional", to: "/app/nutricionista/evolucao-nutricional" },
      { label: "Pesquisa NPS", to: "/app/nutricionista/pesquisa-nps" },
    ],
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
      { label: "Hóspedes", to: "/app/farmacia/ficha" },
      { label: "Pedidos mensais", to: "/app/farmacia/pedidos-mensais" },
      { label: "Custos de medicamento", to: "/app/farmacia/custos-medicamento" },
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
      { label: "Hóspedes", to: "/app/hotelaria/ficha" },
      { label: "Inspeção de suítes", to: "/app/hotelaria/inspecao-suites" },
      // Manutenção da Hotelaria: só os chamados direcionados a ela (governança/
      // limpeza). A predial/corretiva é de Serviços Gerais.
      { label: "Manutenção", to: "/app/hotelaria/manutencao" },
    ],
    emConstrucao: false,
  },
  {
    // SERVIÇOS GERAIS: manutenção predial/corretiva. Herdou da Hotelaria o
    // módulo de chamados de manutenção (reusa a rota flat /manutencao).
    id: "servicos_gerais",
    nome: "Serviços Gerais",
    descricao: "Manutenção predial e corretiva",
    icon: Wrench,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/servicos_gerais/manutencao",
    menu: [
      { label: "Manutenção", to: "/app/servicos_gerais/manutencao" },
    ],
    emConstrucao: false,
  },
  {
    // LAVANDERIA: rouparia/enxoval. Herdou da Hotelaria o módulo de rouparia
    // (reusa a rota flat /rouparia e a tabela rouparia_transito).
    id: "lavanderia",
    nome: "Lavanderia",
    descricao: "Rouparia e enxoval",
    icon: Shirt,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/lavanderia/rouparia",
    menu: [
      { label: "Rouparia", to: "/app/lavanderia/rouparia" },
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
      { label: "Hóspedes", to: "/app/administracao/ficha" },
      { label: "Serviços", to: "/app/administracao/servicos" },
      { label: "Resultados NPS", to: "/app/administracao/resultados-nps" },
      { label: "Tabela de preços", to: "/app/administracao/tabela-precos" },
      { label: "Mensalidades", to: "/app/administracao/mensalidades" },
      { label: "Cobrança", to: "/app/administracao/cobranca" },
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
    // DIREÇÃO: mesma operação da Administração + o módulo CRM (comercial).
    // É o único perfil, junto do Master, com acesso ao funil de admissão.
    id: "direcao",
    nome: "Direção",
    descricao: "Gestão executiva, financeiro e CRM comercial",
    icon: Briefcase,
    cor: "bg-secondary text-secondary-foreground",
    rotaInicial: "/app/direcao",
    menu: [
      { label: "Painel da Direção", to: "/app/direcao" },
      { label: "Hóspedes", to: "/app/direcao/ficha" },
      { label: "CRM", to: "/app/direcao/crm" },
      { label: "Tabela de preços", to: "/app/direcao/tabela-precos" },
      { label: "Mensalidades", to: "/app/direcao/mensalidades" },
      { label: "Upselling", to: "/app/direcao/upselling" },
      { label: "Demonstrativo mensal", to: "/app/direcao/demonstrativo" },
      { label: "Remuneração da equipe", to: "/app/direcao/remuneracao-equipe" },
      { label: "Custos de pessoal", to: "/app/direcao/custos-pessoal" },
      { label: "Profissionais", to: "/app/direcao/profissionais" },
      { label: "Solicitações da família", to: "/app/direcao/solicitacoes-familia" },
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

// ---------------------------------------------------------------------------
// Identidade do usuário atual (autenticado) — usada pelos registros de cada
// perfil (feito_por, registrado_por, definida_por, lancado_por…). Antes eram
// placeholders fixos; agora apontam para o objeto mutável que o AuthProvider
// sincroniza com o usuário AUTENTICADO. Família usa residenteId = residente
// vinculado, garantindo que cada família veja só o seu hóspede.
// ---------------------------------------------------------------------------
export { usuarioAtual as CUIDADOR_ATUAL } from "@/auth/usuarioAtual";
export { usuarioAtual as MULTI_ATUAL } from "@/auth/usuarioAtual";
export { usuarioAtual as NUTRI_ATUAL } from "@/auth/usuarioAtual";
export { usuarioAtual as ADMIN_ATUAL } from "@/auth/usuarioAtual";
export { familiaAtual as FAMILIA_ATUAL } from "@/auth/usuarioAtual";
