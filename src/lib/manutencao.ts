import type { DestinoChamado } from "@/types/database";

// Destino de um chamado de manutenção: quem trata. A escolha é feita na
// abertura (e na não-conformidade da inspeção). Reutilizado pelo formulário,
// pelas telas de gestão (Hotelaria/Serviços Gerais) e pela supervisão da
// Administração.

export const DESTINO_CHAMADO: { value: DestinoChamado; label: string; dica: string }[] = [
  {
    value: "servicos_gerais",
    label: "Serviços Gerais",
    dica: "Elétrica, hidráulica, mobiliário, predial",
  },
  {
    value: "hotelaria",
    label: "Hotelaria",
    dica: "Limpeza, arrumação, governança",
  },
];

export const DESTINO_CHAMADO_LABEL: Record<DestinoChamado, string> = {
  servicos_gerais: "Serviços Gerais",
  hotelaria: "Hotelaria",
};

/** Destino do módulo de Manutenção a partir do perfil da rota (null = vê todos). */
export function destinoDoPerfil(perfil: string | undefined): DestinoChamado | null {
  if (perfil === "hotelaria") return "hotelaria";
  if (perfil === "servicos_gerais") return "servicos_gerais";
  return null;
}
