/**
 * Tabela de preços — Administração (BLOCO Adm1)
 *
 * Valores de referência por tipo de suíte × grau de dependência (12
 * combinações), totalmente editáveis. É a referência usada para sugerir a
 * mensalidade dos hóspedes na tela "Mensalidades".
 */
import { useState } from "react";
import { AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { useAtualizarPreco, useTabelaPreco } from "@/hooks/useMensalidades";
import { GRAUS, TIPOS_SUITE, chavePreco } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/states";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function TabelaPrecos() {
  const { data, isLoading, isError, error } = useTabelaPreco();
  const atualizar = useAtualizarPreco();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const porChave = new Map((data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau), p]));
  const houveAlteracao = Object.keys(edits).length > 0;

  async function handleSalvar() {
    setErro(null);
    setSalvo(false);
    try {
      const tarefas = Object.entries(edits).map(([id, valorStr]) => {
        const valor = Number(valorStr.replace(",", "."));
        return atualizar.mutateAsync({ id, valor });
      });
      await Promise.all(tarefas);
      setEdits({});
      setSalvo(true);
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5 text-primary" />
            Tabela de preços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Valores de referência por tipo de suíte e grau de dependência. Esses valores
            sugerem a mensalidade dos hóspedes em "Mensalidades", mas podem ser ajustados
            individualmente por hóspede.
          </p>

          {TIPOS_SUITE.map((tipo) => (
            <div key={tipo} className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-bold text-secondary">{tipo}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {GRAUS.map((grau) => {
                  const item = porChave.get(chavePreco(tipo, grau));
                  if (!item) return null;
                  const valorAtual = edits[item.id] ?? String(item.valor);
                  return (
                    <div key={grau} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Grau {grau}</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={valorAtual}
                          onChange={(e) =>
                            setEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {erro && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {erro}
            </div>
          )}
          {salvo && !houveAlteracao && (
            <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" /> Tabela de preços atualizada.
            </div>
          )}

          <Button onClick={handleSalvar} disabled={!houveAlteracao || atualizar.isPending}>
            {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
