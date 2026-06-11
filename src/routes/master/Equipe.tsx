import { useMemo, useState } from "react";
import {
  Mail,
  BadgeCheck,
  Filter,
  CalendarClock,
  Clock4,
  Pencil,
  Check,
  X,
  Stethoscope,
  Building2,
  Wrench,
} from "lucide-react";
import { useUsuarios, useDefinirHorarioTrabalho } from "@/hooks/useUsuarios";
import { useTurnos } from "@/hooks/useTurnos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import {
  cn,
  dataISO,
  formatarDataBR,
  formatarHoraBR,
  hojeISO,
  ouNaoInformado,
  somarDias,
} from "@/lib/utils";
import { PERFIL_LABEL, PERFIS_GRUPO_CUIDADO } from "@/data/perfisSistema";
import type { PerfilUsuario, Turno, Usuario } from "@/types/database";
import type { LucideIcon } from "lucide-react";

// ===========================================================================
// MASTER · Equipe — gestão operacional (SEM remuneração/valores, que ficam só
// na Administração). Agrupa usuarios (exceto família) em Assistencial,
// Administrativo e Operacional. Quem é escalado mostra os próximos turnos
// (tabela turnos); mensalistas têm horário fixo editável (horario_trabalho).
// ===========================================================================

type GrupoKey = "assistencial" | "administrativo" | "operacional";

const GRUPOS: { key: GrupoKey; label: string; icon: LucideIcon; perfis: PerfilUsuario[] }[] = [
  {
    key: "assistencial",
    label: "Assistencial",
    icon: Stethoscope,
    perfis: ["medico", "coordenacao", "enfermagem", "cuidador", "multidisciplinar", "nutricionista"],
  },
  { key: "administrativo", label: "Administrativo", icon: Building2, perfis: ["administracao", "master"] },
  { key: "operacional", label: "Operacional", icon: Wrench, perfis: ["farmacia", "hotelaria"] },
];

function grupoDoPerfil(perfil: PerfilUsuario): GrupoKey | null {
  return GRUPOS.find((g) => g.perfis.includes(perfil))?.key ?? null;
}

/** Cargo exibido: a função quando houver, senão o nome do perfil. */
function cargoDe(u: Usuario): string {
  return u.funcao?.trim() || PERFIL_LABEL[u.perfil];
}

/** Escalado por turnos (cuidador/enfermagem) ou pago por plantão. */
function ehEscalado(u: Usuario): boolean {
  return PERFIS_GRUPO_CUIDADO.includes(u.perfil) || u.tipo_remuneracao === "plantao";
}

export function Equipe() {
  const usuarios = useUsuarios();
  // Turnos dos próximos 14 dias para a escala dos escalados.
  const turnos = useTurnos(hojeISO(), dataISO(somarDias(new Date(), 14)));

  const [filtroGrupo, setFiltroGrupo] = useState<GrupoKey | "todos">("todos");
  const [filtroCargo, setFiltroCargo] = useState<string>("todos");

  // Exclui família (acesso de portal, não é equipe).
  const equipe = useMemo(
    () => (usuarios.data ?? []).filter((u) => u.perfil !== "familia"),
    [usuarios.data],
  );

  const turnosPorProf = useMemo(() => {
    const m = new Map<string, Turno[]>();
    for (const t of turnos.data ?? []) {
      if (!t.profissional_id) continue;
      const arr = m.get(t.profissional_id) ?? [];
      arr.push(t);
      m.set(t.profissional_id, arr);
    }
    return m;
  }, [turnos.data]);

  const cargos = useMemo(() => {
    const s = new Set(equipe.map(cargoDe));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [equipe]);

  const contagemGrupo = useMemo(() => {
    const m = new Map<GrupoKey, number>();
    for (const u of equipe) {
      const g = grupoDoPerfil(u.perfil);
      if (g) m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [equipe]);

  if (usuarios.isLoading) return <LoadingState />;
  if (usuarios.error) return <ErrorState error={usuarios.error} />;

  const gruposVisiveis = GRUPOS.filter((g) => filtroGrupo === "todos" || g.key === filtroGrupo);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-secondary">Equipe</h2>
        <p className="text-sm text-muted-foreground">
          Gestão operacional da equipe · {equipe.length} membros (valores ficam na Administração)
        </p>
      </div>

      {/* CONTADORES por grupo (clicáveis como filtro) */}
      <div className="grid grid-cols-3 gap-3">
        {GRUPOS.map((g) => {
          const Icon = g.icon;
          const ativo = filtroGrupo === g.key;
          return (
            <button
              key={g.key}
              onClick={() => setFiltroGrupo(ativo ? "todos" : g.key)}
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
                  {contagemGrupo.get(g.key) ?? 0}
                </div>
                <div className="truncate text-[11px] font-semibold text-muted-foreground">
                  {g.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Cargo</span>
            <select
              value={filtroCargo}
              onChange={(e) => setFiltroCargo(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todos os cargos</option>
              {cargos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {filtroGrupo !== "todos" && (
            <button
              onClick={() => setFiltroGrupo("todos")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Limpar filtro de grupo
            </button>
          )}
        </CardContent>
      </Card>

      {/* GRUPOS */}
      {gruposVisiveis.map((g) => {
        const membros = equipe
          .filter((u) => grupoDoPerfil(u.perfil) === g.key)
          .filter((u) => filtroCargo === "todos" || cargoDe(u) === filtroCargo)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        const Icon = g.icon;
        return (
          <Card key={g.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-secondary" /> {g.label} ({membros.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {membros.length === 0 ? (
                <EmptyState label="Nenhum membro neste grupo para o filtro." />
              ) : (
                membros.map((u) => (
                  <MembroCard key={u.id} usuario={u} turnos={turnosPorProf.get(u.id) ?? []} />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de membro
// ---------------------------------------------------------------------------

function MembroCard({ usuario: u, turnos }: { usuario: Usuario; turnos: Turno[] }) {
  const escalado = ehEscalado(u);
  return (
    <div className={cn("rounded-lg border bg-card p-4", !u.ativo && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-secondary">{u.nome}</span>
            <Badge variant="default">{cargoDe(u)}</Badge>
            {u.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{PERFIL_LABEL[u.perfil]}</span>
            {u.vinculo && <span>· {u.vinculo}</span>}
            {u.registro_profissional && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-3.5" /> {u.registro_profissional}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3.5" /> {ouNaoInformado(u.email)}
            </span>
          </div>
        </div>
      </div>

      {/* Horário de trabalho */}
      <div className="mt-3 rounded-lg border border-border bg-accent/30 p-3">
        {escalado ? (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarClock className="size-3.5" /> Escala — próximos turnos (14 dias)
            </div>
            {turnos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem turnos nos próximos dias.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {turnos.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-secondary">{formatarDataBR(t.data)}</span>{" "}
                    <span className="text-muted-foreground">
                      {formatarHoraBR(t.inicio)}–{formatarHoraBR(t.fim)}
                    </span>{" "}
                    <Badge variant={t.tag === "noturno" ? "secondary" : "muted"}>{t.tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <HorarioFixoEditor usuario={u} />
        )}
      </div>
    </div>
  );
}

/** Edição inline do horário fixo (mensalistas administrativos/operacionais). */
function HorarioFixoEditor({ usuario: u }: { usuario: Usuario }) {
  const definir = useDefinirHorarioTrabalho();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(u.horario_trabalho ?? "");

  if (editando) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock4 className="size-3.5" /> Horário fixo de trabalho
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="ex: Seg–Sex 8h–17h"
            className="h-10 min-w-48 flex-1 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            onClick={() =>
              definir.mutate(
                { id: u.id, horario: texto.trim() || null },
                { onSuccess: () => setEditando(false) },
              )
            }
            disabled={definir.isPending}
          >
            <Check className="size-4" /> Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTexto(u.horario_trabalho ?? "");
              setEditando(false);
            }}
            disabled={definir.isPending}
          >
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-sm">
        <Clock4 className="size-3.5 text-muted-foreground" />
        <span className="font-semibold text-secondary">
          {ouNaoInformado(u.horario_trabalho)}
        </span>
        <span className="text-xs text-muted-foreground">· horário fixo</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
        <Pencil className="size-4" /> Editar horário
      </Button>
    </div>
  );
}
