import { useMemo, useState } from "react";
import { Check, AlertTriangle, Ban, ShieldAlert, Pill } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { usePrescricoes, useRegistrarAdministracao } from "@/hooks/useMedicacao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { PeriodoMedicacao, Prescricao } from "@/types/database";

const PERIODOS: { key: PeriodoMedicacao; label: string }[] = [
  { key: "noite", label: "Noite / jejum" },
  { key: "manha", label: "Manhã" },
  { key: "almoco", label: "Após almoço" },
  { key: "tarde", label: "Tarde" },
];

export function Medicacao() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? hospedes?.[0]?.id;

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="space-y-6">
      <HospedeSelector hospedes={hospedes} selecionadoId={hospedeId} onSelect={setSelecionadoId} />
      {hospedeId && <MedicacaoDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function MedicacaoDoHospede({ residenteId }: { residenteId: string }) {
  const { data, isLoading, isError, error } = usePrescricoes(residenteId);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  return (
    <Tabs defaultValue="manha">
      <TabsList className="w-full justify-start">
        {PERIODOS.map((p) => (
          <TabsTrigger key={p.key} value={p.key}>
            {p.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {PERIODOS.map((p) => (
        <TabsContent key={p.key} value={p.key}>
          <PeriodoMedicacaoView
            residenteId={residenteId}
            periodo={p.key}
            prescricoes={(data ?? []).filter((m) => m.periodo === p.key)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PeriodoMedicacaoView({
  residenteId,
  periodo,
  prescricoes,
}: {
  residenteId: string;
  periodo: PeriodoMedicacao;
  prescricoes: Prescricao[];
}) {
  const registrar = useRegistrarAdministracao(residenteId);
  const [modoParcial, setModoParcial] = useState(false);
  const [faltantes, setFaltantes] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "alerta"; msg: string } | null>(null);

  const orais = useMemo(() => prescricoes.filter((m) => m.via === "oral"), [prescricoes]);
  const enfermagem = useMemo(() => prescricoes.filter((m) => m.via !== "oral"), [prescricoes]);

  if (prescricoes.length === 0) {
    return <EmptyState label="Sem prescrições ativas para este período." />;
  }

  function toggleFaltante(id: string) {
    setFaltantes((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmarTodas() {
    await registrar.mutateAsync({ periodo, status: "sim" });
    setFeedback({ tipo: "ok", msg: `Confirmado: ${orais.length} medicamento(s) oral(is).` });
  }
  async function confirmarParcial() {
    const nomes = orais
      .filter((m) => faltantes.has(m.id))
      .map((m) => `${m.medicamento} ${ouNaoInformado(m.dose)}`)
      .join(", ");
    await registrar.mutateAsync({ periodo, status: "parcial", itensFaltantes: nomes });
    setModoParcial(false);
    setFaltantes(new Set());
    setFeedback({ tipo: "alerta", msg: `Parcial registrado. Coordenação avisada. Faltou: ${nomes}.` });
  }
  async function confirmarNao() {
    await registrar.mutateAsync({ periodo, status: "nao" });
    setFeedback({ tipo: "alerta", msg: "Registrado NÃO administrado. Coordenação avisada imediatamente." });
  }

  return (
    <div className="space-y-5">
      {/* Lista de medicamentos */}
      <Card>
        <CardContent className="space-y-2 p-4">
          {prescricoes.map((m) => {
            const enf = m.via !== "oral";
            const marcarFalta = modoParcial && !enf;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  marcarFalta && faltantes.has(m.id) && "border-warning/50 bg-warning/5",
                )}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <Pill className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-secondary">{m.medicamento}</div>
                  <div className="text-sm text-muted-foreground">
                    {ouNaoInformado(m.dose)} · via {m.via}
                  </div>
                </div>
                {enf ? (
                  <Badge variant="purple">
                    <ShieldAlert className="size-3" /> Enfermagem
                  </Badge>
                ) : marcarFalta ? (
                  <button
                    onClick={() => toggleFaltante(m.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                      faltantes.has(m.id)
                        ? "border-warning bg-warning text-warning-foreground"
                        : "border-input text-muted-foreground hover:border-warning",
                    )}
                  >
                    {faltantes.has(m.id) ? "Faltou" : "Marcar falta"}
                  </button>
                ) : (
                  <Badge variant="muted">oral</Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Aviso da regra de segurança */}
      {enfermagem.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 text-purple-600" />
          Itens injetável/insulina/sonda são de responsabilidade da Enfermagem e não entram na sua
          confirmação.
        </p>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium",
            feedback.tipo === "ok"
              ? "border-success/30 bg-success/5 text-success"
              : "border-warning/40 bg-warning/5 text-warning-foreground",
          )}
        >
          {feedback.tipo === "ok" ? (
            <Check className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          {feedback.msg}
        </div>
      )}

      {/* Ações */}
      {modoParcial ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="warning"
            size="lg"
            disabled={faltantes.size === 0 || registrar.isPending}
            onClick={confirmarParcial}
          >
            Confirmar parcial ({faltantes.size} faltando)
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setModoParcial(false);
              setFaltantes(new Set());
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="success"
            size="lg"
            disabled={orais.length === 0 || registrar.isPending}
            onClick={confirmarTodas}
          >
            <Check className="size-5" /> Sim, todas ({orais.length} orais)
          </Button>
          <Button
            variant="warning"
            size="lg"
            disabled={orais.length === 0 || registrar.isPending}
            onClick={() => {
              setFeedback(null);
              setModoParcial(true);
            }}
          >
            <AlertTriangle className="size-5" /> Parcialmente
          </Button>
          <Button variant="destructive" size="lg" disabled={registrar.isPending} onClick={confirmarNao}>
            <Ban className="size-5" /> Não
          </Button>
        </div>
      )}
    </div>
  );
}
