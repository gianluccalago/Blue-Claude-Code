import { useState } from "react";
import { toast } from "sonner";
import { Radio, Plus, Check } from "lucide-react";
import { useCrmOrigensTodas, useSalvarOrigem } from "@/hooks/useCrm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

const inputBase =
  "h-10 rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CrmOrigens() {
  const origens = useCrmOrigensTodas();
  const salvar = useSalvarOrigem();
  const [nova, setNova] = useState("");

  if (origens.isLoading) return <LoadingState />;
  if (origens.isError) return <ErrorState error={origens.error} />;

  const lista = origens.data ?? [];

  async function adicionar() {
    if (nova.trim() === "") return;
    try {
      await salvar.mutateAsync({ nome: nova, tipo: null });
      toast.success("Origem adicionada.");
      setNova("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }

  async function alternar(id: string, nome: string, ativo: boolean) {
    try {
      await salvar.mutateAsync({ id, nome, tipo: null, ativo: !ativo });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Radio className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Origens</h1>
          <p className="text-sm text-muted-foreground">Como a família chegou até nós (canais de captação)</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 py-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Nova origem</label>
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              className={cn(inputBase, "w-full")}
              placeholder="Ex: Indicação médica"
            />
          </div>
          <Button onClick={adicionar} disabled={salvar.isPending || nova.trim() === ""}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      {lista.length === 0 ? (
        <EmptyState label="Nenhuma origem cadastrada." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {lista.map((o) => (
              <LinhaOrigem key={o.id} nome={o.nome} ativo={o.ativo} onAlternar={() => alternar(o.id, o.nome, o.ativo)} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaOrigem({ nome, ativo, onAlternar }: { nome: string; ativo: boolean; onAlternar: () => void }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3", !ativo && "opacity-60")}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-secondary">{nome}</span>
        {ativo ? <Badge variant="success" className="gap-1"><Check className="size-3" /> ativa</Badge> : <Badge variant="muted">inativa</Badge>}
      </div>
      <Button size="sm" variant="outline" onClick={onAlternar}>
        {ativo ? "Inativar" : "Reativar"}
      </Button>
    </div>
  );
}
