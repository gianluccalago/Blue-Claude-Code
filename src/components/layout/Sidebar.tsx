import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn, ouNaoInformado } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { useSolicitacoesPorDestino } from "@/hooks/useSolicitacoes";
import type { PerfilDef } from "@/data/profiles";
import type { DestinoSolicitacao } from "@/types/database";

// Cada perfil que recebe solicitações da família mapeia para um destino.
const DESTINO_POR_PERFIL: Record<string, DestinoSolicitacao> = {
  coordenacao: "coordenacao",
  medico: "medico",
  administracao: "administracao",
};

export function Sidebar({
  perfil,
  menuAberto = false,
  onFechar,
}: {
  perfil: PerfilDef;
  menuAberto?: boolean;
  onFechar?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { usuarioEfetivo, sair } = useAuth();
  const Icon = perfil.icon;

  // Contador de solicitações abertas (SLA visível no menu).
  const destino = DESTINO_POR_PERFIL[perfil.id];
  const solicitacoes = useSolicitacoesPorDestino(destino);
  const abertas = (solicitacoes.data ?? []).filter((s) => s.status === "aberta").length;

  async function logout() {
    await sair();
    navigate({ to: "/" });
  }

  return (
    <>
      {/* Overlay (mobile) */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onFechar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex h-full w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground",
          // Desktop: estática. Mobile: drawer deslizante.
          "fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0",
          menuAberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Logo className="text-white" />
          {/* Fechar (mobile) */}
          {onFechar && (
            <button
              onClick={onFechar}
              className="grid size-8 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
          )}
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
            const mostrarBadge = item.to.endsWith("/solicitacoes-familia") && abertas > 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onFechar}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-colors",
                  ativo
                    ? "bg-sidebar-accent text-secondary shadow-card"
                    : "text-sidebar-muted hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{item.label}</span>
                {mostrarBadge && (
                  <span className="grid min-w-[20px] shrink-0 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                    {abertas}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-[11px] text-sidebar-muted">
          Blue Senior Living · v0.1
        </div>
      </aside>
    </>
  );
}
