import { useState } from "react";
import { Search, ChevronDown, X } from "lucide-react";
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
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const selecionado = hospedes.find((h) => h.id === selecionadoId);

  // Filtro: busca por nome ou quarto
  const filtrados = busca.trim()
    ? hospedes.filter(
        (h) =>
          h.nome.toLowerCase().includes(busca.toLowerCase()) ||
          (h.quarto ?? "").toLowerCase().includes(busca.toLowerCase()),
      )
    : hospedes;

  // Modo lista compacta (≤6 hóspedes e nenhum em busca) — mantém UX original
  const modoLista = hospedes.length <= 6 && !busca.trim();

  if (modoLista && !aberto) {
    return (
      <div className="flex flex-wrap gap-2">
        {hospedes.map((h) => {
          const ativo = h.id === selecionadoId;
          return (
            <button
              key={h.id}
              onClick={() => onSelect(h.id)}
              className={cn(
                "min-h-[44px] rounded-lg border px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                ativo
                  ? "border-primary bg-primary/10 shadow-card ring-1 ring-primary/30"
                  : "border-border bg-card shadow-xs hover:border-primary/50 hover:shadow-card",
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

  // Modo combobox (muitos hóspedes ou busca ativa)
  return (
    <div className="relative">
      {/* Campo de seleção / busca */}
      <div
        className={cn(
          "flex min-h-[48px] cursor-pointer items-center gap-2 rounded-lg border bg-card px-3.5 py-2 shadow-xs transition-all duration-200",
          aberto ? "border-primary ring-2 ring-ring" : "border-border hover:border-primary/50",
        )}
        onClick={() => setAberto(true)}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        {aberto ? (
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou quarto…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn("flex-1 text-sm", selecionado ? "font-semibold text-secondary" : "text-muted-foreground")}>
            {selecionado
              ? `${selecionado.nome} · Quarto ${selecionado.quarto ?? "—"}`
              : "Selecionar hóspede…"}
          </span>
        )}
        {busca ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setBusca("");
            }}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : (
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", aberto && "rotate-180")} />
        )}
      </div>

      {/* Dropdown de resultados */}
      {aberto && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setAberto(false);
              setBusca("");
            }}
          />
          <div className="absolute z-20 mt-1.5 max-h-72 w-full animate-fade-in-up overflow-y-auto rounded-lg border border-border/70 bg-card shadow-lifted">
            {filtrados.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Nenhum hóspede encontrado.
              </div>
            ) : (
              filtrados.map((h) => {
                const ativo = h.id === selecionadoId;
                return (
                  <button
                    key={h.id}
                    onClick={() => {
                      onSelect(h.id);
                      setAberto(false);
                      setBusca("");
                    }}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-accent",
                      ativo && "bg-primary/5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-semibold", ativo ? "text-primary-strong" : "text-secondary")}>
                        {h.nome}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Quarto {h.quarto ?? "—"} · Grau {h.grau_dependencia ?? "—"}
                      </div>
                    </div>
                    {ativo && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
