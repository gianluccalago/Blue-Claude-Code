import { Clock, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MODALIDADE_SELO } from "@/lib/modalidade";
import type { ModalidadeEstadia } from "@/types/database";

/**
 * Selo da modalidade de estadia. Longa permanência (padrão) NÃO exibe selo —
 * só curta permanência e day care, para a equipe saber que é temporário/parcial.
 */
export function SeloModalidade({
  modalidade,
  className,
}: {
  modalidade: ModalidadeEstadia | null | undefined;
  className?: string;
}) {
  if (!modalidade) return null;
  const texto = MODALIDADE_SELO[modalidade];
  if (!texto) return null;
  const Icon = modalidade === "day_care" ? Sun : Clock;
  return (
    <Badge variant={modalidade === "day_care" ? "secondary" : "warning"} className={className}>
      <Icon className="size-3" /> {texto}
    </Badge>
  );
}
