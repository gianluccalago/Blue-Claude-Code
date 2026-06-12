import { useRef, useState } from "react";
import { toast } from "sonner";
import { User, Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Uploader de foto reutilizável (hóspedes E usuários). Faz o upload via a
 * função `onUpload` recebida (cada contexto usa seu bucket) e devolve a URL
 * por `onChange`. Quem consome decide o que fazer com a URL (gravar direto no
 * banco ou só no estado de um formulário). `onChange(null)` = remover foto.
 * Erros de upload são tratados com toast; não quebram a tela.
 */
export function FotoUploader({
  fotoUrl,
  nome,
  podeEditar,
  onUpload,
  onChange,
  tamanho = "size-24",
  formato = "rounded-2xl",
  iconeTamanho = "size-10",
}: {
  fotoUrl: string | null;
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
        {fotoUrl ? (
          <img src={fotoUrl} alt={`Foto de ${nome}`} className="size-full object-cover" />
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
          {fotoUrl && !enviando && (
            <button
              type="button"
              onClick={() => onChange(null)}
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
