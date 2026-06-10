import { Badge } from "@/components/ui/badge";
import { formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Dieta } from "@/types/database";

/** Exibição somente-leitura da dieta ativa de um hóspede. */
export function DietaInfo({ dieta, compact }: { dieta: Dieta; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{dieta.consistencia}</Badge>
        {(dieta.restricoes ?? []).map((r) => (
          <Badge key={r} variant="muted">{r}</Badge>
        ))}
      </div>
      <p className="text-sm text-secondary/80">{ouNaoInformado(dieta.observacoes)}</p>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Definida por {dieta.definida_por} em {formatarDataHoraBR(dieta.definida_em)}
        </p>
      )}
    </div>
  );
}
