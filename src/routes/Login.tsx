import { useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { LogIn, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getPerfil } from "@/data/profiles";

// ===========================================================================
// Tela de LOGIN (substitui a antiga seleção livre de perfil). Email + senha
// via Supabase Auth. Após autenticar, o usuário é direcionado DIRETO às telas
// do seu perfil (sem escolha de perfil). Usuário inativo não loga.
// ===========================================================================

/** Logo do topo: usa a arte oficial em /logo.png; se faltar, cai no lockup SVG. */
function HeroLogo() {
  const [usarOficial, setUsarOficial] = useState(true);
  if (usarOficial) {
    return (
      <img
        src="/logo.png"
        alt="Blue Senior Living"
        className="h-28 w-auto object-contain sm:h-32"
        onError={() => setUsarOficial(false)}
      />
    );
  }
  return <Logo stacked />;
}

export function Login() {
  const { usuario, carregando, entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Já autenticado → vai direto para as telas do perfil.
  if (!carregando && usuario) {
    const destino = getPerfil(usuario.perfil)?.rotaInicial ?? `/app/${usuario.perfil}`;
    return <Navigate to={destino} />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      // O redirecionamento acontece reativamente quando `usuario` resolve.
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  const inputBase =
    "h-12 w-full rounded-md border border-input bg-card px-3.5 text-sm transition-colors duration-200 placeholder:text-muted-foreground/70 hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* Camada decorativa: halos celestes sutis, identidade sem ruído */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-80 w-80 rounded-full bg-accent blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <HeroLogo />
          <div className="mt-6 h-1 w-16 rounded-full bg-primary" />
          <p className="mt-5 text-muted-foreground">Entre com seu e-mail e senha</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-border/60 bg-card/95 p-7 shadow-lifted backdrop-blur-sm"
        >
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">E-mail</label>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@blueseniorliving.com.br"
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••"
              className={inputBase}
            />
          </div>

          {erro && (
            <div className="flex animate-fade-in items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={enviando || email.trim() === "" || senha === ""}
          >
            {enviando ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
            {enviando ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary-strong" />
          Acesso restrito à equipe e familiares cadastrados pela administração.
        </p>
      </div>
    </div>
  );
}
