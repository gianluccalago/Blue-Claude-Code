import { Ambulance, Building2, Clock3 } from "lucide-react";
import { useAlertasAmbulancia } from "@/hooks/useAlertasAmbulancia";
import { DESFECHO_AMBULANCIA_LABEL, formatarTempoResposta } from "@/lib/ambulancia";
import { Badge } from "@/components/ui/badge";
import { formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";

// ===========================================================================
// Banner de ACIONAMENTO DE AMBULÂNCIA — alerta imediato (Médico e Master).
// Mostra as intercorrências com ambulância acionada (últimas 48h) que ainda
// NÃO tiveram resolução médica, independente de escalação da Coordenação.
// Some sozinho quando não há nenhuma pendente. Somente leitura: a conduta/
// resolução segue pelo fluxo clínico normal.
// ===========================================================================

export function AlertaAmbulancia() {
  const { data } = useAlertasAmbulancia();
  const pendentes = (data ?? []).filter((a) => !a.resolvida);
  if (pendentes.length === 0) return null;

  return (
    <section
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 shadow-sm"
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive">
          <Ambulance className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-bold text-secondary">Acionamento de ambulância</p>
          <p className="text-xs text-muted-foreground">
            Aguardando avaliação médica · últimas 48h
          </p>
        </div>
        <Badge variant="destructive" className="px-3 py-1 text-sm tabular-nums">
          {pendentes.length}
        </Badge>
      </header>

      <div className="space-y-2">
        {pendentes.map((a) => {
          const i = a.intercorrencia;
          return (
            <div key={i.id} className="rounded-lg border border-destructive/30 bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-secondary">
                  {ouNaoInformado(a.residenteNome)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  Quarto {a.residenteQuarto ?? "—"}
                </span>
                <Badge variant="destructive">{i.tipo}</Badge>
              </div>

              {i.observacao && (
                <p className="mt-1 text-sm text-secondary/80">{i.observacao}</p>
              )}

              {/* Detalhes do chamado (preenchidos pela Coordenação, quando chegam). */}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" /> {formatarDataHoraBR(i.registrado_em)}
                </span>
                {i.ambulancia_desfecho && (
                  <span className="font-medium text-destructive">
                    {DESFECHO_AMBULANCIA_LABEL[i.ambulancia_desfecho]}
                  </span>
                )}
                {i.ambulancia_hospital_destino && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3.5" /> {i.ambulancia_hospital_destino}
                  </span>
                )}
                {i.ambulancia_tempo_resposta_min != null && (
                  <span>resposta {formatarTempoResposta(i.ambulancia_tempo_resposta_min)}</span>
                )}
                {i.registrado_por && <span>por {i.registrado_por}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
