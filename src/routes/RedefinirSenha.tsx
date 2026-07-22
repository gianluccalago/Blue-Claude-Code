import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, AlertCircle, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

// ===========================================================================
// REDEFINIR SENHA — destino do link "Esqueci minha senha" enviado por e-mail
// (Supabase Auth). O token chega na URL; o cliente (detectSessionInUrl)
// estabelece a sessão de recuperação e esta página troca a senha
// (auth.updateUser). Link inválido/expirado → aviso para pedir outro.
// ===========================================================================

const SENHA_MIN = 8;

export function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"aguardando" | "pronto" | "invalido" | "concluido">("aguardando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // O detectSessionInUrl processa o token do link; quando a sessão de
    // recuperação existe, liberamos o formulário. Sem sessão em ~6s → o link
    // é inválido/expirado (ou a página foi aberta direto).
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!vivo) return;
      if (evento === "PASSWORD_RECOVERY" || sessao) setEstado((p) => (p === "concluido" ? p : "pronto"));
    });
    supabase.auth.getSession().then(({ data }) => {
      if (vivo && data.session) setEstado((p) => (p === "concluido" ? p : "pronto"));
    });
    const t = setTimeout(() => {
      if (vivo) setEstado((p) => (p === "aguardando" ? "invalido" : p));
    }, 6000);
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MIN) {
      setErro(`A nova senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setEstado("concluido");
      toast.success("Senha redefinida com sucesso.");
      // Sessão já está ativa — entra direto no app.
      setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setSalvando(false);
    }
  }

  const inputBase =
    "h-12 w-full rounded-md border border-input bg-white/80 px-3.5 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="safe-top safe-bottom flex min-h-screen w-full items-center justify-center bg-app-mesh px-6 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo stacked />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-secondary">Redefinir senha</h1>
        </div>

        <div className="rounded-lg border border-white/50 bg-white/70 p-7 shadow-cinematic backdrop-blur-xl">
          {estado === "aguardando" && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Validando o link de recuperação…
            </p>
          )}

          {estado === "invalido" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="size-6" />
              </div>
              <p className="text-sm text-secondary">
                Este link de recuperação é <span className="font-semibold">inválido ou expirou</span>.
                Peça um novo em “Esqueci minha senha” na tela de entrada.
              </p>
              <Button className="w-full" size="lg" onClick={() => navigate({ to: "/" })}>Voltar para o login</Button>
            </div>
          )}

          {estado === "pronto" && (
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-secondary">Nova senha</label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={`Mínimo ${SENHA_MIN} caracteres`}
                  className={inputBase}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-secondary">Confirmar nova senha</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Repita a nova senha"
                  className={inputBase}
                />
              </div>
              {erro && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" loading={salvando} disabled={senha === "" || confirmar === ""}>
                <KeyRound className="size-5" /> Salvar nova senha
              </Button>
            </form>
          )}

          {estado === "concluido" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
                <Check className="size-6" />
              </div>
              <p className="text-sm text-secondary">Senha redefinida! Entrando…</p>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary-strong" />
          Link de uso único, com validade limitada.
        </p>
      </div>
    </div>
  );
}
