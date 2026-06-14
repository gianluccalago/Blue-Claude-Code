/**
 * Pesquisa de NPS — APLICAÇÃO pela equipe (Coordenação, Multidisciplinar,
 * Nutricionista). Um colaborador conduz a conversa com o familiar ou o idoso e
 * registra as 8 dimensões (nota 0-10 + comentário condicional). Os resultados
 * NÃO aparecem aqui — só Master/Administração analisam (ver "Resultados NPS").
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, MessageSquareText, Check, Users } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useSalvarPesquisaNps, type RespostaNpsInput } from "@/hooks/useNps";
import { DIMENSOES_NPS, RESPONDENTES_NPS, perguntaCondicional, tomNota } from "@/lib/nps";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { RespondenteNps } from "@/types/database";

const TOM_NOTA: Record<"destructive" | "warning" | "success", string> = {
  destructive: "bg-destructive border-destructive text-white",
  warning: "bg-warning border-warning text-white",
  success: "bg-success border-success text-white",
};

const NOTAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function PesquisaNps() {
  const residentes = useResidentes();
  const salvar = useSalvarPesquisaNps();

  const [residenteId, setResidenteId] = useState<string | undefined>();
  const [respondente, setRespondente] = useState<RespondenteNps | "">("");
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [observacaoGeral, setObservacaoGeral] = useState("");

  const totalRespondidas = useMemo(
    () => DIMENSOES_NPS.filter((d) => notas[d.key] !== undefined).length,
    [notas],
  );
  const completo = !!residenteId && !!respondente && totalRespondidas === DIMENSOES_NPS.length;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  const lista = residentes.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede cadastrado." />;

  async function handleSalvar() {
    if (!completo || !residenteId || !respondente) return;
    const respostas: RespostaNpsInput[] = DIMENSOES_NPS.map((d) => ({
      dimensao: d.key,
      nota: notas[d.key],
      comentario: comentarios[d.key] ?? null,
    }));
    try {
      await salvar.mutateAsync({
        residenteId,
        respondente,
        observacaoGeral,
        respostas,
      });
      toast.success("Pesquisa de NPS registrada. Obrigado!");
      setRespondente("");
      setNotas({});
      setComentarios({});
      setObservacaoGeral("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a pesquisa.");
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <ClipboardList className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Pesquisa NPS</h1>
          <p className="text-sm text-muted-foreground">
            Conduza a conversa e registre as notas (0 a 10) de cada dimensão.
          </p>
        </div>
      </div>

      {/* Hóspede + respondente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-secondary" /> Sobre quem é a pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <HospedeSelector hospedes={lista} selecionadoId={residenteId} onSelect={setResidenteId} />
          <div>
            <p className="mb-1.5 text-sm font-semibold text-secondary">Quem está respondendo?</p>
            <div className="flex flex-wrap gap-2">
              {RESPONDENTES_NPS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRespondente(r.value)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                    respondente === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimensões */}
      {DIMENSOES_NPS.map((d, i) => {
        const nota = notas[d.key];
        return (
          <Card key={d.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start gap-2 text-base">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-secondary">
                  {i + 1}
                </span>
                {d.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Escala 0-10 grande */}
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
                {NOTAS.map((n) => {
                  const ativo = nota === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNotas((prev) => ({ ...prev, [d.key]: n }))}
                      className={cn(
                        "grid h-11 place-items-center rounded-md border text-sm font-bold tabular-nums transition-all",
                        ativo
                          ? TOM_NOTA[tomNota(n)]
                          : "border-border bg-card text-secondary hover:border-primary/50",
                      )}
                      aria-label={`Nota ${n}`}
                      aria-pressed={ativo}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              {/* Pergunta condicional (sempre solicitada, nunca obrigatória) */}
              {nota !== undefined && (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                    <MessageSquareText className="size-4" /> {perguntaCondicional(nota)}
                  </label>
                  <textarea
                    rows={2}
                    value={comentarios[d.key] ?? ""}
                    onChange={(e) => setComentarios((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    placeholder="Comentário (opcional)"
                    className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Observação geral */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observação geral (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            rows={3}
            value={observacaoGeral}
            onChange={(e) => setObservacaoGeral(e.target.value)}
            placeholder="Algo mais que a pessoa queira registrar…"
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </CardContent>
      </Card>

      {/* Salvar */}
      <div className="sticky bottom-3 z-10">
        <Button size="lg" className="w-full gap-2" disabled={!completo || salvar.isPending} onClick={handleSalvar}>
          <Check className="size-5" />
          {salvar.isPending
            ? "Salvando…"
            : completo
              ? "Salvar pesquisa"
              : `Responda as 8 dimensões (${totalRespondidas}/8)`}
        </Button>
      </div>
    </div>
  );
}
