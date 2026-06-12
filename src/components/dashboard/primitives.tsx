import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ===========================================================================
// Primitivas visuais de dashboard (cockpit) — APENAS apresentação.
// Recebem dados já calculados via props; não fazem queries nem lógica.
// ===========================================================================

type Tom = "primary" | "secondary" | "success" | "warning" | "destructive" | "nursing";

const MEDALHAO: Record<Tom, string> = {
  primary: "bg-brand-gradient text-white shadow-glow-primary",
  secondary: "bg-navy-gradient text-white",
  success: "bg-gradient-to-br from-success to-success/70 text-white",
  warning: "bg-gradient-to-br from-warning to-warning/70 text-warning-foreground",
  destructive: "bg-gradient-to-br from-destructive to-destructive/70 text-white",
  nursing: "bg-gradient-to-br from-nursing to-nursing/70 text-white",
};

/** Ícone em medalhão com gradiente — assinatura visual dos painéis. */
export function Medalhao({
  icon: Icon,
  tom = "primary",
  className,
}: {
  icon: LucideIcon;
  tom?: Tom;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        MEDALHAO[tom],
        className ?? "size-11",
      )}
    >
      <Icon className="size-5" />
    </div>
  );
}

/** Cabeçalho de seção com medalhão + título grande + ação opcional à direita. */
export function SectionHeader({
  icon,
  tom = "secondary",
  titulo,
  subtitulo,
  acao,
}: {
  icon: LucideIcon;
  tom?: Tom;
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Medalhao icon={icon} tom={tom} className="size-10" />
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-secondary">{titulo}</h2>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
      </div>
      {acao}
    </div>
  );
}

/**
 * Hero stat — número gigante de destaque, com medalhão e linha de apoio.
 * Use para o indicador principal de um painel.
 */
export function HeroStat({
  icon,
  rotulo,
  valor,
  sufixo,
  apoio,
  tom = "primary",
  alerta,
  children,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: ReactNode;
  sufixo?: string;
  apoio?: ReactNode;
  tom?: Tom;
  alerta?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-5 shadow-card",
        alerta ? "border-destructive/30" : "border-border/70",
      )}
    >
      {/* Glow decorativo de fundo */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-2xl",
          alerta ? "bg-destructive/10" : "bg-primary/10",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wide">{rotulo}</span>
        </div>
        <Medalhao icon={icon} tom={alerta ? "destructive" : tom} className="size-10" />
      </div>
      <div className="relative mt-2 flex items-end gap-1">
        <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums text-secondary sm:text-5xl">
          {valor}
        </span>
        {sufixo && <span className="mb-1 text-lg font-bold text-muted-foreground">{sufixo}</span>}
      </div>
      {apoio && <div className="relative mt-2 text-sm text-muted-foreground">{apoio}</div>}
      {children && <div className="relative mt-3">{children}</div>}
    </div>
  );
}

/** Card de KPI secundário com medalhão de gradiente e número forte. */
export function StatCard({
  icon,
  rotulo,
  valor,
  sufixo,
  tom = "primary",
  destaque,
  apoio,
  className,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: ReactNode;
  sufixo?: string;
  tom?: Tom;
  destaque?: boolean;
  apoio?: ReactNode;
  className?: string;
}) {
  const semDados = valor === "sem dados";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-all duration-200 hover:shadow-card",
        destaque ? "border-primary/40 bg-primary/5" : "border-border/70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <Medalhao icon={icon} tom={tom} className="size-8 rounded-lg" />
      </div>
      <div className="mt-2 flex items-end gap-1">
        <span
          className={cn(
            "font-extrabold tracking-tight tabular-nums",
            semDados ? "text-lg text-muted-foreground/70" : "text-2xl text-secondary sm:text-3xl",
          )}
        >
          {valor}
        </span>
        {sufixo && !semDados && (
          <span className="mb-0.5 text-sm font-bold text-muted-foreground">{sufixo}</span>
        )}
      </div>
      {apoio && <div className="mt-1 text-[11px] text-muted-foreground">{apoio}</div>}
    </div>
  );
}

/**
 * Barra de progresso decorativa baseada em dado real (0–100).
 * `tom` controla a cor; mostra o trilho mesmo em 0.
 */
export function ProgressBar({
  valor,
  tom = "primary",
  className,
}: {
  valor: number;
  tom?: Tom;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, valor));
  const fill: Record<Tom, string> = {
    primary: "bg-brand-gradient",
    secondary: "bg-navy-gradient",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    nursing: "bg-nursing",
  };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", fill[tom])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Sparkbar decorativo — micro barras a partir de uma série real de números.
 * Puramente ilustrativo da distribuição; sem eixos.
 */
export function Sparkbars({
  valores,
  tom = "primary",
  className,
}: {
  valores: number[];
  tom?: Tom;
  className?: string;
}) {
  const max = Math.max(1, ...valores);
  const fill: Record<Tom, string> = {
    primary: "bg-primary/60",
    secondary: "bg-secondary/50",
    success: "bg-success/60",
    warning: "bg-warning/70",
    destructive: "bg-destructive/60",
    nursing: "bg-nursing/60",
  };
  return (
    <div className={cn("flex h-8 items-end gap-1", className)}>
      {valores.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm", fill[tom])}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
