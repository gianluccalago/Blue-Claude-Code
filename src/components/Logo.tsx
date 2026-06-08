import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";

/**
 * Lockup da marca (emblema + "BLUE / SENIOR LIVING"). A cor segue o texto:
 * use `text-secondary` (navy) em fundo claro ou `text-white` na sidebar.
 */
export function Logo({
  className,
  stacked = false,
}: {
  className?: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex select-none items-center text-secondary",
        stacked ? "flex-col gap-3" : "gap-3",
        className,
      )}
    >
      <BrandMark className={stacked ? "h-16" : "h-9"} />
      <div className={cn("leading-none", stacked && "text-center")}>
        <div
          className={cn(
            "font-extrabold tracking-brand",
            stacked ? "text-2xl" : "text-lg",
          )}
        >
          BLUE
        </div>
        <div
          className={cn(
            "font-medium uppercase tracking-[0.32em] opacity-70",
            stacked ? "mt-1.5 text-[11px]" : "mt-0.5 text-[8px]",
          )}
        >
          Senior Living
        </div>
      </div>
    </div>
  );
}
