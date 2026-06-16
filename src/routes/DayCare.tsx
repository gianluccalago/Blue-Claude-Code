/**
 * Day Care (hoje) — frequentadores do período da TARDE. Cuidado leve/parcial:
 * atividades, refeição do período (lanche/tarde) e eventual medicação da tarde.
 * NÃO ocupa leito (fora do mapa de suítes e da ocupação). Visível aos perfis que
 * atendem no período (cuidador/multi/nutri) e à gestão.
 *
 * Encerramento da estadia: reaproveita o ciclo de INATIVAÇÃO (useRegistrarSaida)
 * — só Master/Direção. O histórico é preservado, como na saída de longa.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Sun, CalendarClock, LogOut, Phone, Activity, Utensils, Pill } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFrequentadoresDayCare } from "@/hooks/usePlanos";
import { useRegistrarSaida } from "@/hooks/useCicloVida";
import { MOTIVOS_SAIDA } from "@/lib/cicloVida";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeloModalidade } from "@/components/SeloModalidade";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";
import type { Residente } from "@/types/database";

export function DayCare() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEncerrar = perfil === "master" || perfil === "direcao";
  const lista = useFrequentadoresDayCare();
  const [encerrando, setEncerrando] = useState<Residente | null>(null);

  if (lista.isLoading) return <LoadingState />;
  if (lista.isError) return <ErrorState error={lista.error} />;

  const frequentadores = lista.data ?? [];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Sun className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Day Care (hoje)</h1>
          <p className="text-sm text-muted-foreground">
            Frequentadores do período da tarde · cuidado leve · não ocupam leito
          </p>
        </div>
      </div>

      {/* Contexto do cuidado parcial */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Activity className="size-3.5" /> Atividades (multidisciplinar)</span>
        <span className="inline-flex items-center gap-1"><Utensils className="size-3.5" /> Lanche da tarde (aceitação do período)</span>
        <span className="inline-flex items-center gap-1"><Pill className="size-3.5" /> Eventual medicação da tarde</span>
      </div>

      {frequentadores.length === 0 ? (
        <EmptyState label="Nenhum frequentador de Day Care ativo." />
      ) : (
        <div className="space-y-2">
          {frequentadores.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary">
                  <Sun className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{r.nome}</span>
                    <SeloModalidade modalidade={r.modalidade} />
                    {r.numero_hospede && <span className="text-xs text-muted-foreground">{r.numero_hospede}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Desde {r.data_inicio_estadia ? formatarDataBR(r.data_inicio_estadia) : "Não informado"}
                    {r.grau_dependencia ? ` · Grau ${r.grau_dependencia}` : ""}
                    {r.contato ? (
                      <span className="ml-1 inline-flex items-center gap-1"><Phone className="size-3" /> {r.contato}</span>
                    ) : null}
                  </p>
                </div>
                {r.data_fim_prevista && (
                  <Badge variant="outline" className="gap-1">
                    <CalendarClock className="size-3" /> até {formatarDataBR(r.data_fim_prevista)}
                  </Badge>
                )}
                {podeEncerrar && (
                  <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => setEncerrando(r)}>
                    <LogOut className="size-3.5" /> Encerrar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {encerrando && <EncerrarEstadia residente={encerrando} onFechar={() => setEncerrando(null)} />}
    </div>
  );
}

function EncerrarEstadia({ residente, onFechar }: { residente: Residente; onFechar: () => void }) {
  const registrar = useRegistrarSaida();
  const [dataSaida, setDataSaida] = useState(hojeISO());
  const [motivo, setMotivo] = useState<string>("Curta permanência");

  async function confirmar() {
    try {
      await registrar.mutateAsync({ id: residente.id, dataSaida, motivo });
      toast.success(`Estadia de ${residente.nome} encerrada.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível encerrar.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-fade-in-up rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <LogOut className="size-5 text-destructive" /> Encerrar estadia (Day Care)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{residente.nome} · {ouNaoInformado(residente.numero_hospede)}</p>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-secondary">Data de saída</span>
            <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-secondary">Motivo</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {MOTIVOS_SAIDA.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            O frequentador sai das telas operacionais; o histórico é preservado (mesma mecânica da saída de longa permanência). Reversível em "Hóspedes inativos".
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>Cancelar</Button>
          <Button variant="destructive" size="lg" className="flex-1" onClick={confirmar} disabled={registrar.isPending}>
            {registrar.isPending ? "Encerrando…" : "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
