import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { cn } from "@/lib/utils";

// ===========================================================================
// Navegador de mês de referência ("YYYY-MM") — versão ÚNICA e acessível do
// bloco "‹ Mês/AAAA ›" que estava copiado em várias telas (UX-05): botões
// nomeados para leitor de tela (UX-01), alvo de toque de 44px e anúncio do mês
// selecionado via aria-live.
// ===========================================================================

export function SeletorMes({
  valor,
  onChange,
  className,
}: {
  /** Mês no formato "YYYY-MM". */
  valor: string;
  onChange: (mes: string) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Mês de referência" className={cn("flex items-center justify-between gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mês anterior"
        onClick={() => onChange(deslocarMes(valor, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span aria-live="polite" className="text-lg font-bold text-secondary">
        {formatarMesReferencia(valor)}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Próximo mês"
        onClick={() => onChange(deslocarMes(valor, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
