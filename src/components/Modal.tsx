import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ===========================================================================
// MODAL ÚNICO do app (UX-02). Um só componente concentra o que todo diálogo
// precisa e que estava copiado (ou faltando) em dezenas de telas:
//   • portal no <body> — nenhum ancestral com transform/filter "prende" o fixed;
//   • centralizado, mas com ROLAGEM PRÓPRIA quando o conteúdo é maior que a
//     tela (celular): `items-start` + `overflow-y-auto` no contêiner e
//     `my-auto` na caixa;
//   • fecha no Esc (só o diálogo do TOPO, quando há um aninhado) e no fundo;
//   • prende o foco (Tab/Shift+Tab ciclam dentro da caixa) e DEVOLVE o foco ao
//     elemento que abriu o diálogo quando fecha;
//   • `aria-labelledby` no título, botão Fechar com `aria-label`;
//   • trava o scroll do body enquanto houver algum modal aberto.
// Uso: {aberto && <Modal titulo="…" onFechar={…}>…</Modal>} ou com `aberto`.
// ===========================================================================

const SELETOR_FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pilha de modais abertos: só o do topo reage ao Esc; o scroll do body volta
// quando o ÚLTIMO fecha (ex.: ConfirmDialog aberto por cima de um formulário).
const pilha: string[] = [];
let overflowAnterior: string | null = null;

function empilhar(id: string) {
  if (pilha.length === 0) {
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  pilha.push(id);
}

function desempilhar(id: string) {
  const i = pilha.lastIndexOf(id);
  if (i >= 0) pilha.splice(i, 1);
  if (pilha.length === 0 && overflowAnterior !== null) {
    document.body.style.overflow = overflowAnterior;
    overflowAnterior = null;
  }
}

function focaveisDentro(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS)).filter(
    (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
  );
}

const LARGURAS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;

export interface ModalProps {
  /** Padrão true — permite tanto `{x && <Modal/>}` quanto `<Modal aberto={x}/>`. */
  aberto?: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  /** Texto de apoio abaixo do título (vira `aria-describedby`). */
  descricao?: ReactNode;
  /** Ícone à esquerda do título. */
  icone?: ReactNode;
  children?: ReactNode;
  /** Área dos botões (já vem com espaçamento). */
  rodape?: ReactNode;
  tamanho?: keyof typeof LARGURAS;
  /** Classes extras da CAIXA (não do fundo). */
  className?: string;
  /** Camada: diálogo aninhado (ex.: confirmação) usa um z-index maior. */
  zIndex?: number;
  /** Clique no fundo fecha (padrão true). Desligue em fluxos que não podem ser perdidos. */
  fecharNoFundo?: boolean;
  /** Mostra o "X" no canto (padrão true). */
  botaoFechar?: boolean;
}

export function Modal({
  aberto = true,
  onFechar,
  titulo,
  descricao,
  icone,
  children,
  rodape,
  tamanho = "md",
  className,
  zIndex = 50,
  fecharNoFundo = true,
  botaoFechar = true,
}: ModalProps) {
  const id = useId();
  const idTitulo = `${id}-titulo`;
  const idDescricao = `${id}-descricao`;
  const caixaRef = useRef<HTMLDivElement>(null);
  // O clique no fundo só fecha se o mousedown TAMBÉM começou no fundo — arrastar
  // uma seleção de texto de dentro da caixa para fora não pode fechar o diálogo.
  const mousedownNoFundo = useRef(false);
  // Sempre a versão mais recente do callback, sem religar os listeners.
  const onFecharRef = useRef(onFechar);
  onFecharRef.current = onFechar;

  useEffect(() => {
    if (!aberto) return;
    const caixa = caixaRef.current;
    if (!caixa) return;

    const elementoAnterior = document.activeElement as HTMLElement | null;
    empilhar(id);

    // Foco inicial: respeita um autoFocus já aplicado pelo React; senão, o
    // primeiro elemento focável; em último caso, a própria caixa.
    if (!caixa.contains(document.activeElement)) {
      const alvo = caixa.querySelector<HTMLElement>("[data-autofocus]") ?? focaveisDentro(caixa)[0] ?? caixa;
      alvo.focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== id) return; // só o modal do topo reage
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onFecharRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focaveis = focaveisDentro(caixa);
      if (focaveis.length === 0) {
        e.preventDefault();
        caixa.focus();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const atual = document.activeElement as HTMLElement | null;
      if (!atual || !caixa.contains(atual)) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primeiro).focus();
      } else if (e.shiftKey && atual === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      desempilhar(id);
      // Devolve o foco a quem abriu o diálogo (se ainda estiver na página).
      if (elementoAnterior && elementoAnterior.isConnected && typeof elementoAnterior.focus === "function") {
        elementoAnterior.focus({ preventScroll: true });
      }
    };
  }, [aberto, id]);

  if (!aberto) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex animate-fade-in items-start justify-center overflow-y-auto overscroll-contain bg-secondary/40 p-4 backdrop-blur-sm sm:items-center"
      style={{ zIndex }}
      onMouseDown={(e) => {
        mousedownNoFundo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (fecharNoFundo && mousedownNoFundo.current && e.target === e.currentTarget) onFechar();
        mousedownNoFundo.current = false;
      }}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        tabIndex={-1}
        className={cn(
          "relative my-auto w-full animate-modal-in rounded-lg border bg-card p-6 shadow-lifted outline-none",
          LARGURAS[tamanho],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={idTitulo} className="flex items-center gap-2 text-lg font-bold text-secondary">
              {icone}
              {titulo}
            </h2>
            {descricao && (
              <p id={idDescricao} className="mt-1 text-sm text-muted-foreground">
                {descricao}
              </p>
            )}
          </div>
          {botaoFechar && (
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-secondary"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        {children && <div className="mt-4">{children}</div>}
        {rodape && <div className="mt-6 flex gap-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}
