import { Link, useParams } from "@tanstack/react-router";
import { HandHeart, ArrowRight } from "lucide-react";
import { useAutonomiaCasa } from "@/hooks/useAutonomia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/states";

/**
 * Indicador de autonomia da casa, sempre decomposto (nunca um número solto):
 * documentada = 4 avaliações em dia + preferência + objetivo ativo;
 * verificada = documentada + objetivo revisto em 90 dias com observação e
 * fala do residente. Tudo sai de registros feitos por pessoas.
 */
const PERFIS_DO_MODULO: ReadonlySet<string> = new Set(["medico", "coordenacao", "multidisciplinar", "nutricionista", "master"]);

export function IndicadorAutonomiaCard() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const q = useAutonomiaCasa();
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HandHeart className="size-4 text-primary" /> Autonomia preservada
        </CardTitle>
        {perfil && PERFIS_DO_MODULO.has(perfil) && (
          <Link to="/app/$perfil/autonomia" params={{ perfil }} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Abrir <ArrowRight className="size-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <LoadingState />
        ) : q.isError || !q.data ? (
          <ErrorState error={q.error} />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-3xl font-extrabold tabular-nums text-secondary">
                  {q.data.indicador.pctDocumentada === null ? "—" : `${q.data.indicador.pctDocumentada}%`}
                </p>
                <p className="text-sm font-semibold text-secondary">Documentada</p>
                <p className="text-xs text-muted-foreground">{q.data.indicador.documentadas} de {q.data.indicador.total} hóspedes</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold tabular-nums text-secondary">
                  {q.data.indicador.pctVerificada === null ? "—" : `${q.data.indicador.pctVerificada}%`}
                </p>
                <p className="text-sm font-semibold text-secondary">Verificada</p>
                <p className="text-xs text-muted-foreground">{q.data.indicador.verificadas} de {q.data.indicador.total} hóspedes</p>
              </div>
            </div>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              <li>{q.data.indicador.semAvaliacaoEmDia} sem as 4 avaliações em dia</li>
              <li>{q.data.indicador.semPreferencia} sem preferência registrada</li>
              <li>{q.data.indicador.semObjetivo} sem objetivo funcional ativo</li>
              <li>{q.data.indicador.semRevisaoRecente} sem revisão de objetivo em 90 dias</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
