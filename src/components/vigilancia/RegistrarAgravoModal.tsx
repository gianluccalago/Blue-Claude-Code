import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Activity, AlertTriangle } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useRegistrarAgravo } from "@/hooks/useAgravos";
import { INDICADORES_RDC, AGRAVO_LABEL, TIPO_REGISTRO_DE } from "@/lib/indicadoresRdc";
import { Button } from "@/components/ui/button";
import { hojeISO } from "@/lib/utils";
import type { TipoAgravo } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível registrar.");

// ===========================================================================
// Registro de AGRAVO (RDC 502/2021, Anexo) — Coordenação/Médico/Master.
// Alimenta os 6 indicadores. Óbito também inativa o residente por falecimento
// (trigger no banco) — sem duplicar.
// ===========================================================================

export function RegistrarAgravoModal({ onFechar }: { onFechar: () => void }) {
  const residentes = useResidentes();
  const registrar = useRegistrarAgravo();

  const [residenteId, setResidenteId] = useState("");
  const [tipo, setTipo] = useState<TipoAgravo>("diarreia_aguda");
  const [data, setData] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function salvar() {
    if (!residenteId) return toast.error("Selecione o hóspede.");
    if (!data) return toast.error("Informe a data.");
    try {
      await registrar.mutateAsync({ residenteId, tipo, dataOcorrencia: data, descricao });
      toast.success(
        tipo === "obito"
          ? "Óbito registrado (também como saída por falecimento)."
          : "Agravo registrado para os indicadores.",
      );
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  const medida = TIPO_REGISTRO_DE[tipo] === "incidencia" ? "Incidência (caso novo no mês)" : "Prevalência (caso presente no mês)";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Registrar agravo" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Activity className="size-5 text-primary" /> Registrar agravo (RDC 502)
          </h2>
          <button onClick={onFechar} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Hóspede</label>
            <select value={residenteId} onChange={(e) => setResidenteId(e.target.value)} className={inputBase}>
              <option value="">Selecione…</option>
              {(residentes.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Tipo de agravo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAgravo)} className={inputBase}>
              {INDICADORES_RDC.map((d) => <option key={d.key} value={d.key}>{AGRAVO_LABEL[d.key]}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{medida}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Data da ocorrência</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
          </div>

          {tipo === "obito" && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>O óbito também será registrado como <strong>saída por falecimento</strong> (o hóspede será inativado).</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Observação (opcional)</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={`${inputBase} h-auto py-2 resize-none`} />
          </div>

          <Button className="w-full" onClick={salvar} disabled={registrar.isPending}>
            {registrar.isPending ? "Registrando…" : "Registrar agravo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
