import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Check, Clock3, ListChecks, ArrowRight } from "lucide-react";
import { useTodasTarefas, useConcluirTarefa, type TarefaComOportunidade } from "@/hooks/useCrm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, cn } from "@/lib/utils";

const hoje = () => new Date().toISOString().slice(0, 10);

export function CrmTarefas() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const tarefas = useTodasTarefas();
  const concluir = useConcluirTarefa();

  const [fStatus, setFStatus] = useState<"pendentes" | "concluidas" | "todas">("pendentes");
  const [fResponsavel, setFResponsavel] = useState("");
  const [fPeriodo, setFPeriodo] = useState<"todos" | "vencidas" | "hoje" | "semana">("todos");

  const lista = tarefas.data ?? [];
  const responsaveis = useMemo(
    () => [...new Set(lista.map((t) => t.responsavel).filter(Boolean) as string[])].sort(),
    [lista],
  );

  const filtradas = useMemo(() => {
    const h = hoje();
    const em7 = new Date(); em7.setDate(em7.getDate() + 7);
    const lim7 = em7.toISOString().slice(0, 10);
    const arr = lista.filter((t) => {
      if (fStatus === "pendentes" && t.concluida) return false;
      if (fStatus === "concluidas" && !t.concluida) return false;
      if (fResponsavel && t.responsavel !== fResponsavel) return false;
      if (fPeriodo === "vencidas" && !(!t.concluida && t.data && t.data < h)) return false;
      if (fPeriodo === "hoje" && t.data !== h) return false;
      if (fPeriodo === "semana" && !(t.data && t.data >= h && t.data <= lim7)) return false;
      return true;
    });
    // Vencidas no topo, depois por data crescente (sem data ao fim).
    return arr.sort((a, b) => {
      const av = !a.concluida && a.data && a.data < h ? 0 : 1;
      const bv = !b.concluida && b.data && b.data < h ? 0 : 1;
      if (av !== bv) return av - bv;
      return (a.data ?? "9999").localeCompare(b.data ?? "9999");
    });
  }, [lista, fStatus, fResponsavel, fPeriodo]);

  if (tarefas.isLoading) return <LoadingState />;
  if (tarefas.isError) return <ErrorState error={tarefas.error} />;

  const vencidas = lista.filter((t) => !t.concluida && t.data && t.data < hoje()).length;

  const inputBase = "h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <ListChecks className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Tarefas do CRM</h1>
          <p className="text-sm text-muted-foreground">
            {lista.filter((t) => !t.concluida).length} pendente(s)
            {vencidas > 0 && <span className="font-semibold text-destructive"> · {vencidas} vencida(s)</span>}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={inputBase}>
            <option value="pendentes">Pendentes</option>
            <option value="concluidas">Concluídas</option>
            <option value="todas">Todas</option>
          </select>
          <select value={fPeriodo} onChange={(e) => setFPeriodo(e.target.value as typeof fPeriodo)} className={inputBase}>
            <option value="todos">Qualquer período</option>
            <option value="vencidas">Vencidas</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Próximos 7 dias</option>
          </select>
          <select value={fResponsavel} onChange={(e) => setFResponsavel(e.target.value)} className={inputBase}>
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </CardContent>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState label="Nenhuma tarefa para os filtros." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map((t) => <LinhaTarefa key={t.id} t={t} base={base} onConcluir={() => concluir.mutate(t)} ocupado={concluir.isPending} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaTarefa({ t, base, onConcluir, ocupado }: { t: TarefaComOportunidade; base: string; onConcluir: () => void; ocupado: boolean }) {
  const vencida = !t.concluida && !!t.data && t.data < hoje();
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", vencida && "bg-destructive/5")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold text-secondary", t.concluida && "line-through opacity-70")}>{t.tipo} · {t.assunto}</span>
          {vencida && <Badge variant="destructive" className="gap-1"><Clock3 className="size-3" /> vencida</Badge>}
          {t.concluida && <Badge variant="success" className="gap-1"><Check className="size-3" /> feita</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.data ? formatarDataBR(t.data) : "Sem data"}{t.hora ? ` · ${t.hora}` : ""}{t.responsavel ? ` · ${t.responsavel}` : ""}
          {" · "}
          <Link to={`${base}/crm-oportunidade` as string} search={{ id: t.oportunidade_id }} className="text-primary hover:underline">
            {t.oportunidadeNome} <ArrowRight className="inline size-3" />
          </Link>
        </p>
      </div>
      {!t.concluida && (
        <Button size="sm" variant="outline" onClick={onConcluir} disabled={ocupado}>
          <Check className="size-4" /> Concluir
        </Button>
      )}
    </div>
  );
}
