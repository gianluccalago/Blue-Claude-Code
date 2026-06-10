import { useState } from "react";
import { CalendarClock, Bus, Save, Info } from "lucide-react";
import { useCompromissosResidente, useAtualizarDetalhesCompromisso } from "@/hooks/useFamilia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR } from "@/lib/utils";
import type { CompromissoExterno } from "@/types/database";

const textareaBase =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Compromissos externos do hóspede. A família pode editar/adicionar os
 * "detalhes" (instruções) de cada compromisso, ex: "levar exame X",
 * "vestir roupa social".
 */
export function Compromissos() {
  const compromissos = useCompromissosResidente();
  const atualizar = useAtualizarDetalhesCompromisso();

  if (compromissos.isLoading) return <LoadingState />;
  if (compromissos.isError) return <ErrorState error={compromissos.error} />;

  const lista = compromissos.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum compromisso externo cadastrado." />;

  return (
    <div className="space-y-3">
      {lista.map((c) => (
        <CompromissoCard
          key={c.id}
          compromisso={c}
          onSalvar={(detalhes) => atualizar.mutate({ id: c.id, detalhes })}
          salvando={atualizar.isPending}
        />
      ))}
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
