import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { useAtualizarMeuNome, useAtualizarMinhaSenha } from "@/hooks/useMeuPerfil";

// ===========================================================================
// "Editar meu perfil" — disponível em TODOS os acessos. Permite trocar o NOME
// de exibição e/ou a SENHA do próprio usuário. A senha é opcional: em branco,
// só o nome é salvo. Sem dependências de modal externas (mesmo padrão do
// ConfirmDialog): fecha no Esc/fundo, botões grandes p/ tablet.
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const SENHA_MIN = 6;

export function EditarPerfilDialog({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { usuario, recarregarUsuario } = useAuth();
  const atualizarNome = useAtualizarMeuNome();
  const atualizarSenha = useAtualizarMinhaSenha();

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Reidrata os campos sempre que (re)abrir, partindo do nome atual.
  useEffect(() => {
    if (aberto) {
      setNome(usuario?.nome ?? "");
      setSenha("");
      setConfirmar("");
      setErro(null);
    }
  }, [aberto, usuario?.nome]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const salvando = atualizarNome.isPending || atualizarSenha.isPending;
  const nomeLimpo = nome.trim();
  const nomeMudou = nomeLimpo !== "" && nomeLimpo !== (usuario?.nome ?? "");
  const querTrocarSenha = senha !== "" || confirmar !== "";

  async function salvar() {
    setErro(null);

    if (nomeLimpo === "") {
      setErro("O nome de exibição não pode ficar vazio.");
      return;
    }
    if (querTrocarSenha) {
      if (senha.length < SENHA_MIN) {
        setErro(`A nova senha precisa ter ao menos ${SENHA_MIN} caracteres.`);
        return;
      }
      if (senha !== confirmar) {
        setErro("A confirmação não confere com a nova senha.");
        return;
      }
    }
    if (!nomeMudou && !querTrocarSenha) {
      onFechar();
      return;
    }

    try {
      if (nomeMudou) {
        await atualizarNome.mutateAsync(nomeLimpo);
        await recarregarUsuario();
      }
      if (querTrocarSenha) {
        await atualizarSenha.mutateAsync(senha);
      }
      toast.success(
        nomeMudou && querTrocarSenha
          ? "Nome e senha atualizados."
          : querTrocarSenha
            ? "Senha atualizada."
            : "Nome de exibição atualizado.",
      );
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar as alterações.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar meu perfil"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onFechar}
        className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <UserCog className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-secondary">Meu perfil</h2>
            <p className="text-sm text-muted-foreground">Nome de exibição e senha de acesso.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary" htmlFor="perfil-nome">
              Nome de exibição
            </label>
            <input
              id="perfil-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              autoComplete="name"
              className={inputBase}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <p className="text-sm font-semibold text-secondary">
              Trocar senha{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary" htmlFor="perfil-senha">
                Nova senha
              </label>
              <input
                id="perfil-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={salvando}
                autoComplete="new-password"
                placeholder={`Mínimo ${SENHA_MIN} caracteres`}
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary" htmlFor="perfil-senha2">
                Confirmar nova senha
              </label>
              <input
                id="perfil-senha2"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                disabled={salvando}
                autoComplete="new-password"
                className={inputBase}
              />
            </div>
          </div>

          {erro && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {erro}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" />}
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
