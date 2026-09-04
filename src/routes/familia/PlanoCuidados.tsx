import { ClipboardList, Clock, HeartHandshake, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FAMILIA_ATUAL } from "@/data/profiles";
import { useResidenteFamilia } from "@/hooks/useFamilia";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/states";
import type { PlanoCuidadoItem } from "@/types/database";

// ===========================================================================
// PORTAL DA FAMÍLIA · PLANO DE CUIDADOS (somente leitura).
// A família acompanha, em linguagem clara, o que a equipe faz pelo seu
// familiar todos os dias. Sem edição: a RLS (0126) libera apenas SELECT e
// apenas do residente vinculado ao usuário.
// ===========================================================================

/** Quem executa, dito para a família (o banco guarda o perfil técnico). */
const QUEM_FAZ: Record<string, string> = {
  cuidador: "Equipe de cuidados",
  enfermagem: "Equipe de enfermagem",
};

/** Agrupa por turno para a leitura ficar natural. */
function turnoDe(horario: string | null): "Manhã" | "Tarde" | "Noite" | "Ao longo do dia" {
  if (!horario) return "Ao longo do dia";
  const h = parseInt(horario.slice(0, 2), 10);
  if (Number.isNaN(h)) return "Ao longo do dia";
  if (h < 12) return "Manhã";
  if (h < 18) return "Tarde";
  return "Noite";
}
const ORDEM_TURNOS = ["Manhã", "Tarde", "Noite", "Ao longo do dia"] as const;

function usePlanoDaFamilia() {
  return useQuery({
    queryKey: ["plano-cuidado-familia", FAMILIA_ATUAL.residenteId],
    enabled: !!FAMILIA_ATUAL.residenteId,
    queryFn: async (): Promise<PlanoCuidadoItem[]> => {
      const { data, error } = await supabase
        .from("plano_cuidado_item")
        .select("*")
        .eq("residente_id", FAMILIA_ATUAL.residenteId!)
        .eq("ativa", true)
        .order("horario");
      // Sem policy de leitura, o retorno é vazio — nunca um erro para a família.
      if (error) return [];
      return data ?? [];
    },
  });
}

export function PlanoCuidados() {
  const residente = useResidenteFamilia();
  const plano = usePlanoDaFamilia();
  const nome = residente.data?.nome?.split(" ")[0] ?? "seu familiar";

  if (plano.isLoading || residente.isLoading) return <LoadingState />;

  const itens = plano.data ?? [];
  const porTurno = ORDEM_TURNOS.map((t) => ({
    turno: t,
    itens: itens.filter((i) => turnoDe(i.horario) === t),
  })).filter((g) => g.itens.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow-primary">
          <ClipboardList className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Plano de cuidados</h1>
          <p className="text-sm text-muted-foreground">
            O que a nossa equipe faz por {nome} todos os dias, combinado com a família.
          </p>
        </div>
      </div>

      {residente.data?.grau_dependencia && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-sm text-secondary">
              Grau de dependência atual{" "}
              <Badge variant="default">Grau {residente.data.grau_dependencia}</Badge>{" "}
              — definido pela avaliação da enfermeira responsável técnica. Sempre que ele muda, o
              plano abaixo é atualizado e a família é comunicada.
            </p>
          </CardContent>
        </Card>
      )}

      {porTurno.length === 0 ? (
        <EmptyState label="O plano de cuidados está sendo montado pela equipe. Assim que estiver pronto, ele aparece aqui." />
      ) : (
        <div className="space-y-4">
          {porTurno.map((g) => (
            <Card key={g.turno}>
              <CardContent className="p-4 sm:p-5">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-4 text-primary" /> {g.turno}
                </h2>
                <div className="divide-y">
                  {g.itens.map((i) => (
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="min-w-0 flex-1 text-sm font-semibold text-secondary">{i.tarefa}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {i.horario && (
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{i.horario}</span>
                        )}
                        <Badge variant="muted">{QUEM_FAZ[i.responsavel ?? ""] ?? "Equipe"}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <HeartHandshake className="mt-0.5 size-4 shrink-0 text-primary" />
        Este plano é acompanhado diariamente pela equipe e revisto pela enfermeira responsável
        técnica. Para falar sobre ele, use as Solicitações — respondemos por lá.
      </p>
    </div>
  );
}
