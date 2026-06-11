import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, MessageSquare, CornerDownRight, CalendarClock, Bus, Save, Info, Plus } from "lucide-react";
import {
  DESTINOS_SOLICITACAO,
  labelDestino,
  useCriarSolicitacao,
  useSolicitacoesFamilia,
} from "@/hooks/useSolicitacoes";
import {
  useAtualizarDetalhesCompromisso,
  useCompromissosResidente,
  useCriarCompromisso,
} from "@/hooks/useFamilia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import type { CompromissoExterno, DestinoSolicitacao, SolicitacaoFamilia } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaBase =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Marca as respostas como lidas localmente (não há campo "lida" no banco):
// guardamos o instante da última visita ao painel; respostas mais novas viram "nova".
const CHAVE_VISTO = "familia-solicitacoes-visto";
function getUltimoVisto(): number {
  const v = localStorage.getItem(CHAVE_VISTO);
  return v ? Number(v) : 0;
}
function marcarVistoAgora() {
  localStorage.setItem(CHAVE_VISTO, String(Date.now()));
}

/**
 * A família abre solicitações para Coordenação/Médico/Administração e
 * acompanha as respostas, e também gerencia os compromissos externos do
 * hóspede (cadastra novos e edita os detalhes/instruções).
 */
export function Solicitacoes() {
  const solicitacoes = useSolicitacoesFamilia();
  const [ultimoVisto] = useState(getUltimoVisto);

  // Respostas mais novas que a última visita ao painel.
  const novasRespostas = (solicitacoes.data ?? []).filter(
    (s) => s.status === "respondida" && s.respondida_em && new Date(s.respondida_em).getTime() > ultimoVisto,
  ).length;

  return (
    <Tabs defaultValue="solicitacoes">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="solicitacoes" className="gap-1.5">
          <MessageSquare className="size-4" /> Solicitações
          {novasRespostas > 0 && (
            <Badge variant="success" className="ml-1">
              {novasRespostas} nova{novasRespostas > 1 ? "s" : ""}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="compromissos" className="gap-1.5">
          <CalendarClock className="size-4" /> Compromissos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="solicitacoes">
        <PainelSolicitacoes />
      </TabsContent>
      <TabsContent value="compromissos">
        <PainelCompromissos />
      </TabsContent>
    </Tabs>
  );
}

function PainelSolicitacoes() {
  const solicitacoes = useSolicitacoesFamilia();
  const criar = useCriarSolicitacao();

  // "Foto" do último visto ao montar — para destacar respostas novas nesta sessão.
  const [ultimoVisto] = useState(getUltimoVisto);

  // Ao carregar as solicitações, marca tudo como visto (limpa o badge da aba).
  const carregou = !!solicitacoes.data;
  useEffect(() => {
    if (carregou) marcarVistoAgora();
  }, [carregou]);

  const [destino, setDestino] = useState<DestinoSolicitacao>("coordenacao");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");

  function enviar() {
    if (!assunto.trim() || !mensagem.trim()) return;
    criar.mutate(
      { destino, assunto: assunto.trim(), mensagem: mensagem.trim() },
      {
        onSuccess: () => {
          setAssunto("");
          setMensagem("");
          toast.success("Solicitação enviada à equipe.");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" /> Nova solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Destino</label>
            <select
              className={inputBase}
              value={destino}
              onChange={(e) => setDestino(e.target.value as DestinoSolicitacao)}
            >
              {DESTINOS_SOLICITACAO.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Assunto</label>
            <input
              className={inputBase}
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: Dúvida sobre medicação"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Mensagem</label>
            <textarea
              className={textareaBase}
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva sua solicitação..."
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={enviar}
              disabled={!assunto.trim() || !mensagem.trim() || criar.isPending}
            >
              <Send className="size-4" /> Enviar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Minhas solicitações
        </h2>
        {solicitacoes.isLoading ? (
          <LoadingState />
        ) : solicitacoes.isError ? (
          <ErrorState error={solicitacoes.error} />
        ) : (solicitacoes.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma solicitação enviada ainda." />
        ) : (
          (solicitacoes.data ?? []).map((s) => (
            <SolicitacaoCard key={s.id} solicitacao={s} ultimoVisto={ultimoVisto} />
          ))
        )}
      </div>
    </div>
  );
}

function SolicitacaoCard({
  solicitacao: s,
  ultimoVisto,
}: {
  solicitacao: SolicitacaoFamilia;
  ultimoVisto: number;
}) {
  const respostaNova =
    s.status === "respondida" &&
    !!s.respondida_em &&
    new Date(s.respondida_em).getTime() > ultimoVisto;

  return (
    <Card className={cn(respostaNova && "border-success/50 ring-1 ring-success/30")}>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <span className="font-bold text-secondary">{s.assunto}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{labelDestino(s.destino)}</Badge>
            {s.status === "respondida" ? (
              <Badge variant="success">{respostaNova ? "Resposta nova" : "Respondida"}</Badge>
            ) : (
              <Badge variant="warning">Aberta</Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-secondary/80">{s.mensagem}</p>
        <p className="text-xs text-muted-foreground">Enviada em {formatarDataHoraBR(s.criada_em)}</p>

        {s.status === "respondida" && s.resposta && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-accent/60 px-3 py-2 text-sm text-secondary">
            <CornerDownRight className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p>{s.resposta}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.respondida_por ?? "Equipe"} · {formatarDataHoraBR(s.respondida_em)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PainelCompromissos() {
  const compromissos = useCompromissosResidente();
  const atualizar = useAtualizarDetalhesCompromisso();
  const criar = useCriarCompromisso();

  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [horarioTransporte, setHorarioTransporte] = useState("");
  const [detalhes, setDetalhes] = useState("");

  function adicionar() {
    if (!titulo.trim() || !data) return;
    criar.mutate(
      { titulo: titulo.trim(), data, horario, horarioTransporte, detalhes: detalhes.trim() },
      {
        onSuccess: () => {
          setTitulo("");
          setData("");
          setHorario("");
          setHorarioTransporte("");
          setDetalhes("");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" /> Novo compromisso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Título</label>
            <input
              className={inputBase}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Consulta com dermatologista"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Data</label>
              <input className={inputBase} type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Horário</label>
              <input className={inputBase} type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Transporte</label>
              <input
                className={inputBase}
                type="time"
                value={horarioTransporte}
                onChange={(e) => setHorarioTransporte(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Detalhes / instruções</label>
            <textarea
              className={textareaBase}
              rows={3}
              placeholder='Ex: "Levar exame X", "vestir roupa social"...'
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={adicionar} disabled={!titulo.trim() || !data || criar.isPending}>
              <Plus className="size-4" /> Adicionar compromisso
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Compromissos cadastrados
        </h2>
        {compromissos.isLoading ? (
          <LoadingState />
        ) : compromissos.isError ? (
          <ErrorState error={compromissos.error} />
        ) : (compromissos.data ?? []).length === 0 ? (
          <EmptyState label="Nenhum compromisso externo cadastrado." />
        ) : (
          (compromissos.data ?? []).map((c) => (
            <CompromissoCard
              key={c.id}
              compromisso={c}
              onSalvar={(detalhesEditados) => atualizar.mutate({ id: c.id, detalhes: detalhesEditados })}
              salvando={atualizar.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CompromissoCard({
  compromisso: c,
  onSalvar,
  salvando,
}: {
  compromisso: CompromissoExterno;
  onSalvar: (detalhes: string) => void;
  salvando: boolean;
}) {
  const [detalhes, setDetalhes] = useState(c.detalhes ?? "");
  const alterado = detalhes !== (c.detalhes ?? "");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{c.titulo}</CardTitle>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
            <CalendarClock className="size-4 text-primary" /> {formatarDataBR(c.data)} ·{" "}
            {c.horario ?? "--:--"}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Bus className="size-3.5" /> Transporte às {c.horario_transporte ?? "--:--"}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
          <Info className="size-4 text-primary" /> Detalhes / instruções
        </label>
        <textarea
          className={textareaBase}
          rows={3}
          placeholder='Ex: "Levar exame X", "vestir roupa social"...'
          value={detalhes}
          onChange={(e) => setDetalhes(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!alterado || salvando} onClick={() => onSalvar(detalhes)}>
            <Save className="size-4" /> Salvar detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
