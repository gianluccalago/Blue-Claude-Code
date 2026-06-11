import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, LogOut, Glasses } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useUsuarios } from "@/hooks/useUsuarios";
import { getPerfil } from "@/data/profiles";
import { PERFIL_LABEL } from "@/data/perfisSistema";
import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// Barra do modo CAMALEÃO — visível só para o Master. Permite "ver como" qualquer
// usuário (assume a identidade efetiva, mantendo a sessão do Master). Quando
// ativo, mostra um aviso destacado e o botão para voltar ao Master.
// ===========================================================================

export function CamaleaoBar() {
  const { ehMaster, impersonado, usuario, personificar } = useAuth();
  const usuarios = useUsuarios();
  const navigate = useNavigate();

  // Usuários ativos, exceto o próprio Master logado, agrupados por perfil.
  const porPerfil = useMemo(() => {
    const grupos = new Map<PerfilUsuario, { id: string; nome: string }[]>();
    for (const u of usuarios.data ?? []) {
      if (!u.ativo || u.id === usuario?.id) continue;
      const arr = grupos.get(u.perfil) ?? [];
      arr.push({ id: u.id, nome: u.nome });
      grupos.set(u.perfil, arr);
    }
    return [...grupos.entries()].sort((a, b) =>
      PERFIL_LABEL[a[0]].localeCompare(PERFIL_LABEL[b[0]], "pt-BR"),
    );
  }, [usuarios.data, usuario?.id]);

  if (!ehMaster) return null;

  function verComo(id: string) {
    const u = (usuarios.data ?? []).find((x) => x.id === id);
    if (!u) return;
    personificar(u);
    const destino = getPerfil(u.perfil)?.rotaInicial ?? `/app/${u.perfil}`;
    navigate({ to: destino });
  }

  function voltarAoMaster() {
    personificar(null);
    navigate({ to: "/app/master" });
  }

  if (impersonado) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/15 px-6 py-2 text-sm">
        <span className="flex items-center gap-2 font-semibold text-warning-foreground">
          <Eye className="size-4" />
          Modo Camaleão — vendo como{" "}
          <span className="font-bold">{impersonado.nome}</span>
          <span className="rounded-full bg-warning/30 px-2 py-0.5 text-xs">
            {PERFIL_LABEL[impersonado.perfil]}
          </span>
        </span>
        <button
          onClick={voltarAoMaster}
          className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-card px-3 py-1.5 text-xs font-semibold text-secondary transition-colors hover:bg-accent"
        >
          <LogOut className="size-3.5" /> Voltar ao Master
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-6 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
        <Glasses className="size-4" /> Camaleão · ver como
      </span>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) verComo(e.target.value);
          e.currentTarget.value = "";
        }}
        className="h-8 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Selecione um usuário…</option>
        {porPerfil.map(([perfil, lista]) => (
          <optgroup key={perfil} label={PERFIL_LABEL[perfil]}>
            {lista.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        (você continua logado como Master)
      </span>
    </div>
  );
}
