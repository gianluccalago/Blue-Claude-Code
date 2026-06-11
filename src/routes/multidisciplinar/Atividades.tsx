/**
 * Atividades — Equipe Multidisciplinar (BLOCO M1)
 *
 * Logins de Fisioterapeuta, Educador Físico e Terapeuta Ocupacional
 * compartilham esta mesma tela (ver MULTI_ATUAL em data/profiles.ts).
 *
 * Agenda de atividades de grupo (pontuais ou recorrentes), registro de
 * execução do dia (presença + descrição geral + foto) e histórico de
 * participação por hóspede.
 */
import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  History,
  ListChecks,
  Plus,
  Repeat,
  Users,
  X,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  atividadesDoDia,
  useAtividades,
  useCriarAtividade,
  useExecucoesDoDia,
  useHistoricoParticipacao,
  useParticipantesDaExecucao,
  useRegistrarExecucao,
} from "@/hooks/useAtividades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import {
  cn,
  dataISO,
  formatarDataBR,
  formatarDataHoraBR,
  hojeISO,
  somarDias,
} from "@/lib/utils";
import type { Atividade, AtividadeExecucao, Residente } from "@/types/database";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DIAS_SEMANA = [
  { value: "0", label: "Dom" },
  { value: "1", label: "Seg" },
  { value: "2", label: "Ter" },
  { value: "3", label: "Qua" },
  { value: "4", label: "Qui" },
  { value: "5", label: "Sex" },
  { value: "6", label: "Sáb" },
];

function extrairErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

/** Formata os dias da semana de uma atividade recorrente, ex: "Seg, Ter, Qua, Qui, Sex". */
function formatarDiasSemana(dias: string[] | null): string {
  if (!dias || dias.length === 0) return "Não informado";
  return [...dias]
    .sort()
    .map((d) => DIAS_SEMANA.find((x) => x.value === d)?.label ?? d)
    .join(", ");
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Atividades() {
  const { data: residentes = [], isLoading: loadRes, error: errRes } = useResidentes();
  const { data: atividades = [], isLoading: loadAtv, error: errAtv } = useAtividades();

  const [tabAtiva, setTabAtiva] = useState<"agenda" | "historico">("agenda");
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO());
  const [novaAtividade, setNovaAtividade] = useState(false);

  const { data: execucoes = [], isLoading: loadExec, error: errExec } = useExecucoesDoDia(dataSelecionada);

  if (loadRes || loadAtv) return <LoadingState />;
  if (errRes) return <ErrorState error={errRes} />;
  if (errAtv) return <ErrorState error={errAtv} />;

  const atividadesHoje = atividadesDoDia(atividades, dataSelecionada).sort((a, b) =>
    a.horario.localeCompare(b.horario)
  );

  const execucaoPorAtividade = new Map(execucoes.map((e) => [e.atividade_id, e]));

  function mudarDia(delta: number) {
    setDataSelecionada(dataISO(somarDias(new Date(dataSelecionada + "T00:00:00"), delta)));
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Atividades</h1>
          <p className="text-sm text-muted-foreground">Atividades de grupo da Equipe Multidisciplinar</p>
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as "agenda" | "historico")}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="agenda" className="gap-1.5">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-4 w-4" /> Histórico por hóspede
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          {/* Navegação de data */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarDia(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarDia(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {dataSelecionada !== hojeISO() && (
                <Button variant="ghost" size="sm" onClick={() => setDataSelecionada(hojeISO())}>
                  Hoje
                </Button>
              )}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setNovaAtividade((v) => !v)}>
              {novaAtividade ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {novaAtividade ? "Cancelar" : "Nova atividade"}
            </Button>
          </div>

          <p className="text-sm font-medium text-secondary capitalize">
            {new Date(dataSelecionada + "T00:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>

          {novaAtividade && (
            <FormNovaAtividade
              dataPadrao={dataSelecionada}
              onConcluido={() => setNovaAtividade(false)}
            />
          )}

          {loadExec ? (
            <LoadingState />
          ) : errExec ? (
            <ErrorState error={errExec} />
          ) : atividadesHoje.length === 0 ? (
            <EmptyState label="Nenhuma atividade agendada para este dia." />
          ) : (
            <div className="space-y-2">
              {atividadesHoje.map((a) => (
                <AtividadeCard
                  key={a.id}
                  atividade={a}
                  data={dataSelecionada}
                  residentes={residentes}
                  execucao={execucaoPorAtividade.get(a.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoPorHospede residentes={residentes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Nova atividade ────────────────────────────────────────────────────────────

function FormNovaAtividade({ dataPadrao, onConcluido }: { dataPadrao: string; onConcluido: () => void }) {
  const criar = useCriarAtividade();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [data, setData] = useState(dataPadrao);
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horario, setHorario] = useState("10:00");
  const [erro, setErro] = useState<string | null>(null);

  const valido = titulo.trim().length > 0 && !!horario && (recorrente ? diasSemana.length > 0 : !!data);

  function toggleDia(dia: string) {
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]));
  }

  async function handleCriar() {
    if (!valido) return;
    setErro(null);
    try {
      await criar.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        horario,
        recorrente,
        data: recorrente ? undefined : data,
        diasSemana: recorrente ? diasSemana : undefined,
      });
      onConcluido();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          Nova atividade de grupo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Fisioterapia em grupo"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Descrição (opcional)</label>
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes sobre a atividade…"
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Horário</label>
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Recorrência</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecorrente(false)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                  !recorrente
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                )}
              >
                <Calendar className="h-3.5 w-3.5" /> Data específica
              </button>
              <button
                type="button"
                onClick={() => setRecorrente(true)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
                  recorrente
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                )}
              >
                <Repeat className="h-3.5 w-3.5" /> Recorrente
              </button>
            </div>
          </div>
        </div>

        {recorrente ? (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDia(d.value)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    diasSemana.includes(d.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={cn(inputClass, "w-auto")}
            />
          </div>
        )}

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <Button className="w-full gap-2" disabled={!valido || criar.isPending} onClick={handleCriar}>
          <Plus className="h-4 w-4" />
          {criar.isPending ? "Criando…" : "Criar atividade"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Card de atividade do dia ─────────────────────────────────────────────────

function AtividadeCard({
  atividade,
  data,
  residentes,
  execucao,
}: {
  atividade: Atividade;
  data: string;
  residentes: Residente[];
  execucao?: AtividadeExecucao;
}) {
  const [expandido, setExpandido] = useState(false);
  const registrada = !!execucao;

  return (
    <Card className={cn(registrada && "border-success/30")}>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center gap-3 p-4 text-left"
          onClick={() => setExpandido((v) => !v)}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              registrada ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            {registrada ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{atividade.titulo}</span>
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="h-3 w-3" /> {atividade.horario}
              </Badge>
              {atividade.recorrente && (
                <Badge variant="muted" className="text-xs gap-1">
                  <Repeat className="h-3 w-3" /> {formatarDiasSemana(atividade.dias_semana)}
                </Badge>
              )}
              <Badge variant={registrada ? "success" : "muted"} className="text-xs">
                {registrada ? "Registrada" : "Pendente registro"}
              </Badge>
            </div>
            {atividade.descricao && (
              <p className="text-xs text-muted-foreground truncate">{atividade.descricao}</p>
            )}
          </div>

          {expandido ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expandido && (
          <div className="border-t px-4 pb-4 pt-3">
            {registrada && execucao ? (
              <ExecucaoResumo atividadeId={atividade.id} data={data} execucao={execucao} />
            ) : (
              <FormRegistrarExecucao atividade={atividade} data={data} residentes={residentes} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Resumo da execução já registrada ─────────────────────────────────────────

function ExecucaoResumo({
  atividadeId,
  data,
  execucao,
}: {
  atividadeId: string;
  data: string;
  execucao: AtividadeExecucao;
}) {
  const { data: participantes = [], isLoading } = useParticipantesDaExecucao(atividadeId, data);

  return (
    <div className="space-y-3">
      {execucao.descricao_geral && <p className="text-sm">{execucao.descricao_geral}</p>}

      {execucao.foto_url && (
        <a href={execucao.foto_url} target="_blank" rel="noreferrer" className="inline-block">
          <img
            src={execucao.foto_url}
            alt="Registro da atividade"
            className="h-28 w-28 rounded-md border object-cover"
          />
        </a>
      )}

      <div className="flex items-center gap-1.5 text-sm">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        {isLoading ? (
          <span className="text-muted-foreground">Carregando participantes…</span>
        ) : participantes.length === 0 ? (
          <span className="text-muted-foreground">Nenhum participante registrado.</span>
        ) : (
          <span>
            {participantes.length} participante{participantes.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Registrado por {execucao.realizada_por} · {formatarDataHoraBR(execucao.realizada_em)}
      </p>
    </div>
  );
}

// ─── Registrar execução ────────────────────────────────────────────────────────

function FormRegistrarExecucao({
  atividade,
  data,
  residentes,
}: {
  atividade: Atividade;
  data: string;
  residentes: Residente[];
}) {
  const registrar = useRegistrarExecucao();

  const [participantes, setParticipantes] = useState<Set<string>>(new Set());
  const [descricaoGeral, setDescricaoGeral] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function toggleParticipante(id: string) {
    setParticipantes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSalvar() {
    if (!foto) return;
    setErro(null);
    try {
      await registrar.mutateAsync({
        atividadeId: atividade.id,
        data,
        descricaoGeral: descricaoGeral.trim() || null,
        foto,
        participantesIds: [...participantes],
      });
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
          <ListChecks className="h-4 w-4" /> Presença — toque para marcar quem participou
        </label>
        {residentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum residente cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {residentes.map((r) => {
              const ativo = participantes.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleParticipante(r.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    ativo
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  )}
                >
                  {ativo && <Check className="h-3.5 w-3.5" />}
                  {r.nome}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {participantes.size} de {residentes.length} marcados como presentes. Quem não for marcado é
          considerado ausente.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-secondary">
          Descrição geral (opcional)
        </label>
        <textarea
          rows={2}
          value={descricaoGeral}
          onChange={(e) => setDescricaoGeral(e.target.value)}
          placeholder="Ex: oficina de música, grupo participativo…"
          className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
          <Camera className="h-4 w-4" /> Foto da atividade (obrigatória)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {erro}
        </div>
      )}

      <Button className="w-full gap-2" disabled={!foto || registrar.isPending} onClick={handleSalvar}>
        <Check className="h-4 w-4" />
        {registrar.isPending ? "Salvando…" : "Salvar registro da atividade"}
      </Button>
    </div>
  );
}

// ─── Histórico por hóspede ──────────────────────────────────────────────────────

function HistoricoPorHospede({ residentes }: { residentes: Residente[] }) {
  const [residenteId, setResidenteId] = useState(residentes[0]?.id ?? "");
  const { data: historico = [], isLoading, error } = useHistoricoParticipacao(residenteId || undefined);

  const ultimos30Dias = useMemo(() => {
    const limite = somarDias(new Date(), -30);
    return historico.filter((p) => new Date(p.data + "T00:00:00") >= limite).length;
  }, [historico]);

  if (residentes.length === 0) return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
        <select value={residenteId} onChange={(e) => setResidenteId(e.target.value)} className={cn(inputClass, "w-auto")}>
          {residentes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-extrabold leading-none tracking-tight tabular-nums">{ultimos30Dias}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Participações nos últimos 30 dias</p>
            </CardContent>
          </Card>

          {historico.length === 0 ? (
            <EmptyState label="Nenhuma participação registrada para este hóspede." />
          ) : (
            <div className="space-y-2">
              {historico.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{p.atividade_titulo ?? "Atividade"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarDataBR(p.data)} · {p.atividade_horario ?? "Não informado"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
