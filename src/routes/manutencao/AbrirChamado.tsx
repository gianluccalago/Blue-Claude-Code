/**
 * Abrir chamado de manutenção — disponível para Hotelaria, Cuidadores,
 * Coordenação e Master (BLOCO H2).
 */
import { useParams } from "@tanstack/react-router";
import { useResidentes } from "@/hooks/usePlanos";
import { FormAbrirChamado } from "@/components/manutencao/FormAbrirChamado";
import { LoadingState, ErrorState } from "@/components/states";
import { useAuth } from "@/auth/AuthProvider";
import type { PerfilSolicitanteChamado } from "@/types/database";

const PERFIL_LABEL: Record<string, string> = {
  hotelaria: "Hotelaria",
  cuidador: "Cuidadores",
  coordenacao: "Coordenação",
  master: "Master",
};

export function AbrirChamado() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const { usuarioEfetivo } = useAuth();
  const { data: residentes = [], isLoading, error } = useResidentes();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const label = PERFIL_LABEL[perfil ?? ""] ?? "Equipe";
  const perfilSolicitante = (
    perfil && perfil in PERFIL_LABEL ? perfil : "coordenacao"
  ) as PerfilSolicitanteChamado;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Chamado de manutenção</h1>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>

      <FormAbrirChamado
        residentes={residentes}
        perfilSolicitante={perfilSolicitante}
        // Quem abre é o usuário LOGADO (editável no formulário).
        abertoPorPadrao={usuarioEfetivo?.nome ?? ""}
      />
    </div>
  );
}
