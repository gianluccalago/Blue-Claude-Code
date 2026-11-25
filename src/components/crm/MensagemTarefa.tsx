import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MessageCircle, Mail, Check, Pencil, Copy, AlertTriangle, Ban } from "lucide-react";
import { useMarcarEnviada, useEditarMensagem } from "@/hooks/usePosVisita";
import { camposPendentes, rotuloCampo } from "@/lib/posVisita";
import { linkWhatsapp, linkEmail } from "@/lib/visitas";
import { formatarDataBR, cn, hojeISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CrmTarefa } from "@/types/database";

// Mensagem do pós-visita: o texto já vem personalizado; o consultor confere,
// completa o que estiver entre {chaves}, toca em "Abrir no WhatsApp" (sai do
// número dele, envio manual) e marca como enviada.
export function MensagemTarefa({
  tarefa: t,
  telefone,
  email,
  optOut,
  nomeOportunidade,
  aberta: abertaInicial = false,
  acaoExtra,
}: {
  tarefa: CrmTarefa;
  telefone: string | null;
  email: string | null;
  optOut: boolean;
  nomeOportunidade?: string;
  aberta?: boolean;
  /** Ação extra ao lado dos botões (ex.: baixar a minuta no e-mail do contrato). */
  acaoExtra?: ReactNode;
}) {
  const marcar = useMarcarEnviada();
  const editar = useEditarMensagem();
  const [aberta, setAberta] = useState(abertaInicial);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(t.mensagem ?? "");

  const pendentes = camposPendentes(t.mensagem);
  const vencida = !t.concluida && !t.cancelada && !!t.data && t.data < hojeISO();
  const hoje = !t.concluida && !t.cancelada && t.data === hojeISO();
  const ehEmail = t.canal === "email";
  const podeEnviar = !t.concluida && !t.cancelada && !optOut;

  function abrir() {
    if (pendentes.length) {
      toast.error(`Complete antes de enviar: ${pendentes.map(rotuloCampo).join(", ")}.`);
      setAberta(true);
      setEditando(true);
      return;
    }
    if (ehEmail) {
      if (!email) { toast.error("A família não tem e-mail cadastrado."); return; }
      window.open(linkEmail(email, "Contrato — Blue Senior Living", t.mensagem ?? ""), "_blank", "noopener");
    } else {
      if (!telefone) { toast.error("A família não tem WhatsApp cadastrado."); return; }
      window.open(linkWhatsapp(telefone, t.mensagem ?? ""), "_blank", "noopener");
    }
  }

  async function salvarTexto() {
    try {
      await editar.mutateAsync({ id: t.id, oportunidadeId: t.oportunidade_id, mensagem: texto });
      setEditando(false);
      toast.success("Mensagem atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className={cn(
      "rounded-lg border bg-card",
      t.cancelada ? "opacity-55" : t.concluida ? "border-success/30" : vencida ? "border-destructive/40" : hoje ? "border-primary/50 shadow-card" : "border-border/70",
    )}>
      <button type="button" onClick={() => setAberta((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="min-w-0">
          <span className={cn("block text-sm font-semibold text-secondary", t.cancelada && "line-through")}>
            {ehEmail ? <Mail className="mr-1 inline size-3.5 align-[-2px]" /> : <MessageCircle className="mr-1 inline size-3.5 align-[-2px] text-success" />}
            {t.assunto}
          </span>
          <span className="text-xs text-muted-foreground">
            {nomeOportunidade ? `${nomeOportunidade} · ` : ""}{t.data ? formatarDataBR(t.data) : "Sem data"}
            {t.concluida && t.concluida_em ? ` · enviada em ${formatarDataBR(t.concluida_em.slice(0, 10))}` : ""}
            {t.cancelada && t.motivo_cancelamento ? ` · cancelada: ${t.motivo_cancelamento}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {pendentes.length > 0 && podeEnviar && <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> completar</Badge>}
          {t.concluida ? <Badge variant="success" className="gap-1"><Check className="size-3" /> enviada</Badge>
            : t.cancelada ? <Badge variant="muted" className="gap-1"><Ban className="size-3" /> cancelada</Badge>
            : vencida ? <Badge variant="destructive">atrasada</Badge>
            : hoje ? <Badge variant="default">hoje</Badge> : null}
        </span>
      </button>

      {aberta && (
        <div className="space-y-2.5 border-t px-3 pb-3 pt-2.5">
          {editando ? (
            <>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={salvarTexto} loading={editar.isPending}><Check className="size-4" /> Salvar texto</Button>
                <Button size="sm" variant="outline" onClick={() => { setTexto(t.mensagem ?? ""); setEditando(false); }}>Cancelar</Button>
              </div>
            </>
          ) : (
            <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed text-secondary">{t.mensagem}</p>
          )}
          {pendentes.length > 0 && podeEnviar && (
            <p className="text-xs font-semibold text-warning">
              Complete à mão antes de enviar: {pendentes.map(rotuloCampo).join(", ")} (onde aparece entre chaves).
            </p>
          )}
          {optOut && !t.concluida && <p className="text-xs font-semibold text-destructive">A família pediu para não receber mensagens.</p>}
          {podeEnviar && !editando && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" onClick={abrir}>
                {ehEmail ? <Mail className="size-4" /> : <MessageCircle className="size-4" />} {ehEmail ? "Abrir e-mail" : "Abrir no WhatsApp"}
              </Button>
              {acaoExtra}
              <Button size="sm" variant="outline" onClick={() => marcar.mutate({ ...t, mensagem: t.mensagem }, {
                onSuccess: () => toast.success("Marcada como enviada."),
                onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
              })} loading={marcar.isPending}>
                <Check className="size-4" /> Marcar como enviada
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setTexto(t.mensagem ?? ""); setEditando(true); }}><Pencil className="size-4" /> Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                navigator.clipboard?.writeText(t.mensagem ?? "").then(() => toast.success("Texto copiado."), () => toast.error("Não foi possível copiar."));
              }}><Copy className="size-4" /> Copiar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
