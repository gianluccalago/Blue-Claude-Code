import { useMemo, useState } from "react";
import { Check, Plus, X, Clock4 } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import {
  usePlanoCuidado,
  useRegistrosHoje,
  useMarcarTarefa,
  useRemoverRegistro,
  useDefinirRefeicao,
} from "@/hooks/useChecklist";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, horarioParaMinutos, ouNaoInformado, formatarHoraBR } from "@/lib/utils";
import type { PlanoCuidadoItem, TarefaRegistro } from "@/types/database";

// 5 refeições, na ordem do dia. A chave (usada na gravação) é o próprio nome.
const REFEICOES = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
] as const;
const NIVEIS = ["Nada", "Pouco", "Metade", "Quase tudo", "Tudo"] as const;
const SOB_DEMANDA = ["Troca de fralda", "Troca de roupa", "Salão de beleza"] as const;

type StatusKey = "feito" | "atraso" | "em_breve" | "normal";

function calcularStatus(item: PlanoCuidadoItem, feito: boolean): {
  key: StatusKey;
  label: string;
  dot: string;
} {
  if (feito) return { key: "feito", label: "Feito", dot: "bg-success" };
  const alvo = horarioParaMinutos(item.horario);
  if (alvo === null) return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
  const agora = new Date();
  const nowMin = agora.getHours() * 60 + agora.getMinutes();
  if (nowMin > alvo + item.tolerancia_minutos)
    return { key: "atraso", label: "Em atraso", dot: "bg-destructive" };
  if (nowMin >= alvo - 30) return { key: "em_breve", label: "Em breve", dot: "bg-warning" };
  return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
}

export function Checklist() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();

  const hospedeId = selecionadoId ?? hospedes?.[0]?.id;

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={hospedes}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && <ChecklistDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

interface Confirmacao {
  titulo: string;
  descricao?: string;
  acao: () => void;
}

function ChecklistDoHospede({ residenteId }: { residenteId: string }) {
  const plano = usePlanoCuidado(residenteId);
  const registros = useRegistrosHoje(residenteId);
  const marcar = useMarcarTarefa(residenteId);
  const remover = useRemoverRegistro(residenteId);
  const definirRefeicao = useDefinirRefeicao(residenteId);

  const registrosHoje = registros.data ?? [];
  const planoItens = plano.data ?? [];
  const planIds = useMemo(() => new Set(planoItens.map((p) => p.id)), [planoItens]);

  // Confirmação para ações destrutivas (evita toque acidental no tablet).
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [outros, setOutros] = useState("");

  function registroDaTarefa(tarefaId: string): TarefaRegistro | undefined {
    return registrosHoje.find((r) => r.tarefa === tarefaId);
  }

  function onToggleTarefa(item: PlanoCuidadoItem) {
    const existente = registroDaTarefa(item.id);
    if (existente) {
      setConfirmacao({
        titulo: "Desfazer este registro?",
        descricao: item.tarefa,
        acao: () => remover.mutate(existente.id),
      });
    } else {
      marcar.mutate({ tarefa: item.id, horario: item.horario });
    }
  }

  // ----- Aceitação alimentar -----
  function registroRefeicao(refeicao: string): TarefaRegistro | undefined {
    return registrosHoje.find((r) => r.tarefa.startsWith(`Aceitação ${refeicao}:`));
  }
  function selecionarRefeicao(refeicao: string, nivel: string) {
    const existente = registroRefeicao(refeicao);
    definirRefeicao.mutate({ registroId: existente?.id, tarefa: `Aceitação ${refeicao}: ${nivel}` });
  }

  // ----- Sob demanda -----
  const sobDemanda = registrosHoje.filter(
    (r) => !planIds.has(r.tarefa) && !r.tarefa.startsWith("Aceitação "),
  );

  if (plano.isError) return <ErrorState error={plano.error} />;
  if (plano.isLoading || registros.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* ---- Tarefas do plano ---- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Tarefas do turno</CardTitle>
          <Legenda />
        </CardHeader>
        <CardContent className="space-y-3">
          {planoItens.length === 0 ? (
            <EmptyState label="Este hóspede ainda não possui plano de cuidado ativo." />
          ) : (
            planoItens.map((item) => {
              const registro = registroDaTarefa(item.id);
              const feito = !!registro;
              const status = calcularStatus(item, feito);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                    feito && "border-success/30 bg-success/5",
                    status.key === "atraso" && "border-destructive/30 bg-destructive/5",
                    status.key === "em_breve" && "border-warning/40 bg-warning/5",
                  )}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <Clock4 className="size-4 text-muted-foreground" />
                    <span className="text-sm font-bold tabular-nums text-secondary">
                      {item.horario ?? "--:--"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-secondary">{item.tarefa}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={cn("size-2 rounded-full", status.dot)} />
                      {feito ? (
                        <span className="text-xs font-semibold text-success">
                          Feito às {formatarHoraBR(registro!.feito_em)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{status.label}</span>
                      )}
                      <Badge variant={item.responsavel === "enfermagem" ? "secondary" : "muted"}>
                        {ouNaoInformado(item.responsavel)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    variant={feito ? "outline" : "success"}
                    onClick={() => onToggleTarefa(item)}
                    disabled={marcar.isPending || remover.isPending}
                  >
                    {feito ? (
                      <>
                        <X className="size-4" /> Desfazer
                      </>
                    ) : (
                      <>
                        <Check className="size-5" /> Marcar feito
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ---- Aceitação alimentar ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Aceitação alimentar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {REFEICOES.map((refeicao) => {
            const reg = registroRefeicao(refeicao);
            const nivelAtual = reg?.tarefa.split(": ")[1];
            return (
              <div key={refeicao}>
                <div className="mb-2 text-sm font-semibold text-secondary">{refeicao}</div>
                <div className="grid grid-cols-5 gap-2">
                  {NIVEIS.map((nivel) => {
                    const ativo = nivelAtual === nivel;
                    return (
                      <button
                        key={nivel}
                        onClick={() => selecionarRefeicao(refeicao, nivel)}
                        disabled={definirRefeicao.isPending}
                        className={cn(
                          "rounded-md border px-2 py-3 text-xs font-semibold transition-all sm:text-sm",
                          ativo
                            ? "border-primary bg-primary text-primary-foreground shadow-card"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {nivel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ---- Sob demanda ---- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Sob demanda</CardTitle>
          <Badge variant="default">{sobDemanda.length} hoje</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SOB_DEMANDA.map((label) => (
              <Button
                key={label}
                variant="outline"
                onClick={() => marcar.mutate({ tarefa: label })}
                disabled={marcar.isPending}
              >
                <Plus className="size-4" /> {label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={outros}
              onChange={(e) => setOutros(e.target.value)}
              placeholder="Outros (descreva)…"
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              variant="secondary"
              disabled={!outros.trim() || marcar.isPending}
              onClick={async () => {
                await marcar.mutateAsync({ tarefa: `Outros: ${outros.trim()}` });
                setOutros("");
              }}
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          {sobDemanda.length > 0 && (
            <div className="space-y-2">
              {sobDemanda.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-secondary">{r.tarefa}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {formatarHoraBR(r.feito_em)}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setConfirmacao({
                        titulo: "Remover este registro?",
                        descricao: r.tarefa,
                        acao: () => remover.mutate(r.id),
                      })
                    }
                    disabled={remover.isPending}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar="Sim, desfazer"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}

function Legenda() {
  const itens = [
    { label: "Feito", dot: "bg-success" },
    { label: "Em atraso", dot: "bg-destructive" },
    { label: "Em breve", dot: "bg-warning" },
    { label: "Normal", dot: "bg-muted-foreground/40" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {itens.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", i.dot)} />
          <span className="text-xs text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
