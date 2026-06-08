import { cn } from "@/lib/utils";

/**
 * Emblema da marca Blue Senior Living — recriação vetorial elegante (vesica
 * entrelaçada) que herda a cor via `currentColor`. Para usar a arte oficial,
 * salve o arquivo em `public/logo.png` (a tela de seleção passa a usá-lo).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 150"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-current", className)}
      aria-hidden="true"
    >
      {/* vesica externa */}
      <path d="M50 8 C80 44 80 106 50 142 C20 106 20 44 50 8 Z" />
      {/* vesica interna */}
      <path d="M50 24 C68 50 68 100 50 126 C32 100 32 50 50 24 Z" strokeWidth={1.6} />
      {/* fios entrelaçados */}
      <path d="M50 16 C34 42 42 80 50 102" strokeWidth={1.6} />
      <path d="M50 16 C66 42 58 80 50 102" strokeWidth={1.6} />
      {/* laço inferior */}
      <path d="M50 102 C40 114 40 128 50 136 C60 128 60 114 50 102 Z" strokeWidth={1.6} />
      {/* gota superior */}
      <path d="M50 16 C45 24 45 32 50 38 C55 32 55 24 50 16 Z" strokeWidth={1.6} />
    </svg>
  );
}
