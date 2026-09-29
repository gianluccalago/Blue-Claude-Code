import { CheckCircle2, Clock4, AlertTriangle } from "lucide-react";
import { DOMINIO_POR_ID, MOTIVO_LABEL, textoPrazo, type StatusDominio } from "@/lib/autonomia";
import { cn, formatarDataBR } from "@/lib/utils";

/** As 4 avaliações de autonomia do hóspede: em dia, pendente ou vencida. */
export function StatusDominios({
  status,
  hoje,
  selecionado,
  onSelecionar,
}: {
  status: StatusDominio[];
  hoje: string;
  selecionado?: string | null;
  onSelecionar?: (dominio: StatusDominio["dominio"]) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {status.map((s) => {
        const def = DOMINIO_POR_ID.get(s.dominio)!;
        const emDia = s.situacao === "em_dia";
        const Icone = emDia ? CheckCircle2 : s.vencida ? AlertTriangle : Clock4;
        const conteudo = (
          <>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Icone className={cn("size-3.5", emDia ? "text-success" : s.vencida ? "text-destructive" : "text-warning")} />
              {def.quemAvalia}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-secondary">{def.rotulo}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {emDia
                ? `Assinada em ${formatarDataBR(s.ultima!.assinada_em!.slice(0, 10))} · reavaliar até ${formatarDataBR(s.prazo)}`
                : `${MOTIVO_LABEL[s.motivo ?? "entrada"]} · ${textoPrazo(s.prazo!, hoje)}${s.rascunho ? " · rascunho salvo" : ""}`}
            </p>
          </>
        );
        const classe = cn(
          "rounded-lg border p-3 text-left transition-colors",
          emDia ? "border-success/30 bg-success/5" : s.vencida ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/5",
          selecionado === s.dominio && "ring-2 ring-primary",
        );
        return onSelecionar ? (
          <button key={s.dominio} type="button" onClick={() => onSelecionar(s.dominio)} className={cn(classe, "hover:border-primary/60")}>
            {conteudo}
          </button>
        ) : (
          <div key={s.dominio} className={classe}>{conteudo}</div>
        );
      })}
    </div>
  );
}
