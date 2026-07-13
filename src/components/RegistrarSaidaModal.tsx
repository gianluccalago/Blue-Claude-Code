import { useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useRegistrarSaida } from "@/hooks/useCicloVida";
import { MOTIVOS_SAIDA } from "@/lib/cicloVida";
import { Button } from "@/components/ui/button";
import { formatarQuarto } from "@/lib/quarto";
import { hojeISO } from "@/lib/utils";
import type { Residente } from "@/types/database";

/**
 * Modal de registro de SAÍDA/ÓBITO do hóspede (inativação com data + motivo).
 * Compartilhado entre o Mapa das Suítes e a Ficha do Hóspede — Master/Direção.
 * Óbito também entra automaticamente ao registrar o agravo (trigger 0086);
 * os dois caminhos conciliam sem duplicar.
 */
export function RegistrarSaidaModal({ residente, onFechar }: { residente: Residente; onFechar: () => void }) {
  const registrar = useRegistrarSaida();
  const [dataSaida, setDataSaida] = useState(hojeISO());
  const [motivo, setMotivo] = useState<string>(MOTIVOS_SAIDA[0]);

  async function confirmar() {
    if (!dataSaida || !motivo) {
      toast.error("Informe a data e o motivo da saída.");
      return;
    }
    try {
      await registrar.mutateAsync({ id: residente.id, dataSaida, motivo });
      toast.success(`Saída de ${residente.nome} registrada. Hóspede inativado.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a saída.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registrar saída"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onFechar}
        className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <LogOut className="size-5 text-destructive" /> Registrar saída
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {residente.nome}
          {residente.numero_hospede ? ` · ${residente.numero_hospede}` : ""}
          {residente.quarto ? ` · Suíte ${formatarQuarto(residente.quarto)}` : ""}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-secondary">Data de saída</span>
            <input
              type="date"
              value={dataSaida}
              onChange={(e) => setDataSaida(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-secondary">Motivo da saída</span>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {MOTIVOS_SAIDA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            O hóspede sai das telas operacionais e a suíte fica vaga. O histórico e o financeiro
            são preservados. Reversível em "Hóspedes inativos".
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="flex-1"
            onClick={confirmar}
            loading={registrar.isPending}
          >
            Confirmar saída
          </Button>
        </div>
      </div>
    </div>
  );
}
