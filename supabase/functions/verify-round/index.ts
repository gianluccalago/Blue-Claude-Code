// ===========================================================================
// Edge Function "verify-round" — check-in NFC da ronda.
//
// Recebe do tablet: a URL lida da tag (NDEF), o serialNumber do Web NFC, e,
// no cabeçalho x-device-token, o token do tablet cadastrado. A cuidadora é
// identificada pelo login (JWT do Supabase no Authorization).
// Fila offline: manda também offline=true, capturado_em (relógio do tablet,
// só informativo) e o checklist já preenchido.
//
// 1) valida a leitura pelo módulo trocável validateTagRead (hoje "ntag213");
// 2) grava tudo pela RPC registrar_leitura_nfc (service_role, transação e
//    trava da tag): dispositivo, usuário, tag, contador, flags, rondas por
//    hóspede do quarto — sempre com o horário do SERVIDOR.
// Nenhuma chave de tag existe aqui (NTAG213 não tem criptografia). As
// variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do Supabase.
//
// Publicação: Supabase → Edge Functions → Deploy new function → nome
// "verify-round" (o endereço nasce do nome e não muda depois), com os
// arquivos index.ts e validacaoTag.ts (ou o arquivo único em docs/deploy).
// Em Settings, deixe "Verify JWT with legacy secret" DESLIGADO: a função
// confere o login ela mesma (auth.getUser abaixo) e recusa quem não estiver
// logado; ligado, projetos com as chaves novas do Supabase recusam o login.
// ===========================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateTagRead } from "./validacaoTag.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta(405, { ok: false, status: "metodo_invalido" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Quem: o login da cuidadora no tablet.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const email = auth.user?.email ?? null;
  if (!email) return resposta(401, { ok: false, status: "nao_autenticado" });

  let corpo: {
    url?: string;
    serial_number?: string | null;
    offline?: boolean;
    capturado_em?: string | null;
    checklist?: Record<string, unknown> | null;
  };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { ok: false, status: "rejeitada_payload" });
  }

  const leitura = await validateTagRead({ url: corpo.url, serialNumber: corpo.serial_number });
  const token = req.headers.get("x-device-token") ?? "";

  const { data, error } = await admin.rpc("registrar_leitura_nfc", {
    p: {
      email,
      device_token_hash: token ? await sha256Hex(token) : "",
      tag_uid: leitura.tagUid,
      contador: leitura.counter,
      valida: leitura.valid,
      motivo: leitura.motivo,
      flags: leitura.flags,
      implementacao: leitura.implementacao,
      offline: !!corpo.offline,
      capturado_em: corpo.capturado_em ?? null,
      checklist: corpo.checklist ?? null,
    },
  });
  if (error) return resposta(500, { ok: false, status: "erro_servidor", mensagem: error.message });
  // 200 também nas recusas: o app mostra o motivo e não tenta de novo.
  return resposta(200, data);
});
