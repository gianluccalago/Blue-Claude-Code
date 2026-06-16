/**
 * Gráfico COMBO (barras agrupadas + linha) sem dependência externa (SVG).
 * - `barras`: 1–2 séries de barras (eixo primário).
 * - `linha`: série opcional em eixo SECUNDÁRIO (ex.: nº de colaboradores).
 * - `meta`: linha horizontal de referência (meta/teto) no eixo das barras.
 */
export interface SerieBarra {
  label: string;
  cor: string; // cor CSS (hex)
  valores: number[]; // alinhado a `categorias`
}

export function GraficoCombo({
  categorias,
  barras,
  linha,
  meta,
  formatarBarra = (n) => String(n),
  formatarLinha = (n) => String(n),
}: {
  categorias: string[];
  barras: SerieBarra[];
  linha?: { label: string; cor: string; valores: number[] };
  meta?: { label: string; valor: number; cor?: string };
  formatarBarra?: (n: number) => string;
  formatarLinha?: (n: number) => string;
}) {
  const n = Math.max(1, categorias.length);
  const W = Math.max(360, n * 66);
  const H = 210;
  const top = 12;
  const bottom = H - 30;
  const left = 8;
  const right = 8;
  const plotH = bottom - top;
  const step = (W - left - right) / n;

  const valoresBarra = barras.flatMap((s) => s.valores);
  const maxBar = Math.max(1, ...valoresBarra, meta?.valor ?? 0);
  const maxLinha = Math.max(1, ...(linha?.valores ?? [0]));
  const barY = (v: number) => bottom - (v / maxBar) * plotH;
  const linY = (v: number) => bottom - (v / maxLinha) * plotH;

  const grupoW = step * 0.62;
  const barW = grupoW / barras.length;
  const metaCor = meta?.cor ?? "#ef4444";

  return (
    <div className="space-y-2">
      {/* Legenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {barras.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: s.cor }} /> {s.label}
          </span>
        ))}
        {linha && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: linha.cor }} /> {linha.label}
          </span>
        )}
        {meta && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: metaCor }} /> {meta.label}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" role="img">
          {/* Barras */}
          {categorias.map((_, i) => {
            const cx = left + (i + 0.5) * step;
            const x0 = cx - grupoW / 2;
            return barras.map((s, si) => {
              const v = s.valores[i] ?? 0;
              const h = bottom - barY(v);
              return (
                <rect
                  key={`${i}-${si}`}
                  x={x0 + si * barW}
                  y={barY(v)}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(0, h)}
                  rx={2}
                  fill={s.cor}
                >
                  <title>{`${categorias[i]} · ${s.label}: ${formatarBarra(v)}`}</title>
                </rect>
              );
            });
          })}

          {/* Linha de meta/teto */}
          {meta && (
            <line x1={left} x2={W - right} y1={barY(meta.valor)} y2={barY(meta.valor)} stroke={metaCor} strokeWidth={1.5} strokeDasharray="5 4" />
          )}

          {/* Linha de dados (eixo secundário) */}
          {linha && (
            <>
              <polyline
                fill="none"
                stroke={linha.cor}
                strokeWidth={2}
                points={categorias.map((_, i) => `${left + (i + 0.5) * step},${linY(linha.valores[i] ?? 0)}`).join(" ")}
              />
              {categorias.map((_, i) => (
                <circle key={`p-${i}`} cx={left + (i + 0.5) * step} cy={linY(linha.valores[i] ?? 0)} r={3} fill={linha.cor}>
                  <title>{`${categorias[i]} · ${linha.label}: ${formatarLinha(linha.valores[i] ?? 0)}`}</title>
                </circle>
              ))}
            </>
          )}

          {/* Rótulos do eixo X */}
          {categorias.map((c, i) => (
            <text key={`x-${i}`} x={left + (i + 0.5) * step} y={H - 10} textAnchor="middle" fontSize="10" fill="currentColor" className="text-muted-foreground">
              {c}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
