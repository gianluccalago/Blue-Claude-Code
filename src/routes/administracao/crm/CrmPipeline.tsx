import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Plus, Search, Star, Clock3, LayoutGrid, List, Filter } from "lucide-react";
import { useCrmEtapas, useOportunidades, useMoverEtapa, type OportunidadeCard } from "@/hooks/useCrm";
import { QUALIFICACAO_LABEL, STATUS_LABEL, STATUS_VARIANTE } from "@/lib/crm";
import { idadeTexto } from "@/lib/sla";
import { formatarMoeda } from "@/lib/mensalidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import { CrmNav } from "./CrmNav";
import type { CrmStatus } from "@/types/database";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Estrelas de qualificação (1 frio → 5 quente). */
function Estrelas({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={QUALIFICACAO_LABEL[valor] ?? ""}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-3.5", n <= valor ? "fill-warning text-warning" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

export function CrmPipeline() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;

  const etapas = useCrmEtapas();
  const ops = useOportunidades();
  const mover = useMoverEtapa();

  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<"ativas" | "todas" | CrmStatus>("ativas");
  const [fResponsavel, setFResponsavel] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);

  const lista = ops.data ?? [];
  const responsaveis = useMemo(
    () => [...new Set(lista.map((o) => o.responsavel).filter(Boolean) as string[])].sort(),
    [lista],
  );
  const origensNomes = useMemo(
    () => [...new Set(lista.map((o) => o.origemNome).filter(Boolean) as string[])].sort(),
    [lista],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((o) => {
      if (fStatus === "ativas" && (o.status === "ganha" || o.status === "perdida")) return false;
      if (fStatus !== "ativas" && fStatus !== "todas" && o.status !== fStatus) return false;
      if (fResponsavel && o.responsavel !== fResponsavel) return false;
      if (fOrigem && o.origemNome !== fOrigem) return false;
      if (q) {
        const alvo = `${o.nome} ${o.contato?.nome ?? ""} ${o.contato?.nome_idoso ?? ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [lista, busca, fStatus, fResponsavel, fOrigem]);

  if (etapas.isLoading || ops.isLoading) return <LoadingState />;
  if (etapas.isError) return <ErrorState error={etapas.error} />;
  if (ops.isError) return <ErrorState error={ops.error} />;

  const totalValor = filtradas.reduce((s, o) => s + (o.valor_mensalidade_estimado ?? 0), 0);

  function soltarNaEtapa(etapa: string) {
    const id = arrastando;
    setArrastando(null);
    if (!id) return;
    const op = lista.find((o) => o.id === id);
    if (!op || op.etapa === etapa) return;
    mover.mutate({ id, etapa, etapaAnterior: op.etapa });
  }

  return (
    <div className="space-y-5">
      <CrmNav ativa="crm" />
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Pipeline comercial</h1>
          <p className="text-sm text-muted-foreground">
            {filtradas.length} oportunidade(s) ·{" "}
            <span className="font-semibold text-secondary">{formatarMoeda(totalValor)}</span> em mensalidades estimadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-card p-0.5">
            <button
              onClick={() => setVista("kanban")}
              className={cn("flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold", vista === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className="size-4" /> Kanban
            </button>
            <button
              onClick={() => setVista("lista")}
              className={cn("flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold", vista === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <List className="size-4" /> Lista
            </button>
          </div>
          <Link to={`${base}/crm-nova` as string}>
            <Button>
              <Plus className="size-4" /> Nova oportunidade
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar família ou idoso…"
              className={cn(inputBase, "pl-8 min-w-[200px]")}
            />
          </div>
          <Filter className="size-4 text-muted-foreground" />
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={inputBase}>
            <option value="ativas">Ativas</option>
            <option value="todas">Todas</option>
            <option value="nova">Nova</option>
            <option value="em_andamento">Em andamento</option>
            <option value="ganha">Ganha</option>
            <option value="perdida">Perdida</option>
            <option value="pausada">Pausada</option>
          </select>
          <select value={fResponsavel} onChange={(e) => setFResponsavel(e.target.value)} className={inputBase}>
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} className={inputBase}>
            <option value="">Todas as origens</option>
            {origensNomes.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState label="Nenhuma oportunidade no funil. Comece criando uma." />
      ) : vista === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(etapas.data ?? []).map((et) => {
            const naEtapa = filtradas.filter((o) => o.etapa === et.nome);
            const valorEtapa = naEtapa.reduce((s, o) => s + (o.valor_mensalidade_estimado ?? 0), 0);
            return (
              <div
                key={et.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarNaEtapa(et.nome)}
                className="flex w-72 shrink-0 flex-col rounded-lg border border-border/70 bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                  <span className="text-sm font-bold text-secondary">{et.nome}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {naEtapa.length} · {formatarMoeda(valorEtapa)}
                  </span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {naEtapa.map((o) => (
                    <OportunidadeCartao
                      key={o.id}
                      op={o}
                      to={`${base}/crm-oportunidade`}
                      onDragStart={() => setArrastando(o.id)}
                    />
                  ))}
                  {naEtapa.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map((o) => (
              <Link
                key={o.id}
                to={`${base}/crm-oportunidade` as string}
                search={{ id: o.id }}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{o.nome}</span>
                    <Badge variant={STATUS_VARIANTE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    {o.temTarefaVencida && (
                      <Badge variant="destructive" className="gap-1"><Clock3 className="size-3" /> tarefa vencida</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.etapa} · {o.origemNome ?? "Sem origem"} · {o.responsavel ?? "Não informado"} · criada {idadeTexto(o.criado_em)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Estrelas valor={o.qualificacao} />
                  <span className="text-sm font-bold tabular-nums text-secondary">
                    {o.valor_mensalidade_estimado != null ? formatarMoeda(o.valor_mensalidade_estimado) : "—"}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OportunidadeCartao({
  op,
  to,
  onDragStart,
}: {
  op: OportunidadeCard;
  to: string;
  onDragStart: () => void;
}) {
  return (
    <Link
      to={to as string}
      search={{ id: op.id }}
      draggable
      onDragStart={onDragStart}
      className="block cursor-grab rounded-lg border border-border/70 bg-card p-3 shadow-xs transition-all hover:border-primary/40 hover:shadow-card active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-secondary">{op.nome}</span>
        {op.temTarefaVencida && (
          <span title="Tarefa vencida"><Clock3 className="size-4 shrink-0 text-destructive" /></span>
        )}
      </div>
      {op.contato?.nome_idoso && (
        <p className="text-xs text-muted-foreground">Hóspede: {op.contato.nome_idoso}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <Estrelas valor={op.qualificacao} />
        <span className="text-sm font-bold tabular-nums text-secondary">
          {op.valor_mensalidade_estimado != null ? formatarMoeda(op.valor_mensalidade_estimado) : "—"}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">criada {idadeTexto(op.criado_em)}</p>
    </Link>
  );
}
