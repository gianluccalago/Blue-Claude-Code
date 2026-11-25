import { useState } from "react";
import { toast } from "sonner";
import { Receipt, Pencil, Check, Plus } from "lucide-react";
import { useTabelaServico, useSalvarServico } from "@/hooks/useTabelaServico";
import { CATEGORIAS_UPSELLING } from "@/lib/upselling";
import { formatarMoeda } from "@/lib/mensalidade";
import { lerReais } from "@/lib/fluxoCaixa";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import type { TabelaServico } from "@/types/database";

const inputBase = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Serviços cobrados à parte (Anexo II do contrato): preço de tabela, usado ao lançar extras. */
export function ServicosAParte({ podeEditar }: { podeEditar: boolean }) {
  const servicos = useTabelaServico();
  const [novo, setNovo] = useState(false);
  if (servicos.isLoading) return <LoadingState />;
  if (servicos.isError) return <ErrorState error={servicos.error} />;
  const lista = servicos.data ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Receipt className="size-5 text-primary" /> Serviços cobrados à parte</CardTitle>
        {podeEditar && !novo && <Button size="sm" variant="outline" onClick={() => setNovo(true)}><Plus className="size-4" /> Serviço</Button>}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Fora da mensalidade (Anexo II do contrato). Sem valor = a combinar. Ao lançar um extra para o hóspede, o valor vem daqui.</p>
        {novo && <LinhaServico podeEditar onFim={() => setNovo(false)} />}
        <div className="divide-y rounded-lg border">
          {lista.map((s) => <LinhaServico key={s.id} s={s} podeEditar={podeEditar} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function LinhaServico({ s, podeEditar, onFim }: { s?: TabelaServico; podeEditar: boolean; onFim?: () => void }) {
  const salvar = useSalvarServico();
  const [editando, setEditando] = useState(!s);
  const [nome, setNome] = useState(s?.nome ?? "");
  const [valor, setValor] = useState(s?.valor != null ? String(s.valor).replace(".", ",") : "");
  const [unidade, setUnidade] = useState(s?.unidade ?? "por uso");
  const [categoria, setCategoria] = useState(s?.categoria_upselling ?? "Outros");
  const [ativo, setAtivo] = useState(s?.ativo ?? true);

  async function gravar() {
    try {
      await salvar.mutateAsync({ id: s?.id, nome, valor: valor.trim() ? lerReais(valor) : null, unidade, categoria_upselling: categoria, ativo });
      toast.success("Serviço salvo.");
      setEditando(false);
      onFim?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  if (editando) {
    return (
      <div className="grid gap-2 p-3 sm:grid-cols-[2fr_1fr_1fr_1.3fr_auto] sm:items-end">
        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Serviço</span><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputBase} /></label>
        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Valor (R$)</span><input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="a combinar" className={inputBase} /></label>
        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Unidade</span><input value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputBase} /></label>
        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Lança como</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputBase}>{CATEGORIAS_UPSELLING.map((c) => <option key={c}>{c}</option>)}</select></label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-primary" /> Ativo</label>
          <Button size="sm" onClick={gravar} loading={salvar.isPending}><Check className="size-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditando(false); onFim?.(); }}>Cancelar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm", !s?.ativo && "opacity-55")}>
      <span className="min-w-0 text-secondary">{s?.nome}{!s?.ativo && <Badge variant="muted" className="ml-2">inativo</Badge>}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-secondary">{s?.valor != null ? formatarMoeda(s.valor) : "a combinar"}</span>
        <span className="text-xs text-muted-foreground">{s?.unidade}</span>
        {podeEditar && <button onClick={() => setEditando(true)} className="text-muted-foreground hover:text-primary" aria-label="Editar serviço"><Pencil className="size-3.5" /></button>}
      </span>
    </div>
  );
}
