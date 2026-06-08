import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  useParams,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SelecaoPerfil } from "@/routes/SelecaoPerfil";
import { EmConstrucao } from "@/routes/EmConstrucao";
import { Checklist } from "@/routes/cuidador/Checklist";
import { Medicacao } from "@/routes/cuidador/Medicacao";
import { Compromissos } from "@/routes/cuidador/Compromissos";
import { Intercorrencia } from "@/routes/cuidador/Intercorrencia";
import { Hospedes } from "@/routes/cuidador/Hospedes";
import { PlanosCuidado } from "@/routes/coordenacao/PlanosCuidado";
import { ModelosRotina } from "@/routes/coordenacao/ModelosRotina";
import { PainelCoordenacao } from "@/routes/coordenacao/Painel";
import { MedicacaoEnfermagem } from "@/routes/coordenacao/MedicacaoEnfermagem";
import { IntercorrenciasCoord } from "@/routes/coordenacao/Intercorrencias";
import { Profissionais } from "@/routes/equipe/Profissionais";
import { Escalas } from "@/routes/coordenacao/Escalas";
import { MinhaEscala } from "@/routes/cuidador/MinhaEscala";
import { getPerfil } from "@/data/profiles";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SelecaoPerfil,
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
  // Coordenação: a "Visão geral" é o painel da coordenação.
  if (perfil === "coordenacao") return <PainelCoordenacao />;
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

// Qualquer outra sub-rota dos perfis em construção cai aqui.
const placeholderRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "$",
  component: EmConstrucao,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
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
    minhaEscalaRoute,
    placeholderRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
