import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { urlAssinadaStorage } from "@/lib/storage";

// ===========================================================================
// Exibição SEGURA de anexos de bucket privado (fotos de idosos, comprovantes).
// O valor guardado (caminho novo ou URL pública legada) é resolvido para uma
// URL ASSINADA temporária. Nunca serve conteúdo sem autenticação.
// ===========================================================================

const VALIDADE_SEGUNDOS = 3600; // 1h

/** URL assinada para um valor guardado num bucket privado. */
export function useUrlAssinada(bucket: string, stored: string | null | undefined) {
  return useQuery({
    queryKey: ["url-assinada", bucket, stored ?? null],
    enabled: !!stored,
    // Reassina antes de expirar (evita imagem quebrada por URL vencida).
    staleTime: (VALIDADE_SEGUNDOS - 300) * 1000,
    gcTime: VALIDADE_SEGUNDOS * 1000,
    retry: 1,
    queryFn: () => urlAssinadaStorage(bucket, stored, VALIDADE_SEGUNDOS),
  });
}

/**
 * `<img>` de um anexo em bucket privado. Enquanto resolve (ou se falhar),
 * mostra `fallback`. Uso: <FotoSegura bucket={...} stored={foto_url} .../>.
 */
export function FotoSegura({
  bucket,
  stored,
  alt,
  className,
  fallback = null,
}: {
  bucket: string;
  stored: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const { data: url } = useUrlAssinada(bucket, stored);
  if (stored && url) return <img src={url} alt={alt} className={className} />;
  return <>{fallback}</>;
}

/**
 * Render-prop para casos com markup próprio (links, thumbnails dentro de `<a>`).
 * Recebe a URL assinada resolvida e renderiza o conteúdo. Enquanto resolve/em
 * falha, mostra `fallback` (por padrão nada). Seguro dentro de listas/maps.
 */
export function AnexoSeguro({
  bucket,
  stored,
  children,
  fallback = null,
}: {
  bucket: string;
  stored: string | null | undefined;
  children: (url: string) => ReactNode;
  fallback?: ReactNode;
}) {
  const { data: url } = useUrlAssinada(bucket, stored);
  if (stored && url) return <>{children(url)}</>;
  return <>{fallback}</>;
}
