import { useState } from "react";
import { Sun, Moon, MapPin, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useMinhaEscala } from "@/hooks/useTurnos";
import { useProfissionalAtual, useRegistrarPonto, type TipoPonto } from "@/hooks/usePonto";
import { ESTABELECIMENTO, distanciaMetros, obterPosicaoAtual, mensagemErroGeo } from "@/lib/geo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, hojeISO, formatarHoraBR } from "@/lib/utils";
import type { Turno } from "@/types/database";

function extrairErroPonto(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Não foi possível registrar o ponto. Tente novamente.";
}

export function MinhaEscala() {
  // Consulta dos próprios turnos (+ ponto no turno de hoje) e se a
  // profissional é isenta do ponto por geolocalização (isento_ponto_app).
  const escala = useMinhaEscala(CUIDADOR_ATUAL.id);
  const profissional = useProfissionalAtual();

  if (escala.isLoading || profissional.isLoading) return <LoadingState />;
  if (escala.isError) return <ErrorState error={escala.error} />;
  if (profissional.isError) return <ErrorState error={profissional.error} />;

  const turnos = escala.data ?? [];
  if (turnos.length === 0)
    return <EmptyState label="Você ainda não possui turnos na escala." />;

  // Default seguro (true = ponto simples) caso o cadastro não traga o campo.
  const isento = profissional.data?.isento_ponto_app ?? true;

  return (
    <div className="space-y-3">
      {turnos.map((t) => (
        <TurnoLinha key={t.id} turno={t} isento={isento} />
      ))}
    </div>
  );
}

function TurnoLinha({ turno: t, isento }: { turno: Turno; isento: boolean }) {
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

      {/* Ponto: só no turno de HOJE. */}
      {ehHoje && (
        <div className="border-t px-4 py-3">
          <PontoBloco turno={t} isento={isento} />
        </div>
      )}
    </Card>
  );
}

/**
 * Controles de ponto.
 *
 * Este ponto é CONTROLE INTERNO/GERENCIAL e não substitui o ponto eletrônico
 * legal das profissionais CLT (que já fazem seu ponto oficial por fora do
 * app — por isso são "isentas" aqui).
 *
 * - Isenta (isento_ponto_app=true, ex: CLT): check-in/out simples, sem
 *   geolocalização — mantém o comportamento de hoje.
 * - Não isenta (ex: cuidadora PJ): exige estar dentro do raio do
 *   estabelecimento (GPS tem imprecisão; raio generoso de
 *   ESTABELECIMENTO.raioCheckinMetros + ajuste manual da Coordenação em
 *   Escalas cobrem falhas de localização).
 */
function PontoBloco({ turno: t, isento }: { turno: Turno; isento: boolean }) {
  const registrar = useRegistrarPonto();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temEntrada = !!t.check_in;
  const temSaida = !!t.check_out;

  async function bater(tipo: TipoPonto) {
    setErro(null);

    if (isento) {
      try {
        await registrar.mutateAsync({ turnoId: t.id, tipo });
      } catch (e) {
        setErro(extrairErroPonto(e));
      }
      return;
    }

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
          `Você está a ${Math.round(dist)} metros do estabelecimento. ` +
            "O ponto só pode ser registrado no local.",
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

      {/* Mensagem de erro/fora do raio/permissão negada */}
      {erro && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{erro}</span>
        </p>
      )}

      {isento ? (
        <p className="text-xs text-muted-foreground">Controle interno — não substitui o ponto eletrônico oficial.</p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> Controle interno — exige localização no estabelecimento (raio de{" "}
          {ESTABELECIMENTO.raioCheckinMetros}m).
        </p>
      )}
    </div>
  );
}

