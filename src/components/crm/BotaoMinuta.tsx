import { useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { baixarMinuta, dadosDaMinuta } from "@/lib/minuta";
import { Button } from "@/components/ui/button";
import type { CrmContato, CrmOportunidade } from "@/types/database";

/** Baixa a minuta do contrato (Word) com o que o CRM já sabe; o resto fica grifado para completar. */
export function BotaoMinuta({ op, contato, size = "sm", variant = "outline" }: {
  op: Pick<CrmOportunidade, "simulacao">;
  contato: CrmContato | null;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const [gerando, setGerando] = useState(false);
  async function baixar() {
    setGerando(true);
    try {
      await baixarMinuta(dadosDaMinuta(op, contato));
      toast.success("Minuta baixada. Complete os campos grifados em amarelo antes de enviar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a minuta.");
    } finally {
      setGerando(false);
    }
  }
  return (
    <Button size={size} variant={variant} onClick={baixar} loading={gerando}>
      <FileText className="size-4" /> Baixar minuta (Word)
    </Button>
  );
}
