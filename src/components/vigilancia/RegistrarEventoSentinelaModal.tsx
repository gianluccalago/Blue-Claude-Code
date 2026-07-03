import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AlertTriangle, X, ShieldAlert } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useRegistrarEventoSentinela } from "@/hooks/useEventosSentinela";
import { TIPO_SENTINELA, TIPO_SENTINELA_ARTIGO } from "@/lib/vigilancia";
import { Button } from "@/components/ui/button";
import type { TipoEventoSentinela } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível registrar.");

/** "YYYY-MM-DDTHH:mm" local (default do datetime-local). */
function agoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ===========================================================================
// Registro de EVENTO SENTINELA (RDC 502/2021) — Coordenação/Médico/Master.
// Usado tanto no registro direto quanto na CLASSIFICAÇÃO de uma queda
// (residente/intercorrência já fixos). Deixa explícito o alerta legal.
// ===========================================================================

export function RegistrarEventoSentinelaModal({
  onFechar,
  residenteFixo,
  intercorrenciaId,
  tipoInicial,
  descricaoInicial,
}: {
  onFechar: () => void;
  /** Quando classificando uma queda: residente já definido. */
  residenteFixo?: { id: string; nome: string };
  intercorrenciaId?: string;
  tipoInicial?: TipoEventoSentinela;
  descricaoInicial?: string;
}) {
  const residentes = useResidentes();
  const registrar = useRegistrarEventoSentinela();

  const [residenteId, setResidenteId] = useState(residenteFixo?.id ?? "");
  const [tipo, setTipo] = useState<TipoEventoSentinela>(tipoInicial ?? "queda_com_lesao");
  const [dataOcorrencia, setDataOcorrencia] = useState(agoraLocal());
  const [descricao, setDescricao] = useState(descricaoInicial ?? "");
  const [descricaoDoenca, setDescricaoDoenca] = useState("");
  const [gravidade, setGravidade] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function salvar() {
    if (!residenteId) return toast.error("Selecione o hóspede.");
    if (tipo === "doenca_notificacao_compulsoria" && !descricaoDoenca.trim())
      return toast.error("Informe qual a doença.");
    if (!descricao.trim()) return toast.error("Descreva o ocorrido.");
    try {
      await registrar.mutateAsync({
        residenteId,
        tipo,
        descricao,
        dataOcorrencia: new Date(dataOcorrencia).toISOString(),
        descricaoDoenca: tipo === "doenca_notificacao_compulsoria" ? descricaoDoenca : null,
        gravidade: gravidade || null,
        intercorrenciaId: intercorrenciaId ?? null,
      });
      toast.success("Evento sentinela registrado. Pendente de notificação à vigilância.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Registrar evento sentinela" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <ShieldAlert className="size-5 text-destructive" /> Registrar evento sentinela
          </h2>
          <button onClick={onFechar} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        {/* Alerta legal explícito */}
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Evento de <strong>notificação compulsória</strong> ({TIPO_SENTINELA_ARTIGO[tipo]} da RDC 502/2021) —
            requer notificação à autoridade sanitária. Após registrar, o Responsável Técnico documenta a
            notificação na aba Vigilância Sanitária.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Hóspede</label>
            {residenteFixo ? (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium text-secondary">{residenteFixo.nome}</p>
            ) : (
              <select value={residenteId} onChange={(e) => setResidenteId(e.target.value)} className={inputBase}>
                <option value="">Selecione…</option>
                {(residentes.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Tipo de evento</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEventoSentinela)} className={inputBase}>
              {TIPO_SENTINELA.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.artigo})</option>)}
            </select>
          </div>

          {tipo === "doenca_notificacao_compulsoria" && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-secondary">Qual doença</label>
              <input value={descricaoDoenca} onChange={(e) => setDescricaoDoenca(e.target.value)} placeholder="Ex.: COVID-19, tuberculose…" className={inputBase} />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Data/hora da ocorrência</label>
            <input type="datetime-local" value={dataOcorrencia} onChange={(e) => setDataOcorrencia(e.target.value)} className={inputBase} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Descrição do ocorrido</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${inputBase} h-auto py-2 resize-none`} placeholder="O que aconteceu, conduta tomada…" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Gravidade (opcional)</label>
            <input value={gravidade} onChange={(e) => setGravidade(e.target.value)} placeholder="Ex.: leve, moderada, grave" className={inputBase} />
          </div>

          <Button className="w-full" onClick={salvar} disabled={registrar.isPending}>
            {registrar.isPending ? "Registrando…" : "Registrar evento sentinela"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
