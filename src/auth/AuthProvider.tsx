import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setUsuarioAtual } from "@/auth/usuarioAtual";
import type { Usuario } from "@/types/database";

// ===========================================================================
// Autenticação (Supabase Auth, email/senha).
//
// O login usa Supabase Auth; o PERFIL e os dados do usuário vêm da tabela
// `usuarios`, ligada por EMAIL (sem mexer em usuarios.id, que é referenciado
// por cuidador_residente/turnos/registros). Usuário inativo NÃO loga.
//
// SEGURANÇA: as travas de verdade estão no banco (RLS) — ver
// supabase/migrations/0015_auth_rls.sql. Aqui é a camada de sessão/interface.
// ===========================================================================

interface AuthState {
  session: Session | null;
  usuario: Usuario | null;
  /** Resolvendo a sessão/usuário inicial. */
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Busca a linha de `usuarios` ATIVA pelo email autenticado (case-insensitive). */
async function resolverUsuario(email: string | undefined): Promise<Usuario | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .ilike("email", email)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    // Não vaza detalhe ao usuário; loga para diagnóstico.
    console.error("Falha ao resolver usuário:", error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;

    async function aplicar(s: Session | null) {
      const u = s ? await resolverUsuario(s.user.email ?? undefined) : null;
      if (!vivo) return;
      setSession(s);
      setUsuario(u);
      setUsuarioAtual(
        u
          ? { id: u.id, nome: u.nome, perfil: u.perfil, residenteVinculado: u.residente_vinculado }
          : null,
      );
      setCarregando(false);
    }

    // Sessão inicial (persistida em localStorage).
    supabase.auth.getSession().then(({ data }) => aplicar(data.session));

    // Mudanças de sessão (login/logout/refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      aplicar(s);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      // Loga a causa real (ex: credencial inexistente, e-mail não confirmado)
      // para diagnóstico; ao usuário mostramos uma mensagem genérica.
      console.error("Falha no login:", error.message);
      throw new Error("E-mail ou senha inválidos.");
    }

    // Confere se há um usuário ATIVO correspondente; senão, derruba a sessão.
    const u = await resolverUsuario(data.user?.email ?? undefined);
    if (!u) {
      await supabase.auth.signOut();
      throw new Error("Usuário inativo ou não cadastrado. Acesso negado.");
    }
    // O onAuthStateChange também aplica; aqui garantimos o estado imediato.
    setSession(data.session);
    setUsuario(u);
    setUsuarioAtual({
      id: u.id,
      nome: u.nome,
      perfil: u.perfil,
      residenteVinculado: u.residente_vinculado,
    });
    setCarregando(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    setSession(null);
    setUsuario(null);
    setUsuarioAtual(null);
  }

  return (
    <AuthContext.Provider value={{ session, usuario, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
