import { useEffect, useRef } from "react";

// ===========================================================================
// Cloudflare Turnstile (CAPTCHA) — proteção anti-robô do login/recuperação.
// LIGÁVEL POR CONFIGURAÇÃO: só renderiza (e só carrega o script) quando
// VITE_TURNSTILE_SITE_KEY estiver definida no build. Com a chave ativa,
// habilite também "Captcha protection" (Turnstile + secret key) no painel do
// Supabase (Auth → Settings) — o GoTrue passa a EXIGIR o token no servidor.
// Para forçar um novo desafio após uma falha, remonte com uma `key` diferente.
// ===========================================================================

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/** O CAPTCHA está configurado neste build? */
export const captchaAtivo = !!SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;

    let vivo = true;
    function renderizar() {
      if (!vivo || !ref.current || widgetId.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        theme: "light",
        language: "pt-BR",
      });
    }

    if (window.turnstile) {
      renderizar();
    } else {
      const idScript = "cf-turnstile-script";
      if (!document.getElementById(idScript)) {
        const s = document.createElement("script");
        s.id = idScript;
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        document.head.appendChild(s);
      }
      const t = setInterval(() => {
        if (window.turnstile) {
          clearInterval(t);
          renderizar();
        }
      }, 150);
      return () => {
        vivo = false;
        clearInterval(t);
        if (widgetId.current) window.turnstile?.remove(widgetId.current);
      };
    }
    return () => {
      vivo = false;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
    // onToken é estável o bastante no uso (setState) — remontagens são por `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
