import { cn } from "@/lib/utils";

/**
 * Gráfico de barras verticais mês a mês (sem dependência externa). Barras
 * positivas no tom escolhido; negativas em vermelho (ex.: resultado no negativo).
 * Mostra o valor no topo e o rótulo do mês embaixo.
 */
export interface PontoBarra {
  mes: string; // "YYYY-MM"
  valor: number;
}

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${m}/${ano.slice(2)}`;
}

export function BarrasMensais({
  pontos,
  formatar,
  tom = "primary",
}: {
  pontos: PontoBarra[];
  formatar: (n: number) => string;
  tom?: "primary" | "secondary";
}) {
  const maxAbs = Math.max(1, ...pontos.map((p) => Math.abs(p.valor)));
  const fillPos = tom === "primary" ? "bg-brand-gradient" : "bg-navy-gradient";

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {pontos.map((p) => {
        const altura = Math.round((Math.abs(p.valor) / maxAbs) * 100);
        const negativo = p.valor < 0;
        return (
          <div key={p.mes} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
              {formatar(p.valor)}
            </span>
            <div className="flex h-32 w-full items-end">
              <div
                className={cn("w-full rounded-t-md transition-all", negativo ? "bg-destructive" : fillPos)}
                style={{ height: `${Math.max(2, altura)}%` }}
                title={`${rotuloMes(p.mes)}: ${formatar(p.valor)}`}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{rotuloMes(p.mes)}</span>
          </div>
        );
      })}
    </div>
  );
}
