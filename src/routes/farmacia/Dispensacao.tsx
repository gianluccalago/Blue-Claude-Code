/**
 * Tela de Dispensação — Farmácia
 * O farmacêutico separa o ziploc por período; ao confirmar, a baixa de estoque ocorre aqui.
 * Duas abas: "Dispensar" (por hóspede) e "Mapa do período" (todos os hóspedes).
 */
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Package,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Pill,
  PackageMinus,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { usePrescricoesParaFarmacia } from "@/hooks/useFarmacia";
import {
  hojeISODate,
  useDispensacoesDoHospede,
  useDispensacoesDodia,
  useConfirmarDispensacao,
  useDesfazerDispensacao,
} from "@/hooks/useDispensacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HospedeSelector } from "@/components/HospedeSelector";
import { LembreteProvisionamento } from "@/components/farmacia/LembreteProvisionamento";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";
import type { Dispensacao, ItemDispensacaoJson, PeriodoMedicacao, Prescricao } from "@/types/database";

// ─── Constantes de período ────────────────────────────────────────────────────

const PERIODOS: { key: PeriodoMedicacao; label: string; horario: string }[] = [
  { key: "jejum", label: "Jejum", horario: "06:00" },
  { key: "manha", label: "Manhã", horario: "08:00" },
  { key: "almoco", label: "Almoço", horario: "12:00" },
  { key: "apos_almoco", label: "Após almoço", horario: "13:00" },
  { key: "tarde", label: "Tarde", horario: "16:00" },
  { key: "noite", label: "Noite", horario: "20:00" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsearQtd(q: string | null): { numero: number; unidade: string } {
  if (!q) return { numero: 1, unidade: "unidade" };
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)/);
  if (!m) return { numero: 1, unidade: q.trim() };
  const n = parseFloat(m[1].replace(",", "."));
  return { numero: isNaN(n) ? 1 : Math.ceil(n), unidade: m[2].trim() || "unidade" };
}

function extrairErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

function formatarPeriodoLabel(periodo: string): string {
  return PERIODOS.find((p) => p.key === periodo)?.label ?? periodo;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Dispensacao() {
  const { data: residentes = [], isLoading, error } = useResidentes();
  const [hospedeId, setHospedeId] = useState<string | undefined>();
  const [tabAtiva, setTabAtiva] = useState<"dispensar" | "mapa">("dispensar");
  const [dataSelecionada, setDataSelecionada] = useState(hojeISODate());

  const hId = hospedeId ?? residentes[0]?.id;
  const indice = residentes.findIndex((r) => r.id === hId);
  const proximo = indice < residentes.length - 1 ? residentes[indice + 1] : null;

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (residentes.length === 0) return <EmptyState label="Nenhum hóspede cadastrado." />;

  return (
    <div className="space-y-4 pb-8">
      <LembreteProvisionamento />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Dispensação</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Data:</label>
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as "dispensar" | "mapa")}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dispensar" className="gap-1.5">
            <Package className="h-4 w-4" /> Dispensar por hóspede
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-1.5">
            <Users className="h-4 w-4" /> Mapa do período
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dispensar" className="space-y-4 mt-4">
          <HospedeSelector
            hospedes={residentes}
            selecionadoId={hId}
            onSelect={setHospedeId}
          />
          {hId && (
            <Dispensar
              key={`${hId}-${dataSelecionada}`}
              residenteId={hId}
              data={dataSelecionada}
              onProximo={proximo ? () => setHospedeId(proximo.id) : undefined}
              proximoNome={proximo?.nome ?? null}
            />
          )}
        </TabsContent>

        <TabsContent value="mapa" className="mt-4">
          <MapaPeriodo residentes={residentes} data={dataSelecionada} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Aba Dispensar ────────────────────────────────────────────────────────────

function Dispensar({
  residenteId,
  data,
  onProximo,
  proximoNome,
}: {
  residenteId: string;
  data: string;
  onProximo?: () => void;
  proximoNome: string | null;
}) {
  const [periodoKey, setPeriodoKey] = useState<PeriodoMedicacao>("manha");
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data: prescricoes = [], isLoading: loadPx, error: errPx } = usePrescricoesParaFarmacia(residenteId);
  const { data: dispensacoes = [], isLoading: loadDisp } = useDispensacoesDoHospede(residenteId, data);
  const confirmar = useConfirmarDispensacao();
  const desfazer = useDesfazerDispensacao();

  // Prescrições orais do período selecionado
  const itensDoZiploc: ItemDispensacaoJson[] = useMemo(() => {
    return prescricoes
      .filter((p) => p.periodo === periodoKey && p.via === "oral")
      .map((p) => {
        const { numero, unidade } = parsearQtd(p.quantidade);
        return { medicamento: p.medicamento, quantidade: numero, unidade };
      });
  }, [prescricoes, periodoKey]);

  // Dispensações deste período nesta data
  const dispDoPeriodo = useMemo(
    () => dispensacoes.filter((d) => d.periodo === periodoKey),
    [dispensacoes, periodoKey]
  );

  async function handleConfirmar(avancar: boolean) {
    if (itensDoZiploc.length === 0) return;
    setConfirmando(true);
    setErro(null);
    try {
      await confirmar.mutateAsync({
        residenteId,
        periodo: periodoKey,
        data,
        itens: itensDoZiploc,
      });
      toast.success("Dispensação confirmada — estoque baixado.");
      if (avancar && onProximo) onProximo();
    } catch (e) {
      setErro(extrairErro(e));
    } finally {
      setConfirmando(false);
    }
  }

  async function handleDesfazer(disp: Dispensacao) {
    if (!window.confirm("Desfazer esta dispensação e estornar o estoque?")) return;
    try {
      await desfazer.mutateAsync(disp);
      toast.success("Dispensação desfeita — estoque estornado.");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  if (loadPx || loadDisp) return <LoadingState />;
  if (errPx) return <ErrorState error={errPx} />;

  return (
    <div className="space-y-4">
      {/* Seletor de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriodoKey(p.key); setErro(null); }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              periodoKey === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground hover:bg-accent"
            )}
          >
            {p.label} <span className="opacity-60 text-xs">{p.horario}</span>
          </button>
        ))}
      </div>

      {/* Lista de separação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Ziploc — {formatarPeriodoLabel(periodoKey)}
            <Badge variant="outline" className="ml-auto text-xs">
              {itensDoZiploc.length} {itensDoZiploc.length === 1 ? "item" : "itens"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {itensDoZiploc.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem prescrições orais ativas para este período.
            </p>
          ) : (
            itensDoZiploc.map((item) => (
              <div
                key={item.medicamento}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{item.medicamento}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.quantidade} {item.unidade}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Botões confirmar */}
      {erro && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erro}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={itensDoZiploc.length === 0 || confirmando || confirmar.isPending}
          onClick={() => handleConfirmar(false)}
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirmando ? "Salvando…" : "Confirmar"}
        </Button>
        <Button
          className="w-full gap-2"
          disabled={itensDoZiploc.length === 0 || confirmando || confirmar.isPending || !onProximo}
          onClick={() => handleConfirmar(true)}
        >
          <CheckCircle2 className="h-4 w-4" />
          {onProximo ? `Confirmar e próximo ▸` : "Confirmar (último)"}
        </Button>
      </div>
      {onProximo && proximoNome && (
        <p className="text-center text-xs text-muted-foreground">
          Próximo: <span className="font-semibold">{proximoNome}</span>
        </p>
      )}

      {/* Histórico do período nesta data */}
      {dispDoPeriodo.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Dispensações de hoje — {formatarPeriodoLabel(periodoKey)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dispDoPeriodo.map((d) => (
              <DispensacaoItem
                key={d.id}
                dispensacao={d}
                onDesfazer={handleDesfazer}
                desfazendo={desfazer.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de outros períodos */}
      {dispensacoes.filter((d) => d.periodo !== periodoKey).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outros períodos hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dispensacoes
              .filter((d) => d.periodo !== periodoKey)
              .map((d) => (
                <DispensacaoItem
                  key={d.id}
                  dispensacao={d}
                  onDesfazer={handleDesfazer}
                  desfazendo={desfazer.isPending}
                />
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Item de dispensação com desfazer ────────────────────────────────────────

function DispensacaoItem({
  dispensacao,
  onDesfazer,
  desfazendo,
}: {
  dispensacao: Dispensacao;
  onDesfazer: (d: Dispensacao) => void;
  desfazendo: boolean;
}) {
  const itens = dispensacao.itens as ItemDispensacaoJson[];
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {formatarPeriodoLabel(dispensacao.periodo)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatarDataHoraBR(dispensacao.dispensado_em)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive"
          title="Desfazer dispensação"
          disabled={desfazendo}
          onClick={() => onDesfazer(dispensacao)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((item) => (
          <Badge key={item.medicamento} variant="secondary" className="text-xs">
            {item.medicamento} · {item.quantidade} {item.unidade}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Aba Mapa do período ──────────────────────────────────────────────────────

function MapaPeriodo({
  residentes,
  data,
}: {
  residentes: { id: string; nome: string }[];
  data: string;
}) {
  const [periodoKey, setPeriodoKey] = useState<PeriodoMedicacao>("manha");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const { data: todasDispensacoes = [], isLoading: loadDisp } = useDispensacoesDodia(data);
  const confirmar = useConfirmarDispensacao();

  // Mapa residenteId → dispensações do período hoje
  const dispPorResidente = useMemo(() => {
    const m: Record<string, Dispensacao[]> = {};
    for (const d of todasDispensacoes) {
      if (d.periodo !== periodoKey) continue;
      if (!m[d.residente_id]) m[d.residente_id] = [];
      m[d.residente_id].push(d);
    }
    return m;
  }, [todasDispensacoes, periodoKey]);

  if (loadDisp) return <LoadingState />;

  return (
    <div className="space-y-4">
      {/* Seletor de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPeriodoKey(p.key); setErros({}); }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              periodoKey === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground hover:bg-accent"
            )}
          >
            {p.label} <span className="opacity-60 text-xs">{p.horario}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {residentes.map((res) => (
          <MapaHospede
            key={res.id}
            residente={res}
            periodoKey={periodoKey}
            dispensacoes={dispPorResidente[res.id] ?? []}
            confirmando={confirmandoId === res.id}
            erro={erros[res.id]}
            onConfirmar={async (itens) => {
              setConfirmandoId(res.id);
              setErros((prev) => ({ ...prev, [res.id]: "" }));
              try {
                await confirmar.mutateAsync({
                  residenteId: res.id,
                  periodo: periodoKey,
                  data,
                  itens,
                });
              } catch (e) {
                setErros((prev) => ({ ...prev, [res.id]: extrairErro(e) }));
              } finally {
                setConfirmandoId(null);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MapaHospede({
  residente,
  periodoKey,
  dispensacoes,
  confirmando,
  erro,
  onConfirmar,
}: {
  residente: { id: string; nome: string };
  periodoKey: PeriodoMedicacao;
  dispensacoes: Dispensacao[];
  confirmando: boolean;
  erro: string | undefined;
  onConfirmar: (itens: ItemDispensacaoJson[]) => void;
}) {
  const { data: prescricoes = [], isLoading } = usePrescricoesParaFarmacia(residente.id);

  const itensDoZiploc: ItemDispensacaoJson[] = useMemo(() => {
    return prescricoes
      .filter((p: Prescricao) => p.periodo === periodoKey && p.via === "oral")
      .map((p: Prescricao) => {
        const { numero, unidade } = parsearQtd(p.quantidade);
        return { medicamento: p.medicamento, quantidade: numero, unidade };
      });
  }, [prescricoes, periodoKey]);

  const jaDispensado = dispensacoes.length > 0;

  if (isLoading) return <div className="h-12 animate-pulse rounded-lg bg-accent" />;

  // Sem itens orais no período: ainda mostra o hóspede (linha discreta) para a
  // farmacêutica saber que não pulou ninguém.
  if (itensDoZiploc.length === 0) {
    return (
      <Card className="opacity-60">
        <CardContent className="flex items-center gap-3 p-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground">
            <PackageMinus className="h-4 w-4" />
          </div>
          <p className="flex-1 text-sm font-medium">{residente.nome}</p>
          <Badge variant="muted" className="text-xs">
            sem prescrição oral
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(jaDispensado && "opacity-75")}>
      <CardContent className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "mt-0.5 rounded-full p-1.5 shrink-0",
            jaDispensado ? "bg-success/12 text-success" : "bg-warning/15 text-warning-foreground"
          )}
        >
          {jaDispensado ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <PackageMinus className="h-4 w-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{residente.nome}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {itensDoZiploc.map((item) => (
              <Badge key={item.medicamento} variant="outline" className="text-xs">
                {item.medicamento} · {item.quantidade} {item.unidade}
              </Badge>
            ))}
          </div>
          {jaDispensado && (
            <p className="text-xs text-success mt-1">
              Dispensado {dispensacoes.length}× hoje
            </p>
          )}
          {erro && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {erro}
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant={jaDispensado ? "outline" : "default"}
          disabled={confirmando}
          onClick={() => onConfirmar(itensDoZiploc)}
          className="shrink-0 text-xs"
        >
          {confirmando ? "…" : jaDispensado ? "Dispensar de novo" : "Confirmar"}
        </Button>
      </CardContent>
    </Card>
  );
}
