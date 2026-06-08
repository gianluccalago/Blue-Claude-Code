import { useMemo, useState } from "react";
import { Syringe, ShieldAlert, Check, CircleDashed } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  usePrescricoesEnfermagem,
  useAdministracoesEnfermagemHoje,
  useRegistrarAdministracaoEnfermagem,
} from "@/hooks/useEnfermagem";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ouNaoInformado, formatarHoraBR, horarioParaMinutos } from "@/lib/utils";
import type { Administracao, PeriodoMedicacao, Prescricao } from "@/types/database";

const PERIODOS: { key: PeriodoMedicacao; label: string }[] = [
  { key: "noite", label: "Noite / jejum" },
  { key: "manha", label: "Manhã" },
  { key: "almoco", label: "Após almoço" },
  { key: "tarde", label: "Tarde" },
];

const VIA_LABEL: Record<string, string> = {
  injetavel: "Injetável",
  insulina: "Insulina",
  sonda: "Sonda",
};

export function MedicacaoEnfermagem() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && <EnfermagemDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function EnfermagemDoHospede({ residenteId }: { residenteId: string }) {
  const prescricoes = usePrescricoesEnfermagem(residenteId);
  const administracoes = useAdministracoesEnfermagemHoje(residenteId);
  const registrar = useRegistrarAdministracaoEnfermagem(residenteId);

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
              <Syringe className="size-5 text-purple-600" /> {p.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.itens.map((m) => (
              <ItemEnfermagem
                key={m.id}
                prescricao={m}
                historico={histPorPrescricao.get(m.id) ?? []}
                salvando={registrar.isPending}
                onRegistrar={() =>
                  registrar.mutate({ prescricaoId: m.id, periodo: p.key })
                }
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ItemEnfermagem({
  prescricao: m,
  historico,
  salvando,
  onRegistrar,
}: {
  prescricao: Prescricao;
  historico: Administracao[];
  salvando: boolean;
  onRegistrar: () => void;
}) {
  // Subtítulo: dose · horário (se houver) · via.
  const detalhe = [ouNaoInformado(m.dose), m.horario, `via ${VIA_LABEL[m.via] ?? m.via}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-700">
            <ShieldAlert className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-secondary">{m.medicamento}</div>
            <div className="text-sm text-muted-foreground">{detalhe}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple">Enfermagem</Badge>
          <Button onClick={onRegistrar} disabled={salvando}>
            <Check className="size-4" /> Registrar administração
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
              <li key={a.id} className="flex items-center gap-2 text-sm text-success">
                <Check className="size-4 shrink-0" />
                <span className="text-secondary/90">
                  Administrado por {ouNaoInformado(a.administrado_por)} ·{" "}
                  {formatarHoraBR(a.administrado_em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
