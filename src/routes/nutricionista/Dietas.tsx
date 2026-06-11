/**
 * Dietas — Nutricionista (BLOCO N1)
 *
 * Dieta ativa por hóspede (consistência, restrições, observações), com
 * formulário para definir/atualizar (mantém histórico via ativa=false) e
 * histórico de dietas anteriores.
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, ChevronUp, Copy, History, Pencil, Salad } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useDefinirDieta, useDietaAtiva, useHistoricoDietas } from "@/hooks/useNutricao";
import { CONSISTENCIAS, RESTRICOES_DIETA } from "@/lib/nutricao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { DietaInfo } from "@/components/nutricao/DietaInfo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function Dietas() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && <DietaDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function DietaDoHospede({ residenteId }: { residenteId: string }) {
  const dietaAtiva = useDietaAtiva(residenteId);
  const historico = useHistoricoDietas(residenteId);
  const [editando, setEditando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  if (dietaAtiva.isError) return <ErrorState error={dietaAtiva.error} />;
  if (dietaAtiva.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Salad className="size-5 text-primary" />
            Dieta atual
          </CardTitle>
          <Button variant={editando ? "outline" : "default"} onClick={() => setEditando((v) => !v)}>
            <Pencil className="size-4" /> {editando ? "Cancelar" : "Definir/atualizar dieta"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!editando &&
            (dietaAtiva.data ? (
              <DietaInfo dieta={dietaAtiva.data} />
            ) : (
              <EmptyState label="Sem dieta definida." />
            ))}

          {editando && (
            <FormDieta
              residenteId={residenteId}
              dietaAtual={dietaAtiva.data}
              ultimaDoHistorico={(historico.data ?? [])[0] ?? null}
              onSalvo={() => setEditando(false)}
              onCancelar={() => setEditando(false)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setMostrarHistorico((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="flex items-center gap-2">
              <History className="size-5 text-muted-foreground" />
              Histórico de dietas
              {(historico.data ?? []).length > 0 && (
                <Badge variant="muted">{historico.data!.length}</Badge>
              )}
            </CardTitle>
            {mostrarHistorico ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </CardHeader>
        {mostrarHistorico && (
          <CardContent>
            {historico.isLoading ? (
              <LoadingState label="Carregando histórico…" />
            ) : historico.isError ? (
              <ErrorState error={historico.error} />
            ) : (historico.data ?? []).length === 0 ? (
              <EmptyState label="Nenhuma dieta anterior registrada." />
            ) : (
              <div className="space-y-3">
                {historico.data!.map((d) => (
                  <div key={d.id} className="rounded-lg border bg-card p-4">
                    <DietaInfo dieta={d} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Vigente até {formatarDataHoraBR(d.definida_em)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

type DietaResumo = { consistencia: string; restricoes: string[] | null; observacoes: string | null };

function FormDieta({
  residenteId,
  dietaAtual,
  ultimaDoHistorico,
  onSalvo,
  onCancelar,
}: {
  residenteId: string;
  dietaAtual: DietaResumo | null | undefined;
  ultimaDoHistorico: DietaResumo | null;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [consistencia, setConsistencia] = useState<string>(dietaAtual?.consistencia ?? "");
  const [restricoes, setRestricoes] = useState<string[]>(dietaAtual?.restricoes ?? []);
  const [observacoes, setObservacoes] = useState(dietaAtual?.observacoes ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const definir = useDefinirDieta(residenteId);

  function toggleRestricao(r: string) {
    setRestricoes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function copiarDieta(d: DietaResumo) {
    setConsistencia(d.consistencia);
    setRestricoes(d.restricoes ?? []);
    setObservacoes(d.observacoes ?? "");
    toast.success("Dieta copiada — revise e salve.");
  }

  async function handleSalvar() {
    if (!consistencia) return;
    setErro(null);
    try {
      await definir.mutateAsync({
        consistencia,
        restricoes,
        observacoes: observacoes.trim() || null,
      });
      toast.success("Dieta definida.");
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  // Origem para "copiar última": a dieta ativa ou, se não houver, a última do histórico.
  const origemCopia = dietaAtual ?? ultimaDoHistorico;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      {origemCopia && (
        <Button variant="outline" size="sm" onClick={() => copiarDieta(origemCopia)} disabled={definir.isPending}>
          <Copy className="size-3.5" /> Copiar última dieta definida
        </Button>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-secondary">Consistência</p>
        <div className="flex flex-wrap gap-2">
          {CONSISTENCIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConsistencia(c)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                consistencia === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-secondary">Restrições</p>
        <div className="flex flex-wrap gap-2">
          {RESTRICOES_DIETA.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRestricao(r)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                restricoes.includes(r)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-secondary">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Orientações para a equipe/cozinha…"
          rows={3}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          disabled={definir.isPending}
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={!consistencia || definir.isPending}>
          {definir.isPending ? "Salvando…" : "Salvar dieta"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={definir.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
