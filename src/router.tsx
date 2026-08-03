import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  useParams,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/routes/Login";
import { RedefinirSenha } from "@/routes/RedefinirSenha";
import { EmConstrucao } from "@/routes/EmConstrucao";
import { FichaHospedeScreen } from "@/routes/FichaHospedeScreen";
import { CrmPipeline } from "@/routes/administracao/crm/CrmPipeline";
import { CrmNovaOportunidade } from "@/routes/administracao/crm/CrmNovaOportunidade";
import { CrmOportunidade } from "@/routes/administracao/crm/CrmOportunidade";
import { CrmTarefas } from "@/routes/administracao/crm/CrmTarefas";
import { CrmContatos } from "@/routes/administracao/crm/CrmContatos";
import { CrmOrigens } from "@/routes/administracao/crm/CrmOrigens";
import { CrmConfig } from "@/routes/administracao/crm/CrmConfig";
import { CrmRelatorios } from "@/routes/administracao/crm/CrmRelatorios";
import { AgendaVisitas } from "@/routes/administracao/crm/AgendaVisitas";
import { FunilVendas } from "@/routes/administracao/crm/FunilVendas";
import { DayCare } from "@/routes/DayCare";
import { Checklist } from "@/routes/cuidador/Checklist";
import { Medicacao } from "@/routes/cuidador/Medicacao";
import { Compromissos } from "@/routes/cuidador/Compromissos";
import { Intercorrencia } from "@/routes/cuidador/Intercorrencia";
import { Hospedes } from "@/routes/cuidador/Hospedes";
import { PlanosCuidado } from "@/routes/coordenacao/PlanosCuidado";
import { ModelosRotina } from "@/routes/coordenacao/ModelosRotina";
import { PainelCoordenacao } from "@/routes/coordenacao/Painel";
import { PainelEstrategico } from "@/routes/master/PainelEstrategico";
import { Visao360 } from "@/routes/master/Visao360";
import { PainelOperacional } from "@/routes/master/PainelOperacional";
import { VigilanciaSentinela } from "@/routes/master/VigilanciaSentinela";
import { VigilanciaIndicadores } from "@/routes/master/VigilanciaIndicadores";
import { VigilanciaVacinacao } from "@/routes/master/VigilanciaVacinacao";
import { VigilanciaProporcao } from "@/routes/master/VigilanciaProporcao";
import { VigilanciaPlano } from "@/routes/master/VigilanciaPlano";
import { VigilanciaRelatorio } from "@/routes/master/VigilanciaRelatorio";
import { SupervisaoClinica } from "@/routes/master/SupervisaoClinica";
import { UsuariosAcessos } from "@/routes/master/UsuariosAcessos";
import { Solicitacoes } from "@/routes/master/Solicitacoes";
import { Equipe } from "@/routes/master/Equipe";
import { EquipeAcessos } from "@/routes/master/EquipeAcessos";
import { HospedesMaster } from "@/routes/master/HospedesMaster";
import { MedicacaoEnfermagem } from "@/routes/coordenacao/MedicacaoEnfermagem";
import { IntercorrenciasCoord } from "@/routes/coordenacao/Intercorrencias";
import { Profissionais } from "@/routes/equipe/Profissionais";
import { Escalas } from "@/routes/coordenacao/Escalas";
import { CoberturaAssistencial } from "@/routes/coordenacao/CoberturaAssistencial";
import { MinhaEscala } from "@/routes/cuidador/MinhaEscala";
import { Prescricoes } from "@/routes/medico/Prescricoes";
import { EscaladosMedico } from "@/routes/medico/EscaladosMedico";
import { EvolucaoMedico } from "@/routes/medico/Evolucao";
import { EvolucaoAdmissao } from "@/routes/medico/EvolucaoAdmissao";
import { TestesCognitivos } from "@/routes/medico/TestesCognitivos";
import { InspecaoSuites } from "@/routes/hotelaria/InspecaoSuites";
import { Manutencao } from "@/routes/hotelaria/Manutencao";
import { Enxoval } from "@/routes/lavanderia/Enxoval";
import { MapaSuites } from "@/routes/administracao/MapaSuites";
import { CustosMateriais } from "@/routes/administracao/CustosMateriais";
import { CobrancaTemporaria } from "@/routes/administracao/CobrancaTemporaria";
import { CobrancaGestao } from "@/routes/administracao/CobrancaGestao";
import { HospedesGestao } from "@/routes/administracao/HospedesGestao";
import { UpsellingAtendimentos } from "@/routes/administracao/UpsellingAtendimentos";
import { CustosPessoalEquipe } from "@/routes/administracao/CustosPessoalEquipe";
import { RhEventos } from "@/routes/administracao/RhEventos";
import { RhPaineis } from "@/routes/administracao/RhPaineis";
import { HospedesInativos } from "@/routes/administracao/HospedesInativos";
import { AnaliseSaidas } from "@/routes/administracao/AnaliseSaidas";
import { PainelHotelaria } from "@/routes/hotelaria/PainelHotelaria";
import { AbrirChamado } from "@/routes/manutencao/AbrirChamado";
import { EstoqueHospede } from "@/routes/farmacia/EstoqueHospede";
import { PainelFarmacia } from "@/routes/farmacia/PainelFarmacia";
import { ObraShell } from "@/routes/obra/ObraShell";
import { ObraCaixa } from "@/routes/obra/ObraCaixa";
import { LivroControlados } from "@/routes/farmacia/LivroControlados";
import { DocumentosInstitucionais } from "@/routes/administracao/DocumentosInstitucionais";
import { Dispensacao } from "@/routes/farmacia/Dispensacao";
import { PedidosMensais } from "@/routes/farmacia/PedidosMensais";
import { CustosMedicamento } from "@/routes/farmacia/CustosMedicamento";
import { EstoqueResgate } from "@/routes/resgate/EstoqueResgate";
import { Atividades } from "@/routes/multidisciplinar/Atividades";
import { TabelaPrecos } from "@/routes/administracao/TabelaPrecos";
import { Mensalidades } from "@/routes/administracao/Mensalidades";
import { Demonstrativo } from "@/routes/administracao/Demonstrativo";
import { PainelAdministracao } from "@/routes/administracao/PainelAdministracao";
import { PainelServicos } from "@/routes/administracao/PainelServicos";
import { PesquisaNps } from "@/routes/nps/PesquisaNps";
import { ResultadosNps } from "@/routes/nps/ResultadosNps";
import { AtendimentosIndividuais } from "@/routes/multidisciplinar/AtendimentosIndividuais";
import { AtendimentosPrecificar } from "@/routes/administracao/AtendimentosPrecificar";
import { Insumos } from "@/routes/nutricionista/Insumos";
import { Pratos } from "@/routes/nutricionista/Pratos";
import { Cardapios } from "@/routes/nutricionista/Cardapios";
import { Desperdicio } from "@/routes/nutricionista/Desperdicio";
import { Peso } from "@/routes/nutricionista/Peso";
import { EscalaCozinha } from "@/routes/nutricionista/EscalaCozinha";
import { RefeicoesEquipe } from "@/routes/nutricionista/RefeicoesEquipe";
import { RemuneracaoEquipe } from "@/routes/administracao/RemuneracaoEquipe";
import { Dietas } from "@/routes/nutricionista/Dietas";
import { Acompanhamento as AcompanhamentoNutricional } from "@/routes/nutricionista/Acompanhamento";
import { EvolucaoNutricional } from "@/routes/nutricionista/Evolucao";
import { Inicio as FamiliaInicio } from "@/routes/familia/Inicio";
import { Fotos as FamiliaFotos } from "@/routes/familia/Fotos";
import { Mensalidade as FamiliaMensalidade } from "@/routes/familia/Mensalidade";
import { Solicitacoes as FamiliaSolicitacoes } from "@/routes/familia/Solicitacoes";
import { CameraQuarto } from "@/routes/familia/CameraQuarto";
import { SinaisVitais } from "@/routes/familia/SinaisVitais";
import { SolicitacoesFamiliaInbox } from "@/components/solicitacoes/SolicitacoesFamiliaInbox";
import { getPerfil } from "@/data/profiles";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// A rota inicial é o LOGIN (a Login redireciona sozinha se já houver sessão).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Login,
});

// Destino do link de recuperação de senha enviado por e-mail (pública).
const redefinirSenhaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "redefinir-senha",
  component: RedefinirSenha,
});

// Layout do app com sidebar + topbar; o perfil ativo vem do segmento da URL.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/$perfil",
  component: AppShell,
});

function AppIndex() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const def = getPerfil(perfil);
  // Master: a "Visão geral" inicial é o Painel estratégico (cockpit do CEO).
  if (perfil === "master") return <PainelEstrategico />;
  // Coordenação (e Enfermeira, sua versão reduzida): "Visão geral" = painel de
  // pendências/alertas, com AÇÃO PLENA nos dois perfis.
  if (perfil === "coordenacao" || perfil === "enfermeira") return <PainelCoordenacao />;
  // Administração e Direção: a "Visão geral" é o painel da administração
  // (Direção é a mesma operação + CRM; o card "Funil comercial" só aparece p/ ela).
  if (perfil === "administracao" || perfil === "direcao") return <PainelAdministracao />;
  // Família: o "Início" é o resumo curado do hóspede.
  if (perfil === "familia") return <FamiliaInicio />;
  // Perfil com telas reais (cuidador) abre direto sua rota inicial.
  if (def && !def.emConstrucao && def.rotaInicial !== `/app/${perfil}`) {
    return <Navigate to={def.rotaInicial} />;
  }
  return <EmConstrucao />;
}

const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: AppIndex,
});

const checklistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "checklist",
  component: Checklist,
});
const medicacaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "medicacao",
  component: Medicacao,
});
const compromissosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "compromissos",
  component: Compromissos,
});
const intercorrenciaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "intercorrencia",
  component: Intercorrencia,
});
const hospedesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "hospedes",
  component: Hospedes,
});
const planosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "planos",
  component: PlanosCuidado,
});
const modelosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "modelos",
  component: ModelosRotina,
});
const medicacaoEnfRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "medicacao-enfermagem",
  component: MedicacaoEnfermagem,
});
const intercorrenciasCoordRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "intercorrencias",
  component: IntercorrenciasCoord,
});
const profissionaisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "profissionais",
  component: Profissionais,
});
const escalasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "escalas",
  component: Escalas,
});
const minhaEscalaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "minha-escala",
  component: MinhaEscala,
});
const coberturaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "cobertura",
  component: CoberturaAssistencial,
});
const prescricoesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "prescricoes",
  component: Prescricoes,
});
const escaladosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "escalados",
  component: EscaladosMedico,
});
const evolucaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "evolucao",
  component: EvolucaoMedico,
});
const admissaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "admissao",
  component: EvolucaoAdmissao,
});
const testesCognitivosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "testes-cognitivos",
  component: TestesCognitivos,
});
const inspecaoSuitesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "inspecao-suites",
  component: InspecaoSuites,
});
const manutencaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "manutencao",
  component: Manutencao,
});
const enxovalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "enxoval",
  component: Enxoval,
});
const mapaSuitesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "mapa-suites",
  component: MapaSuites,
});
const hospedesInativosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "hospedes-inativos",
  component: HospedesInativos,
});
const analiseSaidasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "analise-saidas",
  component: AnaliseSaidas,
});
const custosMateriaisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "custos-materiais",
  component: CustosMateriais,
});
const cobrancaTemporariaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "cobranca-temporaria",
  component: CobrancaTemporaria,
});
const rhEventosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "rh-eventos",
  component: RhEventos,
});
const rhPaineisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "rh-paineis",
  component: RhPaineis,
});
const visaoDiaHotelariaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "visao-dia",
  component: PainelHotelaria,
});
const chamadoManutencaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "chamado-manutencao",
  component: AbrirChamado,
});
const painelFarmaciaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "painel",
  component: PainelFarmacia,
});
const dispensacaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "dispensacao",
  component: Dispensacao,
});
// Livro de medicamentos controlados (Port. 344/98) — farmácia/master/coordenação/
// enfermeira lançam; médico/direção leem (a RPC nega escrita no banco).
const livroControladosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "livro-controlados",
  component: LivroControlados,
});
// Documentos institucionais da ILPI — Master/Administração/Direção.
const documentosInstitucionaisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "documentos-institucionais",
  component: DocumentosInstitucionais,
});
// Módulo Obra — master/direção (total) e obra_prestador (portal restrito).
const obraRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "obra",
  component: ObraShell,
});
// Fluxo de caixa do empreendimento — rota própria p/ administração (financeiro);
// master/direção usam a aba "Caixa" dentro do módulo Obra.
const fluxoCaixaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "fluxo-caixa",
  component: ObraCaixa,
});
const pedidosMensaisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pedidos-mensais",
  component: PedidosMensais,
});
const custosMedicamentoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "custos-medicamento",
  component: CustosMedicamento,
});
const estoqueHospedeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "estoque",
  component: EstoqueHospede,
});
const estoqueResgateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "resgate",
  component: EstoqueResgate,
});
const atividadesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "atividades",
  component: Atividades,
});
const dietasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "dietas",
  component: Dietas,
});
const acompanhamentoNutricionalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "acompanhamento-nutricional",
  component: AcompanhamentoNutricional,
});
const evolucaoNutricionalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "evolucao-nutricional",
  component: EvolucaoNutricional,
});
const tabelaPrecosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "tabela-precos",
  component: TabelaPrecos,
});
const servicosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "servicos",
  component: PainelServicos,
});
const pesquisaNpsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pesquisa-nps",
  component: PesquisaNps,
});
const resultadosNpsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "resultados-nps",
  component: ResultadosNps,
});
const atendimentosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "atendimentos",
  component: AtendimentosIndividuais,
});
const atendimentosPrecificarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "atendimentos-precificar",
  component: AtendimentosPrecificar,
});
const insumosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "insumos",
  component: Insumos,
});
const pratosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "pratos",
  component: Pratos,
});
const cardapiosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "cardapios",
  component: Cardapios,
});
const desperdicioRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "desperdicio",
  component: Desperdicio,
});
const pesoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "peso",
  component: Peso,
});
const escalaCozinhaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "escala-cozinha",
  component: EscalaCozinha,
});
const refeicoesEquipeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "refeicoes-equipe",
  component: RefeicoesEquipe,
});
const mensalidadesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "mensalidades",
  component: Mensalidades,
});
// "Cobrança" = wrapper com abas Mensalistas (PainelCobranca) + Temporários.
const cobrancaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "cobranca",
  component: CobrancaGestao,
});
// "Upselling & atendimentos" = wrapper com abas Lançamentos + A precificar.
const upsellingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "upselling",
  component: UpsellingAtendimentos,
});
const demonstrativoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "demonstrativo",
  component: Demonstrativo,
});
const remuneracaoEquipeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "remuneracao-equipe",
  component: RemuneracaoEquipe,
});
// "Custos de pessoal" = wrapper com abas Pagamentos + Tabela de remuneração.
const custosPessoalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "custos-pessoal",
  component: CustosPessoalEquipe,
});
// "Hóspedes" (Adm/Direção) = wrapper com abas Ativos (ficha) + Inativos.
const hospedesGestaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "hospedes-gestao",
  component: HospedesGestao,
});
const fotosFamiliaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "fotos",
  component: FamiliaFotos,
});
const mensalidadeFamiliaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "mensalidade-familia",
  component: FamiliaMensalidade,
});
const solicitacoesFamiliaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "solicitacoes",
  component: FamiliaSolicitacoes,
});
const cameraQuartoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "camera-quarto",
  component: CameraQuarto,
});
const sinaisVitaisRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "sinais-vitais",
  component: SinaisVitais,
});
// Caixa de "Solicitações da família" — Coordenação, Médico e Administração.
const solicitacoesFamiliaInboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "solicitacoes-familia",
  component: SolicitacoesFamiliaInbox,
});

// Master (MASTER-2): visões consolidadas de supervisão (leitura).
const masterHospedeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "hospede",
  component: Visao360,
});
const masterOperacionalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "operacional",
  component: PainelOperacional,
});
const masterClinicaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "clinica",
  component: SupervisaoClinica,
});
// Vigilância Sanitária (RDC 502/2021) — guarda-chuva; 1º módulo: eventos sentinela.
const vigilanciaSentinelaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-sentinela",
  component: VigilanciaSentinela,
});
const vigilanciaIndicadoresRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-indicadores",
  component: VigilanciaIndicadores,
});
const vigilanciaVacinacaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-vacinacao",
  component: VigilanciaVacinacao,
});
const vigilanciaProporcaoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-proporcao",
  component: VigilanciaProporcao,
});
const vigilanciaPlanoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-plano",
  component: VigilanciaPlano,
});
const vigilanciaRelatorioRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "vigilancia-relatorio",
  component: VigilanciaRelatorio,
});
const masterUsuariosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "usuarios",
  component: UsuariosAcessos,
});
// "Hóspedes" do Master = wrapper com sub-abas Ativos (Residentes) + Inativos.
const masterResidentesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "residentes",
  component: HospedesMaster,
});
const masterEquipeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "equipe",
  component: Equipe,
});
// "Equipe e acessos" do Master = wrapper com abas Acessos + Profissionais +
// Escala & horários (fusão de usuarios/profissionais/equipe num só item).
const masterEquipeAcessosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "equipe-acessos",
  component: EquipeAcessos,
});
// Solicitações (Master): filas de reset de senha e de pedidos de acesso do
// login. O path NÃO pode ser "solicitacoes" — a Família já usa esse path no
// mesmo pai ($perfil) e paths duplicados derrubam o router no boot.
const masterSolicitacoesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "solicitacoes-acesso",
  component: Solicitacoes,
});

// Ficha do hóspede — disponível em todos os perfis (menos Família). Aceita
// ?hospede=ID para abrir direto a partir de uma lista (ex.: Meus hóspedes).
const fichaHospedeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "ficha",
  validateSearch: (s: Record<string, unknown>): { hospede?: string } => ({
    hospede: typeof s.hospede === "string" ? s.hospede : undefined,
  }),
  component: FichaHospedeScreen,
});

// CRM comercial — Administração e Master (RLS no banco restringe os dados).
const crmPipelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm",
  component: CrmPipeline,
});
const crmNovaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-nova",
  component: CrmNovaOportunidade,
});
const crmOportunidadeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-oportunidade",
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: CrmOportunidade,
});
const crmTarefasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-tarefas",
  component: CrmTarefas,
});
const crmContatosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-contatos",
  component: CrmContatos,
});
const crmOrigensRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-origens",
  component: CrmOrigens,
});
const crmConfigRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-config",
  component: CrmConfig,
});
const crmRelatoriosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-relatorios",
  component: CrmRelatorios,
});
const crmAgendaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "crm-agenda",
  component: AgendaVisitas,
});
const funilVendasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "funil-vendas",
  component: FunilVendas,
});
const dayCareRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "day-care",
  component: DayCare,
});

// Qualquer outra sub-rota dos perfis em construção cai aqui.
const placeholderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "$",
  component: EmConstrucao,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  redefinirSenhaRoute,
  appRoute.addChildren([
    appIndexRoute,
    checklistRoute,
    medicacaoRoute,
    compromissosRoute,
    intercorrenciaRoute,
    hospedesRoute,
    planosRoute,
    modelosRoute,
    medicacaoEnfRoute,
    intercorrenciasCoordRoute,
    profissionaisRoute,
    escalasRoute,
    coberturaRoute,
    minhaEscalaRoute,
    masterHospedeRoute,
    masterOperacionalRoute,
    vigilanciaSentinelaRoute,
    vigilanciaIndicadoresRoute,
    vigilanciaVacinacaoRoute,
    vigilanciaProporcaoRoute,
    vigilanciaPlanoRoute,
    vigilanciaRelatorioRoute,
    masterClinicaRoute,
    masterUsuariosRoute,
    masterResidentesRoute,
    masterEquipeRoute,
    masterEquipeAcessosRoute,
    masterSolicitacoesRoute,
    fichaHospedeRoute,
    crmPipelineRoute,
    crmNovaRoute,
    crmOportunidadeRoute,
    crmTarefasRoute,
    crmContatosRoute,
    crmOrigensRoute,
    crmConfigRoute,
    crmRelatoriosRoute,
    crmAgendaRoute,
    funilVendasRoute,
    dayCareRoute,
    prescricoesRoute,
    escaladosRoute,
    evolucaoRoute,
    admissaoRoute,
    testesCognitivosRoute,
    inspecaoSuitesRoute,
    manutencaoRoute,
    enxovalRoute,
    mapaSuitesRoute,
    hospedesInativosRoute,
    hospedesGestaoRoute,
    analiseSaidasRoute,
    custosMateriaisRoute,
    cobrancaTemporariaRoute,
    rhEventosRoute,
    rhPaineisRoute,
    visaoDiaHotelariaRoute,
    chamadoManutencaoRoute,
    painelFarmaciaRoute,
    dispensacaoRoute,
    livroControladosRoute,
    documentosInstitucionaisRoute,
    obraRoute,
    fluxoCaixaRoute,
    pedidosMensaisRoute,
    custosMedicamentoRoute,
    estoqueHospedeRoute,
    estoqueResgateRoute,
    atividadesRoute,
    dietasRoute,
    acompanhamentoNutricionalRoute,
    evolucaoNutricionalRoute,
    tabelaPrecosRoute,
    servicosRoute,
    pesquisaNpsRoute,
    resultadosNpsRoute,
    atendimentosRoute,
    atendimentosPrecificarRoute,
    insumosRoute,
    pratosRoute,
    cardapiosRoute,
    desperdicioRoute,
    pesoRoute,
    escalaCozinhaRoute,
    refeicoesEquipeRoute,
    mensalidadesRoute,
    cobrancaRoute,
    upsellingRoute,
    demonstrativoRoute,
    remuneracaoEquipeRoute,
    custosPessoalRoute,
    fotosFamiliaRoute,
    mensalidadeFamiliaRoute,
    solicitacoesFamiliaRoute,
    cameraQuartoRoute,
    sinaisVitaisRoute,
    solicitacoesFamiliaInboxRoute,
    placeholderRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
