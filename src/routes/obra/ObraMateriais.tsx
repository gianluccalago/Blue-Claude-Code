import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Package,
  Truck,
  AlertTriangle,
  TrendingDown,
  Plus,
  ClipboardList,
  PackageCheck,
  Recycle,
  X,
  Check,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra } from "@/hooks/useObra";
import {
  useTolerancias,
  usePlanejamento,
  useCotacoes,
  useOrdensCompra,
  useConsumo,
  useReposicao,
  useCriarPlanejamento,
  useCriarCotacao,
  useEscolherCotacao,
  useCriarOC,
  useRegistrarRecebimento,
  useRegistrarConsumo,
  useCriarReposicao,
  useEntregarReposicao,
} from "@/hooks/useObraMateriais";
import { calcularGlosaMaterial, curvaABC, diffDias } from "@/lib/obraCalc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";

/** Dias de hoje até uma data futura (negativo = já passou). */
const diasEntre = (deISO: string, ateISO: string) => diffDias(deISO, ateISO);
import type {
  ObraCotacao,
  ObraOrdemCompra,
  ObraPlanejamentoMaterial,
} from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const CATEGORIAS = ["concreto", "aco", "blocos", "ceramicos", "tintas", "demais"] as const;
const CAT_LABEL: Record<string, string> = {
  concreto: "Concreto", aco: "Aço", blocos: "Blocos", ceramicos: "Cerâmicos", tintas: "Tintas", demais: "Demais",
};

const OC_VARIANTE: Record<string, "default" | "warning" | "success" | "muted"> = {
  Emitida: "default", "Entregue parcial": "warning", Entregue: "success", Cancelada: "muted",
};

export function ObraMateriais() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const fases = useFasesObra();
  const tolerancias = useTolerancias();
  const planejamento = usePlanejamento();
  const cotacoes = useCotacoes();
  const ordens = useOrdensCompra();
  const consumo = useConsumo();
  const reposicao = useReposicao();

  const [novoItem, setNovoItem] = useState(false);
  const [cotarItem, setCotarItem] = useState<ObraPlanejamentoMaterial | null>(null);
  const [receberOc, setReceberOc] = useState<ObraOrdemCompra | null>(null);
  const [novoConsumo, setNovoConsumo] = useState(false);
  const [novaRepo, setNovaRepo] = useState(false);

  const carregando = planejamento.isLoading || ordens.isLoading || tolerancias.isLoading;
  if (carregando) return <LoadingState />;
  if (planejamento.isError) return <ErrorState error={planejamento.error} />;

  const listaPlan = planejamento.data ?? [];
  const listaOC = ordens.data ?? [];
  const listaConsumo = consumo.data ?? [];
  const listaCot = cotacoes.data ?? [];
  const hoje = hojeISO();

  // OCs por item de planejamento (para saber quais já têm compra).
  const ocPorPlan = new Set(listaOC.filter((o) => o.status !== "Cancelada").map((o) => o.planejamento_id));

  // ── Métricas ──
  const comprometido = listaOC.filter((o) => o.status !== "Cancelada").reduce((s, o) => s + o.valor_total, 0);

  // Preço médio por categoria (das OCs) para valorar a glosa. Cálculo direto
  // (listas pequenas) — NUNCA useMemo aqui: hooks após return condicional
  // quebram a ordem de hooks (React #310).
  const precoMedioCat = (() => {
    const acc: Record<string, { valor: number; qtd: number }> = {};
    for (const o of listaOC) {
      if (o.status === "Cancelada") continue;
      const a = acc[o.categoria] ?? { valor: 0, qtd: 0 };
      a.valor += o.valor_total; a.qtd += o.quantidade;
      acc[o.categoria] = a;
    }
    const m: Record<string, number> = {};
    for (const [c, a] of Object.entries(acc)) m[c] = a.qtd > 0 ? a.valor / a.qtd : 0;
    return m;
  })();

  // Perdas/glosa por categoria (consumo real × previsto × tolerância).
  const perdas = CATEGORIAS.map((cat) => {
    const previsto = listaPlan.filter((p) => p.categoria === cat).reduce((s, p) => s + p.quantidade_prevista, 0);
    const consumido = listaConsumo.filter((c) => c.categoria === cat).reduce((s, c) => s + c.quantidade_consumida, 0);
    const tol = tolerancias.data?.[cat] ?? 5;
    const r = calcularGlosaMaterial({ previsto, consumido, toleranciaPct: tol, precoMedio: precoMedioCat[cat] ?? 0 });
    return { cat, previsto, consumido, tol, ...r };
  }).filter((p) => p.previsto > 0 || p.consumido > 0);
  const glosaTotal = perdas.reduce((s, p) => s + p.glosaValor, 0);

  // Curva ABC por item (valor comprometido) — cálculo direto, sem hook.
  const abc = (() => {
    const porItem: Record<string, number> = {};
    for (const o of listaOC) {
      if (o.status === "Cancelada") continue;
      porItem[o.item] = (porItem[o.item] ?? 0) + o.valor_total;
    }
    return curvaABC(Object.entries(porItem).map(([item, valor]) => ({ item, valor })));
  })();

  // ── Alertas ──
  const alertasOC = listaOC.filter(
    (o) => (o.status === "Emitida" || o.status === "Entregue parcial") && o.previsao_entrega && diasEntre(hoje, o.previsao_entrega) <= 7,
  );
  const alertasPlan = listaPlan.filter(
    (p) => !ocPorPlan.has(p.id) && p.data_necessidade && diasEntre(hoje, p.data_necessidade) <= 15,
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Métricas */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica icone={<Package className="size-5" />} rotulo="Comprometido (OCs)" valor={formatarMoeda(comprometido)} />
        <Metrica icone={<TrendingDown className="size-5" />} rotulo="Glosa proposta (perdas)" valor={formatarMoeda(glosaTotal)} tom={glosaTotal > 0 ? "destructive" : "secondary"} />
        <Metrica icone={<AlertTriangle className="size-5" />} rotulo="Alertas de prazo" valor={String(alertasOC.length + alertasPlan.length)} tom={alertasOC.length + alertasPlan.length > 0 ? "warning" : "secondary"} />
      </div>

      {/* Alertas */}
      {(alertasOC.length > 0 || alertasPlan.length > 0) && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-secondary"><AlertTriangle className="size-4 text-warning" /> Alertas</h3>
            {alertasPlan.map((p) => (
              <p key={p.id} className="text-sm text-warning-foreground">
                <strong>{p.item}</strong> ({CAT_LABEL[p.categoria] ?? p.categoria}) sem OC — necessário em {formatarDataBR(p.data_necessidade!)} ({diasEntre(hoje, p.data_necessidade!)}d).
              </p>
            ))}
            {alertasOC.map((o) => (
              <p key={o.id} className="text-sm text-warning-foreground">
                OC <strong>{o.item}</strong> ({o.fornecedor}) — entrega prevista {formatarDataBR(o.previsao_entrega!)} ({diasEntre(hoje, o.previsao_entrega!)}d) e ainda não entregue.
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Perdas por categoria + ABC */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><TrendingDown className="size-5 text-primary" /> Perdas e glosa por categoria</h2>
          {perdas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem planejamento/consumo lançado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2 text-right">Previsto</th>
                  <th className="pb-2 text-right">Consumido</th>
                  <th className="pb-2 text-right">Perda</th>
                  <th className="pb-2 text-right">Tol.</th>
                  <th className="pb-2 text-right">Glosa</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {perdas.map((p) => (
                  <tr key={p.cat} className="text-secondary">
                    <td className="py-2">{CAT_LABEL[p.cat] ?? p.cat}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{p.previsto}</td>
                    <td className="py-2 text-right tabular-nums">{p.consumido}</td>
                    <td className={cn("py-2 text-right tabular-nums", p.excede ? "font-bold text-destructive" : "")}>{p.perdaPct}%</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{p.tol}%</td>
                    <td className={cn("py-2 text-right tabular-nums", p.glosaValor > 0 ? "font-bold text-destructive" : "text-muted-foreground")}>{formatarMoeda(p.glosaValor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {glosaTotal > 0 && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Proposta de glosa a descontar da medição do mês: <strong>{formatarMoeda(glosaTotal)}</strong> (perdas acima da tolerância).
            </p>
          )}
          {abc.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-secondary">Curva ABC (por item comprado)</p>
              <div className="flex flex-wrap gap-1.5">
                {abc.map((i) => (
                  <span key={i.item} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold",
                    i.classe === "A" ? "bg-destructive/10 text-destructive" : i.classe === "B" ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground")}>
                    {i.classe} · {i.item} · {formatarMoeda(i.valor)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planejamento */}
      <Secao titulo="Planejamento de materiais" icone={<ClipboardList className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovoItem(true)}><Plus className="size-4" /> Novo item</Button>}>
        {listaPlan.length === 0 ? <EmptyState label="Nenhum material planejado." /> : (
          <div className="divide-y">
            {listaPlan.map((p) => {
              const temOC = ocPorPlan.has(p.id);
              const nCot = listaCot.filter((c) => c.planejamento_id === p.id).length;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-secondary">{p.item}</span>
                      <Badge variant="muted">{CAT_LABEL[p.categoria] ?? p.categoria}</Badge>
                      {temOC ? <Badge variant="success">com OC</Badge> : nCot < 3 ? <Badge variant="warning">{nCot}/3 cotações</Badge> : <Badge variant="default">cotado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.quantidade_prevista} {p.unidade}
                      {p.data_necessidade ? ` · necessário em ${formatarDataBR(p.data_necessidade)}` : ""}
                    </p>
                  </div>
                  {podeEditar && <Button size="sm" variant="outline" onClick={() => setCotarItem(p)}>Cotações / OC</Button>}
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      {/* Ordens de compra */}
      <Secao titulo="Ordens de compra" icone={<Truck className="size-5 text-primary" />}>
        {listaOC.length === 0 ? <EmptyState label="Nenhuma OC emitida." /> : (
          <div className="divide-y">
            {listaOC.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{o.item}</span>
                    <Badge variant={OC_VARIANTE[o.status]}>{o.status}</Badge>
                    <span className="text-xs text-muted-foreground">{o.fornecedor}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.quantidade} {o.unidade} · {formatarMoeda(o.valor_total)}
                    {o.previsao_entrega ? ` · entrega ${formatarDataBR(o.previsao_entrega)}` : ""}
                  </p>
                </div>
                {podeEditar && o.status !== "Entregue" && o.status !== "Cancelada" && (
                  <Button size="sm" variant="outline" onClick={() => setReceberOc(o)}><PackageCheck className="size-4" /> Receber</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* Consumo */}
      <Secao titulo="Consumo (baixa por etapa/fase)" icone={<Package className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovoConsumo(true)}><Plus className="size-4" /> Registrar consumo</Button>}>
        {listaConsumo.length === 0 ? <EmptyState label="Nenhum consumo registrado." /> : (
          <div className="divide-y">
            {listaConsumo.slice(0, 20).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong className="text-secondary">{c.item}</strong> <Badge variant="muted">{CAT_LABEL[c.categoria] ?? c.categoria}</Badge></span>
                <span className="tabular-nums text-muted-foreground">{c.quantidade_consumida} {c.unidade} · {formatarDataBR(c.data_consumo)}</span>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* Estoque de reposição */}
      <Secao titulo="Estoque de reposição (3% acabamentos)" icone={<Recycle className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovaRepo(true)}><Plus className="size-4" /> Item</Button>}>
        {(reposicao.data ?? []).length === 0 ? <EmptyState label="Nenhum item de reposição." /> : (
          <div className="divide-y">
            {(reposicao.data ?? []).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {r.entregue ? <Check className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                  <strong className="text-secondary">{r.item}</strong> · {r.quantidade} {r.unidade}
                </span>
                {r.entregue ? <Badge variant="success">entregue {r.entregue_em ? formatarDataBR(r.entregue_em) : ""}</Badge>
                  : podeEditar ? <EntregarBtn id={r.id} /> : <Badge variant="warning">pendente</Badge>}
              </div>
            ))}
          </div>
        )}
      </Secao>

      {novoItem && <ModalNovoItem fases={fases.data ?? []} onFechar={() => setNovoItem(false)} />}
      {cotarItem && <ModalCotacoes item={cotarItem} cotacoes={listaCot.filter((c) => c.planejamento_id === cotarItem.id)} temOC={ocPorPlan.has(cotarItem.id)} onFechar={() => setCotarItem(null)} />}
      {receberOc && <ModalReceber oc={receberOc} onFechar={() => setReceberOc(null)} />}
      {novoConsumo && <ModalConsumo fases={fases.data ?? []} onFechar={() => setNovoConsumo(false)} />}
      {novaRepo && <ModalReposicao fases={fases.data ?? []} onFechar={() => setNovaRepo(false)} />}
    </div>
  );
}

function Metrica({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "destructive" | "warning" }) {
  const cor = tom === "destructive" ? "text-destructive" : tom === "warning" ? "text-warning" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div><p className={cn("text-xl font-extrabold tabular-nums", cor)}>{valor}</p><p className="text-xs text-muted-foreground">{rotulo}</p></div>
    </div>
  );
}

function Secao({ titulo, icone, acao, children }: { titulo: string; icone: React.ReactNode; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">{icone} {titulo}</h2>
          {acao}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function EntregarBtn({ id }: { id: string }) {
  const entregar = useEntregarReposicao();
  return (
    <button onClick={() => entregar.mutate({ id, hoje: hojeISO() })} className="text-xs font-semibold text-success hover:underline" disabled={entregar.isPending}>
      Marcar entregue
    </button>
  );
}

// ── Modais ────────────────────────────────────────────────────────────────
function ModalBase({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalNovoItem({ fases, onFechar }: { fases: { id: string; nome: string }[]; onFechar: () => void }) {
  const criar = useCriarPlanejamento();
  const [categoria, setCategoria] = useState<string>("concreto");
  const [item, setItem] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [qtd, setQtd] = useState("");
  const [faseId, setFaseId] = useState("");
  const [necessidade, setNecessidade] = useState("");

  async function salvar() {
    const q = parseFloat(qtd.replace(",", "."));
    if (!item.trim() || !Number.isFinite(q) || q < 0) { toast.error("Informe item e quantidade."); return; }
    try {
      await criar.mutateAsync({ categoria, item: item.trim(), unidade: unidade.trim() || "un", quantidade_prevista: q, fase_id: faseId || null, data_necessidade: necessidade || null });
      toast.success("Item planejado."); onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <ModalBase titulo="Novo item de planejamento" onFechar={onFechar}>
      <div className="space-y-3">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputBase}>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item (ex.: Concreto FCK 30)" className={inputBase} />
        <div className="grid grid-cols-2 gap-2">
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="Quantidade" className={inputBase} />
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade" className={inputBase} />
        </div>
        <select value={faseId} onChange={(e) => setFaseId(e.target.value)} className={inputBase}>
          <option value="">Sem fase específica</option>
          {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <label className="block space-y-1"><span className="text-xs text-muted-foreground">Necessário na obra em</span>
          <input type="date" value={necessidade} onChange={(e) => setNecessidade(e.target.value)} className={inputBase} /></label>
        <Button className="w-full" onClick={salvar} loading={criar.isPending}>Salvar</Button>
      </div>
    </ModalBase>
  );
}

function ModalCotacoes({ item, cotacoes, temOC, onFechar }: { item: ObraPlanejamentoMaterial; cotacoes: ObraCotacao[]; temOC: boolean; onFechar: () => void }) {
  const criar = useCriarCotacao();
  const escolher = useEscolherCotacao();
  const criarOC = useCriarOC();
  const [fornecedor, setFornecedor] = useState("");
  const [preco, setPreco] = useState("");
  const [prazo, setPrazo] = useState("");
  const [previsao, setPrevisao] = useState("");
  const escolhida = cotacoes.find((c) => c.escolhida);

  async function addCotacao() {
    const p = parseFloat(preco.replace(",", "."));
    if (!fornecedor.trim() || !Number.isFinite(p)) { toast.error("Informe fornecedor e preço."); return; }
    try { await criar.mutateAsync({ planejamentoId: item.id, fornecedor, precoUnitario: p, prazoDias: prazo ? parseInt(prazo, 10) : null }); setFornecedor(""); setPreco(""); setPrazo(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function gerarOC() {
    if (!escolhida) { toast.error("Escolha uma cotação primeiro."); return; }
    try {
      await criarOC.mutateAsync({ planejamento: item, cotacaoId: escolhida.id, fornecedor: escolhida.fornecedor, quantidade: item.quantidade_prevista, precoUnitario: escolhida.preco_unitario, previsaoEntrega: previsao || null });
      toast.success("OC emitida."); onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }

  return (
    <ModalBase titulo={`${item.item} — cotações`} onFechar={onFechar}>
      <p className="mb-2 text-xs text-muted-foreground">{item.quantidade_prevista} {item.unidade} · mín. 3 fornecedores</p>
      <div className="space-y-1">
        {cotacoes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma cotação ainda.</p> :
          cotacoes.map((c) => (
            <div key={c.id} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", c.escolhida ? "border-success/50 bg-success/5" : "border-border")}>
              <span><strong className="text-secondary">{c.fornecedor}</strong> · {formatarMoeda(c.preco_unitario)}/{item.unidade}{c.prazo_entrega_dias ? ` · ${c.prazo_entrega_dias}d` : ""}</span>
              {c.escolhida ? <Badge variant="success">escolhida</Badge> : !temOC && <button onClick={() => escolher.mutate({ cotacaoId: c.id, planejamentoId: item.id })} className="text-xs font-semibold text-primary hover:underline">Escolher</button>}
            </div>
          ))}
      </div>
      {!temOC && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Fornecedor" className={cn(inputBase, "col-span-3 h-9")} />
            <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="Preço unit." className={cn(inputBase, "h-9 col-span-2")} />
            <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" placeholder="Prazo d" className={cn(inputBase, "h-9")} />
          </div>
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={addCotacao} loading={criar.isPending}>Adicionar cotação</Button>
          <div className="mt-4 border-t pt-3">
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Previsão de entrega da OC</span>
              <input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} className={inputBase} /></label>
            <span className="mt-2 block" title={escolhida ? undefined : "Escolha uma cotação para emitir a OC"}>
              <Button className="w-full" onClick={gerarOC} disabled={!escolhida || criarOC.isPending} loading={criarOC.isPending}>Emitir OC pela cotação escolhida</Button>
            </span>
          </div>
        </>
      )}
      {temOC && <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Este item já tem OC emitida.</p>}
    </ModalBase>
  );
}

function ModalReceber({ oc, onFechar }: { oc: ObraOrdemCompra; onFechar: () => void }) {
  const receber = useRegistrarRecebimento();
  const [qtd, setQtd] = useState(String(oc.quantidade));
  const [foto, setFoto] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const q = parseFloat(qtd.replace(",", "."));
  const divergente = Number.isFinite(q) && q !== oc.quantidade;

  async function salvar() {
    if (!Number.isFinite(q) || q < 0) { toast.error("Quantidade inválida."); return; }
    try {
      await receber.mutateAsync({ oc, quantidadeRecebida: q, foto, observacao: obs });
      toast.success(divergente ? "Recebimento com divergência — NC sinalizada." : "Recebimento conferido."); onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  function onFoto(e: ChangeEvent<HTMLInputElement>) { setFoto(e.target.files?.[0] ?? null); }

  return (
    <ModalBase titulo={`Receber — ${oc.item}`} onFechar={onFechar}>
      <p className="mb-3 text-sm text-muted-foreground">OC: {oc.quantidade} {oc.unidade} · {oc.fornecedor}</p>
      <div className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Quantidade recebida</span>
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" className={inputBase} /></label>
        {divergente && <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">Divergência vs OC ({oc.quantidade} {oc.unidade}) — será sinalizada uma NC.</p>}
        <label className="block cursor-pointer text-sm font-semibold text-primary hover:underline">Foto da conferência<input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFoto} /></label>
        {foto && <p className="text-xs text-success">Foto selecionada.</p>}
        <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação" className={inputBase} />
        <Button className="w-full" onClick={salvar} loading={receber.isPending}>Confirmar recebimento</Button>
      </div>
    </ModalBase>
  );
}

function ModalConsumo({ fases, onFechar }: { fases: { id: string; nome: string }[]; onFechar: () => void }) {
  const registrar = useRegistrarConsumo();
  const [categoria, setCategoria] = useState("concreto");
  const [item, setItem] = useState("");
  const [qtd, setQtd] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [faseId, setFaseId] = useState("");

  async function salvar() {
    const q = parseFloat(qtd.replace(",", "."));
    if (!item.trim() || !Number.isFinite(q) || q < 0) { toast.error("Informe item e quantidade."); return; }
    try { await registrar.mutateAsync({ categoria, item: item.trim(), unidade: unidade.trim() || "un", quantidade_consumida: q, fase_id: faseId || null }); toast.success("Consumo registrado."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <ModalBase titulo="Registrar consumo" onFechar={onFechar}>
      <div className="space-y-3">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputBase}>{CATEGORIAS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item" className={inputBase} />
        <div className="grid grid-cols-2 gap-2">
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="Quantidade" className={inputBase} />
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade" className={inputBase} />
        </div>
        <select value={faseId} onChange={(e) => setFaseId(e.target.value)} className={inputBase}><option value="">Sem fase</option>{fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
        <Button className="w-full" onClick={salvar} loading={registrar.isPending}>Registrar</Button>
      </div>
    </ModalBase>
  );
}

function ModalReposicao({ fases, onFechar }: { fases: { id: string; nome: string }[]; onFechar: () => void }) {
  const criar = useCriarReposicao();
  const [categoria, setCategoria] = useState("ceramicos");
  const [item, setItem] = useState("");
  const [qtd, setQtd] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [faseId, setFaseId] = useState("");

  async function salvar() {
    const q = parseFloat(qtd.replace(",", "."));
    if (!item.trim() || !Number.isFinite(q) || q < 0) { toast.error("Informe item e quantidade."); return; }
    try { await criar.mutateAsync({ categoria, item: item.trim(), unidade: unidade.trim() || "un", quantidade: q, fase_id: faseId || null }); toast.success("Item de reposição criado."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <ModalBase titulo="Item de reposição (3% acabamentos)" onFechar={onFechar}>
      <div className="space-y-3">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputBase}>{CATEGORIAS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item (ex.: Porcelanato 60×60)" className={inputBase} />
        <div className="grid grid-cols-2 gap-2">
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="Quantidade (3%)" className={inputBase} />
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade" className={inputBase} />
        </div>
        <select value={faseId} onChange={(e) => setFaseId(e.target.value)} className={inputBase}><option value="">Sem fase</option>{fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
        <Button className="w-full" onClick={salvar} loading={criar.isPending}>Salvar</Button>
      </div>
    </ModalBase>
  );
}
