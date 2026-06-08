import { Outlet, useParams, useRouterState, Navigate } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { getPerfil } from "@/data/profiles";

export function AppShell() {
  const { perfil: perfilId } = useParams({ strict: false }) as { perfil?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const perfil = getPerfil(perfilId);

  // Perfil inválido na URL → volta para a seleção
  if (!perfil) return <Navigate to="/" />;

  const itemAtivo = perfil.menu.find((m) => m.to === pathname);
  const titulo = itemAtivo?.label ?? perfil.nome;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar perfil={perfil} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar titulo={titulo} />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
