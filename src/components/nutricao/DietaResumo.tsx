import { Apple } from "lucide-react";
import { useDietaAtiva } from "@/hooks/useNutricao";
import { DietaInfo } from "@/components/nutricao/DietaInfo";

/**
 * Resumo somente-leitura da dieta ativa de um hóspede, para uso em outros
 * perfis (Cuidador, Coordenação). A edição é exclusiva da Nutricionista.
 */
export function DietaResumo({ residenteId }: { residenteId: string }) {
  const { data: dieta, isLoading, isError } = useDietaAtiva(residenteId);

  // Não atrapalha o layout do perfil hospedeiro em caso de erro/carregamento.
  if (isLoading || isError) return null;

  return (
    <div className="border-t pt-3">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-secondary">
        <Apple className="size-4" /> Dieta
      </div>
      {dieta ? (
        <DietaInfo dieta={dieta} compact />
      ) : (
        <p className="text-sm text-muted-foreground">Sem dieta definida</p>
      )}
    </div>
  );
}
