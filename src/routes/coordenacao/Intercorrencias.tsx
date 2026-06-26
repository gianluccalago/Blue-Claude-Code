import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Stethoscope, CircleDashed, Ambulance, Pencil, ShieldAlert } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useTodasIntercorrencias, useTratamentos, useResolucoesMedicas } from "@/hooks/useCoordenacao";
import { RegistrarEventoSentinelaModal } from "@/components/vigilancia/RegistrarEventoSentinelaModal";
import { useRegistrarAmbulancia } from "@/hooks/useIntercorrencia";
import { AmbulanciaFields } from "@/components/intercorrencia/AmbulanciaFields";
import {
  DESFECHO_AMBULANCIA_LABEL,
  formatarTempoResposta,
  type DadosAmbulancia,
} from "@/lib/ambulancia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Intercorrencia, PendenciaTratamento, Residente, ResolucaoMedica } from "@/types/database";

const TIPOS = [
  "Queda",
  "Alteração de consciência",
  "Humor/sono",
  "Lesão de pele",
  "Recusa",
  "Vômito",
  "Outras",
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
  const resolucoes = useResolucoesMedicas();

  const [hospedeFiltro, setHospedeFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<Periodo>("7d");
  const [registrarSentinela, setRegistrarSentinela] = useState(false);

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
      // Só hóspedes ATIVOS (inativados somem do operacional): `info` já é a
      // lista de ativos (useResidentes).
      if (!info.has(i.residente_id)) return false;
      if (hospedeFiltro !== "todos" && i.residente_id !== hospedeFiltro) return false;
      if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return false;
      if (!dentroDoPeriodo(i.registrado_em, periodoFiltro)) return false;
      return true;
    });
  }, [intercorrencias.data, info, hospedeFiltro, tipoFiltro, periodoFiltro]);

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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Histórico de intercorrências</CardTitle>
          {/* RDC 502/2021: a Coordenação registra eventos sentinela (queda c/
              lesão, tentativa de suicídio, doença de notificação compulsória).
              O RT acompanha/notifica na aba Vigilância Sanitária. */}
          <Button variant="outline" size="sm" onClick={() => setRegistrarSentinela(true)}>
            <ShieldAlert className="size-4" /> Registrar evento sentinela
          </Button>
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
              resolucoes={resolucoes.data ?? []}
            />
          ))}
        </div>
      )}

      {registrarSentinela && (
        <RegistrarEventoSentinelaModal onFechar={() => setRegistrarSentinela(false)} />
      )}
    </div>
  );
}

function IntercorrenciaCard({
  intercorrencia: i,
  residente,
  tratamentos,
  resolucoes,
}: {
  intercorrencia: Intercorrencia;
  residente: Residente | undefined;
  tratamentos: PendenciaTratamento[];
  resolucoes: ResolucaoMedica[];
}) {
  // tratamentos já vêm ordenados do mais recente p/ o mais antigo.
  const doItem = tratamentos.filter(
    (t) => t.tipo_origem === "intercorrencia" && t.referencia_id === i.id,
  );
  const resolvido = doItem.find((t) => t.acao === "resolvido");
  const escalado = doItem.find((t) => t.acao === "escalado_medico");
  const resolucaoMedica = resolucoes.find(
    (r) => r.tipo_origem === "intercorrencia" && r.referencia_id === i.id,
  );

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
          ) : resolucaoMedica ? (
            <Badge variant="success">
              <Stethoscope className="size-3.5" /> Resolvido pelo médico ·{" "}
              {formatarDataHoraBR(resolucaoMedica.resolvido_em)}
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
        {resolucaoMedica?.observacao && (
          <div className="mt-1 text-sm text-secondary/80">
            Conduta: "{resolucaoMedica.observacao}"
          </div>
        )}
        <div className="mt-1 text-sm font-semibold text-secondary">
          {ouNaoInformado(residente?.nome)} · Quarto {residente?.quarto ?? "—"}
        </div>
        <div className="text-sm text-muted-foreground">{ouNaoInformado(i.observacao)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Registrado por {ouNaoInformado(i.registrado_por)} · {formatarDataHoraBR(i.registrado_em)}
        </div>

        <BlocoAmbulancia intercorrencia={i} />
      </div>
    </div>
  );
}

// ── Chamado de ambulância: exibição + edição (detalhes costumam chegar depois) ──
function BlocoAmbulancia({ intercorrencia: i }: { intercorrencia: Intercorrencia }) {
  const registrar = useRegistrarAmbulancia();
  const [editando, setEditando] = useState(false);
  const [acionada, setAcionada] = useState(i.ambulancia_acionada);
  const [dados, setDados] = useState<DadosAmbulancia>({
    medico: i.ambulancia_medico ?? "",
    tempoRespostaMin: i.ambulancia_tempo_resposta_min,
    desfecho: i.ambulancia_desfecho,
    hospitalDestino: i.ambulancia_hospital_destino ?? "",
  });

  async function salvar() {
    try {
      await registrar.mutateAsync({ id: i.id, ambulancia: acionada ? dados : null });
      toast.success(acionada ? "Chamado de ambulância salvo." : "Chamado de ambulância removido.");
      setEditando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  if (editando) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-card p-3">
        <AmbulanciaFields
          acionada={acionada}
          onAcionadaChange={setAcionada}
          valor={dados}
          onChange={(patch) => setDados((d) => ({ ...d, ...patch }))}
        />
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={salvar} disabled={registrar.isPending}>
            {registrar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={registrar.isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!i.ambulancia_acionada) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
      >
        <Ambulance className="size-3.5" /> Registrar chamado de ambulância
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-destructive">
          <Ambulance className="size-4" /> Ambulância acionada
        </span>
        <button
          onClick={() => setEditando(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
        >
          <Pencil className="size-3" /> Editar
        </button>
      </div>
      <div className="mt-1.5 grid gap-x-4 gap-y-1 text-sm text-secondary sm:grid-cols-2">
        <span>Médico: <strong>{ouNaoInformado(i.ambulancia_medico)}</strong></span>
        <span>Tempo de resposta: <strong>{formatarTempoResposta(i.ambulancia_tempo_resposta_min)}</strong></span>
        <span className="sm:col-span-2">
          Desfecho:{" "}
          <strong>
            {i.ambulancia_desfecho ? DESFECHO_AMBULANCIA_LABEL[i.ambulancia_desfecho] : "Não informado"}
          </strong>
          {i.ambulancia_desfecho === "removido_hospital" && i.ambulancia_hospital_destino && (
            <> — {i.ambulancia_hospital_destino}</>
          )}
        </span>
      </div>
    </div>
  );
}
