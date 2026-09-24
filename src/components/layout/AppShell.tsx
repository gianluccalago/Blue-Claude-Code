import { useState } from "react";
import { Outlet, useParams, useRouterState, Navigate } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CamaleaoBar } from "./CamaleaoBar";
import { getPerfil } from "@/data/profiles";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/states";

// PERFIS EXTERNOS (família e construtora) só abrem as telas do PRÓPRIO menu.
// Todas as rotas vivem sob /app/$perfil, então sem esta trava a família
// chegava a /app/familia/escalas ou /app/familia/remuneracao-equipe pela URL.
// A RLS protege os dados; isto protege a interface.
const PERFIS_EXTERNOS = new Set(["familia", "obra_prestador"]);

function rotaPermitida(perfil: NonNullable<ReturnType<typeof getPerfil>>, pathname: string): boolean {
  const semBarra = pathname.replace(/\/+$/, "");
  if (semBarra === perfil.rotaInicial.replace(/\/+$/, "")) return true;
  return perfil.menu.some((m) => semBarra === m.to || semBarra.startsWith(m.to + "/"));
}

export function AppShell() {
  const { perfil: perfilId } = useParams({ strict: false }) as { perfil?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { usuario, carregando } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  // Aguarda a resolução da sessão antes de decidir qualquer redirecionamento.
  if (carregando) return <LoadingState />;
  // Sem sessão → vai para o login.
  if (!usuario) return <Navigate to="/" />;

  // TRAVA DE PERFIL: cada usuário só acessa as telas do SEU perfil; o Master
  // tem acesso total (pode navegar por qualquer perfil). A trava real dos
  // DADOS está no banco (RLS); esta é a trava de navegação na interface.
  if (usuario.perfil !== perfilId && usuario.perfil !== "master") {
    const destino = getPerfil(usuario.perfil)?.rotaInicial ?? `/app/${usuario.perfil}`;
    return <Navigate to={destino} />;
  }

  const perfil = getPerfil(perfilId);
  // Perfil inválido na URL → volta para o login.
  if (!perfil) return <Navigate to="/" />;
  if (PERFIS_EXTERNOS.has(usuario.perfil) && !rotaPermitida(perfil, pathname)) {
    return <Navigate to={perfil.rotaInicial} />;
  }

  const itemAtivo = perfil.menu.find((m) => m.to === pathname);
  const titulo = itemAtivo?.label ?? perfil.nome;

  return (
    <div className="flex h-screen overflow-hidden bg-app-mesh">
      {/* Sidebar fixa no desktop; drawer no mobile */}
      <Sidebar
        perfil={perfil}
        menuAberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
      />
      {/* `isolate` cria um contexto de empilhamento próprio para a coluna de
          conteúdo. Assim a sidebar (fixed, z-40) e seu overlay (z-30) — que
          vivem no contexto raiz — SEMPRE ficam acima de tudo o que está aqui
          dentro (Topbar, CamaleaoBar, main), independente do z-index interno.
          A barra do Camaleão segue acima do conteúdo da página dentro desta
          coluna; no mobile, o drawer cobre a coluna inteira. */}
      <div className="isolate flex min-w-0 flex-1 flex-col">
        <Topbar titulo={titulo} onAbrirMenu={() => setMenuAberto(true)} />
        <CamaleaoBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div key={pathname} className="mx-auto w-full max-w-5xl animate-route-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
