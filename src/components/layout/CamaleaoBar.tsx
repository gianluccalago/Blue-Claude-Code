import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Eye, LogOut, Glasses, Loader2, Search, ChevronDown, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getPerfil } from "@/data/profiles";
import { PERFIL_LABEL } from "@/data/perfisSistema";
import { cn } from "@/lib/utils";
import type { PerfilUsuario, Usuario } from "@/types/database";

// ===========================================================================
// Barra do modo CAMALEÃO — visível só para o Master. Permite "ver como" qualquer
// usuário ativo (assume a identidade efetiva, mantendo a sessão do Master).
//
// Usa uma consulta PRÓPRIA (chave isolada, sempre fresca) para a lista de
// usuários, para não depender do cache de ["usuarios"] que a tela de Usuários
// invalida — evita o seletor ficar vazio por estado de cache.
// ===========================================================================

/** Iniciais (até 2 letras) para o avatar do usuário. */
function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  const r = (p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "");
  return r.toUpperCase() || "?";
}

/** Ícone do perfil (cai em Users se o perfil não estiver mapeado). */
function IconePerfil({ perfil, className }: { perfil: PerfilUsuario; className?: string }) {
  const Icon = getPerfil(perfil)?.icon ?? Users;
  return <Icon className={className} />;
}

export function CamaleaoBar() {
  const { ehMaster, impersonado, usuario, personificar } = useAuth();
  const navigate = useNavigate();
  // Perfil da ROTA atual: o Master pode "entrar" em outro perfil tanto
  // personificando um usuário (impersonado) quanto navegando direto — os
  // cards/avisos do painel estratégico levam a rotas de outro $perfil.
  const { perfil: perfilRota } = useParams({ strict: false }) as { perfil?: string };
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

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
    const grupos = new Map<PerfilUsuario, { id: string; nome: string; funcao: string | null }[]>();
    for (const u of usuariosQ.data ?? []) {
      if (u.id === usuario?.id) continue;
      const arr = grupos.get(u.perfil) ?? [];
      arr.push({ id: u.id, nome: u.nome, funcao: u.funcao });
      grupos.set(u.perfil, arr);
    }
    return [...grupos.entries()].sort((a, b) =>
      (PERFIL_LABEL[a[0]] ?? a[0]).localeCompare(PERFIL_LABEL[b[0]] ?? b[0], "pt-BR"),
    );
  }, [usuariosQ.data, usuario?.id]);

  const totalSelecionaveis = useMemo(
    () => porPerfil.reduce((s, [, lista]) => s + lista.length, 0),
    [porPerfil],
  );

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

  // Perfil que o Master está visitando: por personificação OU por navegação
  // direta para uma rota de outro perfil (links do painel). Em ambos os casos
  // mostramos a barra de retorno ao Master.
  const perfilVisitado: PerfilUsuario | undefined =
    impersonado?.perfil ??
    (perfilRota && perfilRota !== "master" ? (perfilRota as PerfilUsuario) : undefined);

  if (perfilVisitado) {
    const rotuloPerfil = PERFIL_LABEL[perfilVisitado] ?? perfilVisitado;
    return (
      <div className="relative z-[25] flex flex-wrap items-center justify-between gap-3 border-b border-warning/50 bg-gradient-to-r from-warning/25 via-warning/10 to-transparent px-6 py-2.5 text-sm">
        <span className="flex items-center gap-2.5 font-semibold text-warning-foreground">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/30 ring-1 ring-warning/40">
            <Eye className="size-4" />
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-warning-foreground/70">
              Modo Camaleão
            </span>
            {impersonado ? (
              <>
                · vendo como <span className="font-extrabold">{impersonado.nome}</span>
              </>
            ) : (
              <>· navegando como</>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/30 px-2 py-0.5 text-xs font-bold">
              <IconePerfil perfil={perfilVisitado} className="size-3" />
              {rotuloPerfil}
            </span>
          </span>
        </span>
        <button
          onClick={voltarAoMaster}
          className="inline-flex items-center gap-1.5 rounded-md bg-navy-gradient px-4 py-2 text-xs font-bold text-white shadow-card transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
        >
          <LogOut className="size-4" /> Voltar ao Master
        </button>
      </div>
    );
  }

  const total = usuariosQ.data?.length ?? 0;
  const buscaNorm = busca.trim().toLowerCase();

  return (
    <div className="relative z-[25] flex flex-wrap items-center gap-3 border-b border-white/40 glass px-6 py-2 text-sm">
      {/* Selo do modo */}
      <span className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Glasses className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-xs font-bold text-secondary">Modo Camaleão</span>
          <span className="hidden text-[10px] text-muted-foreground sm:block">
            veja o sistema como outro usuário
          </span>
        </span>
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
        <div className="relative">
          <button
            onClick={() => {
              // Ao ABRIR, rebusca a lista: pega usuários criados fora do app
              // (ex.: via SQL) — a barra fica sempre montada e o app não
              // refaz queries no foco da janela.
              if (!aberto) void usuariosQ.refetch();
              setAberto((v) => !v);
            }}
            className={cn(
              "flex h-9 min-w-[230px] items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-all",
              aberto
                ? "border-primary/40 bg-primary/10 text-secondary shadow-sm"
                : "border-secondary/20 bg-secondary/5 text-secondary/70 hover:border-secondary/35 hover:bg-secondary/10 hover:text-secondary",
            )}
          >
            <Search className="size-3.5 shrink-0 text-primary" />
            <span className="flex-1 text-left">Ver como…</span>
            <span className="rounded-full bg-secondary/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-secondary/70">
              {totalSelecionaveis}
            </span>
            <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", aberto && "rotate-180")} />
          </button>

          {aberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => { setAberto(false); setBusca(""); }} />
              <div className="absolute z-20 mt-1.5 max-h-[26rem] w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border bg-card shadow-lifted">
                {/* Busca */}
                <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2.5">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pelo nome…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                </div>

                {/* Lista agrupada por FUNÇÃO */}
                <div className="max-h-[21rem] overflow-y-auto py-1">
                  {porPerfil
                    .map(([perfil, lista]) => [
                      perfil,
                      lista.filter((u) => u.nome.toLowerCase().includes(buscaNorm)),
                    ] as const)
                    .filter(([, lista]) => lista.length > 0)
                    .map(([perfil, lista]) => (
                      <div key={perfil} className="pb-1">
                        {/* Cabeçalho da função (sticky, com ícone e contagem) */}
                        <div className="sticky top-0 z-10 flex items-center gap-2 bg-card/95 px-3 py-1.5 backdrop-blur-sm">
                          <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-primary">
                            <IconePerfil perfil={perfil} className="size-3" />
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
                            {PERFIL_LABEL[perfil] ?? perfil}
                          </span>
                          <span className="ml-auto rounded-full bg-secondary/10 px-1.5 text-[10px] font-bold tabular-nums text-secondary/60">
                            {lista.length}
                          </span>
                        </div>

                        {lista.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              verComo(u.id);
                              setAberto(false);
                              setBusca("");
                            }}
                            className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-accent"
                          >
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-[10px] font-bold text-white shadow-glow-primary">
                              {iniciais(u.nome)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-secondary">{u.nome}</span>
                              {u.funcao && (
                                <span className="block truncate text-[10px] text-muted-foreground">{u.funcao}</span>
                              )}
                            </span>
                            <Eye className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    ))}

                  {porPerfil.every(([, lista]) =>
                    lista.every((u) => !u.nome.toLowerCase().includes(buscaNorm)),
                  ) && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-secondary/15 bg-secondary/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground md:inline-flex">
        <span className="size-1.5 rounded-full bg-success" />
        Logado como Master
      </span>
    </div>
  );
}
