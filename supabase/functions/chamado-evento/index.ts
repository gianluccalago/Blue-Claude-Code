// ===========================================================================
// Edge Function "chamado-evento" — recebe os eventos da central de chamados
// (botão, corda, botão de presença e sinal de vida) e registra pela RPC
// registrar_evento_chamado (service_role). O horário oficial é o do servidor.
//
// Contrato (ajustar ao aparelho escolhido — ver docs/chamados-integracao.md):
//   POST /functions/v1/chamado-evento
//   Cabeçalho: x-central-token: <token gerado em "Tags e tablets" › Central>
//   Corpo: um evento ou uma lista de eventos:
//     { "evento_id": "abc-123", "dispositivo": "BTN-5106", "tipo": "acionamento", "ocorrido_em": "2026-09-30T02:10:00Z" }
//     { "tipo": "sinal" }   ← sinal de vida, a cada 1 minuto
//
// Publicação: Supabase → Edge Functions → Deploy new function → nome
// "chamado-evento", com este index.ts. Sem secrets: o token da central é
// validado pelo hash guardado no banco. Marque "no JWT verification": a
// central não tem login do Supabase; quem autentica é o token.
// ===========================================================================
async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cabeçalhos com a chave de serviço (JWT antigo "eyJ…" ou chave nova "sb_secret_…"). */
function cabecalhosServico(chave: string): Record<string, string> {
  const h: Record<string, string> = { apikey: chave, "Content-Type": "application/json" };
  if (chave.startsWith("eyJ")) h.Authorization = `Bearer ${chave}`;
  return h;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("use POST", { status: 405 });
  try {
    const token = req.headers.get("x-central-token") ?? "";
    if (!token) return Response.json({ ok: false, resultado: "sem_token" }, { status: 401 });
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !chave) return Response.json({ ok: false, resultado: "erro_servidor", mensagem: "variáveis do Supabase ausentes" }, { status: 500 });

    let corpo: unknown;
    try {
      corpo = await req.json();
    } catch {
      return Response.json({ ok: false, resultado: "json_invalido" }, { status: 400 });
    }
    const eventos = (Array.isArray(corpo) ? corpo : [corpo]) as Record<string, unknown>[];
    const hash = await sha256Hex(token);

    const resultados: unknown[] = [];
    for (const e of eventos.slice(0, 100)) {
      const r = await fetch(`${url}/rest/v1/rpc/registrar_evento_chamado`, {
        method: "POST",
        headers: cabecalhosServico(chave),
        body: JSON.stringify({
          p: {
            central_token_hash: hash,
            evento_id: e.evento_id ?? null,
            dispositivo: e.dispositivo ?? null,
            tipo: e.tipo ?? "acionamento",
            ocorrido_em: e.ocorrido_em ?? null,
          },
        }),
      });
      const dados = await r.json().catch(() => null);
      resultados.push(r.ok ? dados : { ok: false, resultado: "erro_servidor", mensagem: (dados as { message?: string } | null)?.message ?? `HTTP ${r.status}` });
    }
    const status = resultados.some((r) => (r as { resultado?: string }).resultado === "central_invalida") ? 401 : 200;
    return Response.json(Array.isArray(corpo) ? resultados : resultados[0], { status });
  } catch (e) {
    console.error("chamado-evento", e);
    return Response.json({ ok: false, resultado: "erro_servidor", mensagem: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
