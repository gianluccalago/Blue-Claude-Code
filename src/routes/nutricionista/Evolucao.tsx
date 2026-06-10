/**
 * Evolução nutricional — Nutricionista (BLOCO N1)
 *
 * Texto livre datado por hóspede, com histórico cronológico.
 */
import { useState } from "react";
import { AlertCircle, FileText } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useEvolucaoNutricional, useRegistrarEvolucaoNutricional } from "@/hooks/useNutricao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function EvolucaoNutricional() {
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
      {hospedeId && <EvolucaoDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function EvolucaoDoHospede({ residenteId }: { residenteId: string }) {
  const evolucoes = useEvolucaoNutricional(residenteId);
  const registrar = useRegistrarEvolucaoNutricional(residenteId);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleRegistrar() {
    if (!texto.trim()) return;
    setErro(null);
    try {
      await registrar.mutateAsync(texto.trim());
      setTexto("");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Nova evolução nutricional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descreva a evolução nutricional do hóspede…"
            rows={4}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            disabled={registrar.isPending}
          />
          {erro && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {erro}
            </div>
          )}
          <Button onClick={handleRegistrar} disabled={!texto.trim() || registrar.isPending}>
            {registrar.isPending ? "Salvando…" : "Registrar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {evolucoes.isLoading ? (
            <LoadingState label="Carregando histórico…" />
          ) : evolucoes.isError ? (
            <ErrorState error={evolucoes.error} />
          ) : (evolucoes.data ?? []).length === 0 ? (
            <EmptyState label="Nenhum registro de evolução nutricional ainda." />
          ) : (
            <div className="space-y-3">
              {evolucoes.data!.map((ev) => (
                <div key={ev.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ouNaoInformado(ev.registrado_por)} · {formatarDataHoraBR(ev.registrado_em)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-secondary/80">{ev.texto}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
