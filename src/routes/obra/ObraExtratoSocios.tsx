import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { FileText, X, Plus, Pencil, Trash2, Check } from "lucide-react";
import {
  useExtratoLinhas, useExtratoSaldos, useCriarLinhaExtrato, useEditarLinhaExtrato,
  useExcluirLinhaExtrato, useDefinirSaldoInicial,
} from "@/hooks/useExtratoSocios";
import { resumoMesExtrato, consolidarAno, rotuloMesExtenso, SOCIO_ASSINATURA } from "@/lib/extratoSocios";
import { gerarDemonstrativoMensalPdf, gerarDemonstrativoAnualPdf } from "@/lib/exportDemonstrativoCaixa";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, hojeISO } from "@/lib/utils";
import type { FcExtratoLinha } from "@/types/database";

// ===========================================================================
// EXTRATO DOS SÓCIOS + Demonstrativo de Caixa (PDF timbrado, assinatura do
// sócio-diretor). Master/direção APENAS. Mensal: mantém os lançamentos do
// extrato (fiel à planilha) e extrai o PDF; Anual: consolida e extrai.
// ===========================================================================

const selBase = "h-9 rounded-md border border-input bg-card px-2 text-sm";

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function parseValor(txt: string): number {
  return parseFloat(txt.replace(/\./g, "").replace(",", ".")) || parseFloat(txt) || 0;
}

export function ModalExtratoSocios({ onFechar }: { onFechar: () => void }) {
  const linhas = useExtratoLinhas();
  const saldos = useExtratoSaldos();

  const [modo, setModo] = useState<"mes" | "ano">("mes");
  const [mes, setMes] = useState(() => hojeISO().slice(0, 7));
  const [ano, setAno] = useState(() => hojeISO().slice(0, 4));
  const [gerando, setGerando] = useState(false);

  const todas = useMemo(
    () => (linhas.data ?? []).map((l) => ({ mes: l.mes, ordem: l.ordem, grupo: l.grupo, rotulo: l.rotulo, valor: l.valor })),
    [linhas.data],
  );
  const mapaSaldos = saldos.data ?? new Map<string, number>();
  const resumo = useMemo(
    () => resumoMesExtrato(mes, mapaSaldos.get(mes) ?? 0, todas),
    [mes, mapaSaldos, todas],
  );
  const temSaldoDeclarado = mapaSaldos.has(mes);
  const anosDisponiveis = useMemo(() => [...new Set(todas.map((l) => l.mes.slice(0, 4)))].sort(), [todas]);

  async function gerar() {
    setGerando(true);
    try {
      if (modo === "mes") {
        if (resumo.entradas.length + resumo.saidas.length === 0) throw new Error(`Sem lançamentos em ${rotuloMesExtenso(mes)}.`);
        if (!temSaldoDeclarado) throw new Error("Defina o saldo inicial do mês antes de extrair.");
        const pdf = await gerarDemonstrativoMensalPdf(resumo, new Date());
        baixar(pdf.blob, pdf.nomeArquivo);
      } else {
        const c = consolidarAno(ano, mapaSaldos, todas);
        if (!c) throw new Error(`Sem lançamentos no ano de ${ano}.`);
        const pdf = await gerarDemonstrativoAnualPdf(c, new Date());
        baixar(pdf.blob, pdf.nomeArquivo);
      }
      toast.success("Demonstrativo gerado — confira o download.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-2xl animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-secondary">Demonstrativo de Caixa — sócios</h2>
            <p className="text-xs text-muted-foreground">
              Contas Seniors Care · regime de caixa · assinatura de {SOCIO_ASSINATURA.nome.split(" ")[0]} ({SOCIO_ASSINATURA.cargo}).
            </p>
          </div>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 border-b pb-3 pt-2">
          <div className="flex overflow-hidden rounded-md border border-input">
            {(["mes", "ano"] as const).map((m) => (
              <button key={m} onClick={() => setModo(m)}
                className={cn("px-3 py-1.5 text-sm font-semibold", modo === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-secondary")}>
                {m === "mes" ? "Mês" : "Ano"}
              </button>
            ))}
          </div>
          {modo === "mes" ? (
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={selBase} />
          ) : (
            <select value={ano} onChange={(e) => setAno(e.target.value)} className={selBase}>
              {(anosDisponiveis.length ? anosDisponiveis : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <Button size="sm" onClick={gerar} loading={gerando}><FileText className="size-4" /> Gerar PDF</Button>
        </div>

        {linhas.isLoading || saldos.isLoading ? <LoadingState /> : modo === "mes" ? (
          <EditorMes mes={mes} linhas={(linhas.data ?? []).filter((l) => l.mes === mes)} resumo={resumo} temSaldoDeclarado={temSaldoDeclarado} />
        ) : (
          <ResumoAno ano={ano} mapaSaldos={mapaSaldos} todas={todas} />
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Editor do mês (saldo inicial + lançamentos, tudo editável) ─────────────
function EditorMes({ mes, linhas, resumo, temSaldoDeclarado }: {
  mes: string;
  linhas: FcExtratoLinha[];
  resumo: ReturnType<typeof resumoMesExtrato>;
  temSaldoDeclarado: boolean;
}) {
  const definirSaldo = useDefinirSaldoInicial();
  const criar = useCriarLinhaExtrato();
  const excluir = useExcluirLinhaExtrato();

  const [saldoTxt, setSaldoTxt] = useState<string | null>(null);
  const [novoGrupo, setNovoGrupo] = useState<"entrada" | "saida">("saida");
  const [novoRotulo, setNovoRotulo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [excluindo, setExcluindo] = useState<FcExtratoLinha | null>(null);

  function salvarSaldo() {
    if (saldoTxt === null) return;
    definirSaldo.mutate({ mes, saldoInicial: parseValor(saldoTxt) }, {
      onSuccess: () => { toast.success("Saldo inicial salvo."); setSaldoTxt(null); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
    });
  }
  function adicionar() {
    const bruto = parseValor(novoValor);
    // Convenção da planilha: saídas são negativas; entrada digitada positiva
    // permanece positiva (dividendo pago deve ser digitado com o sinal −).
    const valor = novoGrupo === "saida" ? -Math.abs(bruto) : bruto;
    const ordem = Math.max(0, ...linhas.filter((l) => l.grupo === novoGrupo).map((l) => l.ordem)) + 1;
    criar.mutate({ mes, grupo: novoGrupo, rotulo: novoRotulo, valor, ordem }, {
      onSuccess: () => { setNovoRotulo(""); setNovoValor(""); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao adicionar."),
    });
  }

  return (
    <div className="space-y-4">
      {/* Saldo inicial declarado */}
      <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3", temSaldoDeclarado ? "border-border" : "border-warning/60 bg-warning/5")}>
        <span className="text-sm font-semibold text-secondary">Saldo inicial de caixa ({rotuloMesExtenso(mes)})</span>
        <div className="flex items-center gap-2">
          {saldoTxt === null ? (
            <>
              <span className="text-sm font-bold tabular-nums text-secondary">
                {temSaldoDeclarado ? formatarMoeda(resumo.saldoInicial) : "— defina"}
              </span>
              <button onClick={() => setSaldoTxt(String(resumo.saldoInicial || ""))} className="text-muted-foreground hover:text-primary" title="Editar saldo inicial"><Pencil className="size-3.5" /></button>
            </>
          ) : (
            <>
              <input value={saldoTxt} onChange={(e) => setSaldoTxt(e.target.value)} inputMode="decimal" className={cn(selBase, "w-36 text-right")} autoFocus />
              <Button size="sm" onClick={salvarSaldo} loading={definirSaldo.isPending}><Check className="size-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Blocos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["entrada", "saida"] as const).map((grupo) => (
          <div key={grupo} className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {grupo === "entrada" ? "Entradas e movimentações societárias" : "Saídas"}
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {linhas.filter((l) => l.grupo === grupo).sort((a, b) => a.ordem - b.ordem).map((l) => (
                <LinhaEditavel key={l.id} linha={l} onExcluir={() => setExcluindo(l)} />
              ))}
              {linhas.filter((l) => l.grupo === grupo).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum lançamento.</p>
              )}
            </div>
            <p className="border-t pt-1 text-right text-sm font-bold tabular-nums text-secondary">
              {formatarMoeda(grupo === "entrada" ? resumo.totalEntradas : resumo.totalSaidas)}
            </p>
          </div>
        ))}
      </div>

      {/* Adicionar */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-3">
        <select value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value as "entrada" | "saida")} className={selBase}>
          <option value="entrada">Entrada/mov.</option>
          <option value="saida">Saída</option>
        </select>
        <input value={novoRotulo} onChange={(e) => setNovoRotulo(e.target.value)} placeholder="descrição (ex.: aluguel, IPTU…)" className={cn(selBase, "min-w-40 flex-1")} />
        <input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} inputMode="decimal" placeholder="valor" className={cn(selBase, "w-28 text-right")} />
        <Button size="sm" variant="outline" onClick={adicionar} loading={criar.isPending}><Plus className="size-4" /> Adicionar</Button>
      </div>

      <div className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-white">
        <span>Saldo final de caixa</span>
        <span className="float-right tabular-nums">{formatarMoeda(resumo.saldoFinal)}</span>
      </div>

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir lançamento do extrato?"
        descricao={excluindo ? `${excluindo.rotulo} · ${formatarMoeda(excluindo.valor)}` : ""}
        textoConfirmar="Excluir"
        onConfirmar={() => {
          const alvo = excluindo;
          setExcluindo(null);
          if (!alvo) return;
          excluir.mutate(alvo.id, { onError: (e) => toast.error(e instanceof Error ? e.message : "Falha.") });
        }}
        onCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}

function LinhaEditavel({ linha, onExcluir }: { linha: FcExtratoLinha; onExcluir: () => void }) {
  const editar = useEditarLinhaExtrato();
  const [editando, setEditando] = useState(false);
  const [rotulo, setRotulo] = useState(linha.rotulo);
  const [valor, setValor] = useState(String(linha.valor));

  if (editando) {
    return (
      <div className="flex items-center gap-1.5">
        <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className={cn(selBase, "h-8 min-w-0 flex-1")} />
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={cn(selBase, "h-8 w-24 text-right")} />
        <button
          onClick={() => editar.mutate({ id: linha.id, rotulo, valor: parseValor(valor) }, {
            onSuccess: () => setEditando(false),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
          })}
          className="text-success" title="Salvar"
        >
          <Check className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="group flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate text-secondary">{linha.rotulo}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={cn("tabular-nums font-semibold", linha.valor < 0 ? "text-destructive" : "text-secondary")}>{formatarMoeda(linha.valor)}</span>
        <button onClick={() => setEditando(true)} className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100" title="Editar"><Pencil className="size-3" /></button>
        <button onClick={onExcluir} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" title="Excluir"><Trash2 className="size-3" /></button>
      </span>
    </div>
  );
}

// ── Prévia do ano ───────────────────────────────────────────────────────────
function ResumoAno({ ano, mapaSaldos, todas }: {
  ano: string;
  mapaSaldos: Map<string, number>;
  todas: { mes: string; ordem: number; grupo: "entrada" | "saida"; rotulo: string; valor: number }[];
}) {
  const c = consolidarAno(ano, mapaSaldos, todas);
  if (!c) return <p className="text-sm text-muted-foreground">Sem lançamentos no ano de {ano}.</p>;
  return (
    <div className="space-y-2">
      <div className="max-h-64 overflow-y-auto pr-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="pb-1">Mês</th><th className="pb-1 text-right">Entradas/mov.</th>
              <th className="pb-1 text-right">Saídas</th><th className="pb-1 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {c.meses.map((m) => (
              <tr key={m.mes} className="tabular-nums">
                <td className="py-1.5 text-secondary">{rotuloMesExtenso(m.mes)}</td>
                <td className={cn("py-1.5 text-right", m.totalEntradas < 0 ? "text-destructive" : "text-secondary")}>{formatarMoeda(m.totalEntradas)}</td>
                <td className="py-1.5 text-right text-destructive">{formatarMoeda(m.totalSaidas)}</td>
                <td className="py-1.5 text-right font-bold text-secondary">{formatarMoeda(m.saldoFinal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-white">
        <span>Saldo final de caixa — {rotuloMesExtenso(c.meses[c.meses.length - 1].mes)}</span>
        <span className="float-right tabular-nums">{formatarMoeda(c.saldoFinal)}</span>
      </div>
      <p className="text-xs text-muted-foreground">O PDF anual traz também o consolidado por rubrica (entradas e saídas agregadas).</p>
    </div>
  );
}
