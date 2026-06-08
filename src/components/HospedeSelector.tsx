import { cn } from "@/lib/utils";
import type { Residente } from "@/types/database";

export function HospedeSelector({
  hospedes,
  selecionadoId,
  onSelect,
}: {
  hospedes: Residente[];
  selecionadoId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {hospedes.map((h) => {
        const ativo = h.id === selecionadoId;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ativo
                ? "border-primary bg-primary/10 shadow-card"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            <div className={cn("font-bold", ativo ? "text-secondary" : "text-foreground")}>
              {h.nome}
            </div>
            <div className="text-xs text-muted-foreground">
              Quarto {h.quarto ?? "—"} · Grau {h.grau_dependencia ?? "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
