import { Menu } from "lucide-react";
import { Clock } from "@/components/Clock";

export function Topbar({
  titulo,
  subtitulo,
  onAbrirMenu,
}: {
  titulo: string;
  subtitulo?: string;
  onAbrirMenu?: () => void;
}) {
  return (
    <header className="header-safe-top safe-left safe-right sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/40 glass px-4 pb-3.5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Hambúrguer só no mobile (drawer da sidebar) */}
        {onAbrirMenu && (
          <button
            onClick={onAbrirMenu}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-secondary shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-accent active:scale-95 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div className="flex min-w-0 items-center gap-3">
          {/* Acento vertical da marca ao lado do título */}
          <span aria-hidden="true" className="hidden h-9 w-1.5 rounded-full bg-brand-gradient sm:block" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-secondary">{titulo}</h1>
            {subtitulo && <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>}
          </div>
        </div>
      </div>
      <Clock />
    </header>
  );
}
