import { useState } from "react";
import {
  AlertTriangle,
  Droplet,
  CircleDot,
  Pill,
  ClipboardList,
  ShieldAlert,
  Check,
  Stethoscope,
  CheckCircle2,
  Syringe,
  BellOff,
  History,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useTratamentos,
  useMedicacoesPendentesHoje,
  useIntercorrenciasRecentes,
  useProcedimentosEnfermagem,
  useAlertasEliminacaoPainel,
  useRegistrarTratamento,
  useRegistrarEliminacaoTratamento,
  useResolucoesMedicas,
  estadoDaPendencia,
  type AlertaEliminacaoPainel,
} from "@/hooks/useCoordenacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeroStat, StatCard, Sparkbars } from "@/components/dashboard/primitives";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Residente, ResolucaoMedica } from "@/types/database";

const PERIODO_LABEL: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
  tarde: "Tarde",
  noite: "Noite",
};

const VIA_LABEL: Record<string, string> = {
  injetavel: "Injetável",
  insulina: "Insulina",
  sonda: "Sonda",
};

interface InfoResidente {
  nome: string;
  quarto: string | null;
}

export function PainelCoordenacao() {
  const residentes = useResidentes();
  const tratamentos = useTratamentos();
  const medicacoes = useMedicacoesPendentesHoje();
  const intercorrencias = useIntercorrenciasRecentes();
  const enfermagem = useProcedimentosEnfermagem();
  const alertas = useAlertasEliminacaoPainel();
  const registrar = useRegistrarTratamento();
  const tratarAlerta = useRegistrarEliminacaoTratamento();
  const resolucoes = useResolucoesMedicas();

  const carregando =
    residentes.isLoading ||
    tratamentos.isLoading ||
    medicacoes.isLoading ||
    intercorrencias.isLoading ||
    enfermagem.isLoading ||
    alertas.isLoading;

  const erro =
    residentes.error ??
    tratamentos.error ??
    medicacoes.error ??
    intercorrencias.error ??
    enfermagem.error ??
    alertas.error;

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const info = new Map<string, InfoResidente>(
    (residentes.data ?? []).map((r: Residente) => [r.id, { nome: r.nome, quarto: r.quarto }]),
  );
  const nome = (id: string) => info.get(id)?.nome ?? "Não informado";
  const quarto = (id: string) => info.get(id)?.quarto ?? "—";

  const trat = tratamentos.data ?? [];
  const resolData: ResolucaoMedica[] = resolucoes.data ?? [];

  // ----- Pendências abertas (sem tratamento "resolvido") -----
  // Ordenação por gravidade: NÃO administrada > Parcial (escalado sobe ao topo).
  function gravidadeMed(status: string, escalado: boolean): number {
    if (escalado) return 0;
    if (status === "nao") return 1;
    return 2; // "parcial"
  }
  const medsAbertas = (medicacoes.data ?? [])
    .map((m) => ({ reg: m, estado: estadoDaPendencia(trat, "medicacao", m.id) }))
    .filter((x) => !x.estado.resolvido)
    .sort((a, b) =>
      gravidadeMed(a.reg.status, !!a.estado.escaladoEm) -
      gravidadeMed(b.reg.status, !!b.estado.escaladoEm),
    );
  const intercAbertas = (intercorrencias.data ?? [])
    .map((i) => ({
      reg: i,
      estado: estadoDaPendencia(trat, "intercorrencia", i.id),
      resolucaoMedica: resolData.find(
        (r) => r.tipo_origem === "intercorrencia" && r.referencia_id === i.id,
      ) ?? null,
    }))
    .filter((x) => !x.estado.resolvido)
    // Escalados (mas não resolvidos) aparecem por último para liberar foco no não-escalado.
    .sort((a, b) => (!!a.estado.escaladoEm ? 1 : 0) - (!!b.estado.escaladoEm ? 1 : 0));

  // ----- Indicadores -----
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const intercorrenciasHoje = (intercorrencias.data ?? []).filter(
    (i) => new Date(i.registrado_em) >= inicioHoje,
  ).length;
  const pendenciasAbertas = medsAbertas.length + intercAbertas.length;
  const alertasElim = alertas.data ?? [];
  const residentesEmAlerta = new Set(alertasElim.map((a) => a.residenteId)).size;

  const procedimentos = enfermagem.data ?? [];

  async function handleSilenciarTodos() {
    for (const a of alertasElim) {
      await tratarAlerta.mutateAsync({
        residenteId: a.residenteId,
        tipoAlerta: a.tipo,
        acao: "silenciado",
        observacao: null,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. COCKPIT DE INDICADORES — hero (pendências) + secundários */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <HeroStat
            icon={ClipboardList}
            rotulo="Pendências abertas"
            valor={pendenciasAbertas}
            tom={pendenciasAbertas > 0 ? "primary" : "success"}
            alerta={pendenciasAbertas > 0}
            apoio={
              pendenciasAbertas > 0
                ? `${medsAbertas.length} medicação · ${intercAbertas.length} intercorrência`
                : "Tudo em dia"
            }
          >
            <Sparkbars
              valores={[
                medsAbertas.length,
                intercAbertas.length,
                intercorrenciasHoje,
                residentesEmAlerta,
                procedimentos.length,
              ]}
              tom={pendenciasAbertas > 0 ? "primary" : "success"}
            />
          </HeroStat>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
          <StatCard icon={AlertTriangle} rotulo="Intercorrências hoje" valor={intercorrenciasHoje} tom="warning" />
          <StatCard
            icon={Pill}
            rotulo="Medicações não administradas"
            valor={medsAbertas.length}
            tom={medsAbertas.length > 0 ? "destructive" : "success"}
            destaque={medsAbertas.length > 0}
          />
          <StatCard
            icon={Droplet}
            rotulo="Alertas de eliminação"
            valor={residentesEmAlerta}
            tom={residentesEmAlerta > 0 ? "warning" : "success"}
            destaque={residentesEmAlerta > 0}
          />
        </div>
      </div>

      {/* 3. PENDÊNCIAS E ATRASOS */}
      <Card>
        <CardHeader>
          <CardTitle>Pendências e atrasos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendenciasAbertas === 0 ? (
            <EmptyState label="Nenhuma pendência aberta. Tudo em dia!" />
          ) : (
            <>
              {medsAbertas.map(({ reg, estado }) => (
                <PendenciaCard
                  key={reg.id}
                  titulo={`Medicação ${PERIODO_LABEL[reg.periodo] ?? reg.periodo}`}
                  hospede={nome(reg.residente_id)}
                  detalhe={
                    reg.status === "nao"
                      ? reg.motivo
                        ? `NÃO administrada — motivo: ${reg.motivo}`
                        : "NÃO administrada — nenhum oral foi dado"
                      : `Parcial — faltou: ${ouNaoInformado(reg.itens_faltantes)}`
                  }
                  rodape={`Registrado por ${ouNaoInformado(reg.administrado_por)} · ${formatarDataHoraBR(reg.administrado_em)}`}
                  severidade={reg.status === "nao" ? "critico" : "atencao"}
                  escaladoEm={estado.escaladoEm}
                  ocupado={registrar.isPending}
                  onResolver={() =>
                    registrar.mutate({
                      tipoOrigem: "medicacao",
                      referenciaId: reg.id,
                      acao: "resolvido",
                    })
                  }
                  onEscalar={() =>
                    registrar.mutate({
                      tipoOrigem: "medicacao",
                      referenciaId: reg.id,
                      acao: "escalado_medico",
                    })
                  }
                />
              ))}
              {intercAbertas.map(({ reg, estado, resolucaoMedica }) => (
                <PendenciaCard
                  key={reg.id}
                  titulo={`Intercorrência — ${reg.tipo}`}
                  hospede={nome(reg.residente_id)}
                  detalhe={ouNaoInformado(reg.observacao)}
                  rodape={`Registrado por ${ouNaoInformado(reg.registrado_por)} · ${formatarDataHoraBR(reg.registrado_em)}`}
                  severidade="atencao"
                  escaladoEm={estado.escaladoEm}
                  resolvidoPeloMedicoEm={resolucaoMedica?.resolvido_em ?? null}
                  resolvidoPeloMedicoObs={resolucaoMedica?.observacao ?? null}
                  ocupado={registrar.isPending}
                  onResolver={() =>
                    registrar.mutate({
                      tipoOrigem: "intercorrencia",
                      referenciaId: reg.id,
                      acao: "resolvido",
                    })
                  }
                  onEscalar={() =>
                    registrar.mutate({
                      tipoOrigem: "intercorrencia",
                      referenciaId: reg.id,
                      acao: "escalado_medico",
                    })
                  }
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 4. PROCEDIMENTOS DE ENFERMAGEM DO TURNO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Syringe className="size-5 text-nursing" /> Procedimentos de enfermagem do turno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {procedimentos.length === 0 ? (
            <EmptyState label="Nenhum procedimento exclusivo de enfermagem ativo." />
          ) : (
            procedimentos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-nursing/10 text-nursing">
                  <ShieldAlert className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-secondary">
                    {p.medicamento} {p.dose ? `· ${p.dose}` : ""}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {nome(p.residente_id)} · {PERIODO_LABEL[p.periodo] ?? p.periodo}
                  </div>
                </div>
                <Badge variant="purple">{VIA_LABEL[p.via] ?? p.via}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 4. ALERTAS DE ELIMINAÇÃO */}
      <Card className={cn(alertasElim.length > 0 ? "border-warning/40" : "")}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              Alertas de eliminação
              {alertasElim.length > 0 && (
                <Badge variant="warning">{alertasElim.length}</Badge>
              )}
            </CardTitle>
            {alertasElim.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSilenciarTodos}
                disabled={tratarAlerta.isPending}
              >
                <BellOff className="size-4" /> Silenciar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertasElim.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-success">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-semibold">Sem alertas de eliminação.</span>
            </div>
          ) : (
            alertasElim.map((a) => {
              const resolucaoElim = a.escalacaoId
                ? (resolData.find(
                    (r) => r.tipo_origem === "eliminacao" && r.referencia_id === a.escalacaoId,
                  ) ?? null)
                : null;
              return (
                <AlertaEliminacaoCard
                  key={`${a.residenteId}-${a.tipo}`}
                  alerta={a}
                  nome={nome(a.residenteId)}
                  quarto={quarto(a.residenteId)}
                  ocupado={tratarAlerta.isPending}
                  resolvidoPeloMedicoEm={resolucaoElim?.resolvido_em ?? null}
                  resolvidoPeloMedicoObs={resolucaoElim?.observacao ?? null}
                  onEscalar={() =>
                    tratarAlerta.mutate({
                      residenteId: a.residenteId,
                      tipoAlerta: a.tipo,
                      acao: "escalado_medico",
                    })
                  }
                  onSilenciar={(observacao) =>
                    tratarAlerta.mutate({
                      residenteId: a.residenteId,
                      tipoAlerta: a.tipo,
                      acao: "silenciado",
                      observacao,
                    })
                  }
                />
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendenciaCard({
  titulo,
  hospede,
  detalhe,
  rodape,
  severidade = "atencao",
  escaladoEm,
  resolvidoPeloMedicoEm,
  resolvidoPeloMedicoObs,
  ocupado,
  onResolver,
  onEscalar,
}: {
  titulo: string;
  hospede: string;
  detalhe: string;
  rodape: string;
  severidade?: "critico" | "atencao";
  escaladoEm: string | null;
  resolvidoPeloMedicoEm?: string | null;
  resolvidoPeloMedicoObs?: string | null;
  ocupado: boolean;
  onResolver: () => void;
  onEscalar: () => void;
}) {
  const borderCls = severidade === "critico"
    ? "border-destructive/30 bg-destructive/5"
    : "border-warning/30 bg-warning/5";
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", borderCls)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severidade === "critico" ? "destructive" : "warning"}>
              {severidade === "critico" ? "Crítico" : "Atenção"}
            </Badge>
            <span className="font-bold text-secondary">{titulo}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-secondary">{hospede}</div>
          <div className="text-sm text-muted-foreground">{detalhe}</div>
          <div className="mt-1 text-xs text-muted-foreground">{rodape}</div>
          {resolvidoPeloMedicoObs && (
            <div className="mt-1 text-sm text-secondary/80">
              Conduta: "{resolvidoPeloMedicoObs}"
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {resolvidoPeloMedicoEm && (
            <Badge variant="success" className="px-3 py-1.5">
              <Stethoscope className="size-3.5" /> Resolvido pelo médico ·{" "}
              {formatarDataHoraBR(resolvidoPeloMedicoEm)}
            </Badge>
          )}
          {escaladoEm && !resolvidoPeloMedicoEm && (
            <Badge variant="warning" className="px-3 py-1.5">
              <Stethoscope className="size-3.5" /> Escalado ao médico · {formatarDataHoraBR(escaladoEm)}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="success" onClick={onResolver} disabled={ocupado}>
          <Check className="size-4" /> Marcar resolvido
        </Button>
        <Button variant="outline" onClick={onEscalar} disabled={ocupado}>
          <Stethoscope className="size-4" /> Escalar ao médico
        </Button>
      </div>
    </div>
  );
}

const ALERTA_LABEL: Record<string, { texto: string; icon: typeof Droplet }> = {
  evacuacao: { texto: "Sem evacuar há 3 dias ou mais", icon: CircleDot },
  urina: { texto: "Sem registro de urina hoje", icon: Droplet },
};

function AlertaEliminacaoCard({
  alerta,
  nome,
  quarto,
  ocupado,
  resolvidoPeloMedicoEm,
  resolvidoPeloMedicoObs,
  onEscalar,
  onSilenciar,
}: {
  alerta: AlertaEliminacaoPainel;
  nome: string;
  quarto: string;
  ocupado: boolean;
  resolvidoPeloMedicoEm?: string | null;
  resolvidoPeloMedicoObs?: string | null;
  onEscalar: () => void;
  onSilenciar: (observacao: string | null) => void;
}) {
  const [silenciando, setSilenciando] = useState(false);
  const [obs, setObs] = useState("");

  // Reincidente (persistiu após a conduta) → vermelho; demais → amarelo.
  const cor = alerta.reincidente
    ? "border-destructive/40 bg-destructive/10"
    : "border-warning/50 bg-warning/10";
  const info = ALERTA_LABEL[alerta.tipo];
  const Icone = info.icon;

  return (
    <div className={cn("space-y-3 rounded-lg border p-4", cor)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-secondary">{nome}</div>
          <div className="text-xs text-muted-foreground">Quarto {quarto}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant={alerta.reincidente ? "destructive" : "warning"} className="px-3 py-1.5">
            <Icone className="size-3.5" /> {info.texto}
          </Badge>
          {alerta.reincidente && (
            <Badge variant="destructive" className="px-3 py-1.5">
              <History className="size-3.5" /> Reincidente
            </Badge>
          )}
          {resolvidoPeloMedicoEm ? (
            <Badge variant="success" className="px-3 py-1.5">
              <Stethoscope className="size-3.5" /> Resolvido pelo médico ·{" "}
              {formatarDataHoraBR(resolvidoPeloMedicoEm)}
            </Badge>
          ) : alerta.escaladoEm ? (
            <Badge variant="secondary" className="px-3 py-1.5">
              <Stethoscope className="size-3.5" /> Escalado ao médico ·{" "}
              {formatarDataHoraBR(alerta.escaladoEm)}
            </Badge>
          ) : null}
          {resolvidoPeloMedicoObs && (
            <p className="w-full text-xs text-secondary/80">Conduta: "{resolvidoPeloMedicoObs}"</p>
          )}
        </div>
      </div>

      {/* Histórico de conduta (silenciamento) */}
      {alerta.condutaEm && (
        <p className="text-xs text-secondary/80">
          {alerta.reincidente ? "Persiste após conduta de " : "Em acompanhamento desde "}
          {formatarDataHoraBR(alerta.condutaEm)}
          {alerta.condutaPor ? ` · ${alerta.condutaPor}` : ""}
          {alerta.condutaObs ? ` — "${alerta.condutaObs}"` : ""}
        </p>
      )}

      {silenciando ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional), ex: administrado laxante"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="warning"
              onClick={() => {
                onSilenciar(obs.trim() || null);
                setSilenciando(false);
                setObs("");
              }}
              disabled={ocupado}
            >
              <BellOff className="size-4" /> Confirmar silenciar (24h)
            </Button>
            <Button variant="outline" onClick={() => setSilenciando(false)} disabled={ocupado}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* O fluxo real até o perfil Médico será ligado quando o Médico for
              construído; por ora apenas registra o escalamento (selo). */}
          <Button variant="outline" onClick={onEscalar} disabled={ocupado}>
            <Stethoscope className="size-4" /> Escalar ao médico
          </Button>
          <Button variant="outline" onClick={() => setSilenciando(true)} disabled={ocupado}>
            <BellOff className="size-4" /> Silenciar / em tratamento
          </Button>
        </div>
      )}
    </div>
  );
}
