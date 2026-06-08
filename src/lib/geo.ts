// ============================================================================
// Geolocalização do ponto (controle interno/gerencial).
//
// LIMITES (importante):
// - Este ponto NÃO é ponto eletrônico legal (não substitui o ponto físico
//   oficial das CLT — Portaria 671 MTE). É apenas controle interno.
// - GPS tem imprecisão, especialmente dentro de prédios; por isso o raio é
//   generoso (150m) e, ainda assim, pode falhar (há ajuste manual da
//   Coordenação como plano B).
// ============================================================================

/** Coordenadas e raio do estabelecimento (config simples no código). */
export const ESTABELECIMENTO = {
  latitude: -25.4492655955608,
  longitude: -49.333218372840456,
  raioCheckinMetros: 150,
} as const;

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (g: number) => (g * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Obtém a posição atual do navegador (Promise). */
export function obterPosicaoAtual(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este dispositivo não suporta geolocalização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

/** Mensagem amigável para erros de geolocalização. */
export function mensagemErroGeo(err: unknown): string {
  if (typeof GeolocationPositionError !== "undefined" && err instanceof GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) {
      return "O registro de ponto precisa do acesso à sua localização. Permita a localização e tente novamente.";
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      return "Não foi possível obter sua localização agora. Tente novamente em alguns segundos.";
    }
    if (err.code === err.TIMEOUT) {
      return "A localização demorou para responder. Tente novamente.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Não foi possível obter sua localização.";
}
