import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  mesAtualISO,
  useResidentesComProvisionamento,
} from "@/hooks/usePainelFarmacia";
import { entrouNoMes, DIA_REFERENCIA_CICLO } from "@/lib/farmaciaCiclo";

/**
 * Banner persistente do prazo de provisionamento (referência dia 20). Aparece
 * no topo de TODAS as telas da farmácia a partir do dia 20 enquanto houver
 * hóspedes sem provisionamento no mês — torna o lembrete ativo, não passivo.
 *
 * Hóspedes que ENTRARAM no mês corrente não contam como pendência: alinham-se
 * ao ciclo único no próximo pedido cheio (início coberto pela família).
 */
export function LembreteProvisionamento() {
  const dia = new Date().getDate();
  const mesRef = mesAtualISO();
  const residentes = useResidentes();
  const provisionados = useResidentesComProvisionamento(mesRef);

  // Só calcula/mostra a partir do dia de referência do ciclo.
  if (dia < DIA_REFERENCIA_CICLO) return null;
  if (residentes.isLoading || provisionados.isLoading) return null;

  const total = residentes.data?.length ?? 0;
  const provSet = new Set(provisionados.data ?? []);
  const pendentes = (residentes.data ?? []).filter(
    (r) => !provSet.has(r.id) && !entrouNoMes(r.data_admissao, mesRef),
  ).length;
  if (pendentes === 0 || total === 0) return null;

  return (
    <Link
      to="/app/farmacia/estoque"
      className="flex items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-foreground transition-colors hover:bg-warning/15"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Dia {dia} — prazo de provisionamento (ref.: dia {DIA_REFERENCIA_CICLO}) com{" "}
          <strong>{pendentes}</strong> hóspede{pendentes !== 1 ? "s" : ""} pendente
          {pendentes !== 1 ? "s" : ""}.
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}
