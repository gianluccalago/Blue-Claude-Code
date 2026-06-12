import { useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft, Star, Phone, Mail, User, Wallet, BedDouble, CalendarClock, Check,
  XCircle, BadgeCheck, Plus, MessageSquarePlus, History, ListChecks, Clock3, ShieldQuestion,
} from "lucide-react";
import {
  useOportunidade, useCrmEtapas, useEventos, useTarefasOportunidade,
  useMoverEtapa, useMarcarPerda, useMarcarAdmissao, useAnotar,
  useCriarTarefa, useConcluirTarefa, useCrmMotivos, useVincularResidente,
} from "@/hooks/useCrm";
import { useCriarResidente, type ResidenteValor } from "@/hooks/useResidentesGestao";
import { ResidenteFicha } from "@/components/master/ResidenteFicha";
import { QUALIFICACAO_LABEL, STATUS_LABEL, STATUS_VARIANTE, TIPOS_TAREFA, BASE_LEGAL_LABEL } from "@/lib/crm";
import { idadeTexto } from "@/lib/sla";
import { formatarMoeda } from "@/lib/mensalidade";
import { formatarDataHoraBR, formatarDataBR, ouNaoInformado, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import type { CrmContato, CrmOportunidade as CrmOportunidadeRow, CrmTarefa, TipoSuite } from "@/types/database";

export function CrmOportunidade() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const navigate = useNavigate();
  const { id } = useSearch({ strict: false }) as { id?: string };

  const detalhe = useOportunidade(id);
  const etapas = useCrmEtapas();
  const motivos = useCrmMotivos();
  const mover = useMoverEtapa();
  const perda = useMarcarPerda();
  const admissao = useMarcarAdmissao();
  const criarResidente = useCriarResidente();
  const vincular = useVincularResidente();

  const [confirmarAdmissao, setConfirmarAdmissao] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);
  const [motivoSel, setMotivoSel] = useState("");
  const [criandoResidente, setCriandoResidente] = useState(false);

  if (!id) return <EmptyState label="Oportunidade não informada." />;
  if (detalhe.isLoading || etapas.isLoading) return <LoadingState />;
  if (detalhe.isError) return <ErrorState error={detalhe.error} />;
  if (!detalhe.data) return <EmptyState label="Oportunidade não encontrada." />;

  const { oportunidade: op, contato } = detalhe.data;
  const terminal = op.status === "ganha" || op.status === "perdida";
  const idxEtapaAtual = (etapas.data ?? []).findIndex((e) => e.nome === op.etapa);

  async function criarCadastroResidente(valor: ResidenteValor) {
    try {
      const residenteId = await criarResidente.mutateAsync(valor);
      await vincular.mutateAsync({ id: op.id, residenteId });
      toast.success("Cadastro de residente criado e vinculado à oportunidade.");
      setCriandoResidente(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o cadastro.");
    }
  }

  // Fluxo de admissão: cria o cadastro de residente pré-preenchido pela
  // oportunidade. Ao salvar, grava residente_id (rastreabilidade lead→hóspede).
  if (criandoResidente) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setCriandoResidente(false)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar à oportunidade
        </button>
        <ResidenteFicha
          prefill={prefillResidente(op, contato)}
          salvando={criarResidente.isPending || vincular.isPending}
          onSalvar={criarCadastroResidente}
          onCancelar={() => setCriandoResidente(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate({ to: `${base}/crm` as string })}
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" /> Voltar ao pipeline
      </button>

      {/* Cabeçalho + ações */}
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-secondary">{op.nome}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANTE[op.status]}>{STATUS_LABEL[op.status]}</Badge>
                <Estrelas valor={op.qualificacao} />
                <span className="text-xs text-muted-foreground">criada {idadeTexto(op.criado_em)}</span>
                {op.residente_id && <Badge variant="success" className="gap-1"><BadgeCheck className="size-3" /> virou hóspede</Badge>}
              </div>
            </div>
            {!terminal && (
              <div className="flex flex-wrap gap-2">
                <Button variant="success" onClick={() => setConfirmarAdmissao(true)} disabled={admissao.isPending}>
                  <BadgeCheck className="size-4" /> Marcar admissão
                </Button>
                <Button variant="outline" onClick={() => setModalPerda(true)}>
                  <XCircle className="size-4" /> Marcar perda
                </Button>
              </div>
            )}
            {op.status === "perdida" && op.motivo_perda && (
              <Badge variant="destructive">Perdida — {op.motivo_perda}</Badge>
            )}
          </div>

          {/* Stepper de etapas clicável */}
          <div className="flex flex-wrap gap-1.5">
            {(etapas.data ?? []).map((et, i) => {
              const atual = et.nome === op.etapa;
              const passada = i < idxEtapaAtual;
              return (
                <button
                  key={et.id}
                  disabled={terminal || mover.isPending || atual}
                  onClick={() => mover.mutate({ id: op.id, etapa: et.nome, etapaAnterior: op.etapa })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default",
                    atual
                      ? "bg-primary text-primary-foreground"
                      : passada
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "border border-border bg-card text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {et.nome}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Admissão ganha → oferta de criar o cadastro do residente */}
      {op.status === "ganha" && !op.residente_id && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-bold text-secondary">Admissão confirmada 🎉</p>
              <p className="text-sm text-muted-foreground">
                Crie o cadastro de residente a partir desta oportunidade (já pré-preenchido).
              </p>
            </div>
            <Button variant="success" onClick={() => setCriandoResidente(true)}>
              <BadgeCheck className="size-4" /> Criar cadastro de residente
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Painel lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Oportunidade</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Linha icon={Wallet} rotulo="Mensalidade estimada" valor={op.valor_mensalidade_estimado != null ? formatarMoeda(op.valor_mensalidade_estimado) : "Não informado"} />
              <Linha icon={BedDouble} rotulo="Suíte de interesse" valor={ouNaoInformado(op.tipo_suite_interesse)} />
              <Linha icon={Star} rotulo="Qualificação" valor={QUALIFICACAO_LABEL[op.qualificacao] ?? "—"} />
              <Linha icon={CalendarClock} rotulo="Previsão de fechamento" valor={op.previsao_fechamento ? formatarDataBR(op.previsao_fechamento) : "Não informado"} />
              <Linha icon={User} rotulo="Responsável" valor={ouNaoInformado(op.responsavel)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Contato (família)</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <p className="font-semibold text-secondary">{ouNaoInformado(contato?.nome)}</p>
              <p className="text-xs text-muted-foreground">{ouNaoInformado(contato?.relacao)} do hóspede</p>
              {(contato?.telefones ?? []).map((t) => (
                <Linha key={t} icon={Phone} rotulo="Telefone" valor={t} />
              ))}
              {(contato?.emails ?? []).map((e) => (
                <Linha key={e} icon={Mail} rotulo="E-mail" valor={e} />
              ))}
              <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                <ShieldQuestion className="size-3.5" /> LGPD: {BASE_LEGAL_LABEL[contato?.base_legal_lgpd ?? "nao_definida"]}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Futuro hóspede</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Linha icon={User} rotulo="Nome" valor={ouNaoInformado(contato?.nome_idoso)} />
              <Linha icon={CalendarClock} rotulo="Idade" valor={contato?.idade_idoso != null ? `${contato.idade_idoso} anos` : "Não informado"} />
              <Linha icon={BadgeCheck} rotulo="Grau estimado" valor={contato?.grau_estimado ? `Grau ${contato.grau_estimado}` : "Não informado"} />
            </CardContent>
          </Card>
        </div>

        {/* Centro: timeline + tarefas + anotações */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline" className="gap-1.5"><History className="size-4" /> Linha do tempo</TabsTrigger>
              <TabsTrigger value="tarefas" className="gap-1.5"><ListChecks className="size-4" /> Tarefas</TabsTrigger>
              <TabsTrigger value="anotacoes" className="gap-1.5"><MessageSquarePlus className="size-4" /> Anotações</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline"><Timeline oportunidadeId={op.id} /></TabsContent>
            <TabsContent value="tarefas"><TarefasTab oportunidadeId={op.id} /></TabsContent>
            <TabsContent value="anotacoes"><AnotacoesTab oportunidadeId={op.id} /></TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Confirmar admissão */}
      <ConfirmDialog
        aberto={confirmarAdmissao}
        titulo="Marcar como admissão?"
        descricao="A oportunidade será fechada como GANHA. Depois você poderá criar o cadastro do residente a partir dela."
        textoConfirmar="Confirmar admissão"
        varianteConfirmar="default"
        onConfirmar={() => {
          setConfirmarAdmissao(false);
          admissao.mutate({ id: op.id }, { onSuccess: () => toast.success("Admissão registrada.") });
        }}
        onCancelar={() => setConfirmarAdmissao(false)}
      />

      {/* Modal de perda (exige motivo) */}
      {modalPerda && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-hidden tabIndex={-1} onClick={() => setModalPerda(false)} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm animate-fade-in-up rounded-lg border bg-card p-6 shadow-lifted">
            <h2 className="text-lg font-bold text-secondary">Marcar oportunidade como perdida</h2>
            <p className="mt-1 text-sm text-muted-foreground">Selecione o motivo da perda (obrigatório).</p>
            <select
              value={motivoSel}
              onChange={(e) => setMotivoSel(e.target.value)}
              className="mt-3 h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Selecione o motivo —</option>
              {(motivos.data ?? []).map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
            </select>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setModalPerda(false)}>Cancelar</Button>
              <Button
                variant="destructive" size="lg" className="flex-1"
                disabled={!motivoSel || perda.isPending}
                onClick={() => perda.mutate({ id: op.id, motivo: motivoSel }, { onSuccess: () => { setModalPerda(false); toast.success("Oportunidade marcada como perdida."); } })}
              >
                Confirmar perda
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Monta os valores iniciais do cadastro de residente a partir da oportunidade
// e do contato (família). Campos não mapeados ficam vazios ("Não informado").
const SUITES_VALIDAS: TipoSuite[] = ["Suíte Modular", "Suíte", "Long Stay", "Apartamento"];
function prefillResidente(op: CrmOportunidadeRow, contato: CrmContato | null): Partial<ResidenteValor> {
  const suite = SUITES_VALIDAS.includes(op.tipo_suite_interesse as TipoSuite)
    ? (op.tipo_suite_interesse as TipoSuite)
    : null;
  const responsavel = contato?.nome
    ? `${contato.nome}${contato.relacao ? ` (${contato.relacao})` : ""}`
    : null;
  return {
    nome: contato?.nome_idoso ?? "",
    tipo_suite: suite,
    grau_dependencia: contato?.grau_estimado ?? null,
    grau_contratual: contato?.grau_estimado ?? null,
    responsavel_legal: responsavel,
    contato: contato?.telefones?.[0] ?? null,
    mensalidade_valor: op.valor_mensalidade_estimado ?? null,
    data_admissao: new Date().toISOString().slice(0, 10),
  };
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Estrelas({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={QUALIFICACAO_LABEL[valor] ?? ""}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= valor ? "fill-warning text-warning" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

function Linha({ icon: Icon, rotulo, valor }: { icon: typeof User; rotulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="text-secondary">{valor}</p>
      </div>
    </div>
  );
}

const EVENTO_LABEL: Record<string, string> = {
  criacao: "Criação", mudanca_etapa: "Mudança de etapa", tarefa_concluida: "Tarefa concluída",
  anotacao: "Anotação", perda: "Perda", admissao: "Admissão",
};

function Timeline({ oportunidadeId }: { oportunidadeId: string }) {
  const eventos = useEventos(oportunidadeId);
  if (eventos.isLoading) return <LoadingState />;
  const lista = eventos.data ?? [];
  if (lista.length === 0) return <EmptyState label="Sem eventos ainda." />;
  return (
    <div className="space-y-3">
      {lista.map((ev) => (
        <div key={ev.id} className="flex gap-3">
          <div className="mt-1 size-2.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1 border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{EVENTO_LABEL[ev.tipo] ?? ev.tipo}</span>
              <span className="text-xs text-muted-foreground">{formatarDataHoraBR(ev.criado_em)}</span>
            </div>
            {ev.descricao && <p className="mt-0.5 text-sm text-secondary">{ev.descricao}</p>}
            {ev.autor && <p className="text-xs text-muted-foreground">por {ev.autor}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TarefasTab({ oportunidadeId }: { oportunidadeId: string }) {
  const tarefas = useTarefasOportunidade(oportunidadeId);
  const criar = useCriarTarefa();
  const concluir = useConcluirTarefa();
  const [form, setForm] = useState(false);
  const [tipo, setTipo] = useState<string>("Ligar");
  const [assunto, setAssunto] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");

  async function salvar() {
    if (!assunto.trim()) return;
    await criar.mutateAsync({ oportunidadeId, tipo, assunto, descricao: null, responsavel: null, data: data || null, hora: hora || null });
    setAssunto(""); setData(""); setHora(""); setForm(false);
  }

  const lista = tarefas.data ?? [];
  const pendentes = lista.filter((t) => !t.concluida);
  const concluidas = lista.filter((t) => t.concluida);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant={form ? "outline" : "default"} onClick={() => setForm((v) => !v)}>
          <Plus className="size-4" /> {form ? "Cancelar" : "Nova tarefa"}
        </Button>
      </div>
      {form && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm">
                {TIPOS_TAREFA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto *" className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <Button size="sm" onClick={salvar} disabled={!assunto.trim() || criar.isPending}>Salvar tarefa</Button>
          </CardContent>
        </Card>
      )}
      {lista.length === 0 ? (
        <EmptyState label="Nenhuma tarefa para esta oportunidade." />
      ) : (
        <div className="space-y-2">
          {pendentes.map((t) => <ItemTarefa key={t.id} t={t} onConcluir={() => concluir.mutate(t)} ocupado={concluir.isPending} />)}
          {concluidas.map((t) => <ItemTarefa key={t.id} t={t} onConcluir={() => {}} ocupado concluida />)}
        </div>
      )}
    </div>
  );
}

function ItemTarefa({ t, onConcluir, ocupado, concluida = false }: { t: CrmTarefa; onConcluir: () => void; ocupado: boolean; concluida?: boolean }) {
  const vencida = !t.concluida && !!t.data && t.data < new Date().toISOString().slice(0, 10);
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5", concluida ? "opacity-60" : vencida ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-card")}>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold text-secondary", concluida && "line-through")}>{t.tipo} · {t.assunto}</p>
        <p className="text-xs text-muted-foreground">
          {t.data ? formatarDataBR(t.data) : "Sem data"}{t.hora ? ` · ${t.hora}` : ""}{t.responsavel ? ` · ${t.responsavel}` : ""}
          {vencida && <span className="ml-1.5 font-bold text-destructive">vencida</span>}
        </p>
      </div>
      {concluida ? (
        <Badge variant="success" className="gap-1"><Check className="size-3" /> feita</Badge>
      ) : (
        <Button size="sm" variant="outline" onClick={onConcluir} disabled={ocupado}>
          <Check className="size-4" /> Concluir
        </Button>
      )}
    </div>
  );
}

function AnotacoesTab({ oportunidadeId }: { oportunidadeId: string }) {
  const eventos = useEventos(oportunidadeId);
  const anotar = useAnotar();
  const [texto, setTexto] = useState("");
  const notas = (eventos.data ?? []).filter((e) => e.tipo === "anotacao");

  async function salvar() {
    if (!texto.trim()) return;
    await anotar.mutateAsync({ oportunidadeId, texto });
    setTexto("");
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-2 py-4">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Escreva uma anotação (ex: 'Família pediu para retornar após o feriado')…"
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={salvar} disabled={!texto.trim() || anotar.isPending}>
              <MessageSquarePlus className="size-4" /> Anotar
            </Button>
          </div>
        </CardContent>
      </Card>
      {notas.length === 0 ? (
        <EmptyState label="Nenhuma anotação ainda." />
      ) : (
        <div className="space-y-2">
          {notas.map((n) => (
            <div key={n.id} className="rounded-lg border border-border/70 bg-card px-3 py-2.5 text-sm">
              <p className="text-secondary">{n.descricao}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3" /> {n.autor ?? "—"} · {formatarDataHoraBR(n.criado_em)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
