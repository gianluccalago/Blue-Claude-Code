import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Landmark, Plus, X, Download, Pencil, Trash2, TrendingUp, Wallet, CalendarClock,
  RefreshCw, Percent, Link2, FileText,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ModalExtratoSocios } from "@/routes/obra/ObraExtratoSocios";
import {
  useLancamentosFC, useIpcaFC, useCriarLancamentoFC, useEditarLancamentoFC,
  useExcluirLancamentoFC, useDefinirIpca, useSincronizarFC, pendentesDeSincronizacao,
  type LancamentoInput,
} from "@/hooks/useFluxoCaixa";
import { useMarcos, useDisciplinas } from "@/hooks/useObraProjetos";
import { useMedicoes } from "@/hooks/useObraMedicoes";
import { useOrdensCompra } from "@/hooks/useObraMateriais";
import { useCustosIndiretos } from "@/hooks/useObraCustos";
import { useNotasFiscais } from "@/hooks/useObraNotas";
import { CENTROS_CUSTO, PAGADORES, rotuloCentro, rotuloPagador, serieMensalFC, mesCurto } from "@/lib/fluxoCaixa";
import { exportarCSV } from "@/lib/exportCsv";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { FcLancamento } from "@/types/database";

// ===========================================================================
// FLUXO DE CAIXA — controle interno (master · direção · administração).
// SEMPRE por caixa (data de pagamento), nunca competência. Substitui a
// planilha CustoBlue: lançamentos com data exata, centro de custo,
// fornecedor, pagador e correção IPCA do acumulado. Os pagamentos feitos no
// módulo Obra entram sozinhos (sincronização) e tudo é editável.
// ===========================================================================

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selBase = "h-9 rounded-md border border-input bg-card px-2 text-sm";

const CENTRO_COR: Record<string, string> = {
  terreno: "bg-secondary", projetos: "bg-primary", complementares: "bg-primary-strong",
  construtora: "bg-warning", materiais: "bg-success", indiretos: "bg-muted-foreground",
};

export function ObraCaixa() {
  const { usuarioEfetivo } = useAuth();
  // Extrato dos sócios + demonstrativo assinado: SÓ master/direção (o RLS
  // reforça no banco; a administração usa o restante do caixa normalmente).
  const ehSocio = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";
  const lanc = useLancamentosFC();
  const ipca = useIpcaFC();
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const medicoes = useMedicoes();
  const ocs = useOrdensCompra();
  const indiretos = useCustosIndiretos();
  const notas = useNotasFiscais();
  const sincronizar = useSincronizarFC();
  const excluir = useExcluirLancamentoFC();

  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<FcLancamento | null>(null);
  const [excluindo, setExcluindo] = useState<FcLancamento | null>(null);
  const [ipcaAberto, setIpcaAberto] = useState(false);
  const [extratoAberto, setExtratoAberto] = useState(false);

  // Filtros
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [centro, setCentro] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [pagador, setPagador] = useState("");
  const [busca, setBusca] = useState("");

  // ── Sincronização automática (1× por carga): pagamentos do Obra → caixa ──
  const sincronizou = useRef(false);
  const tudoCarregado = !lanc.isLoading && !marcos.isLoading && !medicoes.isLoading && !ocs.isLoading && !indiretos.isLoading && !notas.isLoading;
  useEffect(() => {
    if (!tudoCarregado || sincronizou.current) return;
    sincronizou.current = true;
    const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
    const novos = pendentesDeSincronizacao({
      existentes: lanc.data ?? [],
      marcos: marcos.data ?? [],
      nomeDisciplina: nomeDisc,
      medicoes: medicoes.data ?? [],
      ocs: ocs.data ?? [],
      indiretos: indiretos.data ?? [],
      notas: notas.data ?? [],
    });
    if (novos.length > 0) {
      sincronizar.mutate(novos, {
        onSuccess: (n) => toast.success(`${n} pagamento(s) do módulo Obra entraram no caixa.`),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tudoCarregado]);

  const todos = lanc.data ?? [];
  const fornecedores = useMemo(() => [...new Set(todos.map((l) => l.fornecedor))].sort(), [todos]);
  const centrosEmUso = useMemo(() => {
    const extras = [...new Set(todos.map((l) => l.centro_custo))].filter(
      (c) => !CENTROS_CUSTO.some((k) => k.value === c),
    );
    return [...CENTROS_CUSTO.map((c) => c.value), ...extras.sort()];
  }, [todos]);

  const filtrados = todos.filter((l) =>
    (!de || l.data >= de) && (!ate || l.data <= ate) &&
    (!centro || l.centro_custo === centro) &&
    (!fornecedor || l.fornecedor === fornecedor) &&
    (!pagador || l.pagador === pagador) &&
    (!busca || `${l.fornecedor} ${l.descricao ?? ""} ${l.observacao ?? ""}`.toLowerCase().includes(busca.toLowerCase())),
  );
  const temFiltro = !!(de || ate || centro || fornecedor || pagador || busca);

  // Séries: a corrigida é SEMPRE global (a correção composta não faz sentido
  // sobre um recorte); os cards de mês respeitam os filtros.
  const serieGlobal = useMemo(() => serieMensalFC(todos, ipca.data ?? new Map()), [todos, ipca.data]);
  const serieFiltrada = useMemo(() => serieMensalFC(filtrados, ipca.data ?? new Map()), [filtrados, ipca.data]);

  const totalGeral = todos.reduce((s, l) => s + l.valor, 0);
  const corrigidoFinal = serieGlobal.at(-1)?.corrigido ?? 0;
  const mesAtual = hojeISO().slice(0, 7);
  const noMes = todos.filter((l) => l.data.startsWith(mesAtual)).reduce((s, l) => s + l.valor, 0);
  const totalFiltrado = filtrados.reduce((s, l) => s + l.valor, 0);

  // Totais por centro (respeitam filtros de período/fornecedor/pagador/busca).
  const porCentro = new Map<string, number>();
  for (const l of filtrados) porCentro.set(l.centro_custo, (porCentro.get(l.centro_custo) ?? 0) + l.valor);
  const maxCentro = Math.max(1, ...porCentro.values());

  const maxMes = Math.max(1, ...serieFiltrada.map((s) => s.total));

  function exportar() {
    const ok = exportarCSV(
      "fluxo-de-caixa",
      [...filtrados].sort((a, b) => a.data.localeCompare(b.data)).map((l) => ({
        data: l.data, valor: l.valor, centro: rotuloCentro(l.centro_custo),
        fornecedor: l.fornecedor, descricao: l.descricao ?? "", pagador: rotuloPagador(l.pagador),
        origem: l.origem, observacao: l.observacao ?? "",
      })),
    );
    if (!ok) toast.error("Nada para exportar.");
  }

  if (lanc.isLoading) return <LoadingState />;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Landmark className="size-5 text-primary" /> Fluxo de caixa do empreendimento
          </h2>
          <p className="text-xs text-muted-foreground">
            Sempre por CAIXA (data do pagamento). Pagamentos do módulo Obra entram sozinhos; tudo é editável.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ehSocio && (
            <Button size="sm" variant="outline" onClick={() => setExtratoAberto(true)}>
              <FileText className="size-4" /> Demonstrativo (PDF)
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setIpcaAberto(true)}><Percent className="size-4" /> IPCA</Button>
          <Button size="sm" variant="outline" onClick={exportar}><Download className="size-4" /> CSV</Button>
          <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Novo lançamento</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiFC icone={<Wallet className="size-4" />} rotulo="Total desembolsado" valor={formatarMoeda(totalGeral)} />
        <KpiFC icone={<TrendingUp className="size-4" />} rotulo="Acumulado corrigido (IPCA)" valor={formatarMoeda(corrigidoFinal)} tom="primario" />
        <KpiFC icone={<CalendarClock className="size-4" />} rotulo={`Saída em ${mesCurto(mesAtual)}`} valor={formatarMoeda(noMes)} />
        <KpiFC icone={<RefreshCw className="size-4" />} rotulo="Lançamentos" valor={String(todos.length)} />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">De
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={cn(selBase, "block")} /></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Até
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={cn(selBase, "block")} /></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Centro de custo
            <select value={centro} onChange={(e) => setCentro(e.target.value)} className={cn(selBase, "block")}>
              <option value="">Todos</option>
              {centrosEmUso.map((c) => <option key={c} value={c}>{rotuloCentro(c)}</option>)}
            </select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Fornecedor
            <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={cn(selBase, "block")}>
              <option value="">Todos</option>
              {fornecedores.map((f) => <option key={f} value={f}>{f}</option>)}
            </select></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Pagador
            <select value={pagador} onChange={(e) => setPagador(e.target.value)} className={cn(selBase, "block")}>
              <option value="">Todos</option>
              {PAGADORES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select></label>
          <label className="min-w-40 flex-1 space-y-1 text-xs font-semibold text-muted-foreground">Buscar
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="fornecedor, item, obs…" className={cn(selBase, "block w-full")} /></label>
          {temFiltro && (
            <div className="flex items-center gap-2">
              <Badge variant="default">{filtrados.length} · {formatarMoeda(totalFiltrado)}</Badge>
              <button onClick={() => { setDe(""); setAte(""); setCentro(""); setFornecedor(""); setPagador(""); setBusca(""); }} className="text-xs font-semibold text-primary hover:underline">limpar</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por centro de custo + mês a mês */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-secondary">Por centro de custo{temFiltro ? " (filtro aplicado)" : ""}</h3>
            {[...porCentro.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <button key={c} onClick={() => setCentro(centro === c ? "" : c)} className="block w-full text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn("font-semibold", centro === c ? "text-primary" : "text-secondary")}>{rotuloCentro(c)}</span>
                  <span className="tabular-nums font-bold text-secondary">{formatarMoeda(v)}</span>
                </div>
                <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", CENTRO_COR[c] ?? "bg-primary")} style={{ width: `${(v / maxCentro) * 100}%` }} />
                </div>
              </button>
            ))}
            {porCentro.size === 0 && <p className="text-sm text-muted-foreground">Sem lançamentos no filtro.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1.5 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-secondary">Mês a mês{temFiltro ? " (filtro aplicado)" : ""}</h3>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {[...serieFiltrada].reverse().map((s) => (
                <div key={s.mes} className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 font-semibold text-muted-foreground">{mesCurto(s.mes)}</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(s.total / maxMes) * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right font-bold tabular-nums text-secondary">{formatarMoeda(s.total)}</span>
                </div>
              ))}
            </div>
            {!temFiltro && serieGlobal.length > 0 && (
              <p className="border-t pt-1.5 text-xs text-muted-foreground">
                Acumulado nominal <strong className="tabular-nums text-secondary">{formatarMoeda(serieGlobal.at(-1)!.acumulado)}</strong>{" "}
                · corrigido IPCA <strong className="tabular-nums text-secondary">{formatarMoeda(corrigidoFinal)}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lançamentos */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-1 text-sm font-bold text-secondary">Lançamentos {temFiltro && <span className="font-normal text-muted-foreground">({filtrados.length} de {todos.length})</span>}</h3>
          {filtrados.length === 0 ? <EmptyState label="Nenhum lançamento no filtro." /> : (
            <div className="divide-y">
              {filtrados.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-20 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{formatarDataBR(l.data)}</span>
                  <span className={cn("size-2 shrink-0 rounded-full", CENTRO_COR[l.centro_custo] ?? "bg-primary")} title={rotuloCentro(l.centro_custo)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-secondary">
                      {l.fornecedor}
                      {l.descricao && <span className="font-normal text-muted-foreground"> · {l.descricao}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {rotuloCentro(l.centro_custo)} · {rotuloPagador(l.pagador)}
                      {l.origem !== "manual" && l.origem !== "planilha" && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-primary"><Link2 className="size-3" /> módulo Obra</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-secondary">{formatarMoeda(l.valor)}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => setEditando(l)} className="text-muted-foreground hover:text-primary" title="Editar"><Pencil className="size-3.5" /></button>
                    <button onClick={() => setExcluindo(l)} className="text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="size-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(novo || editando) && (
        <ModalLancamento
          original={editando}
          fornecedores={fornecedores}
          onFechar={() => { setNovo(false); setEditando(null); }}
        />
      )}
      {ipcaAberto && <ModalIpca serie={serieGlobal} ipca={ipca.data ?? new Map()} onFechar={() => setIpcaAberto(false)} />}
      {extratoAberto && ehSocio && <ModalExtratoSocios onFechar={() => setExtratoAberto(false)} />}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir lançamento?"
        descricao={excluindo ? `${formatarDataBR(excluindo.data)} · ${excluindo.fornecedor} · ${formatarMoeda(excluindo.valor)}${excluindo.origem_id ? " — veio do módulo Obra: se o pagamento continuar registrado lá, ele volta na próxima sincronização (edite em vez de excluir, ou desfaça o pagamento na origem)." : ""}` : ""}
        textoConfirmar="Excluir"
        onConfirmar={() => {
          const alvo = excluindo;
          setExcluindo(null);
          if (!alvo) return;
          excluir.mutate(alvo.id, {
            onSuccess: () => toast.success("Lançamento excluído."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
          });
        }}
        onCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function KpiFC({ icone, rotulo, valor, tom }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "primario" }) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5", tom === "primario" ? "border-primary/50 bg-primary/5" : "border-border bg-muted/20")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-card", "text-primary")}>{icone}</span>
      <div className="min-w-0">
        <p className="truncate text-base font-extrabold tabular-nums text-secondary" title={valor}>{valor}</p>
        <p className="truncate text-[11px] text-muted-foreground" title={rotulo}>{rotulo}</p>
      </div>
    </div>
  );
}

function ModalLancamento({ original, fornecedores, onFechar }: {
  original: FcLancamento | null;
  fornecedores: string[];
  onFechar: () => void;
}) {
  const criar = useCriarLancamentoFC();
  const editar = useEditarLancamentoFC();
  const [v, setV] = useState<LancamentoInput>({
    data: original?.data ?? hojeISO(),
    valor: original?.valor ?? 0,
    centroCusto: original?.centro_custo ?? "indiretos",
    fornecedor: original?.fornecedor ?? "",
    descricao: original?.descricao ?? "",
    pagador: original?.pagador ?? "seniors",
    observacao: original?.observacao ?? "",
  });
  const [valorTxt, setValorTxt] = useState(original ? String(original.valor) : "");
  const pending = criar.isPending || editar.isPending;

  async function salvar() {
    const valor = parseFloat(valorTxt.replace(/\./g, "").replace(",", ".")) || parseFloat(valorTxt) || 0;
    const payload = { ...v, valor };
    try {
      if (original) await editar.mutateAsync({ id: original.id, ...payload });
      else await criar.mutateAsync(payload);
      toast.success(original ? "Lançamento atualizado." : "Lançamento registrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-lg animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{original ? "Editar lançamento" : "Novo lançamento (saída de caixa)"}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Data do pagamento *</span>
              <input type="date" value={v.data} onChange={(e) => setV((p) => ({ ...p, data: e.target.value }))} className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Valor (R$) *</span>
              <input value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputBase} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Centro de custo</span>
              <select value={v.centroCusto} onChange={(e) => setV((p) => ({ ...p, centroCusto: e.target.value }))} className={inputBase}>
                {CENTROS_CUSTO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                {!CENTROS_CUSTO.some((c) => c.value === v.centroCusto) && <option value={v.centroCusto}>{v.centroCusto}</option>}
              </select></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Pagador</span>
              <select value={v.pagador} onChange={(e) => setV((p) => ({ ...p, pagador: e.target.value as LancamentoInput["pagador"] }))} className={inputBase}>
                {PAGADORES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select></label>
          </div>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Fornecedor / destino *</span>
            <input value={v.fornecedor} onChange={(e) => setV((p) => ({ ...p, fornecedor: e.target.value }))} list="fc-fornecedores" placeholder="ex.: Vendedores, Bacoccini, TRÍADE…" className={inputBase} />
            <datalist id="fc-fornecedores">{fornecedores.map((f) => <option key={f} value={f} />)}</datalist></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Item / descrição</span>
            <input value={v.descricao} onChange={(e) => setV((p) => ({ ...p, descricao: e.target.value }))} placeholder="ex.: parcela 12/48 do terreno" className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Observação</span>
            <input value={v.observacao} onChange={(e) => setV((p) => ({ ...p, observacao: e.target.value }))} className={inputBase} /></label>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={pending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={pending}>{original ? "Salvar" : "Registrar"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** IPCA mensal — mantém a correção do acumulado (fórmula da planilha). */
function ModalIpca({ serie, ipca, onFechar }: {
  serie: { mes: string; total: number; corrigido: number }[];
  ipca: Map<string, number>;
  onFechar: () => void;
}) {
  const definir = useDefinirIpca();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [pct, setPct] = useState("");

  async function salvar() {
    const val = parseFloat(pct.replace(",", "."));
    if (Number.isNaN(val)) { toast.error("Informe o IPCA do mês em % (ex.: 0,44)."); return; }
    try {
      await definir.mutateAsync({ mes, pct: val / 100 });
      toast.success(`IPCA de ${mesCurto(mes)} salvo (${pct}%).`);
      setPct("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Correção IPCA</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Corrigido do mês = (anterior + desembolso do mês) × (1 + IPCA). Cadastre o índice de cada mês novo.
        </p>
        <div className="mb-4 flex items-end gap-2">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">Mês
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={cn(selBase, "block")} /></label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">IPCA (%)
            <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="0,44" className={cn(selBase, "block w-24")} /></label>
          <Button size="sm" onClick={salvar} loading={definir.isPending}>Salvar</Button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto border-t pt-2 text-xs">
          {[...serie].reverse().map((s) => (
            <div key={s.mes} className="flex items-center justify-between gap-2 tabular-nums">
              <span className="font-semibold text-muted-foreground">{mesCurto(s.mes)}</span>
              <span className={cn(ipca.has(s.mes) ? "text-secondary" : "text-warning")}>
                {ipca.has(s.mes) ? `${(ipca.get(s.mes)! * 100).toFixed(2).replace(".", ",")}%` : "sem índice"}
              </span>
              <span className="text-muted-foreground">{formatarMoeda(s.total)}</span>
              <span className="font-semibold text-secondary">{formatarMoeda(s.corrigido)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
