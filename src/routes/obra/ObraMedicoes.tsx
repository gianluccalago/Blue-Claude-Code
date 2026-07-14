import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  Check,
  Upload,
  Landmark,
  ShieldCheck,
  CircleDollarSign,
  X,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra, useEtapasObra, useChecklistObra, useAtualizarFaseCronograma } from "@/hooks/useObra";
import {
  useObraConfig,
  useObraAliquotas,
  useMedicoes,
  useEtapasMedidas,
  useDocumentosMensais,
  useRetencoesLedger,
  usePendencias,
  useCriarMedicao,
  useAtualizarMedicao,
  usePagarMedicao,
  useEmitirTRP,
  useEmitirTRD,
  useSubirDocumentoMensal,
  useCriarPendencia,
  useSanarPendencia,
  aliquotasParaCalc,
} from "@/hooks/useObraMedicoes";
import {
  OBRA_FASE_STATUS_LABEL,
  OBRA_FASE_STATUS_VARIANTE,
  ultimaVerificacaoPorEtapa,
  etapaConcluida,
} from "@/lib/obra";
import { calcularMedicao, saldoRetencao, calcularMultaBonusFase, arred } from "@/lib/obraCalc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda, formatarMesReferencia } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraFase, ObraMedicao, ObraMedicaoStatus, ObraDocMensalTipo } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const STATUS_VARIANTE: Record<ObraMedicaoStatus, "muted" | "default" | "success" | "destructive" | "warning"> = {
  Pendente: "muted",
  "Em análise": "warning",
  Aprovado: "default",
  Reprovado: "destructive",
  Pago: "success",
};

const DOC_LABEL: Record<ObraDocMensalTipo, string> = {
  inss: "Guia INSS",
  fgts: "Guia FGTS",
  iss: "Guia ISS",
  folha: "Folha de pagamento",
};
const DOC_TIPOS: ObraDocMensalTipo[] = ["inss", "fgts", "iss", "folha"];

export function ObraMedicoes() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEditar = perfil === "master" || perfil === "direcao";

  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const config = useObraConfig();
  const aliquotas = useObraAliquotas();
  const medicoes = useMedicoes();
  const etapasMedidas = useEtapasMedidas();
  const documentos = useDocumentosMensais();
  const retencoes = useRetencoesLedger();
  const pendencias = usePendencias();

  const [faseSel, setFaseSel] = useState<number | null>(null);
  const [novaMedicao, setNovaMedicao] = useState(false);
  const [detalhe, setDetalhe] = useState<ObraMedicao | null>(null);

  const carregando =
    fases.isLoading || etapas.isLoading || checklist.isLoading || config.isLoading || medicoes.isLoading;
  if (carregando) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaFases = fases.data ?? [];
  if (listaFases.length === 0)
    return <EmptyState label="Fases da obra não encontradas — rode a migration 0099 no Supabase." />;

  const emAndamento = listaFases.find((f) => f.status === "em_andamento");
  const fase =
    listaFases.find((f) => f.numero === faseSel) ?? emAndamento ?? listaFases[0];

  const precoBase = parseFloat(config.data?.preco_m2_mo ?? "0");
  const retencaoPct = parseFloat(config.data?.retencao_mo_pct ?? "5");
  const aliqCalc = aliquotasParaCalc(aliquotas.data ?? []);

  const medicoesFase = (medicoes.data ?? []).filter((m) => m.fase_id === fase.id);
  const retFase = (retencoes.data ?? []).filter((r) => r.fase_id === fase.id);
  const saldo = saldoRetencao(retFase);
  const podeVerRetencoes = podeEditar; // prestador não tem policy de leitura no ledger
  const pendFase = (pendencias.data ?? []).filter((p) => p.fase_id === fase.id);

  return (
    <div className="space-y-6 pb-8">
      {/* Seletor de fase */}
      <div className="flex flex-wrap gap-1.5">
        {listaFases.map((f) => (
          <button
            key={f.id}
            onClick={() => setFaseSel(f.numero)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              f.numero === fase.numero ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f.nome} · {OBRA_FASE_STATUS_LABEL[f.status]}
          </button>
        ))}
      </div>

      {/* Documentos do mês (gate de pagamento) */}
      <DocumentosMes documentos={documentos.data ?? []} podeEditar={podeEditar} />

      {/* Medições da fase */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
              <FileText className="size-5 text-primary" /> Medições — {fase.nome}
            </h2>
            {podeEditar && fase.status === "em_andamento" && (
              <Button size="sm" onClick={() => setNovaMedicao(true)}>
                <Plus className="size-4" /> Nova medição
              </Button>
            )}
          </div>

          {medicoesFase.length === 0 ? (
            <EmptyState label="Nenhuma medição lançada nesta fase." />
          ) : (
            <div className="divide-y">
              {medicoesFase.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDetalhe(m)}
                  className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-muted/20"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-secondary">Medição de {formatarMesReferencia(m.mes)}</span>
                      <Badge variant={STATUS_VARIANTE[m.status]}>{m.status}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">{m.percentual_medido}% medido</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bruto {formatarMoeda(m.valor_bruto)} · líquido {formatarMoeda(m.valor_liquido)}
                      {m.data_pagamento ? ` · pago em ${formatarDataBR(m.data_pagamento)}` : ""}
                    </p>
                  </div>
                  <span className="text-right font-bold tabular-nums text-secondary">{formatarMoeda(m.valor_liquido)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recebimento provisório/definitivo (TRP/TRD) + retenções */}
      <RecebimentoFase
        fase={fase}
        medicoesFase={medicoesFase}
        etapas={(etapas.data ?? []).filter((e) => e.fase_id === fase.id)}
        checklist={checklist.data ?? []}
        saldo={saldo}
        ledger={retFase}
        podeVerRetencoes={podeVerRetencoes}
        pendencias={pendFase}
        podeEditar={podeEditar}
        config={config.data ?? {}}
      />

      {novaMedicao && (
        <ModalNovaMedicao
          fase={fase}
          etapasFase={(etapas.data ?? []).filter((e) => e.fase_id === fase.id)}
          checklist={checklist.data ?? []}
          etapasMedidas={etapasMedidas.data ?? new Set()}
          precoBase={precoBase}
          retencaoPct={retencaoPct}
          aliquotas={aliqCalc}
          onFechar={() => setNovaMedicao(false)}
        />
      )}
      {detalhe && (
        <ModalDetalheMedicao
          medicao={detalhe}
          documentos={documentos.data ?? []}
          podeEditar={podeEditar}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

/** Painel dos 4 documentos mensais (gate). Mês selecionável; upload master. */
function DocumentosMes({
  documentos,
  podeEditar,
}: {
  documentos: { mes: string; tipo: ObraDocMensalTipo }[];
  podeEditar: boolean;
}) {
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const subir = useSubirDocumentoMensal();
  const presentes = new Set(documentos.filter((d) => d.mes === mes).map((d) => d.tipo));
  const completos = DOC_TIPOS.every((t) => presentes.has(t));

  async function onArquivo(tipo: ObraDocMensalTipo, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await subir.mutateAsync({ mes, tipo, arquivo: file });
      toast.success(`${DOC_LABEL[tipo]} de ${mes} anexada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao anexar.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Landmark className="size-5 text-primary" /> Documentos do mês
          </h2>
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            <Badge variant={completos ? "success" : "warning"}>{presentes.size}/4</Badge>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOC_TIPOS.map((t) => {
            const ok = presentes.has(t);
            return (
              <div key={t} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2", ok ? "border-success/40 bg-success/5" : "border-border")}>
                <span className="flex items-center gap-2 text-sm">
                  {ok ? <Check className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                  {DOC_LABEL[t]}
                </span>
                {podeEditar && (
                  <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    {ok ? "Substituir" : "Anexar"}
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onArquivo(t, e)} />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** TRP/TRD, saldo de retenção, multa/bônus e pendências da fase. */
function RecebimentoFase({
  fase,
  medicoesFase,
  etapas,
  checklist,
  saldo,
  ledger,
  podeVerRetencoes,
  pendencias,
  podeEditar,
  config,
}: {
  fase: ObraFase;
  medicoesFase: ObraMedicao[];
  etapas: { id: string }[];
  checklist: Parameters<typeof ultimaVerificacaoPorEtapa>[0];
  saldo: number;
  ledger: { tipo: string; valor: number; observacao: string | null; evento_em: string }[];
  podeVerRetencoes: boolean;
  pendencias: { id: string; descricao: string; sanada: boolean }[];
  podeEditar: boolean;
  config: Record<string, string>;
}) {
  const emitirTRP = useEmitirTRP();
  const emitirTRD = useEmitirTRD();
  const cronograma = useAtualizarFaseCronograma();
  const criarPend = useCriarPendencia();
  const sanarPend = useSanarPendencia();
  const [novaPend, setNovaPend] = useState("");
  const [fimPrevisto, setFimPrevisto] = useState(fase.data_fim_prevista ?? "");

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist), [checklist]);
  const tudoConcluido = etapas.length > 0 && etapas.every((e) => etapaConcluida(e.id, ultimaPorEtapa));
  const medicoesAbertas = medicoesFase.some((m) => m.status !== "Pago" && m.status !== "Reprovado");
  const pendAbertas = pendencias.filter((p) => !p.sanada).length;

  // Multa/bônus contra o cronograma (TRP = conclusão real).
  const precoBase = parseFloat(config.preco_m2_mo ?? "0");
  const valorFase = arred(
    fase.area_m2 * (fase.reajustavel && fase.ipca_pct != null ? precoBase * (1 + fase.ipca_pct / 100) : precoBase),
  );
  const mb = calcularMultaBonusFase({
    valorFase,
    dataPrevista: fase.data_fim_prevista,
    dataReal: fase.data_trp,
    multaDiaPct: parseFloat(config.multa_fase_dia_pct ?? "0.05"),
    multaTetoPct: parseFloat(config.multa_fase_teto_pct ?? "5"),
    bonusPct: parseFloat(config.bonus_antecipacao_pct ?? "1"),
    bonusTetoPct: parseFloat(config.bonus_antecipacao_teto_pct ?? "2"),
  });

  // Guardas dos botões (motivo do bloqueio explicado sempre).
  const motivoTRP =
    fase.status !== "em_andamento" ? "A fase precisa estar em andamento."
    : !tudoConcluido ? "Há etapas não concluídas — o TRP exige 100% físico."
    : medicoesAbertas ? "Há medições não pagas nesta fase."
    : null;
  const diasParaTRD = fase.data_trp ? 90 - (new Date(hojeISO()).getTime() - new Date(fase.data_trp).getTime()) / 86400000 : null;
  const motivoTRD =
    fase.status !== "trp_emitido" ? "Emita o TRP antes."
    : diasParaTRD != null && diasParaTRD > 0 ? `Faltam ${Math.ceil(diasParaTRD)} dias (90 desde o TRP).`
    : pendAbertas > 0 ? `Há ${pendAbertas} pendência(s) não sanada(s).`
    : null;

  async function trp() {
    try {
      const v = await emitirTRP.mutateAsync(fase.id);
      toast.success(`TRP emitido — liberados ${formatarMoeda(v)} de retenção.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível emitir o TRP."); }
  }
  async function trd() {
    try {
      const v = await emitirTRD.mutateAsync(fase.id);
      toast.success(`TRD emitido — saldo final liberado: ${formatarMoeda(v)}.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível emitir o TRD."); }
  }
  async function salvarCronograma() {
    try {
      await cronograma.mutateAsync({ faseId: fase.id, dataFimPrevista: fimPrevisto || null });
      toast.success("Cronograma atualizado.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }
  async function addPend() {
    if (!novaPend.trim()) return;
    try {
      await criarPend.mutateAsync({ faseId: fase.id, descricao: novaPend });
      setNovaPend("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao registrar."); }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <ShieldCheck className="size-5 text-primary" /> Recebimento — {fase.nome}
          <Badge variant={OBRA_FASE_STATUS_VARIANTE[fase.status]}>{OBRA_FASE_STATUS_LABEL[fase.status]}</Badge>
        </h2>

        {/* Retenção + multa/bônus */}
        <div className="grid gap-3 sm:grid-cols-3">
          {podeVerRetencoes && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CircleDollarSign className="size-4" /> Retenção em mãos</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-secondary">{formatarMoeda(saldo)}</p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Multa por atraso</p>
            <p className={cn("mt-1 text-xl font-extrabold tabular-nums", mb.multa > 0 ? "text-destructive" : "text-secondary")}>{formatarMoeda(mb.multa)}</p>
            {mb.diasAtraso > 0 && <p className="text-xs text-muted-foreground">{mb.diasAtraso} dias de atraso</p>}
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Bônus antecipação</p>
            <p className={cn("mt-1 text-xl font-extrabold tabular-nums", mb.bonus > 0 ? "text-success" : "text-secondary")}>{formatarMoeda(mb.bonus)}</p>
            {mb.diasAntecipacao > 0 && <p className="text-xs text-muted-foreground">{mb.diasAntecipacao} dias adiantado</p>}
          </div>
        </div>

        {/* Cronograma (base da multa/bônus) */}
        {podeEditar && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-xs font-semibold text-secondary"><CalendarClock className="size-3.5" /> Conclusão prevista</span>
              <input type="date" value={fimPrevisto} onChange={(e) => setFimPrevisto(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            </label>
            <Button size="sm" variant="outline" onClick={salvarCronograma} loading={cronograma.isPending}>Salvar</Button>
            {fase.data_trp && <span className="text-xs text-muted-foreground">TRP (real): {formatarDataBR(fase.data_trp)}</span>}
          </div>
        )}

        {/* Ações TRP/TRD */}
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <span title={motivoTRP ?? undefined}>
              <Button variant="outline" onClick={trp} disabled={!!motivoTRP || emitirTRP.isPending} loading={emitirTRP.isPending}>
                Emitir TRP (libera 50%)
              </Button>
            </span>
            <span title={motivoTRD ?? undefined}>
              <Button variant="outline" onClick={trd} disabled={!!motivoTRD || emitirTRD.isPending} loading={emitirTRD.isPending}>
                Emitir TRD (libera saldo)
              </Button>
            </span>
            {(motivoTRP || motivoTRD) && (
              <span className="self-center text-xs text-muted-foreground">{motivoTRP ?? motivoTRD}</span>
            )}
          </div>
        )}

        {/* Pendências (vícios do TRP → gate do TRD) */}
        <div>
          <p className="mb-1 text-sm font-semibold text-secondary">Pendências de recebimento</p>
          {pendencias.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma pendência registrada.</p>
          ) : (
            <ul className="space-y-1">
              {pendencias.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn(p.sanada && "text-muted-foreground line-through")}>{p.descricao}</span>
                  {podeEditar && !p.sanada ? (
                    <button onClick={() => sanarPend.mutate(p.id)} className="text-xs font-semibold text-success hover:underline">Sanar</button>
                  ) : p.sanada ? <Badge variant="success">Sanada</Badge> : null}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <div className="mt-2 flex gap-2">
              <input value={novaPend} onChange={(e) => setNovaPend(e.target.value)} placeholder="Nova pendência…" className={cn(inputBase, "h-9")} />
              <Button size="sm" variant="outline" onClick={addPend} disabled={!novaPend.trim() || criarPend.isPending}>Add</Button>
            </div>
          )}
        </div>

        {/* Ledger de retenções (só quem pode ver o financeiro) */}
        {podeVerRetencoes && ledger.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-secondary">Movimentos de retenção</p>
            <div className="divide-y text-sm">
              {ledger.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-muted-foreground">{formatarDataBR(e.evento_em.slice(0, 10))} · {e.observacao}</span>
                  <span className={cn("font-semibold tabular-nums", e.tipo === "retido" ? "text-secondary" : "text-success")}>
                    {e.tipo === "retido" ? "+" : "−"}{formatarMoeda(e.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Nova medição: escolhe mês + etapas concluídas ainda não medidas; prévia do cálculo. */
function ModalNovaMedicao({
  fase,
  etapasFase,
  checklist,
  etapasMedidas,
  precoBase,
  retencaoPct,
  aliquotas,
  onFechar,
}: {
  fase: ObraFase;
  etapasFase: { id: string; nome: string; peso_pct: number }[];
  checklist: Parameters<typeof ultimaVerificacaoPorEtapa>[0];
  etapasMedidas: Set<string>;
  precoBase: number;
  retencaoPct: number;
  aliquotas: Parameters<typeof calcularMedicao>[0]["aliquotas"];
  onFechar: () => void;
}) {
  const criar = useCriarMedicao();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [sel, setSel] = useState<Set<string>>(new Set());

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist), [checklist]);
  const disponiveis = etapasFase.filter((e) => etapaConcluida(e.id, ultimaPorEtapa) && !etapasMedidas.has(e.id));

  const etapasSel = disponiveis.filter((e) => sel.has(e.id));
  const previa = calcularMedicao({
    percentualMedido: etapasSel.reduce((s, e) => s + e.peso_pct, 0),
    areaM2: fase.area_m2,
    precoBase,
    reajustavel: fase.reajustavel,
    ipcaPct: fase.ipca_pct,
    retencaoPct,
    aliquotas,
  });

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function salvar() {
    if (etapasSel.length === 0) { toast.error("Selecione ao menos uma etapa concluída."); return; }
    try {
      await criar.mutateAsync({
        fase, mes,
        etapas: etapasSel.map((e) => ({ id: e.id, peso_pct: e.peso_pct })),
        precoBase, retencaoPct, aliquotas,
      });
      toast.success("Medição lançada (Pendente).");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível lançar a medição."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Nova medição" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Nova medição — {fase.nome}</h2>

        <label className="mt-4 block space-y-1">
          <span className="text-sm font-semibold text-secondary">Mês de referência</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputBase} />
        </label>

        <p className="mt-4 mb-1 text-sm font-semibold text-secondary">Etapas concluídas a medir</p>
        {disponiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etapa concluída pendente de medição. Verifique as etapas na aba Execução.</p>
        ) : (
          <div className="space-y-1">
            {disponiveis.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-primary" />
                <span className="flex-1 text-secondary">{e.nome}</span>
                <Badge variant="muted" className="tabular-nums">{e.peso_pct}%</Badge>
              </label>
            ))}
          </div>
        )}

        {/* Memória de cálculo (prévia) */}
        {etapasSel.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
            <MemoriaCalculo memoria={previa.memoria} percentual={etapasSel.reduce((s, e) => s + e.peso_pct, 0)} precoM2={previa.precoM2Aplicado} />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={criar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} disabled={etapasSel.length === 0 || criar.isPending} loading={criar.isPending}>
            Lançar medição
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Detalhe do BM: memória de cálculo + ações conforme o status. */
function ModalDetalheMedicao({
  medicao,
  documentos,
  podeEditar,
  onFechar,
}: {
  medicao: ObraMedicao;
  documentos: { mes: string; tipo: ObraDocMensalTipo }[];
  podeEditar: boolean;
  onFechar: () => void;
}) {
  const atualizar = useAtualizarMedicao();
  const pagar = usePagarMedicao();
  const [motivo, setMotivo] = useState("");
  const [reprovando, setReprovando] = useState(false);
  const [nfNumero, setNfNumero] = useState(medicao.nf_numero ?? "");

  const docsDoMes = new Set(documentos.filter((d) => d.mes === medicao.mes).map((d) => d.tipo));
  const docsCompletos = DOC_TIPOS.every((t) => docsDoMes.has(t));
  const temNF = !!medicao.nf_url;

  const memoria = [
    { rotulo: "Valor bruto da medição", valor: medicao.valor_bruto, sinal: "base" as const },
    { rotulo: `Retenção contratual ${medicao.retencao_pct}%`, valor: medicao.retencao_valor, sinal: "menos" as const },
    { rotulo: `INSS ${medicao.inss_pct}%`, valor: medicao.inss_valor, sinal: "menos" as const },
    { rotulo: `ISS ${medicao.iss_pct}%`, valor: medicao.iss_valor, sinal: "menos" as const },
    ...(medicao.outras_valor > 0 ? [{ rotulo: "Outras retenções (IRRF/CSRF)", valor: medicao.outras_valor, sinal: "menos" as const }] : []),
    { rotulo: "Líquido a pagar", valor: medicao.valor_liquido, sinal: "total" as const },
  ];

  const motivoPagamento =
    medicao.status !== "Aprovado" ? "A medição precisa estar Aprovada."
    : !temNF ? "Anexe a NF da medição."
    : !docsCompletos ? `Faltam documentos do mês ${medicao.mes} (${docsDoMes.size}/4).`
    : null;

  async function transicao(status: ObraMedicaoStatus) {
    try { await atualizar.mutateAsync({ id: medicao.id, status }); toast.success(`Medição → ${status}.`); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha na transição."); }
  }
  async function reprovar() {
    if (!motivo.trim()) { toast.error("Informe o motivo da reprovação."); return; }
    try { await atualizar.mutateAsync({ id: medicao.id, status: "Reprovado", motivo }); toast.success("Medição reprovada."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao reprovar."); }
  }
  async function anexarNF(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await atualizar.mutateAsync({ id: medicao.id, nf: file, nfNumero }); toast.success("NF anexada."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao anexar NF."); }
  }
  async function aprovarPagamento() {
    try { await pagar.mutateAsync(medicao.id); toast.success("Pagamento aprovado — retenção registrada."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao aprovar pagamento."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Detalhe da medição" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-secondary">Medição de {formatarMesReferencia(medicao.mes)}</h2>
            <p className="text-sm text-muted-foreground">{medicao.percentual_medido}% medido · {medicao.status}</p>
          </div>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
        </div>

        {medicao.status === "Reprovado" && medicao.motivo && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Reprovada: {medicao.motivo}</p>
        )}

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <MemoriaCalculo memoria={memoria} percentual={medicao.percentual_medido} precoM2={medicao.preco_m2_aplicado} />
        </div>

        {podeEditar && (
          <div className="mt-5 space-y-3">
            {medicao.status === "Pendente" && (
              <Button className="w-full" onClick={() => transicao("Em análise")} loading={atualizar.isPending}>Enviar para vistoria (Em análise)</Button>
            )}
            {medicao.status === "Em análise" && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setReprovando(true)}>Reprovar</Button>
                <Button onClick={() => transicao("Aprovado")} loading={atualizar.isPending}>Aprovar medição</Button>
              </div>
            )}
            {(medicao.status === "Aprovado") && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-secondary">Nº da NF</label>
                  <input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className={inputBase} />
                  <label className="mt-1 block cursor-pointer text-sm font-semibold text-primary hover:underline">
                    <Upload className="mr-1 inline size-4" />{temNF ? "Substituir NF anexada" : "Anexar NF (PDF)"}
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={anexarNF} />
                  </label>
                  {temNF && <p className="text-xs text-success">NF anexada.</p>}
                </div>
                <span className="block" title={motivoPagamento ?? undefined}>
                  <Button className="w-full" onClick={aprovarPagamento} disabled={!!motivoPagamento || pagar.isPending} loading={pagar.isPending}>
                    Aprovar pagamento
                  </Button>
                </span>
                {motivoPagamento && <p className="text-xs text-muted-foreground">{motivoPagamento}</p>}
              </>
            )}
            {medicao.status === "Pago" && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                Paga em {medicao.data_pagamento ? formatarDataBR(medicao.data_pagamento) : "—"}.
              </p>
            )}
          </div>
        )}

        {reprovando && (
          <div className="mt-4 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <label className="text-sm font-semibold text-secondary">Motivo da reprovação</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputBase} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setReprovando(false)}>Cancelar</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={reprovar} disabled={!motivo.trim() || atualizar.isPending}>Confirmar reprovação</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemoriaCalculo({
  memoria,
  percentual,
  precoM2,
}: {
  memoria: { rotulo: string; valor: number; sinal: "base" | "menos" | "total" }[];
  percentual: number;
  precoM2: number;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Memória de cálculo · {percentual}% × área × {formatarMoeda(precoM2)}/m²
      </p>
      {memoria.map((l, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between gap-2",
            l.sinal === "total" && "border-t pt-1.5 font-bold text-secondary",
          )}
        >
          <span className={cn(l.sinal === "menos" ? "text-muted-foreground" : "text-secondary")}>
            {l.sinal === "menos" ? "(−) " : ""}{l.rotulo}
          </span>
          <span className={cn("tabular-nums", l.sinal === "menos" ? "text-muted-foreground" : "text-secondary")}>
            {formatarMoeda(l.valor)}
          </span>
        </div>
      ))}
    </div>
  );
}
