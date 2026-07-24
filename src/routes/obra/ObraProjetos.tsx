import { useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Ruler,
  Upload,
  Boxes,
  Check,
  AlertTriangle,
  X,
  CircleDollarSign,
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useObraConfig } from "@/hooks/useObraMedicoes";
import {
  useDisciplinas,
  useMarcos,
  useBimRodadas,
  useAtualizarDisciplina,
  useAtualizarMarco,
  usePagarMarco,
  useRegistrarRodadaBim,
  useCriarDisciplina,
  useEditarDisciplina,
  useExcluirDisciplina,
  useAtualizarProgresso,
  useRemoverArtDisciplina,
  useDesfazerPagamentoMarco,
} from "@/hooks/useObraProjetos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SliderPct } from "@/components/ui/slider";
import { useObraArquivos, useSubirArquivosObra, useExcluirArquivoObra } from "@/hooks/useObraArquivos";
import { AnexoSeguro } from "@/components/AnexoSeguro";
import { BUCKET_OBRA } from "@/lib/storage";
import { calcularMultaDisciplina, somarDiasISO } from "@/lib/obraCalc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraBimRodada, ObraDisciplina, ObraDisciplinaMarco, ObraMarcoStatus } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const STATUS_VARIANTE: Record<string, "muted" | "default" | "success" | "destructive" | "warning"> = {
  Pendente: "muted",
  "Em análise": "warning",
  Aprovado: "default",
  "Aguardando input": "warning",
  Reprovado: "destructive",
  Pago: "success",
  Concluído: "success",
};

// Estados da disciplina — todos selecionáveis (controle interno, reversível).
const STATUS_DISCIPLINA = ["Pendente", "Em análise", "Aguardando input", "Aprovado", "Reprovado", "Pago", "Concluído"] as const;

export function ObraProjetos() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const disciplinas = useDisciplinas();
  const marcos = useMarcos();
  const bim = useBimRodadas();
  const config = useObraConfig();

  const [detalhe, setDetalhe] = useState<ObraDisciplina | null>(null);
  const [novaDisciplina, setNovaDisciplina] = useState(false);

  if (disciplinas.isLoading || marcos.isLoading || bim.isLoading || config.isLoading) return <LoadingState />;
  if (disciplinas.isError) return <ErrorState error={disciplinas.error} />;

  const listaDisc = disciplinas.data ?? [];
  const listaMarcos = marcos.data ?? [];
  const rodadas = bim.data ?? [];
  const compatFinal = rodadas.some((r) => r.final && !!r.ifc_url);

  const marcosPorDisc = new Map<string, ObraDisciplinaMarco[]>();
  for (const m of listaMarcos) {
    const arr = marcosPorDisc.get(m.disciplina_id) ?? [];
    arr.push(m);
    marcosPorDisc.set(m.disciplina_id, arr);
  }

  const totalContratado = listaDisc.reduce((s, d) => s + d.valor, 0);
  const totalPago = listaMarcos.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor, 0);

  const multaCfg = {
    multaDiaPct: parseFloat(config.data?.multa_projeto_dia_pct ?? "0.15"),
    tetoPct: parseFloat(config.data?.multa_projeto_teto_pct ?? "10"),
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Resumo global */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Resumo icone={<Ruler className="size-5" />} rotulo="Contratado (projetos)" valor={formatarMoeda(totalContratado)} />
          <Resumo icone={<CircleDollarSign className="size-5" />} rotulo="Pago" valor={formatarMoeda(totalPago)} tom="success" />
          <Resumo icone={<Boxes className="size-5" />} rotulo="Compatibilização BIM" valor={compatFinal ? "Consolidada" : "Pendente"} tom={compatFinal ? "success" : "warning"} />
        </div>
        {podeEditar && (
          <Button variant="outline" onClick={() => setNovaDisciplina(true)}>
            <Plus className="size-4" /> Nova disciplina
          </Button>
        )}
      </div>

      {/* Disciplinas */}
      <Card>
        <CardContent className="space-y-1 p-0">
          <div className="divide-y">
            {listaDisc.map((d) => {
              const ms = (marcosPorDisc.get(d.id) ?? []).sort((a, b) => a.ordem - b.ordem);
              const pagos = ms.filter((m) => m.status === "Pago").length;
              const prevista = somarDiasISO(d.data_base, d.prazo_dias);
              const multa = calcularMultaDisciplina({
                valorDisciplina: d.valor,
                dataPrevista: prevista,
                dataReal: d.data_conclusao ?? hojeISO(),
                ...multaCfg,
              });
              return (
                <button key={d.id} onClick={() => setDetalhe(d)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-secondary">{d.nome}</span>
                      <Badge variant={STATUS_VARIANTE[d.status] ?? "muted"}>{d.status}</Badge>
                      {d.valor === 0 && <Badge variant="muted">sem desembolso</Badge>}
                      {d.valor > 0 && !d.art_url && d.status !== "Concluído" && <Badge variant="warning">sem ART</Badge>}
                      {d.revisoes_usadas >= d.revisoes_max && d.revisoes_max > 0 && (
                        <Badge variant="destructive">revisões esgotadas</Badge>
                      )}
                      {multa.multa > 0 && <Badge variant="destructive">multa {formatarMoeda(multa.multa)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.valor > 0 ? `${formatarMoeda(d.valor)} · marcos ${pagos}/${ms.length} pagos` : "acompanhamento físico"}
                      {prevista ? ` · prazo ${formatarDataBR(prevista)}` : d.prazo_dias ? ` · ${d.prazo_dias}d (defina a data-base)` : ""}
                      {d.revisoes_max > 0 ? ` · revisões ${d.revisoes_usadas}/${d.revisoes_max}` : ""}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 max-w-64 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{d.progresso_pct}%</span>
                    </div>
                  </div>
                  <MiniMarcos marcos={ms} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* BIM */}
      <PainelBim rodadas={rodadas} compatFinal={compatFinal} podeEditar={podeEditar} />

      {/* Repositório: contrato assinado + arquivos gerais do empreendimento */}
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <FolderOpen className="size-5 text-primary" /> Arquivos do empreendimento
          </h2>
          <BlocoArquivos categoria="contrato" titulo="Contrato TRÍADE (assinado, aditivos)" podeEditar={podeEditar} />
          <BlocoArquivos categoria="geral" titulo="Arquivos gerais (memoriais, anexos do contrato…)" podeEditar={podeEditar} />
          <p className="text-[11px] text-muted-foreground">
            Os DWG/PDF de cada projeto ficam na própria atividade — abra a atividade acima e use a seção “Arquivos da atividade”.
          </p>
        </CardContent>
      </Card>

      {detalhe && (
        <ModalDisciplina
          disciplina={listaDisc.find((d) => d.id === detalhe.id) ?? detalhe}
          marcos={(marcosPorDisc.get(detalhe.id) ?? []).sort((a, b) => a.ordem - b.ordem)}
          compatFinal={compatFinal}
          podeEditar={podeEditar}
          multaCfg={multaCfg}
          onFechar={() => setDetalhe(null)}
        />
      )}
      {novaDisciplina && (
        <ModalNovaDisciplina
          proximaOrdem={listaDisc.reduce((m, d) => Math.max(m, d.ordem), 0) + 1}
          onFechar={() => setNovaDisciplina(false)}
        />
      )}
    </div>
  );
}

/** Nova disciplina personalizada (fora do Anexo III) com marcos proporcionais. */
function ModalNovaDisciplina({ proximaOrdem, onFechar }: { proximaOrdem: number; onFechar: () => void }) {
  const criar = useCriarDisciplina();
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [revisoes, setRevisoes] = useState("2");
  const [marcos, setMarcos] = useState<{ rotulo: string; pct: string; exige: boolean }[]>([
    { rotulo: "Início", pct: "25", exige: false },
    { rotulo: "R00", pct: "40", exige: true },
    { rotulo: "R01", pct: "25", exige: true },
    { rotulo: "Retido", pct: "10", exige: false },
  ]);

  const somaPct = marcos.reduce((s, m) => s + (parseFloat(m.pct.replace(",", ".")) || 0), 0);
  const somaOk = marcos.length === 0 || Math.round(somaPct * 100) / 100 === 100;

  async function salvar() {
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    if (!nome.trim() || !Number.isFinite(v) || v < 0) { toast.error("Informe nome e valor."); return; }
    try {
      await criar.mutateAsync({
        nome,
        valor: v,
        prazoDias: prazo.trim() === "" ? null : parseInt(prazo, 10),
        revisoesMax: parseInt(revisoes, 10) || 0,
        marcos: marcos.map((m) => ({ rotulo: m.rotulo, percentual: parseFloat(m.pct.replace(",", ".")) || 0, exigeEntrega: m.exige })),
        ordem: proximaOrdem,
      });
      toast.success("Disciplina criada.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao criar."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Nova disciplina" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Nova disciplina</h2>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Paisagismo executivo" className={inputBase} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Valor (R$)</span>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Prazo (dias)</span>
              <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Revisões</span>
              <input value={revisoes} onChange={(e) => setRevisoes(e.target.value)} inputMode="numeric" className={inputBase} /></label>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Marcos de pagamento (% do valor)</span>
            {marcos.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={m.rotulo} onChange={(e) => setMarcos((p) => p.map((x, idx) => idx === i ? { ...x, rotulo: e.target.value } : x))} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm" />
                <input value={m.pct} onChange={(e) => setMarcos((p) => p.map((x, idx) => idx === i ? { ...x, pct: e.target.value } : x))} inputMode="decimal" className="h-9 w-14 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums" />
                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground" title="Exige entrega de arquivo para aprovação">
                  <input type="checkbox" checked={m.exige} onChange={(e) => setMarcos((p) => p.map((x, idx) => idx === i ? { ...x, exige: e.target.checked } : x))} className="size-3.5 accent-primary" /> entrega
                </label>
                <button onClick={() => setMarcos((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setMarcos((p) => [...p, { rotulo: "", pct: "0", exige: false }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <Plus className="size-3.5" /> Adicionar marco
            </button>
            <p className={cn("text-right text-xs font-bold tabular-nums", somaOk ? "text-success" : "text-destructive")}>Soma: {somaPct.toFixed(1)}%</p>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={criar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} disabled={!somaOk || criar.isPending} loading={criar.isPending}>Criar</Button>
        </div>
      </div>
    </div>
  );
}

function Resumo({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "success" | "warning" }) {
  const cor = tom === "success" ? "text-success" : tom === "warning" ? "text-warning" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div>
        <p className={cn("text-lg font-extrabold tabular-nums", cor)}>{valor}</p>
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function MiniMarcos({ marcos }: { marcos: ObraDisciplinaMarco[] }) {
  return (
    <div className="flex shrink-0 gap-1">
      {marcos.map((m) => (
        <span
          key={m.id}
          title={`${m.rotulo} · ${m.status}`}
          className={cn(
            "grid h-6 min-w-8 place-items-center rounded px-1 text-[10px] font-bold tabular-nums",
            m.status === "Pago" ? "bg-success/15 text-success"
            : m.status === "Aprovado" ? "bg-primary/15 text-primary"
            : m.status === "Reprovado" ? "bg-destructive/15 text-destructive"
            : "bg-muted text-muted-foreground",
          )}
        >
          {m.percentual}%
        </span>
      ))}
    </div>
  );
}

/**
 * WORKSPACE da atividade — exportado: é o mesmo painel usado na Central e na
 * lista de Projetos. Ciclo completo num lugar só: progresso semanal, contrato,
 * ART, revisões e marcos de pagamento (entrada/R00/R01).
 */
export function ModalDisciplina({
  disciplina: d,
  marcos,
  compatFinal,
  podeEditar,
  multaCfg,
  onFechar,
}: {
  disciplina: ObraDisciplina;
  marcos: ObraDisciplinaMarco[];
  compatFinal: boolean;
  podeEditar: boolean;
  multaCfg: { multaDiaPct: number; tetoPct: number };
  onFechar: () => void;
}) {
  const atualizar = useAtualizarDisciplina();
  const editarContrato = useEditarDisciplina();
  const excluirDisc = useExcluirDisciplina();
  const removerArt = useRemoverArtDisciplina();
  const [dataBase, setDataBase] = useState(d.data_base ?? "");
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(d.nome);
  const [valor, setValor] = useState(String(d.valor));
  const [prazo, setPrazo] = useState(d.prazo_dias != null ? String(d.prazo_dias) : "");
  const [revMax, setRevMax] = useState(String(d.revisoes_max));
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const temPago = marcos.some((m) => m.status === "Pago");

  // Estado editável (status + conclusão) — livre e reversível.
  async function mudarStatus(novo: string) {
    try {
      await atualizar.mutateAsync({
        id: d.id,
        status: novo,
        // Concluído sem data → carimba hoje; sair de Concluído limpa a conclusão.
        dataConclusao: novo === "Concluído" ? (d.data_conclusao ?? hojeISO()) : null,
      });
      toast.success(`Status: ${novo}.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao mudar o status."); }
  }
  async function mudarConclusao(data: string) {
    try {
      await atualizar.mutateAsync({ id: d.id, dataConclusao: data || null });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function tirarArt() {
    try { await removerArt.mutateAsync(d.id); toast.success("ART removida."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }

  const prevista = somarDiasISO(dataBase || d.data_base, d.prazo_dias);
  const multa = calcularMultaDisciplina({
    valorDisciplina: d.valor,
    dataPrevista: prevista,
    dataReal: d.data_conclusao ?? hojeISO(),
    ...multaCfg,
  });

  async function salvarBase() {
    try { await atualizar.mutateAsync({ id: d.id, dataBase: dataBase || null }); toast.success("Data-base do prazo atualizada."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }
  async function anexarArt(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await atualizar.mutateAsync({ id: d.id, art: file }); toast.success("ART anexada."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao anexar ART."); }
  }
  async function registrarRevisao() {
    if (d.revisoes_usadas >= d.revisoes_max) return;
    try { await atualizar.mutateAsync({ id: d.id, revisoesUsadas: d.revisoes_usadas + 1 }); toast.success("Revisão registrada."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function salvarContrato() {
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    try {
      await editarContrato.mutateAsync({
        id: d.id, nome, valor: v,
        prazoDias: prazo.trim() === "" ? null : parseInt(prazo, 10),
        revisoesMax: parseInt(revMax, 10) || 0,
      });
      toast.success("Disciplina atualizada — marcos não pagos recalculados.");
      setEditando(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }
  async function excluir() {
    try { await excluirDisc.mutateAsync(d.id); toast.success("Disciplina excluída."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao excluir."); }
  }

  const revisaoAlerta = d.revisoes_max > 0 && d.revisoes_usadas >= d.revisoes_max - 1;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={d.nome} className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-lg animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-secondary">{d.nome}</h2>
            <p className="text-sm text-muted-foreground">
              {d.valor > 0 ? formatarMoeda(d.valor) : "sem desembolso"}
              {d.observacao ? ` · ${d.observacao}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {podeEditar && (
              <>
                <button onClick={() => setEditando((v) => !v)} className={cn("text-muted-foreground hover:text-primary", editando && "text-primary")} title="Editar contrato (nome, valor, prazo, revisões)"><Pencil className="size-4" /></button>
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="text-muted-foreground hover:text-destructive"
                  title={temPago ? "Excluir — atenção: há marco pago" : "Excluir disciplina"}
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
            <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
          </div>
        </div>

        {/* ESTADO — status + conclusão, sempre editável e reversível */}
        {podeEditar && (
          <div className="mt-3 grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Status</span>
              <select value={d.status} onChange={(e) => mudarStatus(e.target.value)} disabled={atualizar.isPending} className={cn(inputBase, "h-9")}>
                {STATUS_DISCIPLINA.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Data de conclusão</span>
              <input type="date" value={d.data_conclusao ?? ""} onChange={(e) => mudarConclusao(e.target.value)} disabled={atualizar.isPending} className={cn(inputBase, "h-9")} />
            </label>
          </div>
        )}

        {/* Edição do contrato da disciplina (controle interno) */}
        {editando && (
          <div className="mt-3 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <label className="block space-y-1"><span className="text-xs font-semibold text-secondary">Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={cn(inputBase, "h-9")} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block space-y-1"><span className="text-xs font-semibold text-secondary">Valor (R$)</span>
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={cn(inputBase, "h-9")} /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-secondary">Prazo (dias)</span>
                <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" className={cn(inputBase, "h-9")} /></label>
              <label className="block space-y-1"><span className="text-xs font-semibold text-secondary">Revisões máx.</span>
                <input value={revMax} onChange={(e) => setRevMax(e.target.value)} inputMode="numeric" className={cn(inputBase, "h-9")} /></label>
            </div>
            <p className="text-[11px] text-muted-foreground">Ao mudar o valor, marcos NÃO pagos são recalculados; pagos ficam como estão.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={editarContrato.isPending}>Cancelar</Button>
              <Button size="sm" onClick={salvarContrato} loading={editarContrato.isPending}>Salvar</Button>
            </div>
          </div>
        )}

        {/* Progresso da atividade (controle semanal) — sempre editável */}
        {podeEditar && <BlocoProgresso disciplina={d} />}

        {/* Prazo / data-base / multa */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Prazo</p>
            <p className="text-sm text-secondary">
              {d.prazo_dias ? `${d.prazo_dias} dias` : "sem prazo"}
              {prevista ? ` · entrega até ${formatarDataBR(prevista)}` : ""}
            </p>
            {podeEditar && (
              <div className="mt-2 flex items-end gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Data-base{d.nome === "Estrutural" ? " (laudo + elevadores)" : ""}</span>
                  <input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-xs" />
                </label>
                <Button size="sm" variant="outline" onClick={salvarBase} loading={atualizar.isPending}>OK</Button>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Multa por atraso</p>
            <p className={cn("text-lg font-extrabold tabular-nums", multa.multa > 0 ? "text-destructive" : "text-secondary")}>{formatarMoeda(multa.multa)}</p>
            {multa.diasAtraso > 0 && <p className="text-[11px] text-muted-foreground">{multa.diasAtraso} dias · 0,15%/dia (teto 10%)</p>}
          </div>
        </div>

        {/* ART + revisões */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
          <span className="flex items-center gap-2 text-sm">
            {d.art_url ? <Check className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
            ART {d.art_url ? "anexada" : "pendente"}
          </span>
          {podeEditar && (
            <span className="flex items-center gap-3">
              {d.art_url && (
                <button onClick={tirarArt} disabled={removerArt.isPending} className="text-xs font-semibold text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50">
                  Remover
                </button>
              )}
              <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                <Upload className="mr-1 inline size-3.5" />{d.art_url ? "Substituir" : "Anexar ART"}
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={anexarArt} />
              </label>
            </span>
          )}
        </div>
        {d.revisoes_max > 0 && (
          <div className={cn("mt-2 flex items-center justify-between gap-2 rounded-lg border p-3", revisaoAlerta ? "border-warning/50 bg-warning/5" : "border-border")}>
            <span className="text-sm text-secondary">Revisões usadas: <strong className="tabular-nums">{d.revisoes_usadas}/{d.revisoes_max}</strong>{revisaoAlerta && " — última disponível"}</span>
            {podeEditar && (
              <span className="flex items-center gap-3">
                {d.revisoes_usadas > 0 && (
                  <button onClick={() => atualizar.mutate({ id: d.id, revisoesUsadas: d.revisoes_usadas - 1 })} disabled={atualizar.isPending} className="text-xs font-semibold text-muted-foreground hover:text-secondary hover:underline disabled:opacity-50">
                    − Desfazer
                  </button>
                )}
                {d.revisoes_usadas < d.revisoes_max && (
                  <button onClick={registrarRevisao} disabled={atualizar.isPending} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                    + Registrar revisão
                  </button>
                )}
              </span>
            )}
          </div>
        )}

        {/* Marcos */}
        <p className="mt-4 mb-1 text-sm font-semibold text-secondary">Marcos de pagamento</p>
        <div className="space-y-2">
          {marcos.map((m) => (
            <MarcoLinha key={m.id} marco={m} disciplina={d} compatFinal={compatFinal} podeEditar={podeEditar} />
          ))}
        </div>

        {/* Arquivos da atividade (DWG/PDF dos projetos) */}
        <div className="mt-4">
          <BlocoArquivos categoria="projeto" disciplinaId={d.id} titulo="Arquivos da atividade (DWG · PDF · memoriais)" podeEditar={podeEditar} />
        </div>
      </div>
      <ConfirmDialog
        aberto={confirmandoExclusao}
        titulo="Excluir disciplina?"
        descricao={`${d.nome} · ${formatarMoeda(d.valor)}.${temPago ? " ATENÇÃO: há marco pago — o histórico financeiro será perdido." : " Os marcos saem junto."} A auditoria preserva o rastro.`}
        textoConfirmar="Excluir"
        onConfirmar={() => { setConfirmandoExclusao(false); void excluir(); }}
        onCancelar={() => setConfirmandoExclusao(false)}
      />
    </div>,
    document.body,
  );
}

/**
 * Bloco de arquivos do repositório (contrato / projeto por atividade / geral):
 * upload múltiplo (PDF, DWG, imagens…), lista com abrir/baixar e excluir.
 */
function BlocoArquivos({
  categoria,
  disciplinaId = null,
  titulo,
  podeEditar,
}: {
  categoria: "contrato" | "projeto" | "geral";
  disciplinaId?: string | null;
  titulo: string;
  podeEditar: boolean;
}) {
  const arquivos = useObraArquivos();
  const subir = useSubirArquivosObra();
  const excluir = useExcluirArquivoObra();
  const [aExcluir, setAExcluir] = useState<{ id: string; nome: string } | null>(null);

  const lista = (arquivos.data ?? []).filter(
    (a) => a.categoria === categoria && (disciplinaId ? a.disciplina_id === disciplinaId : !a.disciplina_id),
  );

  async function onArquivos(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    try {
      await subir.mutateAsync({ categoria, disciplinaId, arquivos: files });
      toast.success(`${files.length} arquivo(s) anexado(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-secondary">{titulo}</p>
        {podeEditar && (
          <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
            <Upload className="mr-1 inline size-3.5" />
            {subir.isPending ? "Enviando…" : "Anexar arquivos"}
            <input
              type="file"
              multiple
              accept=".pdf,.dwg,.dxf,.ifc,.doc,.docx,.xls,.xlsx,image/*"
              className="hidden"
              disabled={subir.isPending}
              onChange={onArquivos}
            />
          </label>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          Nenhum arquivo anexado ainda.
        </p>
      ) : (
        <div className="divide-y rounded-lg border border-border">
          {lista.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 px-3 py-2">
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-secondary" title={a.nome}>{a.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatarDataBR(a.criado_em.slice(0, 10))}{a.registrado_por ? ` · ${a.registrado_por}` : ""}
                </p>
              </div>
              <AnexoSeguro
                bucket={BUCKET_OBRA}
                stored={a.arquivo_url}
                fallback={<span className="text-xs text-muted-foreground">…</span>}
              >
                {(url) => (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" /> Abrir
                  </a>
                )}
              </AnexoSeguro>
              {podeEditar && (
                <button
                  onClick={() => setAExcluir({ id: a.id, nome: a.nome })}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  title="Excluir arquivo"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        aberto={!!aExcluir}
        titulo="Excluir arquivo?"
        descricao={aExcluir?.nome}
        textoConfirmar="Excluir"
        onConfirmar={() => {
          const alvo = aExcluir;
          setAExcluir(null);
          if (!alvo) return;
          excluir.mutate(alvo.id, {
            onSuccess: () => toast.success("Arquivo excluído."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
          });
        }}
        onCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}

/** Slider de progresso + apontamento semanal (grava histórico). */
function BlocoProgresso({ disciplina: d }: { disciplina: ObraDisciplina }) {
  const atualizar = useAtualizarProgresso();
  const [pct, setPct] = useState(d.progresso_pct);
  const [obs, setObs] = useState("");

  async function salvar() {
    try {
      await atualizar.mutateAsync({ disciplinaId: d.id, progressoPct: pct, observacao: obs });
      toast.success(`Progresso registrado: ${pct}%.`);
      setObs("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao registrar."); }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-secondary">Progresso da atividade</span>
        <span className="text-lg font-extrabold tabular-nums text-primary">{pct}%</span>
      </div>
      <SliderPct valor={pct} onChange={setPct} />
      <div className="flex gap-2 pt-1">
        <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação da semana (opcional)" className={cn(inputBase, "h-9 flex-1")} />
        <Button size="sm" onClick={salvar} disabled={pct === d.progresso_pct && !obs.trim()} loading={atualizar.isPending}>Registrar</Button>
      </div>
    </div>
  );
}

function MarcoLinha({
  marco: m,
  disciplina: d,
  compatFinal,
  podeEditar,
}: {
  marco: ObraDisciplinaMarco;
  disciplina: ObraDisciplina;
  compatFinal: boolean;
  podeEditar: boolean;
}) {
  const atualizar = useAtualizarMarco();
  const pagar = usePagarMarco();
  const desfazerPagamento = useDesfazerPagamentoMarco();
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  // Pagamento pede confirmação; o toast de sucesso oferece "Desfazer".
  const [confirmandoPagamento, setConfirmandoPagamento] = useState<null | "pagar" | "entrada">(null);

  function toastPagoComDesfazer(mensagem: string) {
    toast.success(mensagem, {
      duration: 12_000,
      action: {
        label: "Desfazer",
        onClick: () =>
          desfazerPagamento.mutate(
            { id: m.id, disciplina_id: d.id },
            {
              onSuccess: () => toast.success("Pagamento desfeito — marco voltou para Aprovado."),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desfazer."),
            },
          ),
      },
    });
  }

  // ART só é exigida em marcos COM entrega (a Entrada vence no início do
  // projeto, antes de existir ART) — espelha o gate do RPC (0112).
  const motivoPagamento =
    m.status !== "Aprovado" ? "O marco precisa estar Aprovado."
    : m.exige_entrega && !d.art_url ? "Anexe a ART da disciplina."
    : m.chave === "retido" && !compatFinal ? "Retido só libera após a compatibilização final do BIM."
    : null;

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await atualizar.mutateAsync({ id: m.id, entrega: file }); toast.success("Entrega anexada (Em análise)."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao anexar."); }
  }
  async function transicao(status: ObraMarcoStatus) {
    try { await atualizar.mutateAsync({ id: m.id, status }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function reprovar() {
    if (!motivo.trim()) return;
    try { await atualizar.mutateAsync({ id: m.id, status: "Reprovado", motivo }); setReprovando(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function pagarMarco() {
    try {
      await pagar.mutateAsync(m.id);
      toastPagoComDesfazer(`${m.rotulo} pago (${formatarMoeda(m.valor)}).`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar."); }
  }
  /** Entrada (50%): aprova e paga — vence na data de início. */
  async function aprovarEPagarEntrada() {
    try {
      await atualizar.mutateAsync({ id: m.id, status: "Aprovado" });
      await pagar.mutateAsync(m.id);
      toastPagoComDesfazer(`Entrada de ${formatarMoeda(m.valor)} paga.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar a entrada."); }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-secondary">{m.rotulo}</span>
          <Badge variant={STATUS_VARIANTE[m.status] ?? "muted"}>{m.status}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">{m.percentual}% · {formatarMoeda(m.valor)}</span>
        </div>
      </div>
      {m.status === "Reprovado" && m.motivo && <p className="mt-1 text-xs text-destructive">Reprovado: {m.motivo}</p>}

      {podeEditar && m.status !== "Pago" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {m.exige_entrega && (m.status === "Pendente" || m.status === "Reprovado") && (
            <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
              <Upload className="mr-1 inline size-3.5" />{m.entrega_url ? "Nova entrega" : "Anexar entrega"}
              <input type="file" accept="application/pdf,image/*,.dwg,.ifc" className="hidden" onChange={upload} />
            </label>
          )}
          {!m.exige_entrega && m.status === "Pendente" && (
            m.chave === "inicio" ? (
              <Button size="sm" onClick={() => setConfirmandoPagamento("entrada")} loading={atualizar.isPending || pagar.isPending}>
                Pagar entrada ({formatarMoeda(m.valor)})
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => transicao("Aprovado")} loading={atualizar.isPending}>Liberar</Button>
            )
          )}
          {m.status === "Em análise" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setReprovando((v) => !v)}>Reprovar</Button>
              <Button size="sm" onClick={() => transicao("Aprovado")} loading={atualizar.isPending}>Aprovar entrega</Button>
            </>
          )}
          {m.status === "Aprovado" && (
            <>
              <span title={motivoPagamento ?? undefined}>
                <Button size="sm" onClick={() => setConfirmandoPagamento("pagar")} disabled={!!motivoPagamento || pagar.isPending} loading={pagar.isPending}>
                  Pagar {m.percentual}%
                </Button>
              </span>
              <button
                onClick={() => transicao("Pendente")}
                disabled={atualizar.isPending}
                className="text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
                title="Aprovou por engano? Volta o marco para Pendente."
              >
                Desfazer aprovação
              </button>
            </>
          )}
          {m.status === "Aprovado" && motivoPagamento && <span className="text-[11px] text-muted-foreground">{motivoPagamento}</span>}
        </div>
      )}
      {m.status === "Pago" && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-success">{m.data_pagamento ? `Pago em ${formatarDataBR(m.data_pagamento)}.` : "Pago."}</p>
          {podeEditar && (
            <button
              onClick={() => desfazerPagamento.mutate({ id: m.id, disciplina_id: d.id }, {
                onSuccess: () => toast.success("Pagamento desfeito — marco voltou para Aprovado."),
                onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desfazer."),
              })}
              disabled={desfazerPagamento.isPending}
              className="text-[11px] font-semibold text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
              title="Pagou por engano? Reverte o pagamento (volta a Aprovado)."
            >
              Desfazer pagamento
            </button>
          )}
        </div>
      )}

      {reprovando && (
        <div className="mt-2 flex gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da reprovação" className={cn(inputBase, "h-9")} autoFocus />
          <Button size="sm" variant="destructive" onClick={reprovar} disabled={!motivo.trim() || atualizar.isPending}>OK</Button>
        </div>
      )}

      <ConfirmDialog
        aberto={!!confirmandoPagamento}
        titulo={confirmandoPagamento === "entrada" ? "Confirmar pagamento da entrada?" : "Confirmar pagamento?"}
        descricao={`${d.nome} — ${m.rotulo} de ${formatarMoeda(m.valor)}. Você poderá desfazer depois (no aviso ou aqui mesmo, em "Desfazer pagamento").`}
        textoConfirmar="Confirmar pagamento"
        varianteConfirmar="default"
        onConfirmar={() => {
          const tipo = confirmandoPagamento;
          setConfirmandoPagamento(null);
          if (tipo === "entrada") void aprovarEPagarEntrada();
          else void pagarMarco();
        }}
        onCancelar={() => setConfirmandoPagamento(null)}
      />
    </div>
  );
}

function PainelBim({ rodadas, compatFinal, podeEditar }: { rodadas: ObraBimRodada[]; compatFinal: boolean; podeEditar: boolean }) {
  const [nova, setNova] = useState(false);
  const rodadasNormais = rodadas.filter((r) => !r.final).length;

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Boxes className="size-5 text-primary" /> BIM — compatibilização
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant={rodadasNormais >= 3 ? "success" : "warning"}>{rodadasNormais}/3 rodadas</Badge>
            <Badge variant={compatFinal ? "success" : "muted"}>{compatFinal ? "Final com IFC" : "sem final"}</Badge>
            {podeEditar && <Button size="sm" onClick={() => setNova(true)}>Nova rodada</Button>}
          </div>
        </div>
        {rodadas.length === 0 ? (
          <EmptyState label="Nenhuma rodada de compatibilização registrada." />
        ) : (
          <div className="divide-y">
            {rodadas.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-semibold text-secondary">Rodada {r.numero}{r.final ? " (final)" : ""}</span>
                <span className="text-xs text-muted-foreground">{formatarDataBR(r.data_rodada)}</span>
                {r.relatorio_url && <Badge variant="muted">relatório</Badge>}
                {r.ifc_url && <Badge variant="success">IFC</Badge>}
                {r.observacao && <span className="text-xs text-muted-foreground">· {r.observacao}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {nova && <ModalRodadaBim proximoNumero={rodadas.length + 1} onFechar={() => setNova(false)} />}
    </Card>
  );
}

function ModalRodadaBim({ proximoNumero, onFechar }: { proximoNumero: number; onFechar: () => void }) {
  const registrar = useRegistrarRodadaBim();
  const [numero, setNumero] = useState(String(proximoNumero));
  const [ehFinal, setEhFinal] = useState(false);
  const [relatorio, setRelatorio] = useState<File | null>(null);
  const [ifc, setIfc] = useState<File | null>(null);
  const [obs, setObs] = useState("");

  const podeSalvar = !!relatorio && (!ehFinal || !!ifc);

  async function salvar() {
    const n = parseInt(numero, 10);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Número da rodada inválido."); return; }
    try {
      await registrar.mutateAsync({ numero: n, ehFinal, relatorio, ifc, observacao: obs });
      toast.success(`Rodada ${n}${ehFinal ? " (final)" : ""} registrada.`);
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao registrar."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Nova rodada BIM" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Nova rodada BIM</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-secondary">Rodada nº</span>
              <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-11 w-24 rounded-md border border-input bg-card px-3 text-sm" />
            </label>
            <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm">
              <input type="checkbox" checked={ehFinal} onChange={(e) => setEhFinal(e.target.checked)} className="size-4 accent-primary" />
              Rodada final (consolidada)
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Relatório de interferências (PDF)</label>
            <input type="file" accept="application/pdf" onChange={(e) => setRelatorio(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Modelo IFC {ehFinal ? "(obrigatório na final)" : "(opcional)"}</label>
            <input type="file" accept=".ifc" onChange={(e) => setIfc(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground" />
          </div>
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className={inputBase} />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>Cancelar</Button>
          <span className="flex-1" title={podeSalvar ? undefined : ehFinal ? "A rodada final exige relatório e IFC" : "Anexe o relatório de interferências"}>
            <Button size="lg" className="w-full" onClick={salvar} disabled={!podeSalvar || registrar.isPending} loading={registrar.isPending}>Registrar</Button>
          </span>
        </div>
      </div>
    </div>
  );
}
