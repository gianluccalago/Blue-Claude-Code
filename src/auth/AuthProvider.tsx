import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setUsuarioAtual } from "@/auth/usuarioAtual";
import type { Usuario } from "@/types/database";

// ===========================================================================
// Autenticação (Supabase Auth, email/senha) + modo CAMALEÃO.
//
// Login: Supabase Auth; o PERFIL/dados vêm da tabela `usuarios`, ligada por
// EMAIL. Usuário inativo NÃO loga. As travas de dados estão no banco (RLS).
//
// CAMALEÃO: o Master pode "assumir a visão" de qualquer usuário para ver as
// telas/dados daquele perfil sem deslogar. A SESSÃO continua sendo a do Master
// (por isso o RLS — que dá acesso total ao Master — permite ler tudo); o que
// muda é a IDENTIDADE efetiva que os hooks usam para filtrar (id do cuidador,
// residente vinculado da família, etc.). Só o Master pode personificar.
// ===========================================================================

interface AuthState {
  session: Session | null;
  /** Usuário REAL autenticado. */
  usuario: Usuario | null;
  /** Usuário sendo personificado pelo Master (Camaleão), ou null. */
  impersonado: Usuario | null;
  /** Identidade EFETIVA (personificado, se houver; senão o real). */
  usuarioEfetivo: Usuario | null;
  /** O usuário REAL é Master? (quem pode usar o Camaleão) */
  ehMaster: boolean;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  /** Master assume a visão de `u` (ou null para voltar ao Master). */
  personificar: (u: Usuario | null) => void;
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
    console.error("Falha ao resolver usuário:", error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [impersonado, setImpersonado] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const ehMaster = usuario?.perfil === "master";
  const usuarioEfetivo = impersonado ?? usuario;

  // Mantém a identidade usada pelos hooks (usuarioAtual) sempre igual à efetiva.
  useEffect(() => {
    setUsuarioAtual(
      usuarioEfetivo
        ? {
            id: usuarioEfetivo.id,
            nome: usuarioEfetivo.nome,
            perfil: usuarioEfetivo.perfil,
            residenteVinculado: usuarioEfetivo.residente_vinculado,
          }
        : null,
    );
  }, [usuarioEfetivo]);

  useEffect(() => {
    let vivo = true;

    async function aplicar(s: Session | null) {
      const u = s ? await resolverUsuario(s.user.email ?? undefined) : null;
      if (!vivo) return;
      setSession(s);
      setUsuario(u);
      setImpersonado(null); // troca de sessão zera o Camaleão
      setCarregando(false);
    }

    supabase.auth.getSession().then(({ data }) => aplicar(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => aplicar(s));

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
      console.error("Falha no login:", error.message);
      throw new Error("E-mail ou senha inválidos.");
    }
    const u = await resolverUsuario(data.user?.email ?? undefined);
    if (!u) {
      await supabase.auth.signOut();
      throw new Error("Usuário inativo ou não cadastrado. Acesso negado.");
    }
    setSession(data.session);
    setUsuario(u);
    setImpersonado(null);
    setCarregando(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    setSession(null);
    setUsuario(null);
    setImpersonado(null);
  }

  function personificar(u: Usuario | null) {
    // Só o Master pode personificar; nunca a si mesmo.
    if (usuario?.perfil !== "master") return;
    setImpersonado(u && u.id !== usuario.id ? u : null);
  }

  const valor = useMemo<AuthState>(
    () => ({
      session,
      usuario,
      impersonado,
      usuarioEfetivo,
      ehMaster,
      carregando,
      entrar,
      sair,
      personificar,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, usuario, impersonado, usuarioEfetivo, ehMaster, carregando],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
