import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setUsuarioAtual, setUsuarioAutenticado } from "@/auth/usuarioAtual";
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
  entrar: (email: string, senha: string, captchaToken?: string) => Promise<void>;
  sair: () => Promise<void>;
  /** Recarrega o usuário REAL a partir do banco (ex.: após editar o perfil). */
  recarregarUsuario: () => Promise<void>;
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
  // "Registro de pessoal sem acesso" (sem_acesso) NÃO loga — só existe para
  // a tela Equipe e o custo de pessoal. (Checagem em JS p/ tolerar bancos sem
  // a coluna ainda; nesse caso sem_acesso é undefined → permite, como antes.)
  if (data && (data as { sem_acesso?: boolean }).sem_acesso) return null;
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
            registro: usuarioEfetivo.registro_profissional,
          }
        : null,
    );
  }, [usuarioEfetivo]);

  // Identidade REAL (ignora Camaleão) — autoria legal (ex.: médico prescritor).
  useEffect(() => {
    setUsuarioAutenticado(
      usuario
        ? {
            id: usuario.id,
            nome: usuario.nome,
            perfil: usuario.perfil,
            residenteVinculado: usuario.residente_vinculado,
            registro: usuario.registro_profissional,
          }
        : null,
    );
  }, [usuario]);

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
    // IMPORTANTE: o callback do onAuthStateChange roda DENTRO da trava interna
    // de auth do Supabase. Chamar supabase.from(...) aqui — o resolverUsuario
    // faz isso — prende essa trava, e o signInWithPassword (no `entrar`) nunca
    // resolve: o login fica "pendurado" e só entra após um refresh (quando o
    // caminho do getSession roda fora da trava). Adiamos com setTimeout(0) para
    // executar FORA do callback, liberando a trava imediatamente.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setTimeout(() => {
        if (vivo) aplicar(s);
      }, 0);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string, captchaToken?: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
      // Com "Captcha protection" ligada no Supabase, o token é OBRIGATÓRIO —
      // robôs que chamarem a API direto (sem resolver o desafio) são barrados.
      options: captchaToken ? { captchaToken } : undefined,
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

  // Recarrega a linha de `usuarios` do usuário autenticado (não mexe no
  // Camaleão). Usado após o próprio usuário editar nome/foto.
  async function recarregarUsuario() {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? undefined;
    if (!email) return;
    const u = await resolverUsuario(email);
    if (u) setUsuario(u);
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
      recarregarUsuario,
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
