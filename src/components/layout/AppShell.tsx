import { useState } from "react";
import { Outlet, useParams, useRouterState, Navigate } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CamaleaoBar } from "./CamaleaoBar";
import { getPerfil } from "@/data/profiles";
import { useAuth } from "@/auth/AuthProvider";
import { LoadingState } from "@/components/states";

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

  const itemAtivo = perfil.menu.find((m) => m.to === pathname);
  const titulo = itemAtivo?.label ?? perfil.nome;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar fixa no desktop; drawer no mobile */}
      <Sidebar
        perfil={perfil}
        menuAberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar titulo={titulo} onAbrirMenu={() => setMenuAberto(true)} />
        <CamaleaoBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
