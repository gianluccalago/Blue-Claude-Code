import { useMemo, useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  Lock,
  Unlock,
  Check,
  CalendarClock,
  X,
  MessageCircle,
  Mail,
  Link2,
  Ban,
  Trash2,
} from "lucide-react";
import { CrmNav } from "@/routes/administracao/crm/CrmNav";
import {
  useDisponibilidade,
  useAgendamentos,
  ocupacaoAtiva,
  chaveSlot,
  useGerarGrade,
  useExcluirSlot,
  useDefinirBloqueioSlot,
  useDefinirBloqueioDia,
  useIniciarContato,
  useConfirmarVisita,
  useRemarcarVisita,
  useCancelarVisita,
  useAgendarVisitaApp,
  useVincularOportunidade,
} from "@/hooks/useVisitas";
import { useOportunidades } from "@/hooks/useCrm";
import {
  DIAS_SEMANA,
  DIAS_UTEIS,
  HORARIOS_PADRAO_VISITA,
  formatarHora,
  STATUS_VISITA_LABEL,
  STATUS_VISITA_VARIANTE,
  mensagemQualificacao,
  mensagemConfirmacao,
  mensagemRemarcacao,
  linkWhatsapp,
  linkEmail,
} from "@/lib/visitas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { VisitaAgendamento, VisitaDisponibilidade, VisitaStatus } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ─── Datas (local, sem deslocamento de fuso) ──────────────────────────────────
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function inicioSemana(d: Date): Date {
  const dow = d.getDay(); // 0=dom..6=sáb
  return addDias(d, -((dow + 6) % 7)); // volta até segunda
}
function isodow(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// Agenda de Visitas — tela da gestão (Direção/Master). Calendário semanal +
// bloqueios + grade + lista de solicitações com ações (confirmar/remarcar/
// cancelar) e mensagens prontas de WhatsApp/e-mail. Fonte única compartilhada
// com o site institucional (que grava/lê o MESMO banco — ver migração 0080).
// ===========================================================================

export function AgendaVisitas() {
  const [ancora, setAncora] = useState(() => inicioSemana(new Date()));
  const de = isoLocal(ancora);
  const ate = isoLocal(addDias(ancora, 6));

  const disp = useDisponibilidade(de, ate);
  const agend = useAgendamentos();

  // Modais
  const [grade, setGrade] = useState(false);
  const [novaVisita, setNovaVisita] = useState<{ data?: string; hora?: string } | null>(null);
  const [remarcar, setRemarcar] = useState<VisitaAgendamento | null>(null);
  const [slotCtx, setSlotCtx] = useState<{ data: string; hora: string; rect: DOMRect } | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);

  if (disp.isLoading || agend.isLoading) return <LoadingState />;
  if (disp.isError) return <ErrorState error={disp.error} />;
  if (agend.isError) return <ErrorState error={agend.error} />;

  const slots = disp.data ?? [];
  const agendamentos = agend.data ?? [];
  const ocupados = ocupacaoAtiva(agendamentos);

  // Dias da semana visíveis: seg–sáb sempre; domingo só se tiver slot.
  const dias = Array.from({ length: 7 }, (_, i) => addDias(ancora, i)).filter((d, i) => {
    if (i < 6) return true;
    return slots.some((s) => s.data === isoLocal(d));
  });

  // Horários (linhas) = união dos horários da semana, ordenados.
  const horarios = [...new Set(slots.map((s) => formatarHora(s.hora)))].sort();

  const slotPorChave = new Map(slots.map((s) => [chaveSlot(s.data, s.hora), s]));

  return (
    <div className="space-y-6">
      <CrmNav ativa="crm-agenda" />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <CalendarDays className="size-6 text-primary" /> Agenda de Visitas
          </h2>
          <p className="text-sm text-muted-foreground">
            Fonte única, compartilhada com o site. Disponível · Ocupado · Bloqueado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setGrade(true)}>
            <Settings2 className="size-4" /> Editar grade
          </Button>
          <Button size="sm" onClick={() => setNovaVisita({})}>
            <Plus className="size-4" /> Nova visita
          </Button>
        </div>
      </div>

      {/* Navegação de semana */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Button variant="outline" size="icon" onClick={() => setAncora((a) => addDias(a, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-bold text-secondary">
              {formatarDataBR(de)} — {formatarDataBR(ate)}
            </p>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setAncora(inicioSemana(new Date()))}
            >
              Semana atual
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={() => setAncora((a) => addDias(a, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Calendário (grade horas × dias) */}
      {horarios.length === 0 ? (
        <EmptyState label="Sem grade de horários nesta semana. Use “Editar grade” para criar." />
      ) : (
        <Card>
          <CardContent className="planilha-fixa p-0">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Horário
                  </th>
                  {dias.map((d) => {
                    const dataISO = isoLocal(d);
                    const slotsDoDia = slots.filter((s) => s.data === dataISO);
                    const todosBloq = slotsDoDia.length > 0 && slotsDoDia.every((s) => s.bloqueada);
                    return (
                      <th key={dataISO} className="bg-card px-2 py-2 text-center align-top">
                        <div className="text-xs font-bold text-secondary">
                          {DIAS_SEMANA[isodow(d) - 1].curto} {d.getDate()}/{d.getMonth() + 1}
                        </div>
                        {slotsDoDia.length > 0 && (
                          <BloquearDiaBtn data={dataISO} bloqueado={todosBloq} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {horarios.map((h) => (
                  <tr key={h}>
                    <td className="sticky left-0 z-10 border-t bg-card px-3 py-1.5 text-xs font-semibold tabular-nums text-secondary">
                      {h}
                    </td>
                    {dias.map((d) => {
                      const dataISO = isoLocal(d);
                      const slot = slotPorChave.get(chaveSlot(dataISO, h));
                      const ocup = ocupados.get(chaveSlot(dataISO, h));
                      return (
                        <td key={dataISO} className="border-t px-1.5 py-1.5 text-center">
                          <CelulaSlot
                            slot={slot}
                            ocupado={ocup}
                            onClick={(rect) => slot && setSlotCtx({ data: dataISO, hora: h, rect })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Solicitações de visita */}
      <SolicitacoesVisita
        agendamentos={agendamentos}
        destaqueId={destaqueId}
        onRemarcar={(a) => setRemarcar(a)}
      />

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {grade && <ModalGrade onFechar={() => setGrade(false)} />}
      {novaVisita && (
        <ModalNovaVisita
          inicial={novaVisita}
          onFechar={() => setNovaVisita(null)}
        />
      )}
      {remarcar && (
        <ModalRemarcar
          agendamento={remarcar}
          onFechar={() => setRemarcar(null)}
        />
      )}
      {slotCtx && (
        <SlotPopover
          anchor={slotCtx.rect}
          slot={slotPorChave.get(chaveSlot(slotCtx.data, slotCtx.hora))}
          agendamento={ocupados.get(chaveSlot(slotCtx.data, slotCtx.hora))}
          data={slotCtx.data}
          hora={slotCtx.hora}
          onAgendar={() => {
            setNovaVisita({ data: slotCtx.data, hora: slotCtx.hora });
            setSlotCtx(null);
          }}
          onVerSolicitacao={(id) => {
            setDestaqueId(id);
            setSlotCtx(null);
          }}
          onFechar={() => setSlotCtx(null)}
        />
      )}
    </div>
  );
}

// ─── Célula do calendário ─────────────────────────────────────────────────────
function CelulaSlot({
  slot,
  ocupado,
  onClick,
}: {
  slot: VisitaDisponibilidade | undefined;
  ocupado: VisitaAgendamento | undefined;
  onClick: (rect: DOMRect) => void;
}) {
  if (!slot) return <span className="text-xs text-muted-foreground/40">—</span>;
  // Ocupado tem prioridade sobre bloqueado: uma visita já agendada continua
  // valendo mesmo que o dia/horário tenha sido bloqueado para NOVAS visitas.
  if (ocupado) {
    const primeiro = ocupado.nome_completo.split(/\s+/)[0];
    return (
      <button
        onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
        title={`${ocupado.nome_completo} · ${STATUS_VISITA_LABEL[ocupado.status]}`}
        className={cn(
          "block w-full truncate rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
          ocupado.status === "pendente"
            ? "bg-warning/15 text-warning-foreground hover:bg-warning/25"
            : "bg-secondary/10 text-secondary hover:bg-secondary/20",
        )}
      >
        {primeiro}
      </button>
    );
  }
  if (slot.bloqueada) {
    return (
      <button
        onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
        title={slot.motivo_bloqueio ?? "Bloqueado"}
        className="flex w-full items-center justify-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        <Lock className="size-3" /> Bloq.
      </button>
    );
  }
  return (
    <button
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
      className="block w-full rounded-md bg-success/10 px-2 py-1 text-[11px] font-semibold text-success transition-colors hover:bg-success/20"
    >
      Livre
    </button>
  );
}

// Botão de bloquear/liberar dia inteiro (no cabeçalho da coluna).
function BloquearDiaBtn({ data, bloqueado }: { data: string; bloqueado: boolean }) {
  const def = useDefinirBloqueioDia();
  async function alternar() {
    try {
      if (bloqueado) {
        await def.mutateAsync({ data, bloqueada: false });
        toast.success("Dia liberado.");
      } else {
        const motivo = window.prompt("Motivo do bloqueio do dia (opcional):") ?? "";
        await def.mutateAsync({ data, bloqueada: true, motivo: motivo.trim() || null });
        toast.success("Dia bloqueado.");
      }
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  return (
    <button
      onClick={alternar}
      disabled={def.isPending}
      className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-secondary"
    >
      {bloqueado ? <Unlock className="size-3" /> : <Ban className="size-3" />}
      {bloqueado ? "liberar" : "bloquear dia"}
    </button>
  );
}

// ─── Lista de solicitações ────────────────────────────────────────────────────
function SolicitacoesVisita({
  agendamentos,
  destaqueId,
  onRemarcar,
}: {
  agendamentos: VisitaAgendamento[];
  destaqueId: string | null;
  onRemarcar: (a: VisitaAgendamento) => void;
}) {
  const [filtro, setFiltro] = useState<VisitaStatus | "todos">("todos");
  const ordenados = useMemo(() => {
    const peso: Record<VisitaStatus, number> = { pendente: 0, em_contato: 1, remarcada: 2, confirmada: 3, cancelada: 4 };
    return [...agendamentos]
      .filter((a) => filtro === "todos" || a.status === filtro)
      .sort((a, b) => peso[a.status] - peso[b.status] || a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
  }, [agendamentos, filtro]);

  const pendentes = agendamentos.filter((a) => a.status === "pendente").length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Solicitações de visita
          {pendentes > 0 && (
            <Badge variant="warning" className="ml-1">{pendentes} pendente(s)</Badge>
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          {(["todos", "pendente", "em_contato", "confirmada", "remarcada", "cancelada"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filtro === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {f === "todos" ? "Todos" : STATUS_VISITA_LABEL[f]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {ordenados.length === 0 ? (
          <EmptyState label="Nenhuma solicitação neste filtro." />
        ) : (
          ordenados.map((a) => (
            <CardSolicitacao
              key={a.id}
              agendamento={a}
              destaque={destaqueId === a.id}
              onRemarcar={() => onRemarcar(a)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// Abre o WhatsApp DO CLIENTE (número da solicitação) com a mensagem pronta.
// window.open síncrono no clique → sem bloqueio de popup e sem aninhamento de
// <a>; sempre usa o número do cliente normalizado (nunca um número fixo).
function abrirWhatsappCliente(numeroCliente: string, mensagem: string) {
  window.open(linkWhatsapp(numeroCliente, mensagem), "_blank", "noopener");
}

function CardSolicitacao({
  agendamento: a,
  destaque,
  onRemarcar,
}: {
  agendamento: VisitaAgendamento;
  destaque: boolean;
  onRemarcar: () => void;
}) {
  const iniciarContato = useIniciarContato();
  const confirmar = useConfirmarVisita();
  const cancelar = useCancelarVisita();
  const oportunidades = useOportunidades();
  const vincular = useVincularOportunidade();

  const ativa = a.status !== "cancelada";
  // Mensagem certa para o estágio atual (sempre p/ o WhatsApp do cliente).
  const msgAtual =
    a.status === "confirmada"
      ? mensagemConfirmacao(a.nome_completo, a.data, a.hora)
      : a.status === "remarcada"
        ? mensagemRemarcacao(a.nome_completo, a.data, a.hora)
        : mensagemQualificacao(a.nome_completo);

  async function handleIniciarContato() {
    // Abre a mensagem de QUALIFICAÇÃO no WhatsApp do cliente e move p/ "em contato".
    abrirWhatsappCliente(a.whatsapp, mensagemQualificacao(a.nome_completo));
    try {
      await iniciarContato.mutateAsync(a.id);
      toast.success("Lead em contato. Mensagem de qualificação aberta no WhatsApp.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function handleConfirmar() {
    // Abre a mensagem de CONFIRMAÇÃO no WhatsApp do cliente e confirma.
    abrirWhatsappCliente(a.whatsapp, mensagemConfirmacao(a.nome_completo, a.data, a.hora));
    try {
      await confirmar.mutateAsync(a.id);
      toast.success("Visita confirmada. Mensagem de confirmação aberta no WhatsApp.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function handleCancelar() {
    if (!window.confirm(`Cancelar a visita de ${a.nome_completo}? O horário será liberado.`)) return;
    try {
      await cancelar.mutateAsync(a.id);
      toast.success("Visita cancelada e horário liberado.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function handleVincular(id: string) {
    try {
      await vincular.mutateAsync({ id: a.id, oportunidadeId: id || null });
      toast.success(id ? "Vinculada à oportunidade." : "Vínculo removido.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-shadow",
        a.status === "pendente" && "border-warning/40 bg-warning/5",
        a.status === "em_contato" && "border-primary/40 bg-primary/5",
        destaque && "ring-2 ring-primary",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-secondary">{a.nome_completo}</span>
            <Badge variant={STATUS_VISITA_VARIANTE[a.status]}>{STATUS_VISITA_LABEL[a.status]}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{a.origem}</Badge>
          </div>
          <p className="mt-0.5 text-sm font-medium text-secondary/80">
            <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" />
            {formatarDataBR(a.data)} às {formatarHora(a.hora)}
          </p>
          <p className="text-xs text-muted-foreground">WhatsApp {ouNaoInformado(a.whatsapp)}{a.email ? ` · ${a.email}` : ""}</p>
          {a.observacao && <p className="mt-1 text-xs text-secondary/70">{a.observacao}</p>}
        </div>
      </div>

      {/* Ações — fluxo: pendente → em contato → confirmada (cancelar a qualquer momento) */}
      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        {a.status === "pendente" && (
          <Button size="sm" onClick={handleIniciarContato} disabled={iniciarContato.isPending}>
            <MessageCircle className="size-4" /> Iniciar contato
          </Button>
        )}
        {(a.status === "pendente" || a.status === "em_contato") && (
          <Button size="sm" variant="success" onClick={handleConfirmar} disabled={confirmar.isPending}>
            <Check className="size-4" /> Confirmar
          </Button>
        )}
        {ativa && (
          <Button size="sm" variant="outline" onClick={onRemarcar}>
            <CalendarClock className="size-4" /> Remarcar
          </Button>
        )}
        {ativa && (
          <Button size="sm" variant="outline" onClick={handleCancelar} disabled={cancelar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        )}
        {/* No 'pendente', "Iniciar contato" já abre o WhatsApp (e dispara o
            contato) — evita o botão WhatsApp redundante. Nos demais estágios o
            botão reabre a mensagem certa (qualificação/confirmação/remarcação). */}
        {ativa && a.whatsapp && a.status !== "pendente" && (
          <Button size="sm" variant="success" onClick={() => abrirWhatsappCliente(a.whatsapp, msgAtual)}>
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
        )}
        {ativa && a.email && (
          <Button asChild size="sm" variant="outline">
            <a href={linkEmail(a.email, "Sua visita ao Blue Senior Living", msgAtual)} target="_blank" rel="noreferrer">
              <Mail className="size-4" /> E-mail
            </a>
          </Button>
        )}
      </div>

      {/* Vínculo com CRM */}
      {ativa && (
        <div className="mt-2 flex items-center gap-2">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <select
            value={a.oportunidade_id ?? ""}
            onChange={(e) => handleVincular(e.target.value)}
            disabled={vincular.isPending}
            className="h-8 max-w-full rounded-md border border-input bg-card px-2 text-xs"
          >
            <option value="">Vincular a uma oportunidade do CRM…</option>
            {(oportunidades.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
// Portal no body: o wrapper de rota tem `transform` (animate-route-in), o que
// faria um `position: fixed` se ancorar nele em vez da viewport. O portal
// garante que o modal cubra a tela inteira e centralize de verdade.
function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ─── Popover: ações de um slot (ancorado na célula clicada) ───────────────────
// Compacto e posicionado ao lado do horário (não um modal central). Portal no
// body para escapar do `transform` do wrapper de rota (senão o `fixed` se
// ancoraria nele). Fundo transparente: é um popover, não escurece a página.
function SlotPopover({
  anchor,
  slot,
  agendamento,
  data,
  hora,
  onAgendar,
  onVerSolicitacao,
  onFechar,
}: {
  anchor: DOMRect;
  slot: VisitaDisponibilidade | undefined;
  agendamento: VisitaAgendamento | undefined;
  data: string;
  hora: string;
  onAgendar: () => void;
  onVerSolicitacao: (id: string) => void;
  onFechar: () => void;
}) {
  const bloq = useDefinirBloqueioSlot();
  const excluir = useExcluirSlot();
  const [motivo, setMotivo] = useState("");
  const [bloqueando, setBloqueando] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: anchor.bottom + 6, left: anchor.left });

  // Posiciona ao lado da célula, com clamp na viewport (abre para cima se faltar
  // espaço embaixo). Mede o tamanho real após render.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margem = 8;
    let left = anchor.left;
    let top = anchor.bottom + 6;
    if (left + w > window.innerWidth - margem) left = window.innerWidth - w - margem;
    if (left < margem) left = margem;
    if (top + h > window.innerHeight - margem) top = Math.max(margem, anchor.top - h - 6);
    setPos({ top, left });
  }, [anchor, bloqueando, agendamento, slot?.bloqueada]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  if (!slot) return null;

  async function aplicarBloqueio() {
    try {
      await bloq.mutateAsync({ id: slot!.id, bloqueada: true, motivo: motivo.trim() || null });
      toast.success("Horário bloqueado.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function liberar() {
    try {
      await bloq.mutateAsync({ id: slot!.id, bloqueada: false });
      toast.success("Horário liberado.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function removerSlot() {
    if (!window.confirm("Excluir este horário da grade?")) return;
    try {
      await excluir.mutateAsync(slot!.id);
      toast.success("Horário removido.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return createPortal(
    <>
      {/* captura clique fora (sem escurecer/borrar a página) */}
      <div className="fixed inset-0 z-40" onClick={onFechar} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] animate-fade-in-up rounded-xl border bg-card p-3.5 shadow-lifted"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-secondary">{formatarDataBR(data)} · {hora}</p>
          <button onClick={onFechar} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        </div>

        {agendamento ? (
          <div className="space-y-2">
            <div className="rounded-lg border bg-muted/20 p-2.5 text-sm">
              <p className="font-semibold text-secondary">{agendamento.nome_completo}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_VISITA_LABEL[agendamento.status]} · {agendamento.origem}
              </p>
              <p className="text-xs text-muted-foreground">WhatsApp {agendamento.whatsapp}</p>
            </div>
            <Button className="w-full" size="sm" variant="outline" onClick={() => onVerSolicitacao(agendamento.id)}>
              Ver na lista de solicitações
            </Button>
          </div>
        ) : slot.bloqueada ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Bloqueado{slot.motivo_bloqueio ? `: ${slot.motivo_bloqueio}` : "."} O site não oferece este horário.
            </p>
            <Button className="w-full" size="sm" variant="success" onClick={liberar} disabled={bloq.isPending}>
              <Unlock className="size-4" /> Liberar horário
            </Button>
          </div>
        ) : bloqueando ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-secondary">Motivo do bloqueio (opcional)</label>
            <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: evento interno" className={cn(inputBase, "h-9")} />
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" variant="destructive" onClick={aplicarBloqueio} disabled={bloq.isPending}>
                <Lock className="size-4" /> Bloquear
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBloqueando(false)}>Voltar</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button className="w-full" size="sm" onClick={onAgendar}>
              <Plus className="size-4" /> Agendar neste horário
            </Button>
            <Button className="w-full" size="sm" variant="outline" onClick={() => setBloqueando(true)}>
              <Lock className="size-4" /> Bloquear horário
            </Button>
            <Button className="w-full justify-start text-destructive" size="sm" variant="ghost" onClick={removerSlot} disabled={excluir.isPending}>
              <Trash2 className="size-4" /> Excluir da grade
            </Button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

// ─── Modal: editar grade (padrão = 4 horários, dias úteis) ────────────────────
function ModalGrade({ onFechar }: { onFechar: () => void }) {
  const gerar = useGerarGrade();
  const hoje = new Date();
  // Padrão de oferta: 4 horários, seg–sex. A gestão pode ajustar quais horários
  // e dias gerar, mas o default já reflete a regra do site.
  const [horarios, setHorarios] = useState<string[]>([...HORARIOS_PADRAO_VISITA]);
  const [dows, setDows] = useState<number[]>([...DIAS_UTEIS]);
  const [capacidade, setCapacidade] = useState(1);
  const [de, setDe] = useState(isoLocal(hoje));
  const [ate, setAte] = useState(isoLocal(addDias(hoje, 29)));

  function toggleDow(dow: number) {
    setDows((prev) => (prev.includes(dow) ? prev.filter((x) => x !== dow) : [...prev, dow]));
  }
  function toggleHora(h: string) {
    setHorarios((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  async function aplicar() {
    if (dows.length === 0) return toast.error("Selecione ao menos um dia.");
    if (horarios.length === 0) return toast.error("Selecione ao menos um horário.");
    try {
      await gerar.mutateAsync({ de, ate, dows, horarios, capacidade });
      toast.success("Grade de horários atualizada.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Modal titulo="Editar grade de horários" onFechar={onFechar}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cria os horários no período (não remove os existentes — bloqueios são preservados). O padrão
          oferecido pelo site é <span className="font-semibold">10:00, 14:30, 16:00 e 17:30, seg–sex</span>.
        </p>
        <div>
          <label className="text-sm font-semibold text-secondary">Horários (padrão)</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {HORARIOS_PADRAO_VISITA.map((h) => (
              <button
                key={h}
                onClick={() => toggleHora(h)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                  horarios.includes(h) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-secondary">Dias da semana</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.dow}
                onClick={() => toggleDow(d.dow)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  dows.includes(d.dow) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {d.curto}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-secondary">De (data)</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputBase} />
          </div>
          <div>
            <label className="text-sm font-semibold text-secondary">Até (data)</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputBase} />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-secondary">Capacidade por horário</label>
          <input type="number" min={1} value={capacidade} onChange={(e) => setCapacidade(Math.max(1, Number(e.target.value)))} className={inputBase} />
        </div>
        <Button className="w-full" onClick={aplicar} disabled={gerar.isPending}>
          {gerar.isPending ? "Gerando…" : "Gerar horários"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Modal: nova visita (origem app) — manual, QUALQUER data/horário ──────────
function ModalNovaVisita({
  inicial,
  onFechar,
}: {
  inicial: { data?: string; hora?: string };
  onFechar: () => void;
}) {
  const agendar = useAgendarVisitaApp();
  const oportunidades = useOportunidades();
  const [nome, setNome] = useState("");
  const [whats, setWhats] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState(inicial.data ?? "");
  const [hora, setHora] = useState(inicial.hora ?? "");
  const [obs, setObs] = useState("");
  const [opId, setOpId] = useState("");

  async function salvar() {
    if (!nome.trim() || !whats.trim() || !data || !hora) {
      return toast.error("Preencha nome, WhatsApp, data e horário.");
    }
    try {
      await agendar.mutateAsync({
        nomeCompleto: nome.trim(),
        whatsapp: whats.trim(),
        email: email.trim() || null,
        data,
        hora,
        observacao: obs.trim() || null,
        oportunidadeId: opId || null,
      });
      toast.success("Visita agendada (origem app).");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Modal titulo="Nova visita (pela gestão)" onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Marcação manual livre: escolha <span className="font-semibold">qualquer data e horário</span> (não
          se limita à grade padrão oferecida no site).
        </p>
        <Campo label="Nome completo"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputBase} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="WhatsApp"><input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(41) 99999-9999" className={inputBase} /></Campo>
          <Campo label="E-mail (opcional)"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} /></Campo>
          <Campo label="Horário"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputBase} /></Campo>
        </div>
        <Campo label="Observação (opcional)"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={cn(inputBase, "h-auto py-2 resize-none")} /></Campo>
        <Campo label="Vincular a oportunidade do CRM (opcional)">
          <select value={opId} onChange={(e) => setOpId(e.target.value)} className={inputBase}>
            <option value="">Nenhuma</option>
            {(oportunidades.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </Campo>
        <Button className="w-full" onClick={salvar} disabled={agendar.isPending}>
          {agendar.isPending ? "Salvando…" : "Agendar visita"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Modal: remarcar — nova data/horário livres + avisa o cliente ─────────────
function ModalRemarcar({
  agendamento: a,
  onFechar,
}: {
  agendamento: VisitaAgendamento;
  onFechar: () => void;
}) {
  const remarcar = useRemarcarVisita();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");

  async function salvar() {
    if (!data || !hora) return toast.error("Escolha a nova data e horário.");
    // Abre o WhatsApp do cliente com a mensagem de remarcação (no clique).
    abrirWhatsappCliente(a.whatsapp, mensagemRemarcacao(a.nome_completo, data, hora));
    try {
      await remarcar.mutateAsync({ id: a.id, data, hora });
      toast.success("Visita remarcada. Mensagem aberta no WhatsApp do cliente.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Modal titulo={`Remarcar — ${a.nome_completo}`} onFechar={onFechar}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Atual: {formatarDataBR(a.data)} às {formatarHora(a.hora)}. O horário atual é liberado automaticamente.
          Pode escolher qualquer data/horário.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nova data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} /></Campo>
          <Campo label="Novo horário"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputBase} /></Campo>
        </div>
        <Button className="w-full" onClick={salvar} disabled={remarcar.isPending}>
          {remarcar.isPending ? "Salvando…" : "Confirmar remarcação"}
        </Button>
      </div>
    </Modal>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-secondary">{label}</label>
      {children}
    </div>
  );
}
