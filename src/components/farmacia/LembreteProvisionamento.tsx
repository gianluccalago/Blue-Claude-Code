import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  mesAtualISO,
  useResidentesComProvisionamento,
} from "@/hooks/usePainelFarmacia";

/**
 * Banner persistente do prazo de provisionamento (referência dia 20). Aparece
 * no topo de TODAS as telas da farmácia a partir do dia 20 enquanto houver
 * hóspedes sem provisionamento no mês — torna o lembrete ativo, não passivo.
 */
export function LembreteProvisionamento() {
  const dia = new Date().getDate();
  const mesRef = mesAtualISO();
  const residentes = useResidentes();
  const provisionados = useResidentesComProvisionamento(mesRef);

  // Só calcula/mostra a partir do dia 20.
  if (dia < 20) return null;
  if (residentes.isLoading || provisionados.isLoading) return null;

  const total = residentes.data?.length ?? 0;
  const provSet = new Set(provisionados.data ?? []);
  const pendentes = (residentes.data ?? []).filter((r) => !provSet.has(r.id)).length;
  if (pendentes === 0 || total === 0) return null;

  return (
    <Link
      to="/app/farmacia/estoque"
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Dia {dia} — prazo de provisionamento (ref.: dia 20) com{" "}
          <strong>{pendentes}</strong> hóspede{pendentes !== 1 ? "s" : ""} pendente
          {pendentes !== 1 ? "s" : ""}.
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}
