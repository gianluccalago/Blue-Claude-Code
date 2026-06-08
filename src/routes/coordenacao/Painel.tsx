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
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useTratamentos,
  useMedicacoesPendentesHoje,
  useIntercorrenciasRecentes,
  useProcedimentosEnfermagem,
  useAlertasEliminacaoGlobais,
  useRegistrarTratamento,
  estadoDaPendencia,
} from "@/hooks/useCoordenacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Residente } from "@/types/database";

const PERIODO_LABEL: Record<string, string> = {
  noite: "Noite / jejum",
  manha: "Manhã",
  almoco: "Após almoço",
  tarde: "Tarde",
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
  const alertas = useAlertasEliminacaoGlobais();
  const registrar = useRegistrarTratamento();

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

  // ----- Pendências abertas (sem tratamento "resolvido") -----
  const medsAbertas = (medicacoes.data ?? [])
    .map((m) => ({ reg: m, estado: estadoDaPendencia(trat, "medicacao", m.id) }))
    .filter((x) => !x.estado.resolvido);
  const intercAbertas = (intercorrencias.data ?? [])
    .map((i) => ({ reg: i, estado: estadoDaPendencia(trat, "intercorrencia", i.id) }))
    .filter((x) => !x.estado.resolvido);

  // ----- Indicadores -----
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const intercorrenciasHoje = (intercorrencias.data ?? []).filter(
    (i) => new Date(i.registrado_em) >= inicioHoje,
  ).length;
  const pendenciasAbertas = medsAbertas.length + intercAbertas.length;
  const residentesEmAlerta = (alertas.data ?? []).length;

  const procedimentos = enfermagem.data ?? [];

  return (
    <div className="space-y-6">
      {/* 1. ALERTAS DE ELIMINAÇÃO */}
      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" /> Alertas de eliminação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(alertas.data ?? []).length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-success">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-semibold">Sem alertas de eliminação.</span>
            </div>
          ) : (
            (alertas.data ?? []).map(({ residenteId, alertas: a }) => (
              <div
                key={residenteId}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  a.semEvacuacao72h
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-warning/50 bg-warning/10",
                )}
              >
                <div>
                  <div className="font-bold text-secondary">{nome(residenteId)}</div>
                  <div className="text-xs text-muted-foreground">Quarto {quarto(residenteId)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.semEvacuacao72h && (
                    <Badge variant="destructive" className="px-3 py-1.5">
                      <CircleDot className="size-3.5" /> Sem evacuar há 3 dias ou mais
                    </Badge>
                  )}
                  {a.semUrinaHoje && (
                    <Badge variant="warning" className="px-3 py-1.5">
                      <Droplet className="size-3.5" /> Sem registro de urina hoje
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 2. INDICADORES */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador
          icon={ClipboardList}
          rotulo="Pendências abertas"
          valor={pendenciasAbertas}
          destaque={pendenciasAbertas > 0}
        />
        <Indicador icon={AlertTriangle} rotulo="Intercorrências hoje" valor={intercorrenciasHoje} />
        <Indicador
          icon={Pill}
          rotulo="Medicações não administradas hoje"
          valor={medsAbertas.length}
          destaque={medsAbertas.length > 0}
        />
        <Indicador
          icon={Droplet}
          rotulo="Residentes em alerta de eliminação"
          valor={residentesEmAlerta}
          destaque={residentesEmAlerta > 0}
        />
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
                  titulo={`Medicação — ${PERIODO_LABEL[reg.periodo] ?? reg.periodo}`}
                  hospede={nome(reg.residente_id)}
                  detalhe={
                    reg.status === "nao"
                      ? "NÃO administrada"
                      : `Parcial — faltou: ${ouNaoInformado(reg.itens_faltantes)}`
                  }
                  rodape={`Registrado por ${ouNaoInformado(reg.administrado_por)} · ${formatarDataHoraBR(reg.administrado_em)}`}
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
              {intercAbertas.map(({ reg, estado }) => (
                <PendenciaCard
                  key={reg.id}
                  titulo={`Intercorrência — ${reg.tipo}`}
                  hospede={nome(reg.residente_id)}
                  detalhe={ouNaoInformado(reg.observacao)}
                  rodape={`Registrado por ${ouNaoInformado(reg.registrado_por)} · ${formatarDataHoraBR(reg.registrado_em)}`}
                  escaladoEm={estado.escaladoEm}
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
            <Syringe className="size-5 text-purple-600" /> Procedimentos de enfermagem do turno
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
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-700">
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
    </div>
  );
}

function Indicador({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon: typeof Pill;
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <Card className={cn("p-4", destaque && "border-primary/40 bg-primary/5")}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-semibold">{rotulo}</span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-secondary">{valor}</div>
    </Card>
  );
}

function PendenciaCard({
  titulo,
  hospede,
  detalhe,
  rodape,
  escaladoEm,
  ocupado,
  onResolver,
  onEscalar,
}: {
  titulo: string;
  hospede: string;
  detalhe: string;
  rodape: string;
  escaladoEm: string | null;
  ocupado: boolean;
  onResolver: () => void;
  onEscalar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="destructive">Crítico</Badge>
            <span className="font-bold text-secondary">{titulo}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-secondary">{hospede}</div>
          <div className="text-sm text-muted-foreground">{detalhe}</div>
          <div className="mt-1 text-xs text-muted-foreground">{rodape}</div>
        </div>
        {escaladoEm && (
          <Badge variant="warning" className="px-3 py-1.5">
            <Stethoscope className="size-3.5" /> Escalado ao médico · {formatarDataHoraBR(escaladoEm)}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="success" onClick={onResolver} disabled={ocupado}>
          <Check className="size-4" /> Marcar resolvido
        </Button>
        {/* O fluxo real até o perfil Médico será ligado quando o Médico for
            construído; por ora apenas marca a pendência como escalada. */}
        <Button variant="outline" onClick={onEscalar} disabled={ocupado}>
          <Stethoscope className="size-4" /> Escalar ao médico
        </Button>
      </div>
    </div>
  );
}
