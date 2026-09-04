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
  HardHat,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  label: string;
  /** rota dentro do app, ex "/app/cuidador/checklist" */
  to: string;
  /**
   * Seção do menu (cabeçalho na sidebar). Opcional: itens sem `grupo` são
   * renderizados na lista plana de sempre. Hoje só o Master agrupa o menu.
   */
  grupo?: string;
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
    // Menu curado em 5 seções (Operacional → Estratégico → Comercial →
    // Financeiro → Sistema). "Hóspedes" agrega ativos+inativos em sub-abas e
    // "Equipe e acessos" funde usuários/profissionais/equipe em abas.
    menu: [
      // OPERACIONAL
      { label: "Painel operacional", to: "/app/master/operacional", grupo: "Operacional" },
      { label: "Supervisão clínica", to: "/app/master/clinica", grupo: "Operacional" },
      { label: "Visão do hóspede (360°)", to: "/app/master/hospede", grupo: "Operacional" },
      { label: "Hóspedes", to: "/app/master/residentes", grupo: "Operacional" },
      { label: "Day Care", to: "/app/master/day-care", grupo: "Operacional" },
      { label: "Serviços", to: "/app/master/servicos", grupo: "Operacional" },
      { label: "Enxoval", to: "/app/master/enxoval", grupo: "Operacional" },
      { label: "Abrir chamado de manutenção", to: "/app/master/chamado-manutencao", grupo: "Operacional" },
      // ESTRATÉGICO
      { label: "Painel estratégico", to: "/app/master", grupo: "Estratégico" },
      { label: "Análise de saídas", to: "/app/master/analise-saidas", grupo: "Estratégico" },
      { label: "RH — Painéis", to: "/app/master/rh-paineis", grupo: "Estratégico" },
      { label: "Resultados NPS", to: "/app/master/resultados-nps", grupo: "Estratégico" },
      { label: "Mapa das Suítes", to: "/app/master/mapa-suites", grupo: "Estratégico" },
      { label: "Obra", to: "/app/master/obra", grupo: "Estratégico" },
      // COMERCIAL
      { label: "CRM", to: "/app/master/crm", grupo: "Comercial" },
      { label: "Funil de Vendas", to: "/app/master/funil-vendas", grupo: "Comercial" },
      // FINANCEIRO
      { label: "Tabela de preços", to: "/app/master/tabela-precos", grupo: "Financeiro" },
      { label: "Cobrança de temporários", to: "/app/master/cobranca-temporaria", grupo: "Financeiro" },
      // VIGILÂNCIA SANITÁRIA (RT) — guarda-chuva de compliance RDC 502/2021.
      // Próximos sub-itens: indicadores RDC, carteira vacinal, proporção de RH, patologias.
      { label: "Eventos sentinela", to: "/app/master/vigilancia-sentinela", grupo: "Vigilância Sanitária" },
      { label: "Indicadores RDC 502", to: "/app/master/vigilancia-indicadores", grupo: "Vigilância Sanitária" },
      { label: "Controle de vacinação", to: "/app/master/vigilancia-vacinacao", grupo: "Vigilância Sanitária" },
      { label: "Proporção de cuidadores", to: "/app/master/vigilancia-proporcao", grupo: "Vigilância Sanitária" },
      { label: "Patologias e Plano de Saúde", to: "/app/master/vigilancia-plano", grupo: "Vigilância Sanitária" },
      { label: "Documentação Institucional", to: "/app/master/documentos-institucionais", grupo: "Vigilância Sanitária" },
      { label: "Livro de controlados", to: "/app/master/livro-controlados", grupo: "Vigilância Sanitária" },
      { label: "Extrair relatório sanitário", to: "/app/master/vigilancia-relatorio", grupo: "Vigilância Sanitária" },
      // SISTEMA
      { label: "Equipe e acessos", to: "/app/master/equipe-acessos", grupo: "Sistema" },
      { label: "Solicitações de acesso", to: "/app/master/solicitacoes-acesso", grupo: "Sistema" },
      { label: "RH — Eventos de pessoal", to: "/app/master/rh-eventos", grupo: "Sistema" },
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
      { label: "Evolução de admissão", to: "/app/medico/admissao" },
      { label: "Testes cognitivos", to: "/app/medico/testes-cognitivos" },
      { label: "Hóspedes", to: "/app/medico/ficha" },
      { label: "Painel clínico", to: "/app/medico/escalados" },
      { label: "Evolução", to: "/app/medico/evolucao" },
      { label: "Estoque de resgate", to: "/app/medico/resgate" },
      { label: "Livro de controlados", to: "/app/medico/livro-controlados" },
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
      { label: "Cobertura Assistencial", to: "/app/coordenacao/cobertura" },
      { label: "Hóspedes", to: "/app/coordenacao/ficha" },
      { label: "Medicação (enfermagem)", to: "/app/coordenacao/medicacao-enfermagem" },
      { label: "Intercorrências", to: "/app/coordenacao/intercorrencias" },
      { label: "Solicitações da família", to: "/app/coordenacao/solicitacoes-familia" },
      { label: "Escalas", to: "/app/coordenacao/escalas" },
      { label: "Planos de cuidado", to: "/app/coordenacao/planos" },
      { label: "Modelos de rotina", to: "/app/coordenacao/modelos" },
      { label: "Pesquisa NPS", to: "/app/coordenacao/pesquisa-nps" },
      { label: "Estoque de resgate", to: "/app/coordenacao/resgate" },
      { label: "Livro de controlados", to: "/app/coordenacao/livro-controlados" },
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
    nome: "Enfermeira (assistencial)",
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
      { label: "Livro de controlados", to: "/app/enfermeira/livro-controlados" },
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
      { label: "Day Care", to: "/app/cuidador/day-care" },
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
    nome: "Enfermagem (plantão)",
    descricao: "Procedimentos e administração de medicação",
    icon: Stethoscope,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/enfermagem/checklist",
    menu: [
      { label: "Cobertura Assistencial", to: "/app/enfermagem/cobertura" },
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
      { label: "Atendimentos individuais", to: "/app/multidisciplinar/atendimentos" },
      { label: "Hóspedes", to: "/app/multidisciplinar/ficha" },
      { label: "Day Care", to: "/app/multidisciplinar/day-care" },
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
      { label: "Day Care", to: "/app/nutricionista/day-care" },
      { label: "Insumos", to: "/app/nutricionista/insumos" },
      { label: "Pratos", to: "/app/nutricionista/pratos" },
      { label: "Cardápios", to: "/app/nutricionista/cardapios" },
      { label: "Desperdício", to: "/app/nutricionista/desperdicio" },
      { label: "Peso e IMC", to: "/app/nutricionista/peso" },
      { label: "Escala da cozinha", to: "/app/nutricionista/escala-cozinha" },
      { label: "Custo refeições equipe", to: "/app/nutricionista/refeicoes-equipe" },
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
      { label: "Livro de controlados", to: "/app/farmacia/livro-controlados" },
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
    // LAVANDERIA INTERNA: controle do enxoval/patrimônio da casa (não o ciclo
    // diário de lavagem nem a roupa pessoal, resolvidos fora do app).
    id: "lavanderia",
    nome: "Lavanderia",
    descricao: "Enxoval da casa",
    icon: Shirt,
    cor: "bg-primary text-primary-foreground",
    rotaInicial: "/app/lavanderia/enxoval",
    menu: [
      { label: "Enxoval", to: "/app/lavanderia/enxoval" },
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
    // Menu curado em 5 seções. "Hóspedes" agrega ativos+inativos; "Cobrança"
    // (Mensalistas·Temporários), "Upselling & atendimentos" (Lançamentos·A
    // precificar) e "Custos de pessoal" (Pagamentos·Remuneração) fundem telas
    // afins em abas. Mensalidades cuida só do VALOR; status de pagamento é só
    // em Cobrança.
    menu: [
      // OPERACIONAL
      { label: "Hóspedes", to: "/app/administracao/hospedes-gestao", grupo: "Operacional" },
      { label: "Mapa das Suítes", to: "/app/administracao/mapa-suites", grupo: "Operacional" },
      { label: "Day Care", to: "/app/administracao/day-care", grupo: "Operacional" },
      { label: "Serviços", to: "/app/administracao/servicos", grupo: "Operacional" },
      { label: "Enxoval", to: "/app/administracao/enxoval", grupo: "Operacional" },
      { label: "Documentação Institucional", to: "/app/administracao/documentos-institucionais", grupo: "Operacional" },
      { label: "Solicitações da família", to: "/app/administracao/solicitacoes-familia", grupo: "Operacional" },
      // ESTRATÉGICO
      { label: "Painel da Administração", to: "/app/administracao", grupo: "Estratégico" },
      { label: "Fluxo de Caixa (Obra)", to: "/app/administracao/fluxo-caixa", grupo: "Estratégico" },
      { label: "Análise de saídas", to: "/app/administracao/analise-saidas", grupo: "Estratégico" },
      { label: "Resultados NPS", to: "/app/administracao/resultados-nps", grupo: "Estratégico" },
      { label: "RH — Painéis", to: "/app/administracao/rh-paineis", grupo: "Estratégico" },
      // COMERCIAL
      { label: "Funil de Vendas", to: "/app/administracao/funil-vendas", grupo: "Comercial" },
      { label: "Tabela de preços", to: "/app/administracao/tabela-precos", grupo: "Comercial" },
      // FATURAMENTO
      { label: "Mensalidades", to: "/app/administracao/mensalidades", grupo: "Faturamento" },
      { label: "Cobrança", to: "/app/administracao/cobranca", grupo: "Faturamento" },
      { label: "Upselling & atendimentos", to: "/app/administracao/upselling", grupo: "Faturamento" },
      { label: "Demonstrativo mensal", to: "/app/administracao/demonstrativo", grupo: "Faturamento" },
      // CUSTOS & PESSOAL
      { label: "Custos de pessoal", to: "/app/administracao/custos-pessoal", grupo: "Custos & Pessoal" },
      { label: "Custos de materiais", to: "/app/administracao/custos-materiais", grupo: "Custos & Pessoal" },
      { label: "Custo refeições equipe", to: "/app/administracao/refeicoes-equipe", grupo: "Custos & Pessoal" },
      { label: "RH — Eventos de pessoal", to: "/app/administracao/rh-eventos", grupo: "Custos & Pessoal" },
      { label: "Profissionais", to: "/app/administracao/profissionais", grupo: "Custos & Pessoal" },
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
    // Mesma operação/curadoria da Administração (5 seções, mesmas fusões) +
    // CRM no bloco Comercial. Mantém-se o alinhamento "Direção = Adm + CRM".
    menu: [
      // OPERACIONAL
      { label: "Hóspedes", to: "/app/direcao/hospedes-gestao", grupo: "Operacional" },
      { label: "Mapa das Suítes", to: "/app/direcao/mapa-suites", grupo: "Operacional" },
      { label: "Obra", to: "/app/direcao/obra", grupo: "Operacional" },
      { label: "Day Care", to: "/app/direcao/day-care", grupo: "Operacional" },
      { label: "Serviços", to: "/app/direcao/servicos", grupo: "Operacional" },
      { label: "Enxoval", to: "/app/direcao/enxoval", grupo: "Operacional" },
      { label: "Documentação Institucional", to: "/app/direcao/documentos-institucionais", grupo: "Operacional" },
      { label: "Livro de controlados", to: "/app/direcao/livro-controlados", grupo: "Operacional" },
      { label: "Solicitações da família", to: "/app/direcao/solicitacoes-familia", grupo: "Operacional" },
      // ESTRATÉGICO
      { label: "Painel da Direção", to: "/app/direcao", grupo: "Estratégico" },
      { label: "Análise de saídas", to: "/app/direcao/analise-saidas", grupo: "Estratégico" },
      { label: "Resultados NPS", to: "/app/direcao/resultados-nps", grupo: "Estratégico" },
      { label: "RH — Painéis", to: "/app/direcao/rh-paineis", grupo: "Estratégico" },
      // COMERCIAL
      { label: "CRM", to: "/app/direcao/crm", grupo: "Comercial" },
      { label: "Funil de Vendas", to: "/app/direcao/funil-vendas", grupo: "Comercial" },
      { label: "Tabela de preços", to: "/app/direcao/tabela-precos", grupo: "Comercial" },
      // FATURAMENTO
      { label: "Mensalidades", to: "/app/direcao/mensalidades", grupo: "Faturamento" },
      { label: "Cobrança", to: "/app/direcao/cobranca", grupo: "Faturamento" },
      { label: "Upselling & atendimentos", to: "/app/direcao/upselling", grupo: "Faturamento" },
      { label: "Demonstrativo mensal", to: "/app/direcao/demonstrativo", grupo: "Faturamento" },
      // CUSTOS & PESSOAL
      { label: "Custos de pessoal", to: "/app/direcao/custos-pessoal", grupo: "Custos & Pessoal" },
      { label: "Custos de materiais", to: "/app/direcao/custos-materiais", grupo: "Custos & Pessoal" },
      { label: "Custo refeições equipe", to: "/app/direcao/refeicoes-equipe", grupo: "Custos & Pessoal" },
      { label: "RH — Eventos de pessoal", to: "/app/direcao/rh-eventos", grupo: "Custos & Pessoal" },
      { label: "Profissionais", to: "/app/direcao/profissionais", grupo: "Custos & Pessoal" },
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
      { label: "Plano de cuidados", to: "/app/familia/plano-cuidados" },
      { label: "Fotos", to: "/app/familia/fotos" },
      { label: "Mensalidade e extras", to: "/app/familia/mensalidade-familia" },
      { label: "Solicitações", to: "/app/familia/solicitacoes" },
      { label: "Câmera do quarto", to: "/app/familia/camera-quarto" },
      { label: "Sinais vitais", to: "/app/familia/sinais-vitais" },
    ],
    emConstrucao: false,
  },
  {
    // CONSTRUTORA (módulo Obra): acesso EXCLUSIVO ao módulo de obra — nunca vê
    // financeiro do contratante, cotações, fornecedores nem áreas assistenciais
    // (RLS nega no banco; o menu só tem a Obra).
    id: "obra_prestador",
    nome: "Construtora",
    descricao: "Acompanhamento da obra (prestador)",
    icon: HardHat,
    cor: "bg-secondary text-secondary-foreground",
    rotaInicial: "/app/obra_prestador/obra",
    menu: [
      { label: "Obra", to: "/app/obra_prestador/obra" },
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
