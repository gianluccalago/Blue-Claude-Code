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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Hambúrguer só no mobile (drawer da sidebar) */}
        {onAbrirMenu && (
          <button
            onClick={onAbrirMenu}
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-card text-secondary shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-accent active:scale-95 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-secondary">{titulo}</h1>
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
      </div>
      <Clock />
    </header>
  );
}
