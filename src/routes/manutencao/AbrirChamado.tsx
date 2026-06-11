/**
 * Abrir chamado de manutenção — disponível para Hotelaria, Cuidadores,
 * Coordenação e Master (BLOCO H2).
 */
import { useParams } from "@tanstack/react-router";
import { useResidentes } from "@/hooks/usePlanos";
import { FormAbrirChamado } from "@/components/manutencao/FormAbrirChamado";
import { LoadingState, ErrorState } from "@/components/states";
import type { PerfilSolicitanteChamado } from "@/types/database";

const PERFIL_LABEL: Record<string, { label: string; abertoPor: string }> = {
  hotelaria: { label: "Hotelaria", abertoPor: "Hotelaria" },
  cuidador: { label: "Cuidadores", abertoPor: "Cuidador(a)" },
  coordenacao: { label: "Coordenação", abertoPor: "Coordenação" },
  master: { label: "Master", abertoPor: "Master" },
};

export function AbrirChamado() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const { data: residentes = [], isLoading, error } = useResidentes();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const info = PERFIL_LABEL[perfil ?? ""] ?? { label: "Equipe", abertoPor: "" };
  const perfilSolicitante = (
    perfil && perfil in PERFIL_LABEL ? perfil : "coordenacao"
  ) as PerfilSolicitanteChamado;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold">Chamado de manutenção</h1>
        <p className="text-sm text-muted-foreground">{info.label}</p>
      </div>

      <FormAbrirChamado
        residentes={residentes}
        perfilSolicitante={perfilSolicitante}
        abertoPorPadrao={info.abertoPor}
      />
    </div>
  );
}
