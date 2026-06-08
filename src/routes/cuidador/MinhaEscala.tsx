import { useState } from "react";
import { Sun, Moon, MapPin, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useMinhaEscala } from "@/hooks/useTurnos";
import { useRegistrarPonto, type TipoPonto } from "@/hooks/usePonto";
import { ESTABELECIMENTO, distanciaMetros, obterPosicaoAtual, mensagemErroGeo } from "@/lib/geo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, hojeISO, formatarHoraBR } from "@/lib/utils";
import type { Turno } from "@/types/database";

export function MinhaEscala() {
  // Somente consulta dos próprios turnos (+ ponto no turno de hoje).
  // Todas as profissionais batem check-in/check-out (não há mais isenção).
  const escala = useMinhaEscala(CUIDADOR_ATUAL.id);

  if (escala.isLoading) return <LoadingState />;
  if (escala.isError) return <ErrorState error={escala.error} />;

  const turnos = escala.data ?? [];
  if (turnos.length === 0)
    return <EmptyState label="Você ainda não possui turnos na escala." />;

  return (
    <div className="space-y-3">
      {turnos.map((t) => (
        <TurnoLinha key={t.id} turno={t} />
      ))}
    </div>
  );
}

function TurnoLinha({ turno: t }: { turno: Turno }) {
  const ehHoje = t.data === hojeISO();
  const noturno = t.tag === "noturno";
  const Icone = noturno ? Moon : Sun;
  const dataObj = new Date(t.data + "T00:00:00");

  return (
    <Card className={cn("overflow-hidden", ehHoje && "ring-2 ring-primary")}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-accent py-2 text-secondary">
          <span className="text-xs font-semibold capitalize">
            {dataObj.toLocaleDateString("pt-BR", { weekday: "short" })}
          </span>
          <span className="text-xl font-extrabold tabular-nums">{dataObj.getDate()}</span>
          <span className="text-[11px] text-muted-foreground">
            {dataObj.toLocaleDateString("pt-BR", { month: "short" })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-secondary">
              {formatarHoraBR(t.inicio)}–{formatarHoraBR(t.fim)}
            </span>
            {ehHoje && <Badge variant="default">Hoje</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {dataObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
        <Badge
          variant={noturno ? "success" : "default"}
          className="shrink-0 px-3 py-1.5 capitalize"
        >
          <Icone className="size-3.5" /> {t.tag}
        </Badge>
      </CardContent>

      {/* Ponto: só no turno de HOJE (todas as profissionais batem ponto). */}
      {ehHoje && (
        <div className="border-t px-4 py-3">
          <PontoBloco turno={t} />
        </div>
      )}
    </Card>
  );
}

/** Controles de ponto por geolocalização (somente para profissional NÃO isenta). */
function PontoBloco({ turno: t }: { turno: Turno }) {
  const registrar = useRegistrarPonto();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temEntrada = !!t.check_in;
  const temSaida = !!t.check_out;

  async function bater(tipo: TipoPonto) {
    setErro(null);
    setCarregando(true);
    try {
      const pos = await obterPosicaoAtual();
      const { latitude, longitude } = pos.coords;
      const dist = distanciaMetros(
        latitude,
        longitude,
        ESTABELECIMENTO.latitude,
        ESTABELECIMENTO.longitude,
      );
      if (dist > ESTABELECIMENTO.raioCheckinMetros) {
        setErro(
          `Você está fora do raio do estabelecimento (${Math.round(dist)} metros). ` +
            "O registro de ponto só é permitido no local.",
        );
        return;
      }
      await registrar.mutateAsync({ turnoId: t.id, tipo, lat: latitude, lng: longitude });
    } catch (e) {
      setErro(mensagemErroGeo(e));
    } finally {
      setCarregando(false);
    }
  }

  const ocupado = carregando || registrar.isPending;

  return (
    <div className="space-y-2">
      {/* Status do ponto */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className={temEntrada ? "font-semibold text-success" : "text-muted-foreground"}>
          Entrada: {temEntrada ? formatarHoraBR(t.check_in) : "—"}
          {t.check_in_manual && temEntrada ? " (ajuste manual)" : ""}
        </span>
        <span className={temSaida ? "font-semibold text-success" : "text-muted-foreground"}>
          Saída: {temSaida ? formatarHoraBR(t.check_out) : "—"}
          {t.check_out_manual && temSaida ? " (ajuste manual)" : ""}
        </span>
      </div>

      {/* Botões */}
      {!temEntrada ? (
        <Button size="lg" onClick={() => bater("entrada")} disabled={ocupado}>
          <LogIn className="size-5" /> {carregando ? "Localizando…" : "Bater entrada"}
        </Button>
      ) : !temSaida ? (
        <Button size="lg" variant="outline" onClick={() => bater("saida")} disabled={ocupado}>
          <LogOut className="size-5" /> {carregando ? "Localizando…" : "Bater saída"}
        </Button>
      ) : (
        <p className="text-sm font-medium text-success">Ponto do dia concluído.</p>
      )}

      {/* Mensagem de erro/fora do raio */}
      {erro && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{erro}</span>
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5" /> Controle interno — não substitui o ponto físico oficial.
      </p>
    </div>
  );
}
