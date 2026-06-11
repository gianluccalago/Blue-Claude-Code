import { useVinculosCuidador, useAlternarVinculo } from "@/hooks/useUsuarios";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { Residente } from "@/types/database";

// ===========================================================================
// MASTER-3 · Gestão do vínculo cuidador↔hóspede (cuidador_residente).
// Define quais hóspedes um cuidador atende — é a designação que alimenta o
// checklist do cuidador (useHospedesDesignados). Liga/desliga na hora.
// ===========================================================================

export function VinculoHospedes({
  cuidadorId,
  residentes,
}: {
  cuidadorId: string;
  residentes: Residente[];
}) {
  const vinculos = useVinculosCuidador(cuidadorId);
  const alternar = useAlternarVinculo(cuidadorId);

  if (vinculos.isLoading) return <LoadingState label="Carregando vínculos…" />;
  if (vinculos.error) return <ErrorState error={vinculos.error} />;

  const designados = new Set(vinculos.data ?? []);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-sm font-semibold text-secondary">Hóspedes atendidos</div>
      <p className="mb-3 text-xs text-muted-foreground">
        Designação que alimenta o checklist deste cuidador.
      </p>
      {residentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum hóspede cadastrado.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {residentes.map((r) => {
            const ativo = designados.has(r.id);
            return (
              <label
                key={r.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  ativo ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  alternar.isPending && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={ativo}
                  disabled={alternar.isPending}
                  onChange={(e) =>
                    alternar.mutate({ residenteId: r.id, vincular: e.target.checked })
                  }
                  className="size-4 rounded border-input"
                />
                <span className="font-medium text-secondary">{r.nome}</span>
                <span className="text-xs text-muted-foreground">Quarto {r.quarto ?? "—"}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
