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
import { createClient } from "npm:@supabase/supabase-js@2";

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("use POST", { status: 405 });
  const token = req.headers.get("x-central-token") ?? "";
  if (!token) return Response.json({ ok: false, resultado: "sem_token" }, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ ok: false, resultado: "json_invalido" }, { status: 400 });
  }
  const eventos = (Array.isArray(corpo) ? corpo : [corpo]) as Record<string, unknown>[];
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const hash = await sha256Hex(token);

  const resultados = [];
  for (const e of eventos.slice(0, 100)) {
    const { data, error } = await admin.rpc("registrar_evento_chamado", {
      p: {
        central_token_hash: hash,
        evento_id: e.evento_id ?? null,
        dispositivo: e.dispositivo ?? null,
        tipo: e.tipo ?? "acionamento",
        ocorrido_em: e.ocorrido_em ?? null,
      },
    });
    resultados.push(error ? { ok: false, resultado: "erro_servidor", mensagem: error.message } : data);
  }
  const status = resultados.some((r) => (r as { resultado?: string }).resultado === "central_invalida") ? 401 : 200;
  return Response.json(Array.isArray(corpo) ? resultados : resultados[0], { status });
});
