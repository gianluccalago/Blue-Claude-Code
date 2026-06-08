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
    placeholderRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });
