import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Mensagem clara para quem está começando — falta configurar o .env.local
  throw new Error(
    "Variáveis do Supabase ausentes. Copie .env.example para .env.local e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  // Autenticação real (email/senha): mantém a sessão em localStorage e renova
  // o token automaticamente. As travas de acesso ficam no banco via RLS.
  // detectSessionInUrl: o link de RECUPERAÇÃO DE SENHA enviado por e-mail
  // chega com o token na URL (/redefinir-senha#access_token=…) — o cliente
  // precisa detectá-lo para estabelecer a sessão de recuperação.
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
