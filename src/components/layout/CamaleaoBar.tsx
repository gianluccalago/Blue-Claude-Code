import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, LogOut, Glasses, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getPerfil } from "@/data/profiles";
import { PERFIL_LABEL } from "@/data/perfisSistema";
import type { PerfilUsuario, Usuario } from "@/types/database";

// ===========================================================================
// Barra do modo CAMALEÃO — visível só para o Master. Permite "ver como" qualquer
// usuário ativo (assume a identidade efetiva, mantendo a sessão do Master).
//
// Usa uma consulta PRÓPRIA (chave isolada, sempre fresca) para a lista de
// usuários, para não depender do cache de ["usuarios"] que a tela de Usuários
// invalida — evita o seletor ficar vazio por estado de cache.
// ===========================================================================

export function CamaleaoBar() {
  const { ehMaster, impersonado, usuario, personificar } = useAuth();
  const navigate = useNavigate();

  const usuariosQ = useQuery({
    queryKey: ["camaleao-usuarios"],
    enabled: ehMaster,
    staleTime: 0,
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      const lista = data ?? [];
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });

  // Usuários ativos, exceto o próprio Master logado, agrupados por perfil.
  const porPerfil = useMemo(() => {
    const grupos = new Map<PerfilUsuario, { id: string; nome: string }[]>();
    for (const u of usuariosQ.data ?? []) {
      if (u.id === usuario?.id) continue;
      const arr = grupos.get(u.perfil) ?? [];
      arr.push({ id: u.id, nome: u.nome });
      grupos.set(u.perfil, arr);
    }
    return [...grupos.entries()].sort((a, b) =>
      (PERFIL_LABEL[a[0]] ?? a[0]).localeCompare(PERFIL_LABEL[b[0]] ?? b[0], "pt-BR"),
    );
  }, [usuariosQ.data, usuario?.id]);

  if (!ehMaster) return null;

  function verComo(id: string) {
    const u = (usuariosQ.data ?? []).find((x) => x.id === id);
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
          Modo Camaleão — vendo como <span className="font-bold">{impersonado.nome}</span>
          <span className="rounded-full bg-warning/30 px-2 py-0.5 text-xs">
            {PERFIL_LABEL[impersonado.perfil] ?? impersonado.perfil}
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

  const total = usuariosQ.data?.length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-6 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
        <Glasses className="size-4" /> Camaleão · ver como
      </span>

      {usuariosQ.isLoading ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> carregando usuários…
        </span>
      ) : usuariosQ.error ? (
        <span className="text-xs font-semibold text-destructive">
          erro ao listar usuários: {(usuariosQ.error as Error).message}
        </span>
      ) : porPerfil.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          nenhum outro usuário ativo encontrado ({total} no total)
        </span>
      ) : (
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
            <optgroup key={perfil} label={PERFIL_LABEL[perfil] ?? perfil}>
              {lista.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      <span className="text-xs text-muted-foreground">(você continua logado como Master)</span>
    </div>
  );
}
