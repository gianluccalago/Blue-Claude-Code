import { useState } from "react";
import { ClipboardCheck, Clock4, AlertTriangle, History, Repeat, UserX } from "lucide-react";
import { useRotinaPainel, type PendenciaRotinaPainel } from "@/hooks/useRotina";
import { rotuloIntervalo, ehPeriodica, type PlantaoRef } from "@/lib/rotina";
import { rotuloTurnoLivre } from "@/data/tarefas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

function rotuloPlantaoRef(p: PlantaoRef): string {
  const [, m, d] = p.dataPlantao.split("-");
  return `${p.tag === "diurno" ? "diurno" : "noturno"} de ${d}/${m}`;
}

/**
 * ROTINA DE CUIDADOS — o que as cuidadoras (e a enfermagem) deixaram de
 * registrar: atrasadas no plantão em curso, tarefas sem hora marcada a 2 h ou
 * menos do fim do turno (tempo para cobrar/corrigir) e o que o plantão
 * anterior não fez. Atualiza sozinho a cada 5 minutos.
 */
export function RotinaPlantaoCard() {
  const q = useRotinaPainel();
  const [mostrarAnterior, setMostrarAnterior] = useState(true);

  if (q.isLoading) return <Card><CardContent className="py-6"><LoadingState /></CardContent></Card>;
  if (q.isError) return <ErrorState error={q.error} />;
  const { atual, anterior, pendenciasAtual, pendenciasAnterior } = q.data!;
  const atrasadas = pendenciasAtual.filter((p) => p.situacao === "atrasada");
  const vencendo = pendenciasAtual.filter((p) => p.situacao === "vencendo");
  const fimAtual = atual.tag === "diurno" ? "19h" : "07h";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" /> Rotina de cuidados
          <Badge variant="muted">Plantão {rotuloPlantaoRef(atual)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resumo
            icone={AlertTriangle}
            valor={atrasadas.length}
            texto="Atrasadas agora — passaram do horário + tolerância"
            tom={atrasadas.length ? "vermelho" : "ok"}
          />
          <Resumo
            icone={Clock4}
            valor={vencendo.length}
            texto={`Sem hora marcada e ainda não feitas — o turno termina às ${fimAtual}`}
            tom={vencendo.length ? "amarelo" : "ok"}
          />
          <Resumo
            icone={History}
            valor={pendenciasAnterior.length}
            texto={`Não feitas no plantão ${rotuloPlantaoRef(anterior)}`}
            tom={pendenciasAnterior.length ? "vermelho" : "ok"}
          />
        </div>

        {pendenciasAtual.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada em atraso no plantão em curso. As tarefas sem hora marcada aparecem aqui nas 2 últimas horas do turno, se ainda não tiverem sido feitas.
          </p>
        ) : (
          <Lista itens={[...atrasadas, ...vencendo]} />
        )}

        {pendenciasAnterior.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setMostrarAnterior((v) => !v)}
              className="text-sm font-semibold text-secondary underline-offset-2 hover:underline"
            >
              {mostrarAnterior ? "Ocultar" : "Ver"} o que o plantão {rotuloPlantaoRef(anterior)} deixou de fazer ({pendenciasAnterior.length})
            </button>
            {mostrarAnterior && <Lista itens={pendenciasAnterior} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Resumo({ icone: Icone, valor, texto, tom }: { icone: typeof Clock4; valor: number; texto: string; tom: "vermelho" | "amarelo" | "ok" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        tom === "vermelho" && "border-destructive/40 bg-destructive/5",
        tom === "amarelo" && "border-warning/50 bg-warning/5",
        tom === "ok" && "border-success/40 bg-success/5",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          tom === "vermelho" && "bg-destructive/15 text-destructive",
          tom === "amarelo" && "bg-warning/20 text-warning",
          tom === "ok" && "bg-success/15 text-success",
        )}
      >
        <Icone className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-extrabold tabular-nums text-secondary">{valor}</p>
        <p className="text-xs text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

function Lista({ itens }: { itens: PendenciaRotinaPainel[] }) {
  return (
    <div className="divide-y rounded-lg border">
      {itens.map((p) => (
        <div key={`${p.plantao.tag}-${p.plantao.dataPlantao}-${p.item.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <span className="w-14 shrink-0 text-center text-xs font-bold tabular-nums text-secondary">
            {p.item.turno_livre ? rotuloTurnoLivre(p.item.turno_livre) : p.item.horario ?? "--:--"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-secondary">
              {p.item.tarefa} <span className="font-normal text-muted-foreground">· {p.hospede}{p.quarto ? ` (${p.quarto})` : ""}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {p.situacao === "atrasada" && <Badge variant="destructive">Atrasada</Badge>}
              {p.situacao === "vencendo" && <Badge variant="warning">Turno terminando</Badge>}
              {p.situacao === "nao_feita" && <Badge variant="destructive">Não feita</Badge>}
              {ehPeriodica(p.item) && (
                <Badge variant="default" className="gap-1">
                  <Repeat className="size-3" /> {rotuloIntervalo(p.item.intervalo_dias)}
                  {p.diasAtraso > 0 && ` · venceu há ${p.diasAtraso} dia(s)`}
                </Badge>
              )}
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {p.responsaveis.length ? (
              p.responsaveis.join(", ")
            ) : (
              <>
                <UserX className="size-3.5" /> sem cuidadora designada
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
