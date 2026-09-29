import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Nfc } from "lucide-react";
import { useRondaConfig, useSalvarRondaConfig } from "@/hooks/useRondas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states";
import type { Residente } from "@/types/database";

const sel = "h-10 rounded-md border border-input bg-card px-2 text-sm";

/**
 * Ronda com check-in NFC no plano de cuidados (Coordenação configura).
 * Padrão: a cada 2 h no noturno, tolerância de 30 min. Sugestão automática
 * para Grau III (só sugere — quem ativa é a Coordenação).
 */
export function RondaConfigCard({ residente, podeEditar }: { residente: Residente; podeEditar: boolean }) {
  const q = useRondaConfig(residente.id);
  const salvar = useSalvarRondaConfig();
  const [ativa, setAtiva] = useState(false);
  const [intervalo, setIntervalo] = useState(120);
  const [tolerancia, setTolerancia] = useState(30);
  const [turnos, setTurnos] = useState<"noturno" | "ambos">("noturno");

  useEffect(() => {
    if (!q.data) return;
    setAtiva(q.data.ativa);
    setIntervalo(q.data.intervalo_min);
    setTolerancia(q.data.tolerancia_min);
    setTurnos(q.data.turnos);
  }, [q.data]);

  const sugerir = !q.data && residente.grau_dependencia === "III";
  return (
    <Card className={sugerir ? "border-warning/50" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Nfc className="size-4 text-primary" /> Ronda com check-in NFC
          {q.data?.ativa ? <Badge variant="success">ativa</Badge> : <Badge variant="muted">desligada</Badge>}
        </CardTitle>
        {sugerir && <Badge variant="warning">Sugerida para Grau III</Badge>}
      </CardHeader>
      <CardContent>
        {q.isLoading ? <LoadingState /> : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <input type="checkbox" checked={ativa} disabled={!podeEditar} onChange={(e) => setAtiva(e.target.checked)} /> Ronda ativa
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold text-secondary">A cada</p>
              <select value={intervalo} disabled={!podeEditar} onChange={(e) => setIntervalo(Number(e.target.value))} className={sel}>
                {[60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 120 ? `${m} min` : `${m / 60} h`}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-secondary">Tolerância</p>
              <select value={tolerancia} disabled={!podeEditar} onChange={(e) => setTolerancia(Number(e.target.value))} className={sel}>
                {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-secondary">Turnos</p>
              <select value={turnos} disabled={!podeEditar} onChange={(e) => setTurnos(e.target.value as "noturno" | "ambos")} className={sel}>
                <option value="noturno">Só noturno</option>
                <option value="ambos">Diurno e noturno</option>
              </select>
            </div>
            {podeEditar && (
              <Button
                loading={salvar.isPending}
                onClick={() =>
                  salvar.mutate(
                    { residente_id: residente.id, ativa, intervalo_min: intervalo, tolerancia_min: tolerancia, turnos },
                    { onSuccess: () => toast.success("Ronda salva."), onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar.") },
                  )
                }
              >
                Salvar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
