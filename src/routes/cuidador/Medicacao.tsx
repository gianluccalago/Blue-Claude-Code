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
  Loader2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import {
  usePrescricoes,
  useAdministracoesHoje,
  useRegistrarAdministracao,
} from "@/hooks/useMedicacao";
import { useDietaAtiva } from "@/hooks/useNutricao";
import { usePlantao } from "@/hooks/usePlantao";
import { PlantaoBar } from "@/components/cuidador/PlantaoBar";
import { HospedeIdentidade } from "@/components/cuidador/HospedeIdentidade";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado, formatarDataHoraBR, horarioParaMinutos, horarioNoTurno } from "@/lib/utils";
import type {
  Administracao,
  PeriodoMedicacao,
  Prescricao,
  StatusAdministracao,
  Turno,
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

  const hospedeSel = hospedes.find((h) => h.id === hospedeId);

  return (
    <div className="space-y-6">
      {/* Controle de plantão: confirmação de medicação exige check-in no turno. */}
      <PlantaoBar plantao={plantao} />
      <HospedeSelector hospedes={hospedes} selecionadoId={hospedeId} onSelect={setSelecionadoId} />

      {/* Identidade do hóspede (poka-yoke): FOTO + nome + quarto, com a faixa
          de alergia em destaque — padrão do Checklist. O selo "tomar com
          alimento" aparece quando a dieta ativa indicar. */}
      {hospedeSel && <CabecalhoMedicacao hospede={hospedeSel} />}

      {hospedeId && (
        <MedicacaoDoHospede
          key={hospedeId}
          residenteId={hospedeId}
          liberado={plantao.liberado}
          turno={plantao.turnoAtivo}
        />
      )}
    </div>
  );
}

/** Identidade + selo de dieta. "Tomar com alimento" quando a dieta ativa indicar. */
function CabecalhoMedicacao({ hospede }: { hospede: import("@/types/database").Residente }) {
  const dieta = useDietaAtiva(hospede.id);
  // A dieta é texto livre (observações/restrições); o selo aparece quando o
  // texto indicar administração junto à alimentação.
  const textoDieta = [dieta.data?.observacoes ?? "", ...(dieta.data?.restricoes ?? [])].join(" ");
  const comAlimento = /com (alimento|comida)|junto (a|à|com)|durante (a |as )?refei|ap[oó]s (a |as )?refei/i.test(
    textoDieta,
  );
  return (
    <HospedeIdentidade hospede={hospede}>
      {comAlimento && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning px-3 py-1.5 text-xs font-bold text-warning-foreground">
          <UtensilsCrossed className="size-3.5" /> Tomar com alimento
        </span>
      )}
    </HospedeIdentidade>
  );
}

function MedicacaoDoHospede({
  residenteId,
  liberado,
  turno,
}: {
  residenteId: string;
  liberado: boolean;
  turno: Turno | null;
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

  // Apenas os períodos cujo horário cai dentro do turno ativo da cuidadora.
  const periodosDoTurno = useMemo(
    () => PERIODOS.filter((p) => horarioNoTurno(p.horario, turno)),
    [turno]
  );

  if (prescricoes.isLoading) return <LoadingState />;
  if (prescricoes.isError) return <ErrorState error={prescricoes.error} />;

  if (periodosDoTurno.length === 0) {
    return <EmptyState label="Nenhum período de medicação para o seu turno." />;
  }

  return (
    <Tabs defaultValue={periodosDoTurno[0].key} key={periodosDoTurno[0].key}>
      <TabsList className="w-full justify-start">
        {periodosDoTurno.map((p) => (
          <TabsTrigger key={p.key} value={p.key} className="gap-1.5">
            <span>
              {p.label} <span className="font-normal opacity-70">· {p.horario}</span>
            </span>
            <StatusDot status={registroPorPeriodo[p.key]?.status} />
          </TabsTrigger>
        ))}
      </TabsList>
      {periodosDoTurno.map((p) => {
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
  // Hooks SEMPRE antes de qualquer early return (ordem estável de hooks).
  const [escolhendoMotivo, setEscolhendoMotivo] = useState(false);

  const orais = useMemo(() => prescricoes.filter((m) => m.via === "oral"), [prescricoes]);
  const enfermagem = useMemo(() => prescricoes.filter((m) => m.via !== "oral"), [prescricoes]);

  if (prescricoes.length === 0) {
    return <EmptyState label="Sem prescrições ativas para este período." />;
  }

  async function confirmarTodas() {
    await registrar.mutateAsync({ periodo, status: "sim" });
    toast.success("Medicação confirmada.");
  }
  /** "Não" em 1 toque a mais: motivo por botão (zero digitação). */
  async function confirmarNao(motivo: string) {
    await registrar.mutateAsync({ periodo, status: "nao", motivo });
    setEscolhendoMotivo(false);
    toast.warning(`Não administrada (${motivo.toLowerCase()}) — coordenação notificada.`);
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
          <ShieldAlert className="size-3.5 text-nursing" />
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
            {registrar.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Check className="size-5" />
            )}
            Sim, todas ({orais.length} orais)
          </Button>
          <Button
            variant={escolhendoMotivo ? "outline" : "destructive"}
            size="lg"
            disabled={!liberado || registrar.isPending}
            onClick={() => setEscolhendoMotivo((v) => !v)}
          >
            <Ban className="size-5" />
            {escolhendoMotivo ? "Cancelar" : "Não"}
          </Button>
        </div>

        {/* Motivo do "Não" — botões grandes (≥44px), zero digitação */}
        {escolhendoMotivo && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-destructive">Por que não foi administrada?</p>
            <div className="grid grid-cols-2 gap-2">
              {["Recusou", "Indisposto", "Ausente", "Outro"].map((motivo) => (
                <button
                  key={motivo}
                  disabled={registrar.isPending}
                  onClick={() => confirmarNao(motivo)}
                  className="min-h-[48px] rounded-lg border border-destructive/40 bg-card px-3 py-3 text-sm font-bold text-destructive transition-all duration-200 hover:bg-destructive hover:text-white active:scale-[0.97] disabled:opacity-50"
                >
                  {registrar.isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : motivo}
                </button>
              ))}
            </div>
          </div>
        )}
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
      detalhe: registro.motivo
        ? `Motivo: ${registro.motivo}. Coordenação avisada.`
        : "Coordenação avisada.",
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
