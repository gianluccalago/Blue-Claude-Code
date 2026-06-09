import { useMemo, useState } from "react";
import {
  Check,
  AlertTriangle,
  Ban,
  ShieldAlert,
  Pill,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import {
  usePrescricoes,
  useAdministracoesHoje,
  useRegistrarAdministracao,
} from "@/hooks/useMedicacao";
import { usePlantao } from "@/hooks/usePlantao";
import { PlantaoBar } from "@/components/cuidador/PlantaoBar";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado, formatarDataHoraBR, horarioParaMinutos } from "@/lib/utils";
import type {
  Administracao,
  PeriodoMedicacao,
  Prescricao,
  StatusAdministracao,
} from "@/types/database";

// 6 períodos com horário padrão, na ordem do dia.
const PERIODOS: { key: PeriodoMedicacao; label: string; horario: string }[] = [
  { key: "jejum", label: "Jejum", horario: "06:00" },
  { key: "manha", label: "Manhã", horario: "08:00" },
  { key: "almoco", label: "Almoço", horario: "12:00" },
  { key: "apos_almoco", label: "Após almoço", horario: "13:00" },
  { key: "tarde", label: "Tarde", horario: "16:00" },
  { key: "noite", label: "Noite", horario: "20:00" },
];

export function Medicacao() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const plantao = usePlantao();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? hospedes?.[0]?.id;

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="space-y-6">
      {/* Controle de plantão: confirmação de medicação exige check-in no turno. */}
      <PlantaoBar plantao={plantao} />
      <HospedeSelector hospedes={hospedes} selecionadoId={hospedeId} onSelect={setSelecionadoId} />
      {hospedeId && (
        <MedicacaoDoHospede key={hospedeId} residenteId={hospedeId} liberado={plantao.liberado} />
      )}
    </div>
  );
}

function MedicacaoDoHospede({
  residenteId,
  liberado,
}: {
  residenteId: string;
  liberado: boolean;
}) {
  const prescricoes = usePrescricoes(residenteId);
  const administracoes = useAdministracoesHoje(residenteId);

  // Registro mais recente de hoje por período (a query já vem ordenada desc).
  const registroPorPeriodo = useMemo(() => {
    const mapa: Partial<Record<PeriodoMedicacao, Administracao>> = {};
    for (const reg of administracoes.data ?? []) {
      const p = reg.periodo as PeriodoMedicacao;
      if (!mapa[p]) mapa[p] = reg;
    }
    return mapa;
  }, [administracoes.data]);

  if (prescricoes.isLoading) return <LoadingState />;
  if (prescricoes.isError) return <ErrorState error={prescricoes.error} />;

  return (
    <Tabs defaultValue="manha">
      <TabsList className="w-full justify-start">
        {PERIODOS.map((p) => (
          <TabsTrigger key={p.key} value={p.key} className="gap-1.5">
            <span>
              {p.label} <span className="font-normal opacity-70">· {p.horario}</span>
            </span>
            <StatusDot status={registroPorPeriodo[p.key]?.status} />
          </TabsTrigger>
        ))}
      </TabsList>
      {PERIODOS.map((p) => {
        // Medicamentos do período, ordenados por horário sugerido (sem horário vão ao fim).
        const doPeriodo = (prescricoes.data ?? [])
          .filter((m) => m.periodo === p.key)
          .sort(
            (a, b) =>
              (horarioParaMinutos(a.horario) ?? Infinity) -
              (horarioParaMinutos(b.horario) ?? Infinity),
          );
        return (
          <TabsContent key={p.key} value={p.key}>
            <PeriodoMedicacaoView
              residenteId={residenteId}
              periodo={p.key}
              prescricoes={doPeriodo}
              registro={registroPorPeriodo[p.key]}
              liberado={liberado}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function PeriodoMedicacaoView({
  residenteId,
  periodo,
  prescricoes,
  registro,
  liberado,
}: {
  residenteId: string;
  periodo: PeriodoMedicacao;
  prescricoes: Prescricao[];
  registro: Administracao | undefined;
  liberado: boolean;
}) {
  const registrar = useRegistrarAdministracao(residenteId);

  const orais = useMemo(() => prescricoes.filter((m) => m.via === "oral"), [prescricoes]);
  const enfermagem = useMemo(() => prescricoes.filter((m) => m.via !== "oral"), [prescricoes]);

  if (prescricoes.length === 0) {
    return <EmptyState label="Sem prescrições ativas para este período." />;
  }

  // Confirmação BINÁRIA: as orais vêm em pacotes fechados preparados pela
  // farmácia; o cuidador administra o pacote do período inteiro ou não —
  // não existe meio-termo (por isso não há "parcial" aqui).
  async function confirmarTodas() {
    // Passa as orais para o hook disparar a baixa de estoque automaticamente (Bloco B)
    await registrar.mutateAsync({ periodo, status: "sim", prescricoesOrais: orais });
  }
  async function confirmarNao() {
    await registrar.mutateAsync({ periodo, status: "nao" });
  }

  const jaRegistrado = !!registro;

  return (
    <div className="space-y-5">
      {/* STATUS PERSISTENTE do período */}
      <StatusBanner registro={registro} salvando={registrar.isPending} />

      {/* Lista de medicamentos */}
      <Card>
        <CardContent className="space-y-2 p-4">
          {prescricoes.map((m) => {
            const enf = m.via !== "oral";
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                  <Pill className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-secondary">
                    {m.medicamento}
                    {m.quantidade && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {m.quantidade}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {[ouNaoInformado(m.dose), m.horario, `via ${m.via}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {enf ? (
                  <Badge variant="purple">
                    <ShieldAlert className="size-3" /> Enfermagem
                  </Badge>
                ) : (
                  <Badge variant="muted">oral</Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Aviso da regra de segurança */}
      {enfermagem.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 text-purple-600" />
          Itens injetável/insulina/sonda são de responsabilidade da Enfermagem e não entram na sua
          confirmação.
        </p>
      )}

      {/* Ações (binárias: Sim, todas / Não) */}
      <div className="space-y-2">
        {jaRegistrado && (
          <p className="text-center text-xs font-medium text-muted-foreground">
            Já registrado neste período hoje. Você pode corrigir registrando novamente.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="success"
            size="lg"
            disabled={!liberado || orais.length === 0 || registrar.isPending}
            onClick={confirmarTodas}
          >
            <Check className="size-5" /> Sim, todas ({orais.length} orais)
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={!liberado || registrar.isPending}
            onClick={confirmarNao}
          >
            <Ban className="size-5" /> Não
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status?: StatusAdministracao }) {
  if (!status) return null;
  const cor =
    status === "sim" ? "bg-success" : status === "parcial" ? "bg-warning" : "bg-destructive";
  return <span className={cn("size-2 rounded-full", cor)} aria-hidden="true" />;
}

function StatusBanner({
  registro,
  salvando,
}: {
  registro: Administracao | undefined;
  salvando: boolean;
}) {
  if (!registro) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
        <CircleDashed className="size-6 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-bold text-secondary">Ainda não registrado neste período</p>
          <p className="text-sm text-muted-foreground">
            Confirme a administração nos botões abaixo.
          </p>
        </div>
      </div>
    );
  }

  const quando = formatarDataHoraBR(registro.administrado_em);
  const quem = ouNaoInformado(registro.administrado_por);

  const cfg = {
    sim: {
      icon: CheckCircle2,
      classe: "border-success/40 bg-success/10",
      iconCor: "text-success",
      titulo: "Medicação administrada",
      detalhe: "Todas as orais confirmadas.",
    },
    parcial: {
      icon: AlertTriangle,
      classe: "border-warning/50 bg-warning/10",
      iconCor: "text-warning",
      titulo: "Administração parcial",
      detalhe: registro.itens_faltantes
        ? `Faltou: ${registro.itens_faltantes}`
        : "Alguns itens faltaram.",
    },
    nao: {
      icon: XCircle,
      classe: "border-destructive/40 bg-destructive/10",
      iconCor: "text-destructive",
      titulo: "NÃO administrada",
      detalhe: "Coordenação avisada.",
    },
  }[registro.status];

  const Icon = cfg.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", cfg.classe)}>
      <Icon className={cn("mt-0.5 size-6 shrink-0", cfg.iconCor)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-secondary">{cfg.titulo}</p>
          {salvando && <span className="text-xs text-muted-foreground">salvando…</span>}
        </div>
        <p className="text-sm text-secondary/80">{cfg.detalhe}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Registrado por {quem} · {quando}
        </p>
      </div>
    </div>
  );
}
