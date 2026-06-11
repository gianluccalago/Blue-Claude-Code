import { useMemo, useState } from "react";
import { Syringe, ShieldAlert, Check, CircleDashed, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  usePrescricoesEnfermagem,
  useAdministracoesEnfermagemHoje,
  useRegistrarAdministracaoEnfermagem,
  useRemoverAdministracaoEnfermagem,
} from "@/hooks/useEnfermagem";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ouNaoInformado, formatarHoraBR, horarioParaMinutos } from "@/lib/utils";
import type { Administracao, PeriodoMedicacao, Prescricao } from "@/types/database";

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

  return (
    <div className="space-y-6">
      <HospedeSelector hospedes={lista} selecionadoId={hospedeId} onSelect={setSelecionadoId} />

      {/* Navegação prev/next */}
      {lista.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => anterior && setSelecionadoId(anterior.id)}
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
            onClick={() => proximo && setSelecionadoId(proximo.id)}
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
  if (todas.length === 0) {
    return <EmptyState label="Sem prescrições de enfermagem ativas para este hóspede." />;
  }

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
