import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn, ouNaoInformado } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import type { PerfilDef } from "@/data/profiles";

export function Sidebar({ perfil }: { perfil: PerfilDef }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { usuarioEfetivo, sair } = useAuth();
  const Icon = perfil.icon;

  async function logout() {
    await sair();
    navigate({ to: "/" });
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-6">
        <Logo className="text-white" />
      </div>

      <div className="mx-4 mb-2 rounded-lg bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-sidebar-accent text-secondary">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{ouNaoInformado(usuarioEfetivo?.nome)}</div>
            <div className="truncate text-xs text-sidebar-muted">{perfil.nome}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-3.5" />
          Sair
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {perfil.menu.map((item) => {
          const ativo = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "block rounded-md px-4 py-3 text-sm font-semibold transition-colors",
                ativo
                  ? "bg-sidebar-accent text-secondary shadow-card"
                  : "text-sidebar-muted hover:bg-white/10 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-[11px] text-sidebar-muted">
        Blue Senior Living · v0.1
      </div>
    </aside>
  );
}
