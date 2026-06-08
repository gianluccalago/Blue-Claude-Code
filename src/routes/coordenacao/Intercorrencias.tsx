import { useMemo, useState } from "react";
import { AlertTriangle, Check, Stethoscope, CircleDashed } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useTodasIntercorrencias, useTratamentos } from "@/hooks/useCoordenacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Intercorrencia, PendenciaTratamento, Residente } from "@/types/database";

const TIPOS = [
  "Queda",
  "Alteração de consciência",
  "Humor/sono",
  "Lesão de pele",
  "Recusa",
  "Vômito",
] as const;

type Periodo = "hoje" | "7d" | "30d" | "tudo";
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "tudo", label: "Tudo" },
];

const selectBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function dentroDoPeriodo(ts: string, periodo: Periodo): boolean {
  if (periodo === "tudo") return true;
  const data = new Date(ts);
  if (periodo === "hoje") {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return data >= inicio;
  }
  const dias = periodo === "7d" ? 7 : 30;
  return data >= new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

export function IntercorrenciasCoord() {
  const residentes = useResidentes();
  const intercorrencias = useTodasIntercorrencias();
  const tratamentos = useTratamentos();

  const [hospedeFiltro, setHospedeFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<Periodo>("7d");

  const carregando =
    residentes.isLoading || intercorrencias.isLoading || tratamentos.isLoading;
  const erro = residentes.error ?? intercorrencias.error ?? tratamentos.error;

  const info = useMemo(
    () =>
      new Map<string, Residente>((residentes.data ?? []).map((r) => [r.id, r])),
    [residentes.data],
  );

  const trat = tratamentos.data ?? [];

  const filtradas = useMemo(() => {
    return (intercorrencias.data ?? []).filter((i) => {
      if (hospedeFiltro !== "todos" && i.residente_id !== hospedeFiltro) return false;
      if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return false;
      if (!dentroDoPeriodo(i.registrado_em, periodoFiltro)) return false;
      return true;
    });
  }, [intercorrencias.data, hospedeFiltro, tipoFiltro, periodoFiltro]);

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const temResolvido = (id: string) =>
    trat.some(
      (t) => t.tipo_origem === "intercorrencia" && t.referencia_id === id && t.acao === "resolvido",
    );
  const abertas = filtradas.filter((i) => !temResolvido(i.id)).length;

  return (
    <div className="space-y-6">
      {/* Filtros + contadores */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de intercorrências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
              <select
                value={hospedeFiltro}
                onChange={(e) => setHospedeFiltro(e.target.value)}
                className={selectBase}
              >
                <option value="todos">Todos</option>
                {(residentes.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className={selectBase}
              >
                <option value="todos">Todos</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Período</label>
              <select
                value={periodoFiltro}
                onChange={(e) => setPeriodoFiltro(e.target.value as Periodo)}
                className={selectBase}
              >
                {PERIODOS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted" className="px-3 py-1.5">
              {filtradas.length} no período
            </Badge>
            <Badge variant={abertas > 0 ? "warning" : "success"} className="px-3 py-1.5">
              {abertas} aberta{abertas === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <EmptyState label="Nenhuma intercorrência para os filtros selecionados." />
      ) : (
        <div className="space-y-3">
          {filtradas.map((i) => (
            <IntercorrenciaCard
              key={i.id}
              intercorrencia={i}
              residente={info.get(i.residente_id)}
              tratamentos={trat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IntercorrenciaCard({
  intercorrencia: i,
  residente,
  tratamentos,
}: {
  intercorrencia: Intercorrencia;
  residente: Residente | undefined;
  tratamentos: PendenciaTratamento[];
}) {
  // tratamentos já vêm ordenados do mais recente p/ o mais antigo.
  const doItem = tratamentos.filter(
    (t) => t.tipo_origem === "intercorrencia" && t.referencia_id === i.id,
  );
  const resolvido = doItem.find((t) => t.acao === "resolvido");
  const escalado = doItem.find((t) => t.acao === "escalado_medico");

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
        <AlertTriangle className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-secondary">{i.tipo}</span>
          {resolvido ? (
            <Badge variant="success">
              <Check className="size-3.5" /> Resolvido · {ouNaoInformado(resolvido.tratado_por)} ·{" "}
              {formatarDataHoraBR(resolvido.tratado_em)}
            </Badge>
          ) : escalado ? (
            <Badge variant="warning">
              <Stethoscope className="size-3.5" /> Escalado ao médico ·{" "}
              {formatarDataHoraBR(escalado.tratado_em)}
            </Badge>
          ) : (
            <Badge variant="muted">
              <CircleDashed className="size-3.5" /> Aberta
            </Badge>
          )}
        </div>
        <div className="mt-1 text-sm font-semibold text-secondary">
          {ouNaoInformado(residente?.nome)} · Quarto {residente?.quarto ?? "—"}
        </div>
        <div className="text-sm text-muted-foreground">{ouNaoInformado(i.observacao)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Registrado por {ouNaoInformado(i.registrado_por)} · {formatarDataHoraBR(i.registrado_em)}
        </div>
      </div>
    </div>
  );
}
