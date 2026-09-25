import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";

/**
 * Diálogo de confirmação simples, pensado para uso em tablet: botões grandes,
 * linguagem direta. Construído sobre o Modal único do app (Esc, clique no
 * fundo, foco preso e devolvido, rolagem própria no celular). Abre numa camada
 * acima dos demais diálogos, pois costuma ser chamado de dentro de um formulário.
 * `children` (opcional) entra entre a descrição e os botões — ex.: um campo.
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
  children,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  varianteConfirmar?: "destructive" | "default" | "warning";
  onConfirmar: () => void;
  onCancelar: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onCancelar}
      titulo={titulo}
      descricao={descricao}
      tamanho="sm"
      zIndex={70}
      botaoFechar={false}
      rodape={
        <>
          <Button variant="outline" size="lg" className="flex-1" onClick={onCancelar} autoFocus>
            {textoCancelar}
          </Button>
          <Button variant={varianteConfirmar} size="lg" className="flex-1" onClick={onConfirmar}>
            {textoConfirmar}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
