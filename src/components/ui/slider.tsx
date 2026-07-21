import { cn } from "@/lib/utils";

// ===========================================================================
// SliderPct — slider premium de percentual (0–100).
// Trilha com gradiente da marca preenchida até o valor (CSS .slider-premium),
// thumb circular polido e ATALHOS 0/25/50/75/100 para ajuste em um clique.
// ===========================================================================

const ATALHOS = [0, 25, 50, 75, 100];

export function SliderPct({
  valor,
  onChange,
  step = 5,
  disabled = false,
  atalhos = true,
  className,
}: {
  valor: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
  /** Chips 0/25/50/75/100 abaixo da barra (padrão: sim). */
  atalhos?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-premium"
        style={{ "--pct": `${valor}%` } as React.CSSProperties}
        aria-label="Percentual"
      />
      {atalhos && (
        <div className="flex justify-between">
          {ATALHOS.map((v) => (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(v)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors",
                valor === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-secondary",
              )}
            >
              {v}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
