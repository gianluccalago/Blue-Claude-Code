import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Send, Save, Paperclip, FileText, Check, Undo2, MessageSquare, Ruler, Wallet, Ban,
  ClipboardList, Clock4, CircleDollarSign, FilePlus2,
} from "lucide-react";
import { useFasesObra } from "@/hooks/useObra";
import {
  useAnexarAvulso, useCancelarAvulso, useComentarAvulso, useConferirAvulso, useDecidirAvulso,
  useDesfazerPagamentoAvulso, useInformarExecucao, useOrcamentosAvulsos, usePagarAvulso, useRemoverAnexoAvulso,
  useSalvarAvulso, type ItemRascunho, type OrcamentoAvulsoCompleto, type RascunhoAvulso,
} from "@/hooks/useObraAvulsos";
import {
  ETAPAS_AVULSO, FONTES_ITEM, ROTULO_ACAO_EVENTO, STATUS_AVULSO, acoesDisponiveis, codigoAvulso, resumoAvulsos,
  totalItem, totalMedido, totalPrevisto, valorVigente, type QuemVe,
} from "@/lib/orcamentoAvulso";
import { lerReais } from "@/lib/fluxoCaixa";
import { formatarMoeda } from "@/lib/mensalidade";
import { BUCKET_OBRA, LIMITE_UPLOAD_MB } from "@/lib/storage";
import { AnexoSeguro, FotoSegura } from "@/components/AnexoSeguro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import type { FonteItemAvulso } from "@/types/database";

// ===========================================================================
// ORÇAMENTOS AVULSOS — serviços não previstos no contrato. A construtora
// propõe (itens, fotos, PDFs); a Blue aprova, pede ajuste ou reprova; depois
// da execução a Blue confirma o valor real e registra o pagamento (caixa).
// O mesmo componente atende os dois lados (`quem`).
// ===========================================================================

const inputBase = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const num = (n: number, casas = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

function Modal({ titulo, onFechar, largo, children }: { titulo: ReactNode; onFechar: () => void; largo?: boolean; children: ReactNode }) {
  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className={cn("relative my-6 w-full animate-modal-in rounded-lg border bg-card p-5 shadow-lifted sm:p-6", largo ? "max-w-4xl" : "max-w-lg")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const erro = (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");

// ─── Lista ────────────────────────────────────────────────────────────────────

export function OrcamentosAvulsos({ quem }: { quem: QuemVe }) {
  const q = useOrcamentosAvulsos();
  const [editando, setEditando] = useState<RascunhoAvulso | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const lista = q.data ?? [];
  const resumo = useMemo(() => resumoAvulsos(lista), [lista]);
  const aberto = lista.find((o) => o.id === abertoId) ?? null;
  const ativos = lista.filter((o) => !["pago", "cancelado", "reprovado"].includes(o.status));
  const encerrados = lista.filter((o) => ["pago", "cancelado", "reprovado"].includes(o.status));

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-secondary"><FilePlus2 className="size-5 text-primary" /> Orçamentos avulsos</h3>
              <p className="text-sm text-muted-foreground">
                {quem === "construtora"
                  ? "Serviços que não estavam no contrato: lance o orçamento com itens, fotos e PDFs para a Blue aprovar. Aprovado, o valor entra na conta."
                  : "Serviços fora do contrato propostos pela construtora: aprove, peça ajustes ou reprove. Depois da execução, confirme o valor real e registre o pagamento."}
              </p>
            </div>
            <Button onClick={() => setEditando({ id: null, titulo: "", descricao: "", justificativa: "", fase_id: null, referencia_precos: "", itens: [itemVazio()] })}>
              <Plus className="size-4" /> Novo orçamento avulso
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Numero icone={Clock4} valor={formatarMoeda(resumo.emAnalise)} rotulo={quem === "blue" ? `${resumo.aguardandoBlue} aguardando você` : "Aguardando aprovação"} alerta={quem === "blue" && resumo.aguardandoBlue > 0} />
            <Numero icone={Check} valor={formatarMoeda(resumo.aprovadoAReceber)} rotulo={quem === "construtora" ? "Aprovado — a receber" : "Aprovado — a pagar"} />
            <Numero icone={CircleDollarSign} valor={formatarMoeda(resumo.pago)} rotulo="Pago" />
          </div>
        </CardContent>
      </Card>

      {ativos.length === 0 && encerrados.length === 0 ? (
        <EmptyState label="Nenhum orçamento avulso ainda." />
      ) : (
        <div className="space-y-2">
          {ativos.map((o) => <LinhaAvulso key={o.id} o={o} onAbrir={() => setAbertoId(o.id)} />)}
          {encerrados.length > 0 && (
            <button onClick={() => setVerEncerrados((v) => !v)} className="text-sm font-semibold text-primary hover:underline">
              {verEncerrados ? "Ocultar" : "Ver"} pagos, reprovados e cancelados ({encerrados.length})
            </button>
          )}
          {verEncerrados && encerrados.map((o) => <LinhaAvulso key={o.id} o={o} onAbrir={() => setAbertoId(o.id)} />)}
        </div>
      )}

      {editando && <EditorAvulso inicial={editando} onFechar={() => setEditando(null)} onSalvo={(id) => { setEditando(null); setAbertoId(id); }} />}
      {aberto && !editando && (
        <DetalheAvulso
          o={aberto}
          quem={quem}
          onFechar={() => setAbertoId(null)}
          onEditar={() => setEditando({
            id: aberto.id, titulo: aberto.titulo, descricao: aberto.descricao ?? "", justificativa: aberto.justificativa ?? "",
            fase_id: aberto.fase_id, referencia_precos: aberto.referencia_precos ?? "",
            itens: aberto.itens.map((i) => ({ fonte: i.fonte, codigo: i.codigo ?? "", descricao: i.descricao, unidade: i.unidade, quantidade_prevista: i.quantidade_prevista, preco_unitario: i.preco_unitario })),
          })}
        />
      )}
    </div>
  );
}

function Numero({ icone: Icone, valor, rotulo, alerta }: { icone: typeof Clock4; valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", alerta ? "border-warning/60 bg-warning/10" : "bg-card")}>
      <Icone className={cn("size-5", alerta ? "text-warning" : "text-primary")} />
      <div>
        <p className="text-lg font-extrabold tabular-nums text-secondary">{valor}</p>
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function LinhaAvulso({ o, onAbrir }: { o: OrcamentoAvulsoCompleto; onAbrir: () => void }) {
  const st = STATUS_AVULSO[o.status];
  const fotos = o.anexos.filter((a) => a.tipo === "imagem");
  return (
    <button onClick={onAbrir} className="flex w-full flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/60">
      {fotos[0] ? (
        <FotoSegura bucket={BUCKET_OBRA} stored={fotos[0].arquivo_url} alt="" className="size-14 shrink-0 rounded-md object-cover" fallback={<div className="size-14 shrink-0 rounded-md bg-muted" />} />
      ) : (
        <div className="grid size-14 shrink-0 place-items-center rounded-md bg-muted"><ClipboardList className="size-6 text-muted-foreground" /></div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-secondary"><span className="text-muted-foreground">{codigoAvulso(o.numero)}</span> · {o.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {o.itens.length} item(ns) · {o.anexos.length} anexo(s) · atualizado {formatarDataHoraBR(o.atualizado_em)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-extrabold tabular-nums text-secondary">{formatarMoeda(valorVigente(o))}</p>
        <Badge variant={st.variante}>{st.rotulo}</Badge>
      </div>
    </button>
  );
}

// ─── Editor (criar / editar rascunho ou ajustes) ─────────────────────────────

const itemVazio = (): ItemRascunho => ({ fonte: "SINAPI", codigo: "", descricao: "", unidade: "m²", quantidade_prevista: 0, preco_unitario: 0 });

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

function EditorAvulso({ inicial, onFechar, onSalvo }: { inicial: RascunhoAvulso; onFechar: () => void; onSalvo: (id: string) => void }) {
  const fases = useFasesObra();
  const salvar = useSalvarAvulso();
  const anexar = useAnexarAvulso();
  const [r, setR] = useState<RascunhoAvulso>(inicial);
  const [txt, setTxt] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<File[]>([]);
  const total = totalPrevisto(r.itens);
  const valido = r.titulo.trim().length > 0 && r.itens.length > 0 && r.itens.every((i) => i.descricao.trim() && i.unidade.trim() && i.quantidade_prevista > 0) && total > 0;

  const mudarItem = (idx: number, patch: Partial<ItemRascunho>) => setR((v) => ({ ...v, itens: v.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const campoNum = (idx: number, campo: "quantidade_prevista" | "preco_unitario") => ({
    value: txt[`${idx}-${campo}`] ?? (r.itens[idx][campo] ? num(r.itens[idx][campo], campo === "preco_unitario" ? 2 : 3) : ""),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setTxt((t) => ({ ...t, [`${idx}-${campo}`]: e.target.value }));
      mudarItem(idx, { [campo]: lerReais(e.target.value) });
    },
    inputMode: "decimal" as const,
  });

  async function gravar(enviar: boolean) {
    try {
      const id = await salvar.mutateAsync({ rascunho: r, enviar });
      if (arquivos.length) await anexar.mutateAsync({ id, arquivos });
      toast.success(enviar ? "Orçamento enviado para aprovação da Blue." : "Rascunho salvo.");
      onSalvo(id);
    } catch (e) {
      erro(e);
    }
  }

  return (
    <Modal titulo={r.id ? "Editar orçamento avulso" : "Novo orçamento avulso"} onFechar={onFechar} largo>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-secondary">Título</label>
            <input value={r.titulo} onChange={(e) => setR({ ...r, titulo: e.target.value })} placeholder="Ex.: Tapume e portão de entrada" className={inputBase} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-secondary">O que será feito</label>
            <textarea value={r.descricao} onChange={(e) => setR({ ...r, descricao: e.target.value })} rows={2} className={cn(inputBase, "h-auto py-2")} placeholder="Escopo, local, materiais principais" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-secondary">Por que não estava previsto</label>
            <textarea value={r.justificativa} onChange={(e) => setR({ ...r, justificativa: e.target.value })} rows={2} className={cn(inputBase, "h-auto py-2")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-secondary">Fase da obra (opcional)</label>
            <select value={r.fase_id ?? ""} onChange={(e) => setR({ ...r, fase_id: e.target.value || null })} className={inputBase}>
              <option value="">—</option>
              {(fases.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.numero}. {f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-secondary">Base de preços</label>
            <input value={r.referencia_precos} onChange={(e) => setR({ ...r, referencia_precos: e.target.value })} placeholder="Ex.: SINAPI PR set/2026, desonerado" className={inputBase} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-secondary">Itens</p>
          <div className="space-y-2">
            {r.itens.map((it, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-12 sm:items-end">
                <Campo rotulo="Fonte" className="sm:col-span-2">
                  <select value={it.fonte} onChange={(e) => mudarItem(idx, { fonte: e.target.value as FonteItemAvulso })} className={inputBase} aria-label="Fonte">
                    {FONTES_ITEM.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Código" className="sm:col-span-2">
                  <input value={it.codigo} onChange={(e) => mudarItem(idx, { codigo: e.target.value })} placeholder="Código" className={inputBase} />
                </Campo>
                <Campo rotulo="Descrição" className="col-span-2 sm:col-span-8">
                  <input value={it.descricao} onChange={(e) => mudarItem(idx, { descricao: e.target.value })} placeholder="Descrição do serviço" className={inputBase} />
                </Campo>
                <Campo rotulo="Unidade" className="sm:col-span-2">
                  <input value={it.unidade} onChange={(e) => mudarItem(idx, { unidade: e.target.value })} placeholder="Un." className={inputBase} />
                </Campo>
                <Campo rotulo="Quantidade" className="sm:col-span-2">
                  <input {...campoNum(idx, "quantidade_prevista")} placeholder="Qtd." className={inputBase} />
                </Campo>
                <Campo rotulo="Preço unitário" className="sm:col-span-3">
                  <input {...campoNum(idx, "preco_unitario")} placeholder="P.U. (R$)" className={inputBase} />
                </Campo>
                <div className="col-span-2 flex h-10 items-center justify-between gap-2 sm:col-span-5 sm:justify-end">
                  <span className="text-sm font-bold tabular-nums text-secondary">{formatarMoeda(totalItem(it))}</span>
                  <button onClick={() => setR((v) => ({ ...v, itens: v.itens.filter((_, i) => i !== idx) }))} className="text-muted-foreground hover:text-destructive" aria-label="Remover item">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setR((v) => ({ ...v, itens: [...v.itens, itemVazio()] }))}><Plus className="size-4" /> Item</Button>
            <p className="text-base font-extrabold text-secondary">Total previsto: {formatarMoeda(total)}</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Fotos e PDFs (renders, medidas, planilha)</label>
          <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} className="text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Até {LIMITE_UPLOAD_MB} MB por arquivo. {arquivos.length ? `${arquivos.length} selecionado(s).` : ""}</p>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button onClick={() => void gravar(true)} disabled={!valido || salvar.isPending || anexar.isPending} loading={salvar.isPending || anexar.isPending}>
            <Send className="size-4" /> Salvar e enviar para aprovação
          </Button>
          <Button variant="outline" onClick={() => void gravar(false)} disabled={!r.titulo.trim() || salvar.isPending || anexar.isPending}>
            <Save className="size-4" /> Salvar rascunho
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Detalhe e ações ──────────────────────────────────────────────────────────

function DetalheAvulso({ o, quem, onFechar, onEditar }: { o: OrcamentoAvulsoCompleto; quem: QuemVe; onFechar: () => void; onEditar: () => void }) {
  const st = STATUS_AVULSO[o.status];
  const acoes = acoesDisponiveis(o.status, quem);
  const anexar = useAnexarAvulso();
  const remover = useRemoverAnexoAvulso();
  const comentar = useComentarAvulso();
  const [comentario, setComentario] = useState("");
  const medido = totalMedido(o.itens);
  const temReal = o.itens.some((i) => i.quantidade_real !== null);

  return (
    <Modal titulo={<span>{codigoAvulso(o.numero)} · {o.titulo}</span>} onFechar={onFechar} largo>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={st.variante}>{st.rotulo}</Badge>
          <span className="text-xs text-muted-foreground">proposto por {o.registrado_por ?? "—"} em {formatarDataHoraBR(o.criado_em)}</span>
        </div>
        <LinhaDoTempo status={o.status} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Valor rotulo="Previsto" valor={o.valor_previsto} ativo={!o.valor_aprovado} />
          <Valor rotulo="Aprovado" valor={o.valor_aprovado} sub={o.aprovado_por ? `por ${o.aprovado_por}` : undefined} ativo={!!o.valor_aprovado && !o.valor_real} />
          <Valor rotulo="Real" valor={o.valor_real} sub={o.data_pagamento ? `pago em ${formatarDataBR(o.data_pagamento)}` : o.conferido_por ? `por ${o.conferido_por}` : undefined} ativo={!!o.valor_real} />
        </div>

        {(o.descricao || o.justificativa || o.referencia_precos) && (
          <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
            {o.descricao && <p><span className="font-semibold text-secondary">O que será feito:</span> {o.descricao}</p>}
            {o.justificativa && <p><span className="font-semibold text-secondary">Por que não estava previsto:</span> {o.justificativa}</p>}
            {o.referencia_precos && <p><span className="font-semibold text-secondary">Base de preços:</span> {o.referencia_precos}</p>}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-2">Fonte</th><th className="p-2">Descrição</th><th className="p-2">Un.</th><th className="p-2 text-right">Qtd. prevista</th>{temReal && <th className="p-2 text-right">Qtd. real</th>}<th className="p-2 text-right">P.U.</th><th className="p-2 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y">
              {o.itens.map((i) => (
                <tr key={i.id}>
                  <td className="p-2 text-xs text-muted-foreground">{i.fonte}{i.codigo ? ` ${i.codigo}` : ""}</td>
                  <td className="p-2 text-secondary">{i.descricao}</td>
                  <td className="p-2">{i.unidade}</td>
                  <td className="p-2 text-right tabular-nums">{num(i.quantidade_prevista, 3)}</td>
                  {temReal && <td className={cn("p-2 text-right tabular-nums", i.quantidade_real !== null && i.quantidade_real !== i.quantidade_prevista && "font-bold text-warning-foreground")}>{i.quantidade_real === null ? "—" : num(i.quantidade_real, 3)}</td>}
                  <td className="p-2 text-right tabular-nums">{formatarMoeda(i.preco_unitario)}</td>
                  <td className="p-2 text-right font-semibold tabular-nums">{formatarMoeda(temReal ? Math.round((i.quantidade_real ?? i.quantidade_prevista) * i.preco_unitario * 100) / 100 : totalItem(i))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-bold text-secondary">
                <td colSpan={temReal ? 6 : 5} className="p-2 text-right">{temReal ? "Total pelas quantidades reais" : "Total previsto"}</td>
                <td className="p-2 text-right tabular-nums">{formatarMoeda(temReal ? medido : o.valor_previsto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-secondary"><Paperclip className="size-4" /> Anexos</p>
          {o.anexos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum anexo.</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {o.anexos.map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
                  <AnexoSeguro bucket={BUCKET_OBRA} stored={a.arquivo_url}>
                    {(url) => (
                      <a href={url} target="_blank" rel="noreferrer" className="block">
                        {a.tipo === "imagem"
                          ? <img src={url} alt={a.nome ?? ""} className="h-32 w-full object-cover" />
                          : <div className="flex h-32 flex-col items-center justify-center gap-1 p-2 text-center"><FileText className="size-8 text-primary" /><span className="line-clamp-2 text-xs text-secondary">{a.nome}</span></div>}
                      </a>
                    )}
                  </AnexoSeguro>
                  {acoes.anexar && (
                    <button onClick={() => remover.mutate(a.id, { onError: erro })} className="absolute right-1 top-1 rounded bg-card/90 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Remover anexo">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {acoes.anexar && (
            <input type="file" multiple accept="image/*,application/pdf" className="text-sm"
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                if (fs.length) anexar.mutate({ id: o.id, arquivos: fs }, { onSuccess: () => toast.success("Anexo(s) enviado(s)."), onError: erro });
                e.target.value = "";
              }} />
          )}
        </div>

        <Acoes o={o} quem={quem} medido={medido} onEditar={onEditar} />

        <div className="space-y-2 border-t pt-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-secondary"><MessageSquare className="size-4" /> Histórico</p>
          <ul className="space-y-1.5 text-sm">
            {o.eventos.map((e) => (
              <li key={e.id} className="rounded-md bg-muted/30 px-3 py-2">
                <span className="font-semibold text-secondary">{e.por ?? "—"}</span>{" "}
                <span className="text-muted-foreground">{ROTULO_ACAO_EVENTO[e.acao] ?? e.acao}{e.valor !== null ? ` · ${formatarMoeda(e.valor)}` : ""} · {formatarDataHoraBR(e.em)}</span>
                {e.comentario && <p className="mt-0.5 text-secondary">{e.comentario}</p>}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreva um comentário" className={inputBase} />
            <Button variant="outline" disabled={!comentario.trim() || comentar.isPending}
              onClick={() => comentar.mutate({ id: o.id, comentario }, { onSuccess: () => setComentario(""), onError: erro })}>
              Comentar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function LinhaDoTempo({ status }: { status: string }) {
  if (["rascunho", "cancelado", "reprovado", "ajustes"].includes(status)) return null;
  const idx = ETAPAS_AVULSO.findIndex((e) => e.status === status);
  return (
    <div className="flex items-center gap-1">
      {ETAPAS_AVULSO.map((e, i) => (
        <div key={e.status} className="flex flex-1 flex-col items-center gap-1">
          <div className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-primary" : "bg-muted")} />
          <span className={cn("text-[11px] font-semibold", i <= idx ? "text-secondary" : "text-muted-foreground")}>{e.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

function Valor({ rotulo, valor, sub, ativo }: { rotulo: string; valor: number | null; sub?: string; ativo?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", ativo ? "border-primary/60 bg-primary/5" : "bg-card")}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-extrabold tabular-nums text-secondary">{valor === null ? "—" : formatarMoeda(valor)}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Acoes({ o, quem, medido, onEditar }: { o: OrcamentoAvulsoCompleto; quem: QuemVe; medido: number; onEditar: () => void }) {
  const acoes = acoesDisponiveis(o.status, quem);
  const salvar = useSalvarAvulso();
  const decidir = useDecidirAvulso();
  const executar = useInformarExecucao();
  const conferir = useConferirAvulso();
  const pagar = usePagarAvulso();
  const desfazer = useDesfazerPagamentoAvulso();
  const cancelar = useCancelarAvulso();
  const [comentario, setComentario] = useState("");
  const [modo, setModo] = useState<null | "execucao" | "conferir" | "pagar" | "cancelar" | "desfazer">(null);
  const [reais, setReais] = useState<Record<string, string>>({});
  const [valorReal, setValorReal] = useState("");
  const [dataPag, setDataPag] = useState(hojeISO());
  const [nfNumero, setNfNumero] = useState("");
  const [nf, setNf] = useState<File | null>(null);
  const [comp, setComp] = useState<File | null>(null);
  const ocupado = [salvar, decidir, executar, conferir, pagar, desfazer, cancelar].some((m) => m.isPending);
  const ok = (msg: string) => () => { toast.success(msg); setModo(null); setComentario(""); };

  const nada = !acoes.editar && !acoes.decidir && !acoes.informarExecucao && !acoes.conferir && !acoes.pagar && !acoes.desfazerPagamento && !acoes.cancelar;
  if (nada) return null;

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-accent/30 p-3">
      <div className="flex flex-wrap gap-2">
        {acoes.editar && <Button size="sm" variant="outline" onClick={onEditar}>Editar</Button>}
        {acoes.enviar && (
          <Button size="sm" disabled={ocupado} onClick={() => salvar.mutate({ rascunho: {
            id: o.id, titulo: o.titulo, descricao: o.descricao ?? "", justificativa: o.justificativa ?? "", fase_id: o.fase_id, referencia_precos: o.referencia_precos ?? "",
            itens: o.itens.map((i) => ({ fonte: i.fonte, codigo: i.codigo ?? "", descricao: i.descricao, unidade: i.unidade, quantidade_prevista: i.quantidade_prevista, preco_unitario: i.preco_unitario })),
          }, enviar: true }, { onSuccess: ok("Enviado para aprovação da Blue."), onError: erro })}>
            <Send className="size-4" /> Enviar para aprovação
          </Button>
        )}
        {acoes.informarExecucao && <Button size="sm" variant={quem === "construtora" ? "default" : "outline"} onClick={() => setModo("execucao")}><Ruler className="size-4" /> Informar execução (quantidades reais)</Button>}
        {acoes.conferir && <Button size="sm" onClick={() => { setValorReal(medido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })); setModo("conferir"); }}><Check className="size-4" /> Confirmar valor real</Button>}
        {acoes.pagar && <Button size="sm" variant="success" onClick={() => setModo("pagar")}><Wallet className="size-4" /> Registrar pagamento</Button>}
        {acoes.desfazerPagamento && <Button size="sm" variant="outline" onClick={() => setModo("desfazer")}><Undo2 className="size-4" /> Desfazer pagamento</Button>}
        {acoes.cancelar && <Button size="sm" variant="ghost" onClick={() => setModo("cancelar")}><Ban className="size-4" /> Cancelar orçamento</Button>}
      </div>

      {acoes.decidir && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-secondary">Decisão da Blue</p>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentário para a construtora (obrigatório para pedir ajustes ou reprovar)" className={cn(inputBase, "h-auto py-2")} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" disabled={ocupado} onClick={() => decidir.mutate({ id: o.id, decisao: "aprovado", comentario }, { onSuccess: ok(`Aprovado: ${formatarMoeda(o.valor_previsto)} entra na conta da obra.`), onError: erro })}>
              <Check className="size-4" /> Aprovar {formatarMoeda(o.valor_previsto)}
            </Button>
            <Button size="sm" variant="warning" disabled={ocupado || comentario.trim().length < 5} onClick={() => decidir.mutate({ id: o.id, decisao: "ajustes", comentario }, { onSuccess: ok("Ajustes pedidos à construtora."), onError: erro })}>
              Pedir ajustes
            </Button>
            <Button size="sm" variant="destructive" disabled={ocupado || comentario.trim().length < 5} onClick={() => decidir.mutate({ id: o.id, decisao: "reprovado", comentario }, { onSuccess: ok("Orçamento reprovado."), onError: erro })}>
              Reprovar
            </Button>
          </div>
        </div>
      )}

      {modo === "execucao" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-secondary">Quantidades executadas (deixe em branco o que ficou igual ao previsto)</p>
          {o.itens.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 text-secondary">{i.descricao}</span>
              <span className="text-xs text-muted-foreground">previsto {num(i.quantidade_prevista, 3)} {i.unidade}</span>
              <input value={reais[i.id] ?? ""} onChange={(e) => setReais((r) => ({ ...r, [i.id]: e.target.value }))} placeholder={num(i.quantidade_prevista, 3)} inputMode="decimal" className={cn(inputBase, "w-28")} />
            </div>
          ))}
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Observação (ex.: área do tapume ficou menor)" className={cn(inputBase, "h-auto py-2")} />
          <Button size="sm" disabled={ocupado} onClick={() => executar.mutate({
            id: o.id, comentario,
            itens: Object.entries(reais).filter(([, v]) => v.trim() !== "").map(([id, v]) => ({ id, quantidade_real: lerReais(v) })),
          }, { onSuccess: ok("Execução informada. A Blue vai conferir o valor real."), onError: erro })}>Enviar execução</Button>
        </div>
      )}

      {modo === "conferir" && (
        <div className="space-y-2">
          <p className="text-sm text-secondary">
            Pelas quantidades {o.status === "executado" ? "informadas pela construtora" : "previstas"}: <strong>{formatarMoeda(medido)}</strong>
            {o.valor_aprovado !== null && <> · aprovado: {formatarMoeda(o.valor_aprovado)}</>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-secondary">Valor real (R$)</label>
            <input value={valorReal} onChange={(e) => setValorReal(e.target.value)} inputMode="decimal" className={cn(inputBase, "w-40")} />
          </div>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Explique se o valor real for diferente do calculado" className={cn(inputBase, "h-auto py-2")} />
          <Button size="sm" disabled={ocupado || lerReais(valorReal) <= 0} onClick={() => conferir.mutate({ id: o.id, valorReal: lerReais(valorReal), comentario }, { onSuccess: ok("Valor real confirmado."), onError: erro })}>
            Confirmar {formatarMoeda(lerReais(valorReal))}
          </Button>
        </div>
      )}

      {modo === "pagar" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-secondary">Data do pagamento</label><input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className={inputBase} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-secondary">Número da NF (opcional)</label><input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className={inputBase} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-secondary">NF (PDF, opcional)</label><input type="file" accept="application/pdf,image/*" onChange={(e) => setNf(e.target.files?.[0] ?? null)} className="text-sm" /></div>
          <div><label className="mb-1 block text-xs font-semibold text-secondary">Comprovante (opcional)</label><input type="file" accept="application/pdf,image/*" onChange={(e) => setComp(e.target.files?.[0] ?? null)} className="text-sm" /></div>
          <div className="sm:col-span-2">
            <Button size="sm" variant="success" disabled={ocupado || !dataPag} loading={pagar.isPending}
              onClick={() => pagar.mutate({ id: o.id, data: dataPag, nfNumero, nf, comprovante: comp }, {
                onSuccess: (r) => { toast.success(r.pela_planilha ? "Pago. O caixa deste mês já tem a linha da TRÍADE da planilha: não foi duplicado." : `Pago: ${formatarMoeda(o.valor_real)} lançado no caixa.`); setModo(null); },
                onError: erro,
              })}>
              Registrar pagamento de {formatarMoeda(o.valor_real)}
            </Button>
          </div>
        </div>
      )}

      {(modo === "cancelar" || modo === "desfazer") && (
        <div className="space-y-2">
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Motivo" className={cn(inputBase, "h-auto py-2")} />
          <Button size="sm" variant="destructive" disabled={ocupado || comentario.trim().length < 5}
            onClick={() => (modo === "cancelar" ? cancelar : desfazer).mutate({ id: o.id, comentario }, { onSuccess: ok(modo === "cancelar" ? "Orçamento cancelado." : "Pagamento desfeito e retirado do caixa."), onError: erro })}>
            {modo === "cancelar" ? "Confirmar cancelamento" : "Confirmar: desfazer pagamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
