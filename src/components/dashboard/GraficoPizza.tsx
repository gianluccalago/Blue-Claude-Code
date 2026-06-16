/** Gráfico de PIZZA/donut (SVG, sem dependência). */
export interface FatiaPizza {
  label: string;
  valor: number;
  cor: string; // hex
}

export function GraficoPizza({ fatias, formatar = (n) => String(n) }: { fatias: FatiaPizza[]; formatar?: (n: number) => string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const R = 16; // raio do donut (viewBox 0 0 42 42)
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 42 42" width={140} height={140} role="img">
        <circle cx="21" cy="21" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        {total > 0 &&
          fatias
            .filter((f) => f.valor > 0)
            .map((f) => {
              const frac = f.valor / total;
              const dash = frac * C;
              const offset = C * 0.25 - acumulado; // começa no topo
              acumulado += dash;
              return (
                <circle
                  key={f.label}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={f.cor}
                  strokeWidth="6"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${f.label}: ${formatar(f.valor)} (${Math.round(frac * 100)}%)`}</title>
                </circle>
              );
            })}
        <text x="21" y="21" textAnchor="middle" dominantBaseline="central" fontSize="6" fill="currentColor" className="font-bold text-secondary">
          {total}
        </text>
      </svg>
      <ul className="space-y-1 text-sm">
        {fatias.map((f) => (
          <li key={f.label} className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: f.cor }} />
            <span className="text-secondary">{f.label}</span>
            <span className="text-muted-foreground">· {formatar(f.valor)}{total > 0 ? ` (${Math.round((f.valor / total) * 100)}%)` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
