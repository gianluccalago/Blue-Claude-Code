import { cn } from "@/lib/utils";

/**
 * Bloco de carregamento com shimmer sutil — usar no lugar do spinner seco
 * quando a tela tem estrutura previsível (listas, cards, tabelas).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent after:[animation:shimmer_1.6s_infinite]",
        className,
      )}
      {...props}
    />
  );
}
