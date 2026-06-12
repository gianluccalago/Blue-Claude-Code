import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Users2,
  Mail,
  BadgeCheck,
  Clock4,
  LinkIcon,
  Filter,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useUsuarios,
  useCriarUsuario,
  useEditarUsuario,
  useDefinirAtivoUsuario,
  type UsuarioValor,
} from "@/hooks/useUsuarios";
import { UsuarioForm } from "@/components/master/UsuarioForm";
import { VinculoHospedes } from "@/components/master/VinculoHospedes";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import {
  PERFIS_SISTEMA,
  PERFIL_LABEL,
  PERFIS_GRUPO_CUIDADO,
  perfilParaSeletor,
  type PerfilSeletor,
} from "@/data/perfisSistema";
import type { Residente, Usuario } from "@/types/database";

// ===========================================================================
// MASTER-3 · Usuários e acessos — o Master cria/edita/ativa todos os usuários
// de todos os perfis. É a FUNDAÇÃO da autenticação: o email será o login e
// cada perfil cairá direto nas suas telas (ver comentários em useUsuarios.ts).
// ===========================================================================

type FiltroStatus = "todos" | "ativo" | "inativo";

export function UsuariosAcessos() {
  const usuarios = useUsuarios();
  const residentes = useResidentes();
  const criar = useCriarUsuario();
  const editar = useEditarUsuario();
  const definirAtivo = useDefinirAtivoUsuario();

  const [filtroPerfil, setFiltroPerfil] = useState<PerfilSeletor | "todos">("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [vinculosId, setVinculosId] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{
    titulo: string;
    descricao?: string;
    acao: () => void;
  } | null>(null);

  const lista = usuarios.data ?? [];
  const listaResidentes = residentes.data ?? [];

  // Cargos (funcao) já usados no sistema — sugeridos ao criar/editar usuário,
  // permitindo reaproveitar um cargo existente ou criar um novo.
  const cargosExistentes = useMemo(
    () => [...new Set(lista.map((u) => u.funcao?.trim()).filter((c): c is string => !!c))].sort(),
    [lista],
  );

  // Contadores: usuários ATIVOS por perfil (grupo cuidado = cuidador+enfermagem).
  const ativosPorPerfil = useMemo(() => {
    const m = new Map<PerfilSeletor, number>();
    for (const u of lista) {
      if (!u.ativo) continue;
      const s = perfilParaSeletor(u.perfil);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [lista]);

  const filtrada = useMemo(() => {
    return lista.filter((u) => {
      if (filtroStatus === "ativo" && !u.ativo) return false;
      if (filtroStatus === "inativo" && u.ativo) return false;
      if (filtroPerfil !== "todos" && perfilParaSeletor(u.perfil) !== filtroPerfil) return false;
      return true;
    });
  }, [lista, filtroPerfil, filtroStatus]);

  if (usuarios.isLoading || residentes.isLoading) return <LoadingState />;
  const erro = usuarios.error ?? residentes.error;
  if (erro) return <ErrorState error={erro} />;

  const ocupado = criar.isPending || editar.isPending || definirAtivo.isPending;
  const totalAtivos = lista.filter((u) => u.ativo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-secondary">
            Usuários e acessos
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalAtivos} ativos · {lista.length} no total · o e-mail será o login de cada usuário
          </p>
        </div>
        <Button
          onClick={() => {
            setAdicionando((v) => !v);
            setEditandoId(null);
            setVinculosId(null);
          }}
        >
          <Plus className="size-4" /> Criar usuário
        </Button>
      </div>

      {/* CONTADORES por perfil (ativos) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PERFIS_SISTEMA.map((p) => {
          const Icon = p.icon;
          const n = ativosPorPerfil.get(p.value) ?? 0;
          const ativo = filtroPerfil === p.value;
          return (
            <button
              key={p.value}
              onClick={() => setFiltroPerfil(ativo ? "todos" : p.value)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                ativo ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
              )}
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold leading-none tabular-nums text-secondary">
                  {n}
                </div>
                <div className="truncate text-[11px] font-semibold text-muted-foreground">
                  {p.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Formulário de criação */}
      {adicionando && (
        <UsuarioForm
          modoEdicao={false}
          residentes={listaResidentes}
          cargosExistentes={cargosExistentes}
          salvando={criar.isPending}
          onCancelar={() => setAdicionando(false)}
          onSalvar={(valor: UsuarioValor) =>
            criar.mutate(valor, { onSuccess: () => setAdicionando(false) })
          }
        />
      )}

      {/* FILTROS */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Status</span>
            <Segmentado<FiltroStatus>
              valor={filtroStatus}
              onChange={setFiltroStatus}
              opcoes={[
                { v: "ativo", label: "Ativos" },
                { v: "inativo", label: "Inativos" },
                { v: "todos", label: "Todos" },
              ]}
            />
          </div>
          {filtroPerfil !== "todos" && (
            <button
              onClick={() => setFiltroPerfil("todos")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Limpar filtro de perfil
            </button>
          )}
        </CardContent>
      </Card>

      {/* LISTA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="size-4 text-secondary" /> Usuários ({filtrada.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtrada.length === 0 ? (
            <EmptyState label="Nenhum usuário para os filtros selecionados." />
          ) : (
            filtrada.map((u) =>
              editandoId === u.id ? (
                <UsuarioForm
                  key={u.id}
                  modoEdicao
                  inicial={u}
                  residentes={listaResidentes}
                  cargosExistentes={cargosExistentes}
                  salvando={editar.isPending}
                  onCancelar={() => setEditandoId(null)}
                  onSalvar={(valor) =>
                    editar.mutate({ id: u.id, valor }, { onSuccess: () => setEditandoId(null) })
                  }
                />
              ) : (
                <UsuarioCard
                  key={u.id}
                  usuario={u}
                  residentes={listaResidentes}
                  ocupado={ocupado}
                  vinculosAberto={vinculosId === u.id}
                  onEditar={() => {
                    setEditandoId(u.id);
                    setAdicionando(false);
                    setVinculosId(null);
                  }}
                  onToggleVinculos={() =>
                    setVinculosId((atual) => (atual === u.id ? null : u.id))
                  }
                  onInativar={() =>
                    setConfirmacao({
                      titulo: "Inativar este usuário?",
                      descricao: `${u.nome} deixará de aparecer e não poderá acessar o sistema (não é excluído).`,
                      acao: () => definirAtivo.mutate({ id: u.id, ativo: false }),
                    })
                  }
                  onReativar={() => definirAtivo.mutate({ id: u.id, ativo: true })}
                />
              ),
            )
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar="Sim, inativar"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function UsuarioCard({
  usuario: u,
  residentes,
  ocupado,
  vinculosAberto,
  onEditar,
  onToggleVinculos,
  onInativar,
  onReativar,
}: {
  usuario: Usuario;
  residentes: Residente[];
  ocupado: boolean;
  vinculosAberto: boolean;
  onEditar: () => void;
  onToggleVinculos: () => void;
  onInativar: () => void;
  onReativar: () => void;
}) {
  const ehCuidado = PERFIS_GRUPO_CUIDADO.includes(u.perfil);
  const residenteVinculado =
    u.perfil === "familia" && u.residente_vinculado
      ? residentes.find((r) => r.id === u.residente_vinculado)?.nome ?? "Não informado"
      : null;

  return (
    <div className={cn("rounded-lg border bg-card p-4", !u.ativo && "opacity-60")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-secondary">{u.nome}</span>
            {u.funcao && <Badge variant="secondary">{u.funcao}</Badge>}
            <Badge variant="default">{PERFIL_LABEL[u.perfil]}</Badge>
            {u.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3.5" /> {ouNaoInformado(u.email)}
            </span>
            {u.vinculo && <span>{u.vinculo}</span>}
            {u.registro_profissional && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-3.5" /> {u.registro_profissional}
              </span>
            )}
            {ehCuidado && (
              <span className="inline-flex items-center gap-1">
                <Clock4 className="size-3.5" />
                {u.isento_ponto_app ? "Isento de ponto no app" : "Bate ponto no app"}
              </span>
            )}
            {residenteVinculado && (
              <span className="inline-flex items-center gap-1">
                <LinkIcon className="size-3.5" /> {residenteVinculado}
              </span>
            )}
            {u.tipo_remuneracao && (
              <span>
                · {u.tipo_remuneracao === "mensal_fixo" ? "Mensal" : "Por plantão"}
                {/* Valores ficam na Administração (Remuneração da equipe). */}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {ehCuidado && (
            <Button variant="outline" size="sm" onClick={onToggleVinculos} disabled={ocupado}>
              <LinkIcon className="size-4" /> Hóspedes
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEditar} disabled={ocupado}>
            <Pencil className="size-4" /> Editar
          </Button>
          {u.ativo ? (
            <Button variant="outline" size="sm" onClick={onInativar} disabled={ocupado}>
              <UserX className="size-4" /> Inativar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReativar} disabled={ocupado}>
              <UserCheck className="size-4" /> Reativar
            </Button>
          )}
        </div>
      </div>

      {/* Gestão do vínculo cuidador↔hóspede (designação do checklist). */}
      {ehCuidado && vinculosAberto && (
        <div className="mt-3">
          <VinculoHospedes cuidadorId={u.id} residentes={residentes} />
        </div>
      )}
    </div>
  );
}

function Segmentado<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { v: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            valor === o.v
              ? "bg-card text-secondary shadow-card"
              : "text-muted-foreground hover:text-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
