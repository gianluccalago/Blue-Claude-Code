// ===========================================================================
// Leitura NFC no navegador (Web NFC, Chrome Android). Só LÊ: quem valida é a
// Edge Function verify-round. O parser da URL é o MESMO módulo usado no
// servidor (supabase/functions/verify-round/validacaoTag.ts).
// ===========================================================================
export { lerUrlNtag213, normalizarUid } from "../../supabase/functions/verify-round/validacaoTag";

export interface LeituraNfc {
  url: string | null;
  serialNumber: string | null;
}

export function nfcDisponivel(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

/** URL do primeiro registro "url" (ou texto com http) da mensagem NDEF. */
export function urlDaMensagem(msg: NDEFMessage): string | null {
  const dec = new TextDecoder();
  for (const r of msg.records) {
    if (!r.data) continue;
    if (r.recordType === "url" || r.recordType === "absolute-url") return dec.decode(r.data);
    if (r.recordType === "text") {
      const t = dec.decode(r.data);
      if (/^https?:\/\//.test(t)) return t;
    }
  }
  return null;
}

/**
 * Aguarda UM toque de tag. Resolve com a URL e o número de série; o
 * `signal` cancela a espera. Precisa ser chamado a partir de um toque na tela
 * (exigência do Chrome).
 */
export async function lerUmaTag(signal: AbortSignal): Promise<LeituraNfc> {
  if (!nfcDisponivel()) throw new Error("Este aparelho não lê NFC pelo navegador (use o Chrome no tablet Android).");
  const leitor = new NDEFReader();
  await leitor.scan({ signal });
  return new Promise<LeituraNfc>((resolve, reject) => {
    leitor.onreading = (ev) => resolve({ url: urlDaMensagem(ev.message), serialNumber: ev.serialNumber || null });
    leitor.onreadingerror = () => reject(new Error("Não consegui ler a etiqueta. Encoste de novo, sem mexer."));
    signal.addEventListener("abort", () => reject(new DOMException("cancelado", "AbortError")));
  });
}
