import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  HardHat, Bell, FileText, Landmark, Ruler, Upload, Check, AlertTriangle, X, ClipboardCheck,
} from "lucide-react";
import { useFasesObra, useEtapasObra, useChecklistObra } from "@/hooks/useObra";
import { useMedicoes, useEtapasMedidas, useDocumentosMensais, useSubirDocumentoMensal, usePendencias } from "@/hooks/useObraMedicoes";
import { useMarcos, useDisciplinas, useBimRodadas, useRegistrarRodadaBim } from "@/hooks/useObraProjetos";
import { useSubmeterBM, useSubmeterEntrega, useNotificacoesObra, useMarcarNotificacaoLida } from "@/hooks/useObraPortal";
import { ultimaVerificacaoPorEtapa, etapaConcluida, avancoFisico, OBRA_FASE_STATUS_LABEL } from "@/lib/obra";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import type { ObraFase } from "@/types/database";

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DOC_TIPOS = ["inss", "fgts", "iss", "folha"] as const;
const DOC_LABEL: Record<string, string> = { inss: "Guia INSS", fgts: "Guia FGTS", iss: "Guia ISS", folha: "Folha de pagamento" };
const MED_VARIANTE: Record<string, "muted" | "warning" | "default" | "destructive" | "success"> = {
  Pendente: "muted", "Em análise": "warning", Aprovado: "default", Reprovado: "destructive", Pago: "success",
};

export function PortalPrestador() {
  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const medicoes = useMedicoes();
  const documentos = useDocumentosMensais();
  const pendencias = usePendencias();
  const notificacoes = useNotificacoesObra();

  const [submeterBM, setSubmeterBM] = useState(false);

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist.data ?? []), [checklist.data]);

  if (fases.isLoading || etapas.isLoading || medicoes.isLoading) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaFases = fases.data ?? [];
  const emAndamento = listaFases.find((f) => f.status === "em_andamento");
  const naoLidas = (notificacoes.data ?? []).filter((n) => !n.lida);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><HardHat className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Portal da obra</h1>
          <p className="text-xs text-muted-foreground">Suas medições, documentos e entregas.</p>
        </div>
      </div>

      {/* Notificações */}
      {naoLidas.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-secondary"><Bell className="size-4 text-warning" /> Avisos</h3>
            {naoLidas.map((n) => <NotifLinha key={n.id} id={n.id} titulo={n.titulo} corpo={n.corpo} quando={n.criado_em} />)}
          </CardContent>
        </Card>
      )}

      {/* Cronograma / avanço das fases */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Ruler className="size-5 text-primary" /> Cronograma</h2>
            {emAndamento && <Button size="sm" onClick={() => setSubmeterBM(true)}><ClipboardCheck className="size-4" /> Submeter medição</Button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {listaFases.map((f) => {
              const av = avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa);
              return (
                <div key={f.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-secondary">{f.nome}</span>
                    <Badge variant="muted">{OBRA_FASE_STATUS_LABEL[f.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.modulos}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, av)}%` }} /></div>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">{av.toFixed(1)}% físico</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Minhas medições */}
      <Card>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><FileText className="size-5 text-primary" /> Minhas medições</h2>
          {(medicoes.data ?? []).length === 0 ? <EmptyState label="Nenhuma medição submetida." /> : (
            <div className="divide-y">
              {(medicoes.data ?? []).map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-secondary">BM {m.mes}</span>
                      <Badge variant={MED_VARIANTE[m.status]}>{m.status}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">{m.percentual_medido}% medido</span>
                    </div>
                    {m.status === "Reprovado" && m.motivo && <p className="text-xs text-destructive">Reprovada: {m.motivo}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos do mês */}
      <DocumentosPrestador documentos={documentos.data ?? []} />

      {/* Projetos: entregas + BIM */}
      <ProjetosPrestador />

      {/* Pendências de recebimento */}
      {(pendencias.data ?? []).length > 0 && (
        <Card>
          <CardContent className="space-y-1 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><AlertTriangle className="size-5 text-warning" /> Pendências</h2>
            {(pendencias.data ?? []).map((p) => (
              <p key={p.id} className={cn("text-sm", p.sanada ? "text-muted-foreground line-through" : "text-secondary")}>{p.descricao}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {submeterBM && emAndamento && (
        <ModalSubmeterBM
          fase={emAndamento}
          etapasFase={(etapas.data ?? []).filter((e) => e.fase_id === emAndamento.id)}
          ultimaPorEtapa={ultimaPorEtapa}
          onFechar={() => setSubmeterBM(false)}
        />
      )}
    </div>
  );
}

function NotifLinha({ id, titulo, corpo, quando }: { id: string; titulo: string; corpo: string | null; quando: string }) {
  const marcar = useMarcarNotificacaoLida();
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
      <div><p className="text-sm font-semibold text-secondary">{titulo}</p>{corpo && <p className="text-xs text-muted-foreground">{corpo}</p>}<p className="text-[11px] text-muted-foreground">{formatarDataHoraBR(quando)}</p></div>
      <button onClick={() => marcar.mutate(id)} className="text-xs font-semibold text-primary hover:underline">OK</button>
    </div>
  );
}

function DocumentosPrestador({ documentos }: { documentos: { mes: string; tipo: string }[] }) {
  const subir = useSubirDocumentoMensal();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const presentes = new Set(documentos.filter((d) => d.mes === mes).map((d) => d.tipo));

  async function onArquivo(tipo: (typeof DOC_TIPOS)[number], e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await subir.mutateAsync({ mes, tipo, arquivo: file }); toast.success(`${DOC_LABEL[tipo]} enviada.`); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar."); }
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Landmark className="size-5 text-primary" /> Documentos do mês</h2>
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            <Badge variant={presentes.size === 4 ? "success" : "warning"}>{presentes.size}/4</Badge>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOC_TIPOS.map((t) => {
            const ok = presentes.has(t);
            return (
              <div key={t} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2", ok ? "border-success/40 bg-success/5" : "border-border")}>
                <span className="flex items-center gap-2 text-sm">{ok ? <Check className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}{DOC_LABEL[t]}</span>
                <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">{ok ? "Substituir" : "Enviar"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onArquivo(t, e)} /></label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjetosPrestador() {
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const bim = useBimRodadas();
  const submeter = useSubmeterEntrega();
  const registrarBim = useRegistrarRodadaBim();
  const [bimAberto, setBimAberto] = useState(false);

  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
  // Marcos que aguardam entrega do prestador.
  const aEntregar = (marcos.data ?? []).filter((m) => m.exige_entrega && (m.status === "Pendente" || m.status === "Reprovado"));
  const rodadas = bim.data ?? [];

  async function upload(marcoId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await submeter.mutateAsync({ marcoId, arquivo: file }); toast.success("Entrega enviada — em análise."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar."); }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><FileText className="size-5 text-primary" /> Entregas de projeto</h2>
          <Button size="sm" variant="outline" onClick={() => setBimAberto(true)}>Rodada BIM</Button>
        </div>
        {aEntregar.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma entrega pendente.</p> : (
          <div className="divide-y">
            {aEntregar.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-semibold text-secondary">{nomeDisc.get(m.disciplina_id) ?? "Disciplina"}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{m.rotulo}</span>
                  {m.status === "Reprovado" && m.motivo && <p className="text-xs text-destructive">Reprovado: {m.motivo}</p>}
                </div>
                <label className="cursor-pointer text-xs font-semibold text-primary hover:underline"><Upload className="mr-1 inline size-3.5" />Enviar entrega<input type="file" accept="application/pdf,image/*,.dwg,.ifc" className="hidden" onChange={(e) => upload(m.id, e)} /></label>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-2">
          <p className="text-xs text-muted-foreground">BIM: {rodadas.filter((r) => !r.final).length} rodadas · {rodadas.some((r) => r.final && r.ifc_url) ? "final com IFC entregue" : "sem final"}</p>
        </div>
      </CardContent>
      {bimAberto && <ModalBim proximo={rodadas.length + 1} onFechar={() => setBimAberto(false)} registrar={registrarBim} />}
    </Card>
  );
}

function ModalSubmeterBM({ fase, etapasFase, ultimaPorEtapa, onFechar }: {
  fase: ObraFase;
  etapasFase: { id: string; nome: string; peso_pct: number }[];
  ultimaPorEtapa: ReturnType<typeof ultimaVerificacaoPorEtapa>;
  onFechar: () => void;
}) {
  const submeter = useSubmeterBM();
  const medidas = useEtapasMedidas();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const disponiveis = etapasFase.filter((e) => etapaConcluida(e.id, ultimaPorEtapa) && !(medidas.data ?? new Set()).has(e.id));
  const pct = disponiveis.filter((e) => sel.has(e.id)).reduce((s, e) => s + e.peso_pct, 0);

  function toggle(id: string) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function enviar() {
    if (sel.size === 0) { toast.error("Selecione ao menos uma etapa concluída."); return; }
    try { await submeter.mutateAsync({ faseId: fase.id, mes, etapaIds: [...sel] }); toast.success("Medição submetida (Pendente)."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao submeter."); }
  }
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Submeter medição — {fase.nome}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Mês</span><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputBase} /></label>
        <p className="mt-3 mb-1 text-sm font-semibold text-secondary">Etapas concluídas ({pct}% medido)</p>
        {disponiveis.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa concluída pendente de medição.</p> : (
          <div className="space-y-1">
            {disponiveis.map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-primary" />
                <span className="flex-1 text-secondary">{e.nome}</span><Badge variant="muted">{e.peso_pct}%</Badge>
              </label>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Os valores são calculados pelo sistema; a medição entra como Pendente para análise da gestão.</p>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={submeter.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={enviar} disabled={sel.size === 0 || submeter.isPending} loading={submeter.isPending}>Submeter</Button>
        </div>
      </div>
    </div>
  );
}

function ModalBim({ proximo, onFechar, registrar }: { proximo: number; onFechar: () => void; registrar: ReturnType<typeof useRegistrarRodadaBim> }) {
  const [numero, setNumero] = useState(String(proximo));
  const [ehFinal, setEhFinal] = useState(false);
  const [relatorio, setRelatorio] = useState<File | null>(null);
  const [ifc, setIfc] = useState<File | null>(null);
  const podeSalvar = !!relatorio && (!ehFinal || !!ifc);

  async function salvar() {
    const n = parseInt(numero, 10);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Número inválido."); return; }
    try { await registrar.mutateAsync({ numero: n, ehFinal, relatorio, ifc }); toast.success("Rodada registrada."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="mb-3 text-lg font-bold text-secondary">Rodada BIM</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-11 w-24 rounded-md border border-input bg-card px-3 text-sm" />
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={ehFinal} onChange={(e) => setEhFinal(e.target.checked)} className="size-4 accent-primary" /> Final</label>
          </div>
          <label className="block space-y-1"><span className="text-sm text-secondary">Relatório de interferências (PDF)</span><input type="file" accept="application/pdf" onChange={(e) => setRelatorio(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></label>
          <label className="block space-y-1"><span className="text-sm text-secondary">IFC {ehFinal ? "(obrigatório)" : "(opcional)"}</span><input type="file" accept=".ifc" onChange={(e) => setIfc(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></label>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} disabled={!podeSalvar || registrar.isPending} loading={registrar.isPending}>Registrar</Button>
        </div>
      </div>
    </div>
  );
}
