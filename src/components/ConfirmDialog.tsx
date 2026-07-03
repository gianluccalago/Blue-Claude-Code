import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Diálogo de confirmação simples (sem dependências externas), pensado para
 * uso em tablet: botões grandes, linguagem direta, fecha no Esc ou no fundo.
 */
export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  textoConfirmar = "Sim",
  textoCancelar = "Cancelar",
  varianteConfirmar = "destructive",
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  varianteConfirmar?: "destructive" | "default" | "warning";
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* fundo */}
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancelar}
        className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm"
      />
      {/* caixa */}
      <div className="relative w-full max-w-sm animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
        {descricao && <p className="mt-1.5 text-sm text-muted-foreground">{descricao}</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onCancelar} autoFocus>
            {textoCancelar}
          </Button>
          <Button
            variant={varianteConfirmar}
            size="lg"
            className="flex-1"
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
