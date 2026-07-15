import { useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogIn, Loader2, AlertCircle, ShieldCheck, HeartPulse, Sparkles, Users, KeyRound, UserPlus, X, Check, MailCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useSolicitarResetSenha, useSolicitarAcesso } from "@/hooks/useSolicitacoesAcesso";
import { Logo } from "@/components/Logo";
import { BrandMark } from "@/components/BrandMark";
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
        className="h-24 w-auto object-contain drop-shadow-sm sm:h-28"
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
  const [modal, setModal] = useState<null | "reset" | "acesso">(null);

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
    "h-12 w-full rounded-md border border-input bg-white/80 px-3.5 text-sm transition-colors duration-200 placeholder:text-muted-foreground/70 hover:border-primary/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      {/* ===== Painel esquerdo cinematográfico (≥lg) ===== */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-hero-navy p-12 text-white lg:flex xl:w-[55%]">
        {/* Auroras animadas */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/4 h-96 w-96 animate-aurora rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-[28rem] w-[28rem] animate-aurora-slow rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-1/4 top-0 h-72 w-72 animate-aurora rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative">
          <Logo className="text-white" />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="size-3.5" /> Rede de residenciais para idosos
          </span>
          <h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight">
            Quem cuida e quem ama,
            <span className="text-gradient-brand"> sempre conectados</span>.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            O portal das casas Blue Senior Living: aqui a nossa equipe registra
            cada cuidado do dia a dia, e as famílias acompanham tudo de perto,
            com transparência e carinho.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <FeaturePill icon={HeartPulse} texto="Cuidado em cada detalhe" />
            <FeaturePill icon={Users} texto="Família sempre por perto" />
            <FeaturePill icon={ShieldCheck} texto="Informações protegidas" />
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          © Blue Senior Living · Portal exclusivo da equipe e das famílias
        </p>
      </aside>

      {/* ===== Painel direito: formulário ===== */}
      <main className="safe-top safe-bottom relative flex w-full items-center justify-center bg-app-mesh px-6 py-12 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="lg:hidden">
              <HeroLogo />
            </div>
            <div className="mt-4 hidden size-16 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-primary lg:grid">
              <BrandMark className="h-10" />
            </div>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-secondary">Bem-vindo de volta</h1>
            <p className="mt-1.5 text-muted-foreground">Entre com seu e-mail e senha</p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border border-white/50 bg-white/70 p-7 shadow-cinematic backdrop-blur-xl"
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal("reset")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong hover:underline"
              >
                <KeyRound className="size-3.5" /> Esqueci minha senha
              </button>
              <button
                type="button"
                onClick={() => setModal("acesso")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:underline"
              >
                <UserPlus className="size-3.5" /> Solicitar acesso
              </button>
            </div>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary-strong" />
            Acesso restrito à equipe e familiares cadastrados pela administração.
          </p>
        </div>
      </main>

      {modal === "reset" && <ModalReset onFechar={() => setModal(null)} />}
      {modal === "acesso" && <ModalAcesso onFechar={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modais públicos: reset de senha e solicitação de acesso.
// ---------------------------------------------------------------------------

const modalInput =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CascaModal({ titulo, icone, onFechar, children }: { titulo: string; icone: React.ReactNode; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">{icone} {titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalReset({ onFechar }: { onFechar: () => void }) {
  const solicitar = useSolicitarResetSenha();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    try {
      await solicitar.mutateAsync(email.trim());
      setEnviado(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    }
  }

  return (
    <CascaModal titulo="Esqueci minha senha" icone={<KeyRound className="size-5 text-primary" />} onFechar={onFechar}>
      {enviado ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success"><Check className="size-6" /></div>
          <p className="text-sm text-secondary">
            Solicitação enviada. A administração vai <span className="font-semibold">redefinir sua senha</span> e informar você.
          </p>
          <Button className="w-full" onClick={onFechar}>Entendi</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Informe o e-mail do seu acesso. A administração recebe o pedido e redefine sua senha (os avisos por e-mail ainda não estão ativos).
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-secondary">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@blueseniorliving.com.br" className={modalInput} />
          </label>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onFechar} disabled={solicitar.isPending}>Cancelar</Button>
            <Button className="flex-1" onClick={enviar} loading={solicitar.isPending} disabled={email.trim() === ""}>Enviar solicitação</Button>
          </div>
        </div>
      )}
    </CascaModal>
  );
}

function ModalAcesso({ onFechar }: { onFechar: () => void }) {
  const solicitar = useSolicitarAcesso();
  const [tipo, setTipo] = useState<"familiar" | "colaborador">("familiar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [contato, setContato] = useState("");
  const [cargo, setCargo] = useState("");
  const [residenteNome, setResidenteNome] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviado, setEnviado] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valido = nome.trim() !== "" && emailValido && contato.trim() !== "" &&
    (tipo === "colaborador" ? cargo.trim() !== "" : residenteNome.trim() !== "");

  async function enviar() {
    try {
      await solicitar.mutateAsync({ tipo, nome: nome.trim(), email: email.trim(), contato, cargo, residenteNome, parentesco, observacao });
      setEnviado(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
    }
  }

  if (enviado) {
    return (
      <CascaModal titulo="Solicitar acesso" icone={<UserPlus className="size-5 text-primary" />} onFechar={onFechar}>
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success"><MailCheck className="size-6" /></div>
          <p className="text-sm text-secondary">
            Solicitação enviada para <span className="font-semibold">aprovação da administração</span>. Você receberá o acesso assim que for liberado.
          </p>
          <Button className="w-full" onClick={onFechar}>Entendi</Button>
        </div>
      </CascaModal>
    );
  }

  return (
    <CascaModal titulo="Solicitar acesso" icone={<UserPlus className="size-5 text-primary" />} onFechar={onFechar}>
      <div className="space-y-3">
        {/* Tipo */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {([["familiar", "Familiar"], ["colaborador", "Colaborador"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTipo(v)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tipo === v ? "bg-card text-secondary shadow-card" : "text-muted-foreground hover:text-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Nome completo</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={modalInput} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={modalInput} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Telefone / contato</span>
            <input value={contato} onChange={(e) => setContato(e.target.value)} className={modalInput} /></label>
        </div>

        {tipo === "colaborador" ? (
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Cargo / função</span>
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Cuidadora, Enfermeira, Recepcionista" className={modalInput} /></label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Hóspede que acompanha</span>
              <input value={residenteNome} onChange={(e) => setResidenteNome(e.target.value)} placeholder="Nome do residente" className={modalInput} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Parentesco</span>
              <input value={parentesco} onChange={(e) => setParentesco(e.target.value)} placeholder="Ex.: Filho(a), Cônjuge" className={modalInput} /></label>
          </div>
        )}

        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} className={`${modalInput} h-auto py-2`} /></label>

        {email.trim() !== "" && !emailValido && <p className="text-xs text-destructive">E-mail inválido.</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onFechar} disabled={solicitar.isPending}>Cancelar</Button>
          <Button className="flex-1" onClick={enviar} loading={solicitar.isPending} disabled={!valido}>Enviar solicitação</Button>
        </div>
      </div>
    </CascaModal>
  );
}

function FeaturePill({ icon: Icon, texto }: { icon: typeof HeartPulse; texto: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/85 backdrop-blur-sm">
      <Icon className="size-4 text-primary" /> {texto}
    </span>
  );
}
