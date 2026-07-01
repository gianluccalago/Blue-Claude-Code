import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Syringe, ShieldAlert, Check, CircleDashed, X, ChevronLeft, ChevronRight, Clock3, Users, ClipboardCheck } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  usePrescricoesEnfermagem,
  useAdministracoesEnfermagemHoje,
  useRegistrarAdministracaoEnfermagem,
  useRemoverAdministracaoEnfermagem,
  usePrescricoesEnfermagemTodas,
  useAdministracoesEnfermagemHojeTodas,
  useRegistrarAdministracaoEnfermagemCasa,
  useProcedimentosEnfermagemHoje,
  useRegistrarProcedimentoEnfermagem,
  useRemoverProcedimentoEnfermagem,
} from "@/hooks/useEnfermagem";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado, formatarHoraBR, horarioParaMinutos } from "@/lib/utils";
import type { Administracao, PeriodoMedicacao, Prescricao, Residente } from "@/types/database";

interface Confirmacao {
  titulo: string;
  descricao?: string;
  acao: () => void;
}

// 6 períodos com horário padrão, na ordem do dia.
const PERIODOS: { key: PeriodoMedicacao; label: string; horario: string }[] = [
  { key: "jejum", label: "Jejum", horario: "06:00" },
  { key: "manha", label: "Manhã", horario: "08:00" },
  { key: "almoco", label: "Almoço", horario: "12:00" },
  { key: "apos_almoco", label: "Após almoço", horario: "13:00" },
  { key: "tarde", label: "Tarde", horario: "16:00" },
  { key: "noite", label: "Noite", horario: "20:00" },
];

const VIA_LABEL: Record<string, string> = {
  injetavel: "Injetável",
  insulina: "Insulina",
  sonda: "Sonda",
};

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Procedimentos comuns de enfermagem (sugestões; o campo aceita texto livre).
const PROCEDIMENTOS_COMUNS = [
  "Curativo",
  "Troca de curativo",
  "Cuidados com sonda nasoenteral",
  "Cuidados com gastrostomia",
  "Sondagem vesical",
  "Aspiração de vias aéreas",
  "Glicemia capilar",
];

export function MedicacaoEnfermagem() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const lista = residentes.data ?? [];
  const hospedeId = selecionadoId ?? lista[0]?.id;
  const indice = lista.findIndex((r) => r.id === hospedeId);

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (lista.length === 0) return <EmptyState label="Nenhum residente cadastrado." />;

  const anterior = indice > 0 ? lista[indice - 1] : null;
  const proximo = indice < lista.length - 1 ? lista[indice + 1] : null;

  // Visão "AGORA" (heijunka): a casa inteira numa lista única — atrasados em
  // vermelho + devidos no período corrente. Navegação por hóspede vira
  // visão secundária (sem perder nada do fluxo atual).
  return (
    <Tabs defaultValue="agora">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="agora" className="gap-1.5">
          <Clock3 className="size-4" /> Agora (casa)
        </TabsTrigger>
        <TabsTrigger value="hospede" className="gap-1.5">
          <Users className="size-4" /> Por hóspede
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agora">
        <VisaoAgora residentes={lista} />
      </TabsContent>

      <TabsContent value="hospede">
        <VisaoPorHospede
          lista={lista}
          hospedeId={hospedeId}
          indice={indice}
          anterior={anterior}
          proximo={proximo}
          onSelect={setSelecionadoId}
        />
      </TabsContent>
    </Tabs>
  );
}

/** Visão da casa: itens de enfermagem atrasados + do período corrente. */
function VisaoAgora({ residentes }: { residentes: Residente[] }) {
  const prescricoes = usePrescricoesEnfermagemTodas();
  const administracoes = useAdministracoesEnfermagemHojeTodas();
  const registrar = useRegistrarAdministracaoEnfermagemCasa();

  const nomePorId = useMemo(
    () => new Map(residentes.map((r) => [r.id, r])),
    [residentes],
  );

  // Período corrente = o último cujo horário-padrão já chegou (antes das
  // 06:00 não há período corrente — só atrasados de ontem não entram, o
  // recorte é o dia de hoje).
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const indiceCorrente = (() => {
    let idx = -1;
    PERIODOS.forEach((p, i) => {
      if ((horarioParaMinutos(p.horario) ?? 0) <= agoraMin) idx = i;
    });
    return idx;
  })();

  // prescricao_id já administrada hoje (independente do período do registro).
  const administradasHoje = useMemo(
    () => new Set((administracoes.data ?? []).map((a) => a.prescricao_id)),
    [administracoes.data],
  );

  if (prescricoes.isLoading || administracoes.isLoading) return <LoadingState />;
  if (prescricoes.isError) return <ErrorState error={prescricoes.error} />;

  type ItemAgora = { prescricao: Prescricao; residente: Residente; atrasado: boolean };
  const itens: ItemAgora[] = [];
  for (const p of prescricoes.data ?? []) {
    const idxPeriodo = PERIODOS.findIndex((x) => x.key === p.periodo);
    if (idxPeriodo === -1 || idxPeriodo > indiceCorrente) continue; // ainda não venceu
    if (administradasHoje.has(p.id)) continue; // já registrado hoje
    const residente = nomePorId.get(p.residente_id);
    if (!residente) continue;
    itens.push({ prescricao: p, residente, atrasado: idxPeriodo < indiceCorrente });
  }
  // Atrasados primeiro; dentro do grupo, pela ordem do dia.
  itens.sort((a, b) => {
    if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
    const ia = PERIODOS.findIndex((x) => x.key === a.prescricao.periodo);
    const ib = PERIODOS.findIndex((x) => x.key === b.prescricao.periodo);
    return ia - ib;
  });

  const atrasados = itens.filter((i) => i.atrasado).length;

  if (indiceCorrente === -1) {
    return <EmptyState label="Antes das 06:00 — nenhum período de enfermagem vencido hoje." />;
  }
  if (itens.length === 0) {
    return <EmptyState label="Tudo em dia: nenhum item de enfermagem pendente até agora." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{itens.length} pendente{itens.length !== 1 ? "s" : ""}</Badge>
        {atrasados > 0 && (
          <Badge variant="destructive">{atrasados} atrasado{atrasados !== 1 ? "s" : ""}</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Período corrente: {PERIODOS[indiceCorrente].label} · {PERIODOS[indiceCorrente].horario}
        </span>
      </div>

      {itens.map(({ prescricao: m, residente, atrasado }) => {
        const periodo = PERIODOS.find((x) => x.key === m.periodo);
        return (
          <div
            key={m.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
              atrasado ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg",
                  atrasado ? "bg-destructive/10 text-destructive" : "bg-nursing/10 text-nursing",
                )}
              >
                <Syringe className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-secondary">
                  {residente.nome}
                  <span className="font-normal text-muted-foreground">
                    {" "}· Quarto {ouNaoInformado(residente.quarto)}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.medicamento} · {periodo?.label} {periodo?.horario}
                  {atrasado && (
                    <span className="ml-1.5 font-bold text-destructive">ATRASADO</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={registrar.isPending}
              onClick={() =>
                registrar.mutate({
                  residenteId: residente.id,
                  prescricaoId: m.id,
                  periodo: m.periodo as PeriodoMedicacao,
                })
              }
            >
              <Check className="size-4" /> Registrar
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** Visão original por hóspede (navegação ‹ › preservada). */
function VisaoPorHospede({
  lista,
  hospedeId,
  indice,
  anterior,
  proximo,
  onSelect,
}: {
  lista: Residente[];
  hospedeId: string | undefined;
  indice: number;
  anterior: Residente | null;
  proximo: Residente | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <HospedeSelector hospedes={lista} selecionadoId={hospedeId} onSelect={onSelect} />

      {/* Navegação prev/next */}
      {lista.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => anterior && onSelect(anterior.id)}
            disabled={!anterior}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            {anterior ? anterior.nome.split(" ")[0] : "Anterior"}
          </button>
          <span className="text-xs text-muted-foreground">
            {indice + 1} / {lista.length}
          </span>
          <button
            onClick={() => proximo && onSelect(proximo.id)}
            disabled={!proximo}
            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {proximo ? proximo.nome.split(" ")[0] : "Próximo"}
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {hospedeId && <EnfermagemDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function EnfermagemDoHospede({ residenteId }: { residenteId: string }) {
  const prescricoes = usePrescricoesEnfermagem(residenteId);
  const administracoes = useAdministracoesEnfermagemHoje(residenteId);
  const registrar = useRegistrarAdministracaoEnfermagem(residenteId);
  const remover = useRemoverAdministracaoEnfermagem(residenteId);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  // Administrações de hoje agrupadas por prescrição (para o histórico do item).
  const histPorPrescricao = useMemo(() => {
    const mapa = new Map<string, Administracao[]>();
    for (const a of administracoes.data ?? []) {
      if (!a.prescricao_id) continue;
      const arr = mapa.get(a.prescricao_id) ?? [];
      arr.push(a);
      mapa.set(a.prescricao_id, arr);
    }
    return mapa;
  }, [administracoes.data]);

  if (prescricoes.isError) return <ErrorState error={prescricoes.error} />;
  if (prescricoes.isLoading) return <LoadingState />;

  const todas = prescricoes.data ?? [];

  // Só exibe os períodos que possuem itens de enfermagem.
  const periodosComItens = PERIODOS.map((p) => ({
    ...p,
    itens: todas
      .filter((m) => m.periodo === p.key)
      .sort(
        (a, b) =>
          (horarioParaMinutos(a.horario) ?? Infinity) -
          (horarioParaMinutos(b.horario) ?? Infinity),
      ),
  })).filter((p) => p.itens.length > 0);

  return (
    <div className="space-y-6">
      {periodosComItens.length === 0 && (
        <EmptyState label="Sem medicação de enfermagem (injetável/insulina/sonda) ativa para este hóspede." />
      )}
      {periodosComItens.map((p) => (
        <Card key={p.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="size-5 text-nursing" /> {p.label}
              <span className="text-sm font-normal text-muted-foreground">· {p.horario}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.itens.map((m) => (
              <ItemEnfermagem
                key={m.id}
                prescricao={m}
                historico={histPorPrescricao.get(m.id) ?? []}
                salvando={registrar.isPending}
                removendo={remover.isPending}
                onRegistrar={() =>
                  registrar.mutate({ prescricaoId: m.id, periodo: p.key })
                }
                onDesfazer={(adm) =>
                  setConfirmacao({
                    titulo: "Desfazer este registro de administração?",
                    descricao: `${m.medicamento} · ${formatarHoraBR(adm.administrado_em)}`,
                    acao: () => remover.mutate(adm.id),
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Procedimentos (curativo, sonda…) — item próprio, separado da medicação. */}
      <ProcedimentosEnfermagem residenteId={residenteId} />

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

/**
 * Procedimentos de enfermagem (curativo, sonda e afins). NÃO é medicação e
 * nunca via oral (VO é das cuidadoras). A enfermagem registra a EXECUÇÃO; o
 * histórico do dia fica logo abaixo, com desfazer.
 */
function ProcedimentosEnfermagem({ residenteId }: { residenteId: string }) {
  const hoje = useProcedimentosEnfermagemHoje(residenteId);
  const registrar = useRegistrarProcedimentoEnfermagem(residenteId);
  const remover = useRemoverProcedimentoEnfermagem(residenteId);
  const [procedimento, setProcedimento] = useState("");
  const [observacao, setObservacao] = useState("");

  const valido = procedimento.trim().length > 0;
  async function salvar() {
    if (!valido) return;
    try {
      await registrar.mutateAsync({ procedimento: procedimento.trim(), observacao });
      setProcedimento("");
      setObservacao("");
      toast.success("Procedimento registrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o procedimento. Tente novamente.");
    }
  }

  const lista = hoje.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-nursing" /> Procedimentos (curativo, sonda)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Registro da execução de procedimentos de enfermagem — não é medicação e nunca via oral
          (VO é das cuidadoras).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PROCEDIMENTOS_COMUNS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProcedimento(p)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                procedimento === p
                  ? "border-nursing bg-nursing/10 text-nursing"
                  : "bg-background hover:border-nursing/50",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={procedimento}
          onChange={(e) => setProcedimento(e.target.value)}
          placeholder="Procedimento (escolha acima ou digite)"
          className={inputBase}
        />
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação (opcional)"
          className={inputBase}
        />
        <Button onClick={salvar} disabled={!valido || registrar.isPending}>
          <Check className="size-4" /> Registrar procedimento
        </Button>

        <div className="border-t pt-3">
          {lista.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDashed className="size-4" /> Nenhum procedimento registrado hoje.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lista.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-secondary">{p.procedimento}</span>
                    {p.observacao && <span className="text-muted-foreground"> · {p.observacao}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {ouNaoInformado(p.registrado_por)} · {formatarHoraBR(p.registrado_em)}
                    </span>
                  </span>
                  <button
                    onClick={() => remover.mutate(p.id)}
                    disabled={remover.isPending}
                    aria-label="Desfazer este procedimento"
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemEnfermagem({
  prescricao: m,
  historico,
  salvando,
  removendo,
  onRegistrar,
  onDesfazer,
}: {
  prescricao: Prescricao;
  historico: Administracao[];
  salvando: boolean;
  removendo: boolean;
  onRegistrar: () => void;
  onDesfazer: (adm: Administracao) => void;
}) {
  // Subtítulo: dose · quantidade (se houver) · horário (se houver) · via.
  const detalhe = [ouNaoInformado(m.dose), m.quantidade, m.horario, `via ${VIA_LABEL[m.via] ?? m.via}`]
    .filter(Boolean)
    .join(" · ");

  const qtdHoje = historico.length;
  const jaAdministrado = qtdHoje > 0;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-nursing/10 text-nursing">
            <ShieldAlert className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-secondary">{m.medicamento}</div>
            <div className="text-sm text-muted-foreground">{detalhe}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple">Enfermagem</Badge>
          {jaAdministrado && (
            <Badge variant="success">
              <Check className="size-3.5" /> {qtdHoje} hoje
            </Badge>
          )}
          {/* Sempre clicável: a enfermagem pode administrar várias vezes ao dia. */}
          <Button onClick={onRegistrar} disabled={salvando}>
            <Check className="size-4" />
            {jaAdministrado ? "Registrar nova administração" : "Registrar administração"}
          </Button>
        </div>
      </div>

      {/* Histórico de hoje deste item */}
      <div className="mt-3 border-t pt-3">
        {historico.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDashed className="size-4" /> Pendente — nenhuma administração hoje.
          </div>
        ) : (
          <ul className="space-y-1">
            {historico.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-sm"
              >
                <span className="flex items-center gap-2 text-success">
                  <Check className="size-4 shrink-0" />
                  <span className="text-secondary/90">
                    Administrado por {ouNaoInformado(a.administrado_por)} ·{" "}
                    {formatarHoraBR(a.administrado_em)}
                  </span>
                </span>
                <button
                  onClick={() => onDesfazer(a)}
                  disabled={removendo}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Desfazer este registro"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
