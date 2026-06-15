import { cn } from "@/lib/utils";

/**
 * Gráfico de barras AGRUPADAS (várias séries por categoria do eixo X), sem
 * dependência externa. Suporta valores negativos (linha de zero tracejada) —
 * serve tanto p/ NPS (-100..+100) quanto p/ contagens (≥ 0).
 */
export interface SerieAgrupada {
  label: string;
  corClasse: string; // tailwind bg-* sólido
  valores: number[]; // alinhado a `categorias`
}

/** Paleta de classes sólidas (distintas) para as séries. */
export const PALETA_BARRAS = [
  "bg-primary",
  "bg-secondary",
  "bg-success",
  "bg-warning",
  "bg-destructive",
  "bg-nursing",
  "bg-muted-foreground",
];

export function BarrasAgrupadas({
  categorias,
  series,
  formatarValor = (n) => String(n),
  alturaPx = 168,
}: {
  categorias: string[];
  series: SerieAgrupada[];
  formatarValor?: (n: number) => string;
  alturaPx?: number;
}) {
  const todos = series.flatMap((s) => s.valores);
  const maxV = Math.max(0, ...todos);
  const minV = Math.min(0, ...todos);
  const range = Math.max(1, maxV - minV);
  const zeroPx = (maxV / range) * alturaPx;
  const temNegativo = minV < 0;

  return (
    <div className="space-y-3">
      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-3 rounded-sm", s.corClasse)} /> {s.label}
          </span>
        ))}
      </div>

      {/* Área do gráfico */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {categorias.map((cat, ci) => (
          <div key={cat} className="flex min-w-[60px] flex-1 flex-col items-center gap-1">
            <div className="relative w-full" style={{ height: alturaPx }}>
              <div className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: zeroPx }} />
              <div className="absolute inset-0 flex items-stretch justify-center gap-[3px] px-0.5">
                {series.map((s) => {
                  const v = s.valores[ci] ?? 0;
                  const h = v === 0 ? 0 : Math.max(2, (Math.abs(v) / range) * alturaPx);
                  const top = v >= 0 ? zeroPx - h : zeroPx;
                  return (
                    <div
                      key={s.label}
                      className="relative flex-1"
                      title={`${cat} · ${s.label}: ${formatarValor(v)}`}
                    >
                      <div className={cn("absolute w-full rounded-sm", s.corClasse)} style={{ height: h, top }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <span className="text-center text-[10px] leading-tight text-muted-foreground">{cat}</span>
          </div>
        ))}
      </div>

      {temNegativo && <p className="text-[10px] text-muted-foreground">Linha tracejada = zero.</p>}
    </div>
  );
}
