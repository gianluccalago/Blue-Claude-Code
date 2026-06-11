/**
 * Rouparia — Hotelaria (BLOCO H3, mínimo)
 * Saldo em trânsito (lavanderia) por categoria, com limite de alerta.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Shirt, AlertTriangle, Save, Minus, Plus } from "lucide-react";
import { useRouparia, useAtualizarRouparia } from "@/hooks/useRouparia";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";
import type { RoupariaTransito } from "@/types/database";

const inputClass =
  "h-9 w-16 rounded-md border border-input bg-card px-2 text-sm text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Rouparia() {
  const { data, isLoading, isError, error } = useRouparia();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const itens = data ?? [];
  if (itens.length === 0) return <EmptyState label="Nenhuma categoria de rouparia cadastrada." />;

  const saldoTotal = itens.reduce((s, i) => s + i.saldo_atual, 0);
  const limiteTotal = itens.reduce((s, i) => s + i.limite, 0);
  const acimaDoLimite = saldoTotal > limiteTotal;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold">Rouparia</h1>
        <p className="text-sm text-muted-foreground">Saldo em trânsito na lavanderia, por categoria</p>
      </div>

      {/* Saldo total */}
      <Card className={cn("border-l-4", acimaDoLimite ? "border-l-destructive" : "border-l-success")}>
        <CardContent className="flex items-center gap-3 pt-4 pb-3">
          {acimaDoLimite ? (
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
          ) : (
            <Shirt className="h-6 w-6 shrink-0 text-success" />
          )}
          <div>
            <p className={cn("text-2xl font-extrabold leading-none tracking-tight tabular-nums", acimaDoLimite && "text-destructive")}>
              {saldoTotal}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Saldo total em trânsito (limite: {limiteTotal})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Por categoria */}
      <div className="space-y-2">
        {itens.map((item) => (
          <ItemRouparia key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ItemRouparia({ item }: { item: RoupariaTransito }) {
  const atualizar = useAtualizarRouparia();
  const [saldo, setSaldo] = useState(String(item.saldo_atual));
  const [limite, setLimite] = useState(String(item.limite));

  const saldoNum = Number(saldo) || 0;
  const limiteNum = Number(limite) || 0;
  const acima = saldoNum > limiteNum;
  const alterado = saldoNum !== item.saldo_atual || limiteNum !== item.limite;

  function ajustarSaldo(delta: number) {
    setSaldo((s) => String(Math.max(0, (Number(s) || 0) + delta)));
  }

  async function handleSalvar() {
    await atualizar.mutateAsync({ id: item.id, saldoAtual: saldoNum, limite: limiteNum });
    toast.success(`${item.categoria} atualizada.`);
  }

  return (
    <Card className={cn(acima && "border-destructive/40 bg-destructive/5")}>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-secondary">{item.categoria}</p>
          <p className="text-xs text-muted-foreground">
            Atualizado em {formatarDataHoraBR(item.atualizado_em)}
          </p>
        </div>
        {acima && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="size-3" /> Acima do limite
          </Badge>
        )}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Saldo</label>
          {/* Botões −/+ para ajuste por toque (sem teclado) */}
          <button
            type="button"
            onClick={() => ajustarSaldo(-1)}
            className="grid size-9 place-items-center rounded-md border bg-card text-secondary transition-colors hover:bg-accent"
            aria-label="Diminuir saldo"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            min={0}
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => ajustarSaldo(1)}
            className="grid size-9 place-items-center rounded-md border bg-card text-secondary transition-colors hover:bg-accent"
            aria-label="Aumentar saldo"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Limite</label>
          <input
            type="number"
            min={0}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button size="sm" disabled={!alterado || atualizar.isPending} onClick={handleSalvar} className="gap-1.5">
          <Save className="size-3.5" />
          {atualizar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </CardContent>
    </Card>
  );
}
