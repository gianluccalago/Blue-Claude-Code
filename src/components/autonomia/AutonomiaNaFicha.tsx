import { Link } from "@tanstack/react-router";
import { ArrowRight, HandHeart } from "lucide-react";
import { useAutonomiaHospede } from "@/hooks/useAutonomia";
import { StatusDominios } from "@/components/autonomia/StatusDominios";
import { ResumoAutonomiaCard } from "@/components/autonomia/ResumoAutonomiaCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/states";
import { hojeISO } from "@/lib/utils";
import type { PerfilUsuario, Residente } from "@/types/database";

const PERFIS_DO_MODULO: ReadonlySet<string> = new Set(["medico", "coordenacao", "multidisciplinar", "nutricionista", "master"]);

/** Perfil do hóspede: estado das 4 avaliações de autonomia + resumo de leitura. */
export function AutonomiaNaFicha({ residente, perfil }: { residente: Pick<Residente, "id" | "data_admissao">; perfil?: PerfilUsuario }) {
  const q = useAutonomiaHospede(residente);
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HandHeart className="size-4 text-secondary" /> Avaliações de autonomia
          </CardTitle>
          {perfil && PERFIS_DO_MODULO.has(perfil) && (
            <Link
              to="/app/$perfil/autonomia"
              params={{ perfil }}
              className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Abrir módulo <ArrowRight className="size-4" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {q.isLoading ? <LoadingState /> : q.data ? <StatusDominios status={q.data.status} hoje={hojeISO()} /> : null}
        </CardContent>
      </Card>
      <ResumoAutonomiaCard residente={residente} />
    </>
  );
}
