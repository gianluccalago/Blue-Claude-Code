import { cn } from "@/lib/utils";

/**
 * Placeholder de logo — substitua por <img src="/logo.svg" /> quando tiver a
 * arte oficial. Mantém a identidade (celeste + navy) por enquanto.
 */
export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid size-10 place-items-center rounded-xl font-extrabold shadow-card",
          light ? "bg-white text-secondary" : "bg-primary text-primary-foreground",
        )}
      >
        B
      </div>
      <div className="leading-tight">
        <div className={cn("font-extrabold tracking-tight", light ? "text-white" : "text-secondary")}>
          Blue
        </div>
        <div className={cn("text-[11px] font-medium", light ? "text-sidebar-muted" : "text-muted-foreground")}>
          Senior Living
        </div>
      </div>
    </div>
  );
}
