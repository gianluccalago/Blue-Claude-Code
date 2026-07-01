import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { User, Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUrlAssinada } from "@/components/AnexoSeguro";

/**
 * Uploader de foto reutilizável (hóspedes E usuários). Faz o upload via a
 * função `onUpload` recebida (cada contexto usa seu bucket) e devolve o CAMINHO
 * do objeto por `onChange`. Quem consome decide o que fazer (gravar no banco ou
 * só no estado). `onChange(null)` = remover foto.
 *
 * `bucket` (privado): o `fotoUrl` recebido é o valor GUARDADO (caminho novo ou
 * URL pública legada) e é resolvido para URL ASSINADA na exibição. Após enviar,
 * mostra uma prévia local imediata. Erros são tratados com toast.
 */
export function FotoUploader({
  fotoUrl,
  bucket,
  nome,
  podeEditar,
  onUpload,
  onChange,
  tamanho = "size-24",
  formato = "rounded-2xl",
  iconeTamanho = "size-10",
}: {
  fotoUrl: string | null;
  bucket?: string;
  nome: string;
  podeEditar: boolean;
  onUpload: (file: File) => Promise<string | null>;
  onChange: (url: string | null) => void;
  tamanho?: string;
  formato?: string;
  iconeTamanho?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [previaLocal, setPreviaLocal] = useState<string | null>(null);

  // Exibição: bucket privado → URL assinada; sem bucket → usa o valor direto.
  const assinada = useUrlAssinada(bucket ?? "", bucket ? fotoUrl : null);
  const urlExibicao = previaLocal ?? (bucket ? assinada.data ?? null : fotoUrl);

  // Libera o objectURL da prévia ao trocar/desmontar.
  useEffect(() => {
    return () => {
      if (previaLocal) URL.revokeObjectURL(previaLocal);
    };
  }, [previaLocal]);

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      const url = await onUpload(file);
      if (!url) {
        toast.error("Não foi possível enviar a foto. Tente novamente.");
        return;
      }
      setPreviaLocal(URL.createObjectURL(file)); // feedback imediato
      onChange(url);
    } catch {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "grid place-items-center overflow-hidden bg-brand-gradient text-white shadow-glow-primary",
          tamanho,
          formato,
        )}
      >
        {urlExibicao ? (
          <img src={urlExibicao} alt={`Foto de ${nome}`} className="size-full object-cover" />
        ) : (
          <User className={iconeTamanho} />
        )}
      </div>

      {podeEditar && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="absolute -bottom-1.5 -right-1.5 grid size-9 place-items-center rounded-full border-2 border-card bg-secondary text-white shadow-card transition-colors hover:bg-secondary/90 disabled:opacity-60"
            aria-label="Trocar foto"
            title="Trocar foto"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          {urlExibicao && !enviando && (
            <button
              type="button"
              onClick={() => { setPreviaLocal(null); onChange(null); }}
              className="absolute -top-1.5 -right-1.5 grid size-7 place-items-center rounded-full border-2 border-card bg-destructive text-white shadow-card transition-colors hover:bg-destructive/90"
              aria-label="Remover foto"
              title="Remover foto"
            >
              <X className="size-3.5" />
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onArquivo} />
        </>
      )}
    </div>
  );
}
