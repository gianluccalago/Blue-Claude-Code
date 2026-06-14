/**
 * Pratos / fichas técnicas — Nutricionista (BLOCO N2).
 *
 * Cada prato lista insumos (do N1) com quantidade. O custo é SEMPRE recalculado
 * com o custo ATUAL do insumo (mudou o preço no N1 → muda aqui). Os pratos
 * alimentarão os cardápios diários (N3); o custo por porção é base para o valor
 * estimado de desperdício (N4).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Plus, Pencil, Search, Check, X, Archive, Trash2 } from "lucide-react";
import {
  usePratos,
  useTodosPratoInsumos,
  useSalvarPrato,
  useInativarPrato,
  type LinhaPratoInput,
} from "@/hooks/usePratos";
import { useInsumos } from "@/hooks/useInsumos";
import { CATEGORIAS_PRATO, CATEGORIA_PRATO_LABEL } from "@/lib/pratos";
import { formatarMoeda } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { CategoriaPrato, Insumo, Prato, PratoInsumo } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Custo do lote = soma(quantidade × custo atual do insumo). */
function custoLoteDe(linhas: PratoInsumo[], custoPorInsumo: Map<string, number>): number {
  return linhas.reduce((s, l) => s + l.quantidade * (custoPorInsumo.get(l.insumo_id) ?? 0), 0);
}

export function Pratos() {
  const pratos = usePratos();
  const pratoInsumos = useTodosPratoInsumos();
  const insumos = useInsumos();
  const inativar = useInativarPrato();

  const [categoria, setCategoria] = useState<CategoriaPrato | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState<Prato | null>(null);
  const [criando, setCriando] = useState(false);

  const custoPorInsumo = useMemo(
    () => new Map((insumos.data ?? []).map((i) => [i.id, i.custo_unitario])),
    [insumos.data],
  );
  const linhasPorPrato = useMemo(() => {
    const m = new Map<string, PratoInsumo[]>();
    for (const l of pratoInsumos.data ?? []) {
      const arr = m.get(l.prato_id) ?? [];
      arr.push(l);
      m.set(l.prato_id, arr);
    }
    return m;
  }, [pratoInsumos.data]);

  if (pratos.isLoading || insumos.isLoading) return <LoadingState />;
  if (pratos.isError) return <ErrorState error={pratos.error} />;

  const filtrados = (pratos.data ?? [])
    .filter((p) => mostrarInativos || p.ativo)
    .filter((p) => categoria === "todas" || p.categoria === categoria)
    .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <UtensilsCrossed className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Pratos</h1>
          <p className="text-sm text-muted-foreground">Fichas técnicas com custo por porção.</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoria("todas")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                categoria === "todas" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
              )}
            >
              Todas
            </button>
            {CATEGORIAS_PRATO.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategoria(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  categoria === c.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="size-4 accent-primary" />
              Mostrar inativos
            </label>
            <Button size="sm" onClick={() => { setCriando(true); setEditando(null); }}>
              <Plus className="size-4" /> Novo prato
            </Button>
          </div>
        </CardContent>
      </Card>

      {(criando || editando) && (
        <FormPrato
          inicial={editando}
          linhasIniciais={editando ? linhasPorPrato.get(editando.id) ?? [] : []}
          insumos={(insumos.data ?? [])}
          onFechar={() => { setCriando(false); setEditando(null); }}
        />
      )}

      {filtrados.length === 0 ? (
        <EmptyState label="Nenhum prato para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => {
            const linhas = linhasPorPrato.get(p.id) ?? [];
            const custoLote = custoLoteDe(linhas, custoPorInsumo);
            const custoPorcao = p.rendimento_porcoes > 0 ? custoLote / p.rendimento_porcoes : 0;
            return (
              <Card key={p.id} className={cn(!p.ativo && "opacity-60")}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-secondary">{p.nome}</span>
                      <Badge variant="muted">{CATEGORIA_PRATO_LABEL[p.categoria]}</Badge>
                      {!p.ativo && <Badge variant="muted">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rende {p.rendimento_porcoes} porção(ões) · {linhas.length} insumo(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-secondary">{formatarMoeda(custoPorcao)}</p>
                      <p className="text-[11px] text-muted-foreground">por porção · lote {formatarMoeda(custoLote)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditando(p); setCriando(false); }} aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          inativar.mutate(
                            { id: p.id, ativo: !p.ativo },
                            { onSuccess: () => toast.success(p.ativo ? "Prato inativado." : "Prato reativado.") },
                          )
                        }
                        aria-label={p.ativo ? "Inativar" : "Reativar"}
                      >
                        <Archive className={cn("size-4", p.ativo ? "text-muted-foreground" : "text-success")} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormPrato({
  inicial,
  linhasIniciais,
  insumos,
  onFechar,
}: {
  inicial: Prato | null;
  linhasIniciais: PratoInsumo[];
  insumos: Insumo[];
  onFechar: () => void;
}) {
  const salvar = useSalvarPrato();

  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [categoria, setCategoria] = useState<CategoriaPrato>(inicial?.categoria ?? "prato_principal");
  const [rendimento, setRendimento] = useState(String(inicial?.rendimento_porcoes ?? 1));
  const [modoPreparo, setModoPreparo] = useState(inicial?.modo_preparo ?? "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const [linhas, setLinhas] = useState<LinhaPratoInput[]>(
    linhasIniciais.length > 0
      ? linhasIniciais.map((l) => ({ insumoId: l.insumo_id, quantidade: l.quantidade }))
      : [{ insumoId: "", quantidade: 0 }],
  );

  const custoPorInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.custo_unitario])), [insumos]);
  const unidadePorInsumo = useMemo(() => new Map(insumos.map((i) => [i.id, i.unidade])), [insumos]);

  const custoLote = useMemo(
    () => linhas.reduce((s, l) => s + (l.quantidade || 0) * (custoPorInsumo.get(l.insumoId) ?? 0), 0),
    [linhas, custoPorInsumo],
  );
  const rendNum = Math.max(1, Number(rendimento) || 1);
  const custoPorcao = custoLote / rendNum;

  function setLinha(idx: number, patch: Partial<LinhaPratoInput>) {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removerLinha(idx: number) {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  }

  const valido = nome.trim().length > 0 && linhas.some((l) => l.insumoId && l.quantidade > 0);

  async function handleSalvar() {
    if (!valido) {
      toast.error("Informe o nome e ao menos um insumo com quantidade.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: inicial?.id,
        nome,
        categoria,
        rendimentoPorcoes: rendNum,
        modoPreparo: modoPreparo || null,
        observacao: observacao || null,
        linhas: linhas.filter((l) => l.insumoId && l.quantidade > 0),
      });
      toast.success(inicial ? "Prato atualizado." : "Prato cadastrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const insumosOrdenados = [...insumos].filter((i) => i.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{inicial ? "Editar prato" : "Novo prato"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-secondary">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Arroz branco" className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPrato)} className={inputBase}>
              {CATEGORIAS_PRATO.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Rendimento (porções)</span>
            <input type="number" min={1} value={rendimento} onChange={(e) => setRendimento(e.target.value)} className={inputBase} />
          </label>
        </div>

        {/* Insumos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-secondary">Insumos</span>
            <Button variant="outline" size="sm" onClick={() => setLinhas((p) => [...p, { insumoId: "", quantidade: 0 }])}>
              <Plus className="size-4" /> Adicionar insumo
            </Button>
          </div>
          {insumosOrdenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre insumos primeiro (aba Insumos).</p>
          ) : (
            <div className="space-y-2">
              {linhas.map((l, idx) => {
                const unidade = unidadePorInsumo.get(l.insumoId);
                const subtotal = (l.quantidade || 0) * (custoPorInsumo.get(l.insumoId) ?? 0);
                return (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2">
                    <label className="min-w-[10rem] flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">Insumo</span>
                      <select value={l.insumoId} onChange={(e) => setLinha(idx, { insumoId: e.target.value })} className={inputBase}>
                        <option value="">Selecione…</option>
                        {insumosOrdenados.map((i) => (
                          <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>
                        ))}
                      </select>
                    </label>
                    <label className="w-28 space-y-1">
                      <span className="text-xs text-muted-foreground">Qtd ({unidade ?? "—"})</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.quantidade || ""}
                        onChange={(e) => setLinha(idx, { quantidade: Number(e.target.value) })}
                        className={inputBase}
                      />
                    </label>
                    <div className="w-24 pb-2 text-right text-sm font-semibold tabular-nums text-secondary">
                      {formatarMoeda(subtotal)}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removerLinha(idx)} aria-label="Remover linha">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cálculo em destaque */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo total do lote</p>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{formatarMoeda(custoLote)}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo por porção</p>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{formatarMoeda(custoPorcao)}</p>
            <p className="text-[11px] text-muted-foreground">÷ {rendNum} porção(ões)</p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-secondary">Modo de preparo (opcional)</span>
          <textarea rows={3} value={modoPreparo} onChange={(e) => setModoPreparo(e.target.value)} placeholder="Passo a passo…" className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: rende mais com…" className={inputBase} />
        </label>

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={!valido || salvar.isPending}>
            <Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar prato"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O custo é recalculado com o preço atual dos insumos.
        </p>
      </CardContent>
    </Card>
  );
}
