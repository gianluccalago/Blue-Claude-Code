/**
 * Insumos e contratos — Nutricionista (BLOCO N1).
 *
 * Cadastro de INSUMOS (com custo unitário de contrato) e FORNECEDORES. Ao
 * alterar o custo, o valor anterior é gravado no histórico (trilha de preço).
 * Estes insumos alimentarão as fichas técnicas de pratos (N2), o cálculo de
 * cardápio e o valor estimado de desperdício nos blocos seguintes.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Carrot, Truck, Plus, Pencil, Search, Check, X, Archive } from "lucide-react";
import {
  useInsumos,
  useCriarInsumo,
  useEditarInsumo,
  useInativarInsumo,
  useFornecedores,
  useSalvarFornecedor,
  useInativarFornecedor,
  type InsumoInput,
} from "@/hooks/useInsumos";
import { CATEGORIAS_INSUMO, CATEGORIA_INSUMO_LABEL, UNIDADES_INSUMO } from "@/lib/insumos";
import { formatarMoeda } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { CategoriaInsumo, Fornecedor, Insumo, UnidadeInsumo } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Insumos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Carrot className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Insumos e contratos</h1>
          <p className="text-sm text-muted-foreground">Custos de contrato dos insumos e fornecedores.</p>
        </div>
      </div>

      <Tabs defaultValue="insumos">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="insumos" className="gap-1.5">
            <Carrot className="size-4" /> Insumos
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-1.5">
            <Truck className="size-4" /> Fornecedores
          </TabsTrigger>
        </TabsList>
        <TabsContent value="insumos">
          <SecaoInsumos />
        </TabsContent>
        <TabsContent value="fornecedores">
          <SecaoFornecedores />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Insumos ────────────────────────────────────────────────────────────────

function SecaoInsumos() {
  const insumos = useInsumos();
  const fornecedores = useFornecedores();
  const inativar = useInativarInsumo();

  const [categoria, setCategoria] = useState<CategoriaInsumo | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [criando, setCriando] = useState(false);

  const nomeFornecedor = useMemo(
    () => new Map((fornecedores.data ?? []).map((f) => [f.id, f.nome])),
    [fornecedores.data],
  );

  if (insumos.isLoading) return <LoadingState />;
  if (insumos.isError) return <ErrorState error={insumos.error} />;

  const filtrados = (insumos.data ?? [])
    .filter((i) => mostrarInativos || i.ativo)
    .filter((i) => categoria === "todas" || i.categoria === categoria)
    .filter((i) => i.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="space-y-4">
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
            {CATEGORIAS_INSUMO.map((c) => (
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
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar insumo…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="size-4 accent-primary" />
              Mostrar inativos
            </label>
            <Button size="sm" onClick={() => { setCriando(true); setEditando(null); }}>
              <Plus className="size-4" /> Novo insumo
            </Button>
          </div>
        </CardContent>
      </Card>

      {(criando || editando) && (
        <FormInsumo
          inicial={editando}
          fornecedores={fornecedores.data ?? []}
          onFechar={() => { setCriando(false); setEditando(null); }}
        />
      )}

      {filtrados.length === 0 ? (
        <EmptyState label="Nenhum insumo para os filtros selecionados." />
      ) : (
        <div className="space-y-2">
          {filtrados.map((i) => (
            <Card key={i.id} className={cn(!i.ativo && "opacity-60")}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{i.nome}</span>
                    <Badge variant="muted">{CATEGORIA_INSUMO_LABEL[i.categoria]}</Badge>
                    {!i.ativo && <Badge variant="muted">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatarMoeda(i.custo_unitario)} / {i.unidade} · {ouNaoInformado(nomeFornecedor.get(i.fornecedor_id ?? "") ?? null)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditando(i); setCriando(false); }} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      inativar.mutate(
                        { id: i.id, ativo: !i.ativo },
                        { onSuccess: () => toast.success(i.ativo ? "Insumo inativado." : "Insumo reativado.") },
                      )
                    }
                    aria-label={i.ativo ? "Inativar" : "Reativar"}
                  >
                    <Archive className={cn("size-4", i.ativo ? "text-muted-foreground" : "text-success")} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FormInsumo({
  inicial,
  fornecedores,
  onFechar,
}: {
  inicial: Insumo | null;
  fornecedores: Fornecedor[];
  onFechar: () => void;
}) {
  const criar = useCriarInsumo();
  const editar = useEditarInsumo();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [categoria, setCategoria] = useState<CategoriaInsumo>(inicial?.categoria ?? "supermercado");
  const [unidade, setUnidade] = useState<UnidadeInsumo>(inicial?.unidade ?? "kg");
  const [custo, setCusto] = useState(inicial ? String(inicial.custo_unitario) : "");
  const [fornecedorId, setFornecedorId] = useState(inicial?.fornecedor_id ?? "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");

  const salvando = criar.isPending || editar.isPending;
  const valido = nome.trim().length > 0 && custo.trim() !== "";

  async function salvar() {
    const custoNum = Number(custo.replace(",", "."));
    if (!valido || !Number.isFinite(custoNum) || custoNum < 0) {
      toast.error("Informe nome e um custo válido.");
      return;
    }
    const payload: InsumoInput = {
      nome,
      categoria,
      unidade,
      custoUnitario: custoNum,
      fornecedorId: fornecedorId || null,
      observacao: observacao || null,
    };
    try {
      if (inicial) await editar.mutateAsync({ id: inicial.id, ...payload });
      else await criar.mutateAsync(payload);
      toast.success(inicial ? "Insumo atualizado." : "Insumo cadastrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{inicial ? "Editar insumo" : "Novo insumo"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-secondary">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Arroz branco tipo 1" className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaInsumo)} className={inputBase}>
              {CATEGORIAS_INSUMO.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Unidade</span>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeInsumo)} className={inputBase}>
              {UNIDADES_INSUMO.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Custo unitário (R$ / {unidade})</span>
            <input type="number" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Fornecedor (opcional)</span>
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={inputBase}>
              <option value="">Não informado</option>
              {fornecedores.filter((f) => f.ativo || f.id === fornecedorId).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: marca, contrato, validade…" className={inputBase} />
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={salvar} disabled={!valido || salvando}>
            <Check className="size-4" /> {salvando ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

function SecaoFornecedores() {
  const fornecedores = useFornecedores();
  const inativar = useInativarFornecedor();
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [criando, setCriando] = useState(false);

  if (fornecedores.isLoading) return <LoadingState />;
  if (fornecedores.isError) return <ErrorState error={fornecedores.error} />;
  const lista = fornecedores.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setCriando(true); setEditando(null); }}>
          <Plus className="size-4" /> Novo fornecedor
        </Button>
      </div>

      {(criando || editando) && (
        <FormFornecedor inicial={editando} onFechar={() => { setCriando(false); setEditando(null); }} />
      )}

      {lista.length === 0 ? (
        <EmptyState label="Nenhum fornecedor cadastrado." />
      ) : (
        <div className="space-y-2">
          {lista.map((f) => (
            <Card key={f.id} className={cn(!f.ativo && "opacity-60")}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{f.nome}</span>
                    <Badge variant="muted">{f.categoria_principal}</Badge>
                    {!f.ativo && <Badge variant="muted">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{ouNaoInformado(f.contato)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditando(f); setCriando(false); }} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      inativar.mutate(
                        { id: f.id, ativo: !f.ativo },
                        { onSuccess: () => toast.success(f.ativo ? "Fornecedor inativado." : "Fornecedor reativado.") },
                      )
                    }
                    aria-label={f.ativo ? "Inativar" : "Reativar"}
                  >
                    <Archive className={cn("size-4", f.ativo ? "text-muted-foreground" : "text-success")} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FormFornecedor({ inicial, onFechar }: { inicial: Fornecedor | null; onFechar: () => void }) {
  const salvar = useSalvarFornecedor();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [categoria, setCategoria] = useState(inicial?.categoria_principal ?? "");
  const [contato, setContato] = useState(inicial?.contato ?? "");

  const valido = nome.trim().length > 0 && categoria.trim().length > 0;

  async function handleSalvar() {
    if (!valido) return;
    try {
      await salvar.mutateAsync({
        id: inicial?.id,
        nome,
        categoriaPrincipal: categoria,
        contato: contato || null,
      });
      toast.success(inicial ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{inicial ? "Editar fornecedor" : "Novo fornecedor"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Atacadão Central" className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Categoria principal</span>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Supermercado" className={inputBase} />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-secondary">Contato (opcional)</span>
            <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Telefone / e-mail" className={inputBase} />
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={!valido || salvar.isPending}>
            <Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
