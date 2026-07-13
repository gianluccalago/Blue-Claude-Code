import { useState } from "react";
import { toast } from "sonner";
import { Settings, Plus, Check, ChevronUp, ChevronDown, Pencil } from "lucide-react";
import {
  useCrmEtapasTodas,
  useSalvarEtapa,
  useReordenarEtapas,
  useCrmMotivosTodos,
  useSalvarMotivo,
} from "@/hooks/useCrm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import { CrmNav } from "./CrmNav";
import type { CrmEtapa, CrmMotivoPerda } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CrmConfig() {
  return (
    <div className="space-y-5">
      <CrmNav ativa="crm-config" />
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Settings className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Configurações do funil</h1>
          </div>
        </div>

        <EtapasCard />
        <MotivosCard />
      </div>
    </div>
  );
}

// ─── Etapas ───────────────────────────────────────────────────────────────────

function EtapasCard() {
  const etapas = useCrmEtapasTodas();
  const salvar = useSalvarEtapa();
  const reordenar = useReordenarEtapas();
  const [nova, setNova] = useState("");

  const lista = etapas.data ?? [];

  async function adicionar() {
    if (nova.trim() === "") return;
    const proximaOrdem = lista.length ? Math.max(...lista.map((e) => e.ordem)) + 1 : 1;
    try {
      await salvar.mutateAsync({ nome: nova, ordem: proximaOrdem });
      toast.success("Etapa adicionada.");
      setNova("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    const a = lista[idx];
    const b = lista[idx + dir];
    if (!a || !b) return;
    try {
      await reordenar.mutateAsync({ a: { id: a.id, ordem: a.ordem }, b: { id: b.id, ordem: b.ordem } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reordenar.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Etapas do pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {etapas.isLoading ? (
          <LoadingState />
        ) : etapas.isError ? (
          <ErrorState error={etapas.error} />
        ) : lista.length === 0 ? (
          <EmptyState label="Nenhuma etapa cadastrada." />
        ) : (
          <div className="divide-y rounded-md border">
            {lista.map((et, i) => (
              <LinhaEtapa
                key={et.id}
                etapa={et}
                primeiro={i === 0}
                ultimo={i === lista.length - 1}
                onSubir={() => mover(i, -1)}
                onDescer={() => mover(i, 1)}
                onSalvarNome={(nome) => salvar.mutateAsync({ id: et.id, nome })}
                onAlternar={() => salvar.mutateAsync({ id: et.id, nome: et.nome, ativo: !et.ativo })}
                ocupado={reordenar.isPending || salvar.isPending}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1">
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              className={inputBase}
              placeholder="Nova etapa…"
            />
          </div>
          <Button onClick={adicionar} disabled={salvar.isPending || nova.trim() === ""}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LinhaEtapa({
  etapa,
  primeiro,
  ultimo,
  onSubir,
  onDescer,
  onSalvarNome,
  onAlternar,
  ocupado,
}: {
  etapa: CrmEtapa;
  primeiro: boolean;
  ultimo: boolean;
  onSubir: () => void;
  onDescer: () => void;
  onSalvarNome: (nome: string) => Promise<unknown>;
  onAlternar: () => void;
  ocupado: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(etapa.nome);

  async function confirmar() {
    if (nome.trim() === "" || nome.trim() === etapa.nome) {
      setEditando(false);
      setNome(etapa.nome);
      return;
    }
    try {
      await onSalvarNome(nome.trim());
      toast.success("Etapa atualizada.");
      setEditando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2.5", !etapa.ativo && "opacity-60")}>
      <div className="flex flex-col">
        <button onClick={onSubir} disabled={primeiro || ocupado} className="text-muted-foreground hover:text-secondary disabled:opacity-30">
          <ChevronUp className="size-4" />
        </button>
        <button onClick={onDescer} disabled={ultimo || ocupado} className="text-muted-foreground hover:text-secondary disabled:opacity-30">
          <ChevronDown className="size-4" />
        </button>
      </div>
      {editando ? (
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
          autoFocus
          className={cn(inputBase, "flex-1")}
        />
      ) : (
        <span className="flex-1 font-semibold text-secondary">{etapa.nome}</span>
      )}
      {!etapa.ativo && <Badge variant="muted">inativa</Badge>}
      {editando ? (
        <Button size="sm" onClick={confirmar} disabled={ocupado}>
          <Check className="size-4" /> Salvar
        </Button>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)} title="Renomear">
            <Pencil className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onAlternar} disabled={ocupado}>
            {etapa.ativo ? "Inativar" : "Reativar"}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Motivos de perda ─────────────────────────────────────────────────────────

function MotivosCard() {
  const motivos = useCrmMotivosTodos();
  const salvar = useSalvarMotivo();
  const [novo, setNovo] = useState("");

  const lista = motivos.data ?? [];

  async function adicionar() {
    if (novo.trim() === "") return;
    try {
      await salvar.mutateAsync({ nome: novo });
      toast.success("Motivo adicionado.");
      setNovo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {motivos.isLoading ? (
          <LoadingState />
        ) : motivos.isError ? (
          <ErrorState error={motivos.error} />
        ) : lista.length === 0 ? (
          <EmptyState label="Nenhum motivo cadastrado." />
        ) : (
          <div className="divide-y rounded-md border">
            {lista.map((m) => (
              <LinhaMotivo
                key={m.id}
                motivo={m}
                onSalvarNome={(nome) => salvar.mutateAsync({ id: m.id, nome })}
                onAlternar={() => salvar.mutateAsync({ id: m.id, nome: m.nome, ativo: !m.ativo })}
                ocupado={salvar.isPending}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1">
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              className={inputBase}
              placeholder="Novo motivo de perda…"
            />
          </div>
          <Button onClick={adicionar} disabled={salvar.isPending || novo.trim() === ""}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LinhaMotivo({
  motivo,
  onSalvarNome,
  onAlternar,
  ocupado,
}: {
  motivo: CrmMotivoPerda;
  onSalvarNome: (nome: string) => Promise<unknown>;
  onAlternar: () => void;
  ocupado: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(motivo.nome);

  async function confirmar() {
    if (nome.trim() === "" || nome.trim() === motivo.nome) {
      setEditando(false);
      setNome(motivo.nome);
      return;
    }
    try {
      await onSalvarNome(nome.trim());
      toast.success("Motivo atualizado.");
      setEditando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2.5", !motivo.ativo && "opacity-60")}>
      {editando ? (
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
          autoFocus
          className={cn(inputBase, "flex-1")}
        />
      ) : (
        <span className="flex-1 font-semibold text-secondary">{motivo.nome}</span>
      )}
      {!motivo.ativo && <Badge variant="muted">inativo</Badge>}
      {editando ? (
        <Button size="sm" onClick={confirmar} disabled={ocupado}>
          <Check className="size-4" /> Salvar
        </Button>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)} title="Renomear">
            <Pencil className="size-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onAlternar} disabled={ocupado}>
            {motivo.ativo ? "Inativar" : "Reativar"}
          </Button>
        </>
      )}
    </div>
  );
}
