import { useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Receipt, X, Copy, CalendarClock, Building2, Upload, CircleDollarSign, Undo2,
  FileText, Paperclip, Trash2, CheckCircle2,
} from "lucide-react";
import {
  useNotasFiscais, useEmitirNotaFiscal, useExcluirNotaFiscal, usePagarNotaFiscal,
  useDesfazerPagamentoNota, useAnexarComprovanteNota,
} from "@/hooks/useObraNotas";
import { useMarcos, useDisciplinas } from "@/hooks/useObraProjetos";
import { useMedicoes } from "@/hooks/useObraMedicoes";
import { TOMADOR_NF, proximaJanelaFaturamento, ehDiaDeJanela } from "@/lib/faturamento";
import { AnexoSeguro } from "@/components/AnexoSeguro";
import { BUCKET_OBRA } from "@/lib/storage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda, formatarMesReferencia } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraNotaFiscal, ObraNotaFiscalItem } from "@/types/database";

// ===========================================================================
// FATURAMENTO DA CONSTRUTORA — janelas nos dias 1 e 11 de cada mês.
// Prestador: confere os itens APROVADOS, emite a NF contra a Seniors Care e
// anexa o PDF (FaturamentoPrestador). Nós: pagamos a NF e anexamos o
// comprovante (NotasConstrutora, na aba Financeiro; ações também na Central).
// ===========================================================================

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Ids (marco/medição) já cobertos por alguma NF não excluída. */
export function idsCobertosPorNF(notas: ObraNotaFiscal[]): Set<string> {
  const s = new Set<string>();
  for (const n of notas) for (const i of n.itens) s.add(i.id);
  return s;
}

function LinkArquivo({ stored, rotulo }: { stored: string | null; rotulo: string }) {
  if (!stored) return null;
  return (
    <AnexoSeguro bucket={BUCKET_OBRA} stored={stored}>
      {(url) => (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <FileText className="size-3.5" /> {rotulo}
        </a>
      )}
    </AnexoSeguro>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Janela + dados do tomador (cards informativos — usados pelo prestador)
// ───────────────────────────────────────────────────────────────────────────

function CardJanelaETomador() {
  const hoje = hojeISO();
  const proxima = proximaJanelaFaturamento(hoje);
  const hojeEhJanela = ehDiaDeJanela(hoje);

  function copiarCnpj() {
    navigator.clipboard?.writeText(TOMADOR_NF.cnpj.replace(/\D/g, ""))
      .then(() => toast.success("CNPJ copiado (só números)."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className={cn(hojeEhJanela && "border-primary/60")}>
        <CardContent className="space-y-1.5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-secondary">
            <CalendarClock className="size-4 text-primary" /> Janelas de faturamento
          </h3>
          <p className="text-sm text-secondary">
            Todo dia <strong>1º</strong> e dia <strong>11</strong>: confira abaixo o que está{" "}
            <strong>aprovado pelo Contratante</strong>, emita a(s) nota(s) e anexe o PDF aqui.
          </p>
          <p className="text-xs text-muted-foreground">
            {hojeEhJanela
              ? "HOJE é dia de janela — os itens aprovados já podem ser faturados."
              : `Próxima janela: ${formatarDataBR(proxima)}.`}{" "}
            O pagamento ocorre em até 15 dias corridos após a aprovação (cláusula 8.1.2).
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-1.5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-secondary">
            <Building2 className="size-4 text-primary" /> Dados do tomador (para emissão)
          </h3>
          <p className="text-sm font-semibold text-secondary">{TOMADOR_NF.razaoSocial}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <span className="tabular-nums">CNPJ {TOMADOR_NF.cnpj}</span>
            <button onClick={copiarCnpj} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <Copy className="size-3" /> copiar
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            {TOMADOR_NF.endereco} · CEP {TOMADOR_NF.cep} · {TOMADOR_NF.municipio}
          </p>
          <p className="text-xs text-muted-foreground">{TOMADOR_NF.retencoes}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LADO PRESTADOR — aprovados a faturar + minhas notas
// ───────────────────────────────────────────────────────────────────────────

export function FaturamentoPrestador() {
  const notas = useNotasFiscais();
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const medicoes = useMedicoes();
  const excluir = useExcluirNotaFiscal();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [emitindo, setEmitindo] = useState(false);
  const [excluindo, setExcluindo] = useState<ObraNotaFiscal | null>(null);

  const listaNotas = notas.data ?? [];
  const cobertos = useMemo(() => idsCobertosPorNF(listaNotas), [listaNotas]);
  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));

  // Itens aprovados (aferidos e confirmados por nós) ainda sem NF.
  const aFaturar: ObraNotaFiscalItem[] = [
    ...(marcos.data ?? [])
      .filter((m) => m.status === "Aprovado" && !cobertos.has(m.id))
      .map((m) => ({
        tipo: "marco" as const,
        id: m.id,
        rotulo: `${nomeDisc.get(m.disciplina_id) ?? "Projeto"} — ${m.rotulo}`,
        valor: m.valor,
      })),
    ...(medicoes.data ?? [])
      .filter((m) => m.status === "Aprovado" && !cobertos.has(m.id))
      .map((m) => ({
        tipo: "medicao" as const,
        id: m.id,
        rotulo: `Medição de ${formatarMesReferencia(m.mes)}`,
        valor: m.valor_liquido,
      })),
  ];

  const itensSelecionados = aFaturar.filter((i) => selecionados.has(i.id));
  const totalSelecionado = itensSelecionados.reduce((s, i) => s + i.valor, 0);

  function alternar(id: string) {
    setSelecionados((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <CardJanelaETomador />

      {/* Aprovado — pronto para faturar */}
      <Card>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
              <CheckCircle2 className="size-5 text-success" /> Aprovado — pronto para faturar
            </h2>
            {itensSelecionados.length > 0 && (
              <Button size="sm" onClick={() => setEmitindo(true)}>
                <Receipt className="size-4" /> Anexar NF ({itensSelecionados.length} — {formatarMoeda(totalSelecionado)})
              </Button>
            )}
          </div>
          {aFaturar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada aguardando faturamento. Assim que o Contratante aprovar um marco ou uma medição, ele aparece aqui.
            </p>
          ) : (
            <div className="divide-y">
              {aFaturar.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input type="checkbox" checked={selecionados.has(i.id)} onChange={() => alternar(i.id)} className="size-4 accent-primary" />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-secondary">{i.rotulo}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-secondary">{formatarMoeda(i.valor)}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Minhas notas */}
      <Card>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Receipt className="size-5 text-primary" /> Notas emitidas
          </h2>
          {listaNotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma nota anexada ainda.</p>
          ) : (
            <div className="divide-y">
              {listaNotas.map((n) => (
                <LinhaNota
                  key={n.id}
                  nota={n}
                  acoes={n.status === "emitida" && (
                    <button onClick={() => setExcluindo(n)} className="text-muted-foreground hover:text-destructive" title="Excluir nota (emitida por engano)">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {emitindo && (
        <ModalEmitirNF
          itens={itensSelecionados}
          onFechar={() => setEmitindo(false)}
          onEmitida={() => { setEmitindo(false); setSelecionados(new Set()); }}
        />
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir esta nota?"
        descricao={excluindo ? `NF ${excluindo.numero} de ${formatarMoeda(excluindo.valor)} — os itens dela voltam a "pronto para faturar".` : ""}
        textoConfirmar="Excluir"
        onConfirmar={() => {
          const alvo = excluindo;
          setExcluindo(null);
          if (!alvo) return;
          excluir.mutate(alvo.id, {
            onSuccess: () => toast.success("Nota excluída."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
          });
        }}
        onCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}

/** Linha de NF compartilhada (prestador e Contratante). */
function LinhaNota({ nota, acoes }: { nota: ObraNotaFiscal; acoes?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-secondary">NF {nota.numero}</span>
          <Badge variant={nota.status === "paga" ? "success" : "warning"}>
            {nota.status === "paga" ? `paga em ${nota.data_pagamento ? formatarDataBR(nota.data_pagamento) : "—"}` : "aguardando pagamento"}
          </Badge>
          <span className="text-xs text-muted-foreground">emitida {formatarDataBR(nota.data_emissao)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {nota.itens.map((i) => i.rotulo).join(" · ") || "—"}
          {nota.observacao ? ` · ${nota.observacao}` : ""}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <LinkArquivo stored={nota.arquivo_url} rotulo="Abrir NF" />
          {nota.status === "paga" && <LinkArquivo stored={nota.comprovante_url} rotulo="Comprovante" />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-secondary">{formatarMoeda(nota.valor)}</p>
          {nota.retencoes > 0 && (
            <p className="text-[11px] tabular-nums text-muted-foreground">líquido {formatarMoeda(nota.valor - nota.retencoes)}</p>
          )}
        </div>
        {acoes}
      </div>
    </div>
  );
}

function ModalEmitirNF({ itens, onFechar, onEmitida }: {
  itens: ObraNotaFiscalItem[];
  onFechar: () => void;
  onEmitida: () => void;
}) {
  const emitir = useEmitirNotaFiscal();
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const [numero, setNumero] = useState("");
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [valor, setValor] = useState(String(total.toFixed(2)));
  const [retencoes, setRetencoes] = useState("");
  const [observacao, setObservacao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const retNum = parseFloat(retencoes.replace(",", ".")) || 0;

  async function salvar() {
    try {
      await emitir.mutateAsync({
        numero,
        dataEmissao,
        valor: valorNum,
        retencoes: retNum,
        observacao,
        arquivo,
        itens,
      });
      toast.success(`NF ${numero} anexada — ela aparece agora para o Contratante pagar.`);
      onEmitida();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao anexar a NF.");
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-lg animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Anexar nota fiscal</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Itens cobertos</p>
            {itens.map((i) => (
              <p key={i.id} className="flex items-center justify-between gap-2 text-sm text-secondary">
                <span className="min-w-0">{i.rotulo}</span>
                <span className="shrink-0 tabular-nums font-semibold">{formatarMoeda(i.valor)}</span>
              </p>
            ))}
            <p className="mt-1 border-t pt-1 text-right text-sm font-bold tabular-nums text-secondary">{formatarMoeda(total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Número da NF *</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex.: 1234" className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Data de emissão</span>
              <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className={inputBase} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Valor da NF (R$)</span>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Retenções (R$)</span>
              <input value={retencoes} onChange={(e) => setRetencoes(e.target.value)} inputMode="decimal" placeholder="IRRF/CSRF/ISS retidos" className={inputBase} /></label>
          </div>
          {retNum > 0 && valorNum > retNum && (
            <p className="text-xs text-muted-foreground">
              Líquido a receber: <strong className="tabular-nums text-secondary">{formatarMoeda(valorNum - retNum)}</strong> (retenções destacadas na nota, cláusula 7.1.5.2).
            </p>
          )}
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Observação</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="opcional" className={inputBase} /></label>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">PDF da nota *</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input p-3 text-sm font-semibold text-primary hover:bg-accent">
              <Upload className="size-4" /> {arquivo ? arquivo.name : "Selecionar arquivo (PDF/XML)"}
              <input type="file" accept="application/pdf,text/xml,application/xml,image/*" className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={emitir.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={emitir.isPending}>Anexar NF</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LADO CONTRATANTE — pagar NF + comprovante (aba Financeiro; e ações na Central)
// ───────────────────────────────────────────────────────────────────────────

export function NotasConstrutora({ podeEditar }: { podeEditar: boolean }) {
  const notas = useNotasFiscais();
  const desfazer = useDesfazerPagamentoNota();
  const anexarComp = useAnexarComprovanteNota();
  const [pagando, setPagando] = useState<ObraNotaFiscal | null>(null);
  const [desfazendo, setDesfazendo] = useState<ObraNotaFiscal | null>(null);

  const lista = notas.data ?? [];
  const emitidas = lista.filter((n) => n.status === "emitida");

  function subirComprovante(id: string, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    anexarComp.mutate({ id, arquivo: f }, {
      onSuccess: () => toast.success("Comprovante anexado."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Falha no upload."),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <Receipt className="size-5 text-primary" /> Notas fiscais da construtora
          {emitidas.length > 0 && <Badge variant="warning">{emitidas.length} a pagar</Badge>}
        </h2>
        <p className="text-xs text-muted-foreground">
          A TRÍADE fatura nas janelas dos dias 1 e 11 sobre o que aprovamos. Pagamento em até 15 dias
          corridos da aprovação (8.1.2) — pague a nota e anexe o comprovante.
        </p>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota recebida ainda.</p>
        ) : (
          <div className="divide-y">
            {lista.map((n) => (
              <LinhaNota
                key={n.id}
                nota={n}
                acoes={podeEditar && (
                  n.status === "emitida" ? (
                    <Button size="sm" onClick={() => setPagando(n)}>
                      <CircleDollarSign className="size-4" /> Registrar pagamento
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {!n.comprovante_url && (
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          <Paperclip className="size-3.5" /> Anexar comprovante
                          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => subirComprovante(n.id, e)} />
                        </label>
                      )}
                      <button onClick={() => setDesfazendo(n)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive" title="Desfazer pagamento">
                        <Undo2 className="size-3.5" /> Desfazer
                      </button>
                    </div>
                  )
                )}
              />
            ))}
          </div>
        )}

        {pagando && <ModalPagarNF nota={pagando} onFechar={() => setPagando(null)} />}

        <ConfirmDialog
          aberto={!!desfazendo}
          titulo="Desfazer o pagamento desta nota?"
          descricao={desfazendo ? `NF ${desfazendo.numero} de ${formatarMoeda(desfazendo.valor)} — os itens voltam para Aprovado e o comprovante é desanexado.` : ""}
          textoConfirmar="Desfazer"
          onConfirmar={() => {
            const alvo = desfazendo;
            setDesfazendo(null);
            if (!alvo) return;
            desfazer.mutate(alvo, {
              onSuccess: () => toast.success("Pagamento desfeito — a nota voltou para aguardando pagamento."),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desfazer."),
            });
          }}
          onCancelar={() => setDesfazendo(null)}
        />
      </CardContent>
    </Card>
  );
}

/** Modal de pagamento da NF: confirma, data e comprovante (opcional aqui, anexável depois). */
export function ModalPagarNF({ nota, onFechar }: { nota: ObraNotaFiscal; onFechar: () => void }) {
  const pagar = usePagarNotaFiscal();
  const [dataPagamento, setDataPagamento] = useState(hojeISO());
  const [comprovante, setComprovante] = useState<File | null>(null);

  async function confirmar() {
    try {
      await pagar.mutateAsync({ nota, dataPagamento, comprovante });
      toast.success(`NF ${nota.numero} paga (${formatarMoeda(nota.valor)}). Você pode desfazer na lista de notas.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar o pagamento.");
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Registrar pagamento — NF {nota.numero}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            {nota.itens.map((i) => (
              <p key={i.id} className="flex items-center justify-between gap-2 text-secondary">
                <span className="min-w-0">{i.rotulo}</span>
                <span className="shrink-0 tabular-nums font-semibold">{formatarMoeda(i.valor)}</span>
              </p>
            ))}
            <p className="mt-1 border-t pt-1 text-right font-bold tabular-nums text-secondary">{formatarMoeda(nota.valor)}</p>
            {nota.retencoes > 0 && (
              <p className="text-right text-xs tabular-nums text-muted-foreground">
                líquido a pagar à TRÍADE: <strong className="text-secondary">{formatarMoeda(nota.valor - nota.retencoes)}</strong> · retenções (guias): {formatarMoeda(nota.retencoes)}
              </p>
            )}
          </div>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Data do pagamento</span>
            <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className={inputBase} /></label>
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Comprovante</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input p-3 text-sm font-semibold text-primary hover:bg-accent">
              <Upload className="size-4" /> {comprovante ? comprovante.name : "Anexar comprovante (PDF/imagem)"}
              <input type="file" accept="application/pdf,image/*" className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setComprovante(e.target.files?.[0] ?? null)} />
            </label>
            {!comprovante && <p className="text-xs text-muted-foreground">Dá para anexar depois, na lista de notas.</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Os itens cobertos serão marcados como <strong>Pagos</strong> (passando pelos mesmos gates de sempre). Reversível.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={pagar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={confirmar} loading={pagar.isPending}>Confirmar pagamento</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
