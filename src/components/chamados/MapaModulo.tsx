import { MAPA_ALTURA, MAPA_CENTRO, MAPA_LARGURA, type AndarMapa, type SuiteMapa } from "@/data/mapaModulo5";
import { tempoDesde, type ChamadoAberto } from "@/lib/chamados";
import { cn } from "@/lib/utils";

// ===========================================================================
// Mapa do andar (SVG) nas cores do sistema. Suíte normal em branco; chamado
// acende em AMARELO; emergência em VERMELHO, pulsando até a presença no quarto.
// A barra azul marca o lado da porta (voltado ao corredor).
// ===========================================================================

const PORTA = 26;

function barraPorta(s: SuiteMapa) {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  switch (s.porta) {
    case "sul": return { x: cx - PORTA / 2, y: s.y + s.h - 3, w: PORTA, h: 6 };
    case "norte": return { x: cx - PORTA / 2, y: s.y - 3, w: PORTA, h: 6 };
    case "leste": return { x: s.x + s.w - 3, y: cy - PORTA / 2, w: 6, h: PORTA };
    default: return { x: s.x - 3, y: cy - PORTA / 2, w: 6, h: PORTA };
  }
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0];

export function MapaModulo({
  andar,
  chamados,
  ocupacao,
  selecionada,
  onSelecionar,
  agora,
}: {
  andar: AndarMapa;
  chamados: Map<string, ChamadoAberto>;
  ocupacao: Map<string, { nome: string; leito: string }[]>;
  selecionada: string | null;
  onSelecionar: (codigo: string) => void;
  agora: Date;
}) {
  return (
    <svg
      viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label={`Mapa do Módulo 5, ${andar.andar}º andar`}
    >
      {/* Área central: circulação e áreas comuns */}
      <rect
        x={MAPA_CENTRO.x}
        y={MAPA_CENTRO.y}
        width={MAPA_CENTRO.w}
        height={MAPA_CENTRO.h}
        rx={28}
        className="fill-accent/50 stroke-primary/40"
        strokeWidth={2}
        strokeDasharray="8 8"
      />
      <text x={MAPA_CENTRO.x + MAPA_CENTRO.w / 2} y={MAPA_CENTRO.y + MAPA_CENTRO.h / 2 - 8} textAnchor="middle" className="fill-secondary/70" fontSize={20} fontWeight={800} letterSpacing={2}>
        MÓDULO 5 · {andar.andar}º ANDAR
      </text>
      <text x={MAPA_CENTRO.x + MAPA_CENTRO.w / 2} y={MAPA_CENTRO.y + MAPA_CENTRO.h / 2 + 18} textAnchor="middle" className="fill-muted-foreground" fontSize={13}>
        Circulação e áreas comuns · {andar.suites.length} suítes
      </text>

      {andar.suites.map((s) => {
        const c = chamados.get(s.codigo);
        const emerg = c?.tipo === "emergencia";
        const hosp = ocupacao.get(s.codigo) ?? [];
        const sel = selecionada === s.codigo;
        const porta = barraPorta(s);
        const cx = s.x + s.w / 2;
        const deitada = s.w > s.h;
        const topo = s.y + (deitada ? 34 : 52);
        return (
          <g
            key={s.codigo}
            role="button"
            tabIndex={0}
            aria-label={`Suíte ${s.codigo}${c ? `, ${emerg ? "emergência" : "chamado"} aberto` : ""}`}
            onClick={() => onSelecionar(s.codigo)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelecionar(s.codigo)}
            className="cursor-pointer outline-none"
          >
            <title>{`Suíte ${s.codigo}${hosp.length ? ` · ${hosp.map((h) => h.nome).join(", ")}` : " · vaga"}`}</title>
            {c && (
              <rect
                x={s.x - 5}
                y={s.y - 5}
                width={s.w + 10}
                height={s.h + 10}
                rx={18}
                className={cn(emerg ? "fill-destructive alerta-pulso-rapido" : "fill-warning alerta-pulso")}
              />
            )}
            <rect
              x={s.x + 3}
              y={s.y + 3}
              width={s.w - 6}
              height={s.h - 6}
              rx={14}
              strokeWidth={sel ? 4 : c ? 3 : 1.5}
              className={cn(
                "transition-colors",
                emerg ? "fill-[hsl(0_85%_96%)] stroke-destructive" : c ? "fill-[hsl(45_100%_94%)] stroke-warning" : hosp.length ? "fill-card stroke-border hover:stroke-primary" : "fill-muted/60 stroke-border",
                sel && !c && "stroke-primary",
                sel && c && "stroke-secondary",
              )}
            />
            <rect x={porta.x} y={porta.y} width={porta.w} height={porta.h} rx={3} className="fill-primary" />
            <circle cx={s.x + s.w - 16} cy={s.y + 17} r={6} className={emerg ? "fill-destructive" : c ? "fill-warning" : "fill-border"} />
            <text x={cx} y={topo} textAnchor="middle" fontSize={24} fontWeight={800} className={emerg ? "fill-destructive" : "fill-secondary"}>
              {s.codigo}
            </text>
            {hosp.length === 0 ? (
              <text x={cx} y={topo + 20} textAnchor="middle" fontSize={11} className="fill-muted-foreground">vaga</text>
            ) : (
              hosp.slice(0, 2).map((h, i) => (
                <text key={h.leito} x={cx} y={topo + 19 + i * 15} textAnchor="middle" fontSize={11.5} fontWeight={600} className="fill-foreground/80">
                  {h.leito.slice(-1)} · {primeiroNome(h.nome)}
                </text>
              ))
            )}
            {c && (
              <>
                <rect
                  x={s.x + 10}
                  y={s.y + s.h - (deitada ? 30 : 40)}
                  width={s.w - 20}
                  height={deitada ? 20 : 26}
                  rx={8}
                  className={emerg ? "fill-destructive" : "fill-warning"}
                />
                <text
                  x={cx}
                  y={s.y + s.h - (deitada ? 16 : 23)}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={800}
                  className={emerg ? "fill-white" : "fill-warning-foreground"}
                >
                  {emerg ? "EMERGÊNCIA" : "CHAMADO"} · {tempoDesde(c.aberto_em, agora)}
                </text>
                {c.reconhecido_por && !deitada && (
                  <text x={cx} y={s.y + s.h - 46} textAnchor="middle" fontSize={9.5} fontWeight={700} className={emerg ? "fill-destructive" : "fill-warning-foreground"}>
                    a caminho: {primeiroNome(c.reconhecido_por)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
