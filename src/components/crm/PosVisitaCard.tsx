import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCheck, MessageCircleReply, BellOff, Plus, XCircle, Send } from "lucide-react";
import { useTarefasOportunidade, useMarcarPerda } from "@/hooks/useCrm";
import { useBiblioteca, useModelosMensagem, useFamiliaRespondeu, useOptOut, useNovaMensagem } from "@/hooks/usePosVisita";
import { MensagemTarefa } from "@/components/crm/MensagemTarefa";
import { contatosFeitos, semRetornoApos3Contatos, modalidadeInfo, dataCurta } from "@/lib/posVisita";
import { formatarMoeda } from "@/lib/mensalidade";
import { formatarDataHoraBR, hojeISO, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { CrmContato, CrmOportunidade } from "@/types/database";

const MODELOS_AVULSOS = ["M6", "M4", "M5", "M7", "AVISO_CONTRATO", "MINUTA_EMAIL"];

/** Condução depois da visita: resumo, regra dos 3 contatos e as mensagens prontas para enviar. */
export function PosVisitaCard({ op, contato }: { op: CrmOportunidade; contato: CrmContato | null }) {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const tarefas = useTarefasOportunidade(op.id);
  const biblioteca = useBiblioteca();
  const modelos = useModelosMensagem();
  const respondeu = useFamiliaRespondeu();
  const optOut = useOptOut();
  const nova = useNovaMensagem();
  const perda = useMarcarPerda();
  const [nota, setNota] = useState<string | null>(null);
  const [confirmarOptOut, setConfirmarOptOut] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [codigo, setCodigo] = useState("M6");
  const [dataNova, setDataNova] = useState(hojeISO());
  const [verCanceladas, setVerCanceladas] = useState(false);

  const terminal = op.status === "ganha" || op.status === "perdida";
  if (!op.visita_em) {
    if (terminal) return null;
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-bold text-secondary">Já teve a visita?</p>
            <p className="text-sm text-muted-foreground">Registre o pós-visita: o app monta as mensagens de WhatsApp para a família.</p>
          </div>
          <Button asChild><Link to={`${base}/crm-pos-visita` as string} search={{ op: op.id } as never}><ClipboardCheck className="size-4" /> Registrar pós-visita</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const todas = (tarefas.data ?? []).filter((t) => t.mensagem);
  const pendentes = todas.filter((t) => !t.concluida && !t.cancelada).sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  const enviadas = todas.filter((t) => t.concluida).sort((a, b) => (b.concluida_em ?? "").localeCompare(a.concluida_em ?? ""));
  const canceladas = todas.filter((t) => t.cancelada);
  const feitos = contatosFeitos(todas);
  const semRetorno = !terminal && semRetornoApos3Contatos(todas, op.ultimo_retorno_em);
  const titulo = (cod: string) => (biblioteca.data ?? []).find((b) => b.codigo === cod)?.titulo ?? cod;
  const op1 = op.simulacao?.opcoes?.[0];
  const validadeVencida = op.simulacao_validade ? op.simulacao_validade < hojeISO() : false;
  const telefone = contato?.telefones?.[0] ?? null;
  const email = contato?.emails?.[0] ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">Acompanhamento pós-visita</CardTitle>
        {!terminal && (
          <Button asChild size="sm" variant="outline"><Link to={`${base}/crm-pos-visita` as string} search={{ op: op.id } as never}><ClipboardCheck className="size-4" /> Refazer pós-visita</Link></Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dores</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(op.dores ?? []).map((d, i) => <Badge key={d} variant={i < 2 ? "default" : "muted"}>{titulo(d)}</Badge>)}
              {(op.objecoes ?? []).map((o) => <Badge key={o} variant="warning">{titulo(o)}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Simulação</p>
            {op1 && op1.valor_final != null ? (
              <p className="text-secondary">
                {modalidadeInfo(op1.modalidade).label}{op1.tipo_suite ? ` · ${op1.tipo_suite}` : ""}: <strong>{formatarMoeda(op1.valor_final)}{op1.unidade === "pacote" ? "" : op1.unidade}</strong>
                {op1.desconto_pct > 0 && <span className="text-muted-foreground"> ({op1.desconto_pct}% off)</span>}
              </p>
            ) : <p className="text-muted-foreground">Sem valor</p>}
            {op.simulacao_validade && (
              <p className={cn("text-xs", validadeVencida ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {validadeVencida ? "Venceu em " : "Válida até "}{dataCurta(op.simulacao_validade, true)}
              </p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primeira semana</p>
            <p className="text-secondary"><strong>{feitos} de 3</strong> contatos feitos</p>
            <p className="text-xs text-muted-foreground">
              {op.opt_out ? "Pediu para não receber mensagens" : op.ultimo_retorno_em ? `Respondeu em ${formatarDataHoraBR(op.ultimo_retorno_em)}` : "Ainda sem resposta"}
            </p>
          </div>
        </div>

        {/* Regra: 3 contatos sem retorno → perdido */}
        {semRetorno && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-secondary"><strong>3 contatos sem retorno.</strong> Pela regra, o lead é dado como perdido.</p>
            <Button size="sm" variant="destructive" loading={perda.isPending}
              onClick={() => perda.mutate({ id: op.id, motivo: "Não respondeu mais" }, { onSuccess: () => toast.success("Lead perdido — não respondeu mais.") })}>
              <XCircle className="size-4" /> Dar como perdido
            </Button>
          </div>
        )}

        {/* Ações */}
        {!terminal && !op.opt_out && (
          <div className="flex flex-wrap gap-2">
            {nota === null ? (
              <Button size="sm" variant="success" onClick={() => setNota("")}><MessageCircleReply className="size-4" /> Família respondeu</Button>
            ) : (
              <div className="flex w-full flex-wrap gap-2">
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que disseram? (opcional)" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm" />
                <Button size="sm" loading={respondeu.isPending} onClick={() => respondeu.mutate({ oportunidadeId: op.id, nota }, { onSuccess: () => { setNota(null); toast.success("Resposta registrada."); } })}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setNota(null)}>Cancelar</Button>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setNovaAberta((v) => !v)}><Plus className="size-4" /> Nova mensagem</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmarOptOut(true)}><BellOff className="size-4" /> Pediu para não receber</Button>
          </div>
        )}
        {novaAberta && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-3">
            <label className="min-w-48 flex-1 space-y-1"><span className="text-xs font-semibold text-muted-foreground">Modelo</span>
              <select value={codigo} onChange={(e) => setCodigo(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
                {(modelos.data ?? []).filter((m) => MODELOS_AVULSOS.includes(m.codigo) && m.ativo).map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
              </select></label>
            <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Para quando</span>
              <input type="date" value={dataNova} onChange={(e) => setDataNova(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm" /></label>
            <Button size="sm" loading={nova.isPending} onClick={() => nova.mutate({ oportunidadeId: op.id, codigo, data: dataNova }, {
              onSuccess: () => { setNovaAberta(false); toast.success("Mensagem criada."); },
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
            })}><Send className="size-4" /> Criar</Button>
          </div>
        )}

        {/* Mensagens */}
        <div className="space-y-2">
          {pendentes.length === 0 && enviadas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem programada.</p>}
          {pendentes.map((t, i) => <MensagemTarefa key={t.id} tarefa={t} telefone={telefone} email={email} optOut={op.opt_out} aberta={i === 0 && (t.data ?? "") <= hojeISO()} />)}
          {enviadas.map((t) => <MensagemTarefa key={t.id} tarefa={t} telefone={telefone} email={email} optOut={op.opt_out} />)}
          {canceladas.length > 0 && (
            <button onClick={() => setVerCanceladas((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
              {verCanceladas ? "Esconder canceladas" : `Ver canceladas (${canceladas.length})`}
            </button>
          )}
          {verCanceladas && canceladas.map((t) => <MensagemTarefa key={t.id} tarefa={t} telefone={telefone} email={email} optOut={op.opt_out} />)}
        </div>
      </CardContent>

      <ConfirmDialog
        aberto={confirmarOptOut}
        titulo="A família pediu para não receber mensagens?"
        descricao="As mensagens programadas serão canceladas e o app deixa de sugerir envios (LGPD)."
        textoConfirmar="Confirmar"
        onConfirmar={() => { setConfirmarOptOut(false); optOut.mutate(op.id, { onSuccess: () => toast.success("Registrado. Nenhuma mensagem será enviada.") }); }}
        onCancelar={() => setConfirmarOptOut(false)}
      />
    </Card>
  );
}
