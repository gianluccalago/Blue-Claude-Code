// ===========================================================================
// MAPA DO MÓDULO 5 — suítes do 1º andar (5101–5119) e do 2º (5201–5220).
// Coordenadas da proposta enviada (mapas-modulo-5.zip, versão 1), num quadro
// de 930 × 840. Numeração a partir do canto superior direito, seguindo o
// contorno: topo para a esquerda, lateral esquerda para baixo, base para a
// direita, lateral direita para cima. `porta` = lado voltado ao corredor.
// Esquemático, sem escala; a posição do leito dentro da suíte é ilustrativa.
// ===========================================================================

export type LadoPorta = "norte" | "sul" | "leste" | "oeste";

export interface SuiteMapa {
  codigo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  porta: LadoPorta;
}

export interface AndarMapa {
  andar: number;
  nivel: string;
  suites: SuiteMapa[];
}

export const MAPA_LARGURA = 930;
export const MAPA_ALTURA = 840;
/** Área central (circulação e áreas comuns), entre os quatro lados de suítes. */
export const MAPA_CENTRO = { x: 236, y: 262, w: 482, h: 356 };

export const MODULO_5: { modulo: number; andares: AndarMapa[] } = {
  modulo: 5,
  andares: [
  {
    andar: 1,
    nivel: "+7,70",
    suites: [
      { codigo: "5101", x: 725, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5102", x: 625, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5103", x: 525, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5104", x: 425, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5105", x: 325, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5106", x: 225, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5107", x: 125, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5108", x: 25, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5109", x: 51, y: 301, w: 170, h: 100, porta: "leste" },
      { codigo: "5110", x: 51, y: 401, w: 170, h: 100, porta: "leste" },
      { codigo: "5111", x: 51, y: 501, w: 170, h: 100, porta: "leste" },
      { codigo: "5112", x: 51, y: 601, w: 170, h: 100, porta: "leste" },
      { codigo: "5113", x: 107, y: 701, w: 170, h: 100, porta: "leste" },
      { codigo: "5114", x: 277, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5115", x: 477, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5116", x: 577, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5117", x: 677, y: 701, w: 170, h: 100, porta: "oeste" },
      { codigo: "5118", x: 733, y: 601, w: 170, h: 100, porta: "oeste" },
      { codigo: "5119", x: 733, y: 501, w: 170, h: 100, porta: "oeste" },
    ],
  },
  {
    andar: 2,
    nivel: "+10,70",
    suites: [
      { codigo: "5201", x: 725, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5202", x: 625, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5203", x: 525, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5204", x: 425, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5205", x: 325, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5206", x: 225, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5207", x: 125, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5208", x: 25, y: 75, w: 100, h: 170, porta: "sul" },
      { codigo: "5209", x: 51, y: 301, w: 170, h: 100, porta: "leste" },
      { codigo: "5210", x: 51, y: 401, w: 170, h: 100, porta: "leste" },
      { codigo: "5211", x: 51, y: 501, w: 170, h: 100, porta: "leste" },
      { codigo: "5212", x: 51, y: 601, w: 170, h: 100, porta: "leste" },
      { codigo: "5213", x: 107, y: 701, w: 170, h: 100, porta: "leste" },
      { codigo: "5214", x: 277, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5215", x: 377, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5216", x: 477, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5217", x: 577, y: 633, w: 100, h: 168, porta: "norte" },
      { codigo: "5218", x: 677, y: 701, w: 170, h: 100, porta: "oeste" },
      { codigo: "5219", x: 733, y: 601, w: 170, h: 100, porta: "oeste" },
      { codigo: "5220", x: 733, y: 501, w: 170, h: 100, porta: "oeste" },
    ],
  },
  ],
};
