import { useMemo } from "react";
import { History } from "lucide-react";
import { PainelChamados } from "@/components/chamados/PainelChamados";
import { useChamadosRecentes } from "@/hooks/useChamados";
import { indicadoresChamados, ROTULO_TIPO, ROTULO_VIA } from "@/lib/chamados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/states";
import { formatarDataHoraBR } from "@/lib/utils";

// ===========================================================================
// CHAMADOS — mapa do Módulo 5 com os alertas ao vivo + últimas 24 horas.
// Master, Coordenação, Enfermeira, Enfermagem e Cuidadoras.
// ===========================================================================
export function Chamados() {
  const recentes = useChamadosRecentes(24);
  const ind = useMemo(() => indicadoresChamados(recentes.data ?? []), [recentes.data]);
  return (
    <div className="space-y-6">
      <PainelChamados />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" /> Últimas 24 horas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentes.isLoading ? <LoadingState /> : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Numero valor={String(ind.total)} rotulo="Chamados (sem simulações)" />
                <Numero valor={String(ind.emergencias)} rotulo="Emergências" />
                <Numero valor={ind.medianaMin === null ? "—" : `${ind.medianaMin} min`} rotulo="Tempo típico até a presença no quarto" />
                <Numero valor={String(ind.excepcionais)} rotulo="Encerrados sem presença" alerta={ind.excepcionais > 0} />
              </div>
              {(recentes.data ?? []).length === 0 ? <EmptyState label="Nenhum chamado nas últimas 24 horas." /> : (
                <div className="divide-y rounded-lg border">
                  {(recentes.data ?? []).map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="w-12 font-bold text-secondary">{c.quarto}</span>
                      <Badge variant={c.tipo === "emergencia" ? "destructive" : "warning"}>{ROTULO_TIPO[c.tipo]}</Badge>
                      {c.simulado && <Badge variant="muted">simulação</Badge>}
                      <span className="text-muted-foreground">aberto {formatarDataHoraBR(c.aberto_em)}</span>
                      {c.status === "aberto" ? (
                        <Badge variant="destructive">aberto</Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          · {c.status === "atendido" ? "atendido" : "encerrado"} {c.atendido_em ? formatarDataHoraBR(c.atendido_em) : ""} por {c.atendido_por ?? "—"} ({ROTULO_VIA[c.atendimento_via ?? ""] ?? "—"})
                        </span>
                      )}
                      {c.justificativa && <span className="w-full text-xs text-muted-foreground">Justificativa: {c.justificativa}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Numero({ valor, rotulo, alerta }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className={alerta ? "rounded-xl border border-destructive/40 bg-destructive/5 p-3" : "rounded-xl border bg-card p-3"}>
      <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}
