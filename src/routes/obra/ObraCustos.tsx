import { useState } from "react";
import { toast } from "sonner";
import { Coins, Plus, Trash2, Repeat, Download, X, Pencil } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useCustosIndiretos, useCriarCustoIndireto, useEditarCustoIndireto, useExcluirCustoIndireto } from "@/hooks/useObraCustos";
import { somaPorMes } from "@/lib/obraFinanceiro";
import { arred } from "@/lib/obraCalc";
import { exportarCSV } from "@/lib/exportCsv";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatarMoeda, formatarMesReferencia } from "@/lib/mensalidade";
import { cn, hojeISO } from "@/lib/utils";
import type { ObraCustoIndireto } from "@/types/database";

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CATEGORIAS = [
  { value: "engenharia", label: "Engenharia / fiscalização" },
  { value: "software", label: "Software / assinaturas" },
  { value: "administrativo", label: "Administrativo" },
  { value: "taxas", label: "Taxas / cartório" },
  { value: "financeiro", label: "Financeiro / juros" },
  { value: "outros", label: "Outros" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

export function ObraCustos() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";
  const custos = useCustosIndiretos();
  const excluir = useExcluirCustoIndireto();
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<ObraCustoIndireto | null>(null);
  const [aExcluir, setAExcluir] = useState<ObraCustoIndireto | null>(null);

  if (custos.isLoading) return <LoadingState />;
  if (custos.isError) return <ErrorState error={custos.error} />;

  const lista = custos.data ?? [];
  const total = arred(lista.reduce((s, c) => s + c.valor, 0));
  const recorrenteMensal = arred(lista.filter((c) => c.recorrente).reduce((s, c) => s + c.valor, 0));
  const porMes = somaPorMes(lista.map((c) => ({ mes: c.competencia, valor: c.valor })))
    .sort((a, b) => b.mes.localeCompare(a.mes));

  // Agrupa lançamentos por competência (mês).
  const grupos = new Map<string, ObraCustoIndireto[]>();
  for (const c of lista) {
    const arr = grupos.get(c.competencia) ?? [];
    arr.push(c);
    grupos.set(c.competencia, arr);
  }
  const meses = [...grupos.keys()].sort((a, b) => b.localeCompare(a));

  function exportar() {
    const ok = exportarCSV("obra-custos-indiretos", lista.map((c) => ({
      Competência: c.competencia, Categoria: CAT_LABEL[c.categoria] ?? c.categoria,
      Descrição: c.descricao, "Valor (R$)": c.valor, Recorrente: c.recorrente ? "Sim" : "Não",
    })));
    if (!ok) toast.error("Nada para exportar.");
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><Coins className="size-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Custos indiretos</h1>
            <p className="text-xs text-muted-foreground">Engenharia, assinaturas, administrativo e gastos gerais — por mês.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar} disabled={lista.length === 0}><Download className="size-4" /> CSV</Button>
          {podeEditar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Lançar custo</Button>}
        </div>
      </div>

      {/* Totais */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi rotulo="Total acumulado" valor={formatarMoeda(total)} />
        <Kpi rotulo="Recorrente/mês" valor={formatarMoeda(recorrenteMensal)} />
        <Kpi rotulo="Lançamentos" valor={String(lista.length)} />
      </div>

      {/* Controle mensal */}
      {lista.length === 0 ? (
        <EmptyState label="Nenhum custo indireto lançado. Registre honorários, assinaturas e gastos gerais da obra." />
      ) : (
        <div className="space-y-3">
          {meses.map((mes) => {
            const itens = grupos.get(mes)!;
            const totalMes = arred(itens.reduce((s, c) => s + c.valor, 0));
            return (
              <Card key={mes}>
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-bold text-secondary">{formatarMesReferencia(mes)}</h2>
                    <span className="font-bold tabular-nums text-secondary">{formatarMoeda(totalMes)}</span>
                  </div>
                  <div className="divide-y">
                    {itens.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-secondary">{c.descricao}</span>
                            <Badge variant="muted">{CAT_LABEL[c.categoria] ?? c.categoria}</Badge>
                            {c.recorrente && <Badge variant="default" className="gap-1"><Repeat className="size-3" /> mensal</Badge>}
                          </div>
                          {c.observacao && <p className="text-xs text-muted-foreground">{c.observacao}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-secondary">{formatarMoeda(c.valor)}</span>
                          {podeEditar && (
                            <>
                              <button onClick={() => setEditando(c)} className="text-muted-foreground hover:text-primary" title="Editar"><Pencil className="size-4" /></button>
                              <button onClick={() => setAExcluir(c)} className="text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 className="size-4" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Evolução mensal (mini) */}
      {porMes.length > 1 && (
        <Card><CardContent className="p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-secondary">Evolução mensal</p>
          <div className="flex flex-wrap gap-2">
            {porMes.map((m) => (
              <span key={m.mes} className="rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">{formatarMesReferencia(m.mes)}</span> · <strong className="tabular-nums text-secondary">{formatarMoeda(m.valor)}</strong>
              </span>
            ))}
          </div>
        </CardContent></Card>
      )}

      {novo && <ModalCusto onFechar={() => setNovo(false)} />}
      {editando && <ModalCusto inicial={editando} onFechar={() => setEditando(null)} />}
      <ConfirmDialog
        aberto={!!aExcluir}
        titulo="Excluir lançamento?"
        descricao={aExcluir ? `${aExcluir.descricao} · ${formatarMoeda(aExcluir.valor)}` : ""}
        textoConfirmar="Excluir"
        onConfirmar={async () => {
          const c = aExcluir; setAExcluir(null);
          if (!c) return;
          try { await excluir.mutateAsync(c.id); toast.success("Lançamento excluído."); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao excluir."); }
        }}
        onCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-xl font-extrabold tabular-nums text-secondary">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function ModalCusto({ inicial, onFechar }: { inicial?: ObraCustoIndireto; onFechar: () => void }) {
  const criar = useCriarCustoIndireto();
  const editar = useEditarCustoIndireto();
  const [competencia, setCompetencia] = useState(inicial?.competencia ?? hojeISO().slice(0, 7));
  const [categoria, setCategoria] = useState(inicial?.categoria ?? "engenharia");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [recorrente, setRecorrente] = useState(inicial?.recorrente ?? false);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const salvando = criar.isPending || editar.isPending;

  async function salvar() {
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!descricao.trim() || !Number.isFinite(v) || v < 0) { toast.error("Informe descrição e valor."); return; }
    try {
      if (inicial) {
        await editar.mutateAsync({ id: inicial.id, competencia, categoria, descricao, valor: v, recorrente, observacao });
        toast.success("Lançamento atualizado.");
      } else {
        await criar.mutateAsync({ competencia, categoria, descricao, valor: v, recorrente, observacao });
        toast.success("Custo lançado.");
      }
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{inicial ? "Editar custo indireto" : "Lançar custo indireto"}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>
        <div className="space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Competência (mês)</span>
            <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputBase}>
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Descrição</span>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Honorário de engenharia · assinatura Claude" className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Valor (R$)</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inputBase} /></label>
          <label className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5", recorrente ? "border-primary bg-primary/5" : "border-border")}>
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm text-secondary">Custo mensal recorrente (honorário, assinatura…)</span>
          </label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação (opcional)" className={inputBase} />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={salvando}>{inicial ? "Salvar" : "Lançar"}</Button>
        </div>
      </div>
    </div>
  );
}
