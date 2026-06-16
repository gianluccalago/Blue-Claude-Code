import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, grauNivel } from "@/lib/utils";
import type { GrauDependencia } from "@/types/database";

// ===========================================================================
// Exibição padronizada de GRAU CONTRATUAL × GRAU REAL (IVCF). Apenas mostra
// dados já existentes (grau_contratual e grau_dependencia, este atualizado pelo
// último IVCF). Reaproveita o MESMO critério de divergência da ficha do Master
// (grauNivel + diferença ≥ 1 nível) — não cria outro.
//   • Sem grau real (grau_dependencia nulo) → "sem avaliação" + aviso de IVCF.
//   • Sem grau contratual → "não cadastrado".
// ===========================================================================

/** Divergência ≥1 nível entre contratual e real (gatilho de revisão). */
export function divergeGrauContratual(
  contratual: GrauDependencia | null | undefined,
  real: GrauDependencia | null | undefined,
): boolean {
  const c = grauNivel(contratual ?? null);
  const r = grauNivel(real ?? null);
  return c !== null && r !== null && Math.abs(c - r) >= 1;
}

export function GrauContratualReal({
  contratual,
  real,
  className,
  compact = false,
  ocultarReal = false,
}: {
  contratual: GrauDependencia | null | undefined;
  /** Grau real = grau_dependencia (atualizado pelo último IVCF). */
  real: GrauDependencia | null | undefined;
  className?: string;
  compact?: boolean;
  /**
   * Oculta o GRAU REAL (IVCF) e exibe SÓ o grau de ingresso (contratual). Usado
   * na ponta assistencial (cuidadoras/enfermagem), que cuida pelo grau de
   * ingresso. Ver `podeVerGrauReal` em lib/fichaHospede.
   */
  ocultarReal?: boolean;
}) {
  const diverge = divergeGrauContratual(contratual, real);
  const contratualTxt = contratual ?? "não cadastrado";
  const realTxt = real ?? "sem avaliação";

  if (compact) {
    return (
      <span className={cn("inline-flex flex-wrap items-center gap-1 text-xs", className)}>
        <span className="text-muted-foreground">
          Grau de ingresso <strong className="text-secondary">{contratualTxt}</strong>
          {!ocultarReal && (
            <>
              {" "}· real{" "}
              <strong className={cn(diverge ? "text-destructive" : "text-secondary")}>{realTxt}</strong>
            </>
          )}
        </span>
        {!ocultarReal && diverge && (
          <AlertTriangle className="size-3.5 text-destructive" aria-label="divergência de grau" />
        )}
        {!ocultarReal && !real && <span className="text-warning-foreground">· precisa de IVCF</span>}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium">
        <span className="text-muted-foreground">Grau de ingresso:</span>
        <strong className="text-secondary">{contratualTxt}</strong>
      </span>
      {ocultarReal ? null : (
        <>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium",
              diverge ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30",
            )}
          >
            <span className="text-muted-foreground">Grau real (IVCF):</span>
            <strong className={cn(diverge ? "text-destructive" : "text-secondary")}>{realTxt}</strong>
          </span>
          {diverge && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" /> divergência
            </Badge>
          )}
          {!real && <Badge variant="warning">precisa de IVCF</Badge>}
        </>
      )}
    </div>
  );
}
