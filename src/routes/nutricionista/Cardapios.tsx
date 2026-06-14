/**
 * Cardápios diários por restrição — Nutricionista (BLOCO N3).
 *
 * A casa serve buffet; cada dia tem um cardápio por TIPO DE RESTRIÇÃO, composto
 * pelos pratos do N2. O custo por porção do cardápio (soma do custo/porção dos
 * pratos, com custo ATUAL dos insumos) será base para o valor estimado de
 * desperdício (N4) e o custo da refeição dos funcionários (N7).
 *
 * Integração leve (secundária, futura): exibir o cardápio do dia em leitura
 * para Coordenação/Cuidadores e/ou no portal da Família. Aqui priorizamos a
 * MONTAGEM pela Nutri.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  UtensilsCrossed,
  CalendarRange,
} from "lucide-react";
import { usePratos, useTodosPratoInsumos } from "@/hooks/usePratos";
import { useInsumos } from "@/hooks/useInsumos";
import {
  useCardapioDoDia,
  useCardapiosSemana,
  useAdicionarPratoCardapio,
  useRemoverItemCardapio,
  useCopiarCardapio,
} from "@/hooks/useCardapios";
import { custoPorcaoPorPrato, REFEICOES, RESTRICAO_LABEL, TIPOS_RESTRICAO } from "@/lib/cardapio";
import { formatarMoeda } from "@/lib/mensalidade";
import { dataISO, formatarDataBR, hojeISO, somarDias } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { Prato, RefeicaoCardapio, TipoRestricaoCardapio } from "@/types/database";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Cardapios() {
  const pratos = usePratos();
  const pratoInsumos = useTodosPratoInsumos();
  const insumos = useInsumos();

  const [data, setData] = useState(hojeISO());
  const [restricao, setRestricao] = useState<TipoRestricaoCardapio>("livre");

  const custoPorcao = useMemo(
    () => custoPorcaoPorPrato(pratos.data ?? [], pratoInsumos.data ?? [], insumos.data ?? []),
    [pratos.data, pratoInsumos.data, insumos.data],
  );
  const pratoPorId = useMemo(
    () => new Map((pratos.data ?? []).map((p) => [p.id, p])),
    [pratos.data],
  );

  if (pratos.isLoading || insumos.isLoading) return <LoadingState />;
  if (pratos.isError) return <ErrorState error={pratos.error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <CalendarDays className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Cardápios</h1>
          <p className="text-sm text-muted-foreground">Monte o cardápio do dia por tipo de restrição.</p>
        </div>
      </div>

      {/* Restrição (abas) */}
      <div className="flex flex-wrap gap-2">
        {TIPOS_RESTRICAO.map((r) => (
          <button
            key={r.value}
            onClick={() => setRestricao(r.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
              restricao === r.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="dia">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dia" className="gap-1.5">
            <CalendarDays className="size-4" /> Dia
          </TabsTrigger>
          <TabsTrigger value="semana" className="gap-1.5">
            <CalendarRange className="size-4" /> Semana
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dia">
          <VisaoDia
            data={data}
            setData={setData}
            restricao={restricao}
            pratos={(pratos.data ?? []).filter((p) => p.ativo)}
            pratoPorId={pratoPorId}
            custoPorcao={custoPorcao}
          />
        </TabsContent>
        <TabsContent value="semana">
          <VisaoSemana restricao={restricao} pratoPorId={pratoPorId} custoPorcao={custoPorcao} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Visão do dia (montagem) ──────────────────────────────────────────────────

function VisaoDia({
  data,
  setData,
  restricao,
  pratos,
  pratoPorId,
  custoPorcao,
}: {
  data: string;
  setData: (d: string) => void;
  restricao: TipoRestricaoCardapio;
  pratos: Prato[];
  pratoPorId: Map<string, Prato>;
  custoPorcao: Map<string, number>;
}) {
  const cardapio = useCardapioDoDia(data, restricao);
  const adicionar = useAdicionarPratoCardapio();
  const remover = useRemoverItemCardapio();
  const [copiarAberto, setCopiarAberto] = useState(false);

  const itens = cardapio.data?.itens ?? [];
  const custoTotal = itens.reduce((s, it) => s + (custoPorcao.get(it.prato_id) ?? 0), 0);

  function mudarDia(delta: number) {
    setData(dataISO(somarDias(new Date(data + "T00:00:00"), delta)));
  }

  return (
    <div className="space-y-4">
      {/* Navegação de data + custo + copiar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => mudarDia(-1)}><ChevronLeft className="size-4" /></Button>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
            <Button variant="outline" size="icon" onClick={() => mudarDia(1)}><ChevronRight className="size-4" /></Button>
            {data !== hojeISO() && (
              <Button variant="ghost" size="sm" onClick={() => setData(hojeISO())}>Hoje</Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo por pessoa</p>
              <p className="text-xl font-extrabold tabular-nums text-secondary">{formatarMoeda(custoTotal)}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCopiarAberto((v) => !v)}>
              <Copy className="size-4" /> Copiar cardápio
            </Button>
          </div>
        </CardContent>
      </Card>

      {copiarAberto && (
        <PainelCopiar
          destinoData={data}
          destinoRestricao={restricao}
          onFechar={() => setCopiarAberto(false)}
        />
      )}

      {cardapio.isLoading ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {REFEICOES.map((ref) => {
            const itensRef = itens.filter((it) => it.refeicao === ref.value);
            return (
              <RefeicaoCard
                key={ref.value}
                refeicao={ref.value}
                titulo={ref.label}
                itens={itensRef.map((it) => ({ id: it.id, prato: pratoPorId.get(it.prato_id) }))}
                custoPorcao={custoPorcao}
                pratos={pratos}
                adicionando={adicionar.isPending}
                onAdicionar={(pratoId) =>
                  adicionar.mutate(
                    { data, restricao, refeicao: ref.value, pratoId },
                    { onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao adicionar.") },
                  )
                }
                onRemover={(id) => remover.mutate({ id, data, restricao })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefeicaoCard({
  titulo,
  itens,
  custoPorcao,
  pratos,
  adicionando,
  onAdicionar,
  onRemover,
}: {
  refeicao: RefeicaoCardapio;
  titulo: string;
  itens: { id: string; prato: Prato | undefined }[];
  custoPorcao: Map<string, number>;
  pratos: Prato[];
  adicionando: boolean;
  onAdicionar: (pratoId: string) => void;
  onRemover: (id: string) => void;
}) {
  const [pratoSel, setPratoSel] = useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum prato.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <span className="min-w-0 font-medium text-secondary">
                  {it.prato?.nome ?? "Não informado"}
                  {it.prato && (
                    <span className="text-xs font-normal text-muted-foreground"> · {formatarMoeda(custoPorcao.get(it.prato.id) ?? 0)}/porção</span>
                  )}
                </span>
                <button onClick={() => onRemover(it.id)} aria-label="Remover" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select value={pratoSel} onChange={(e) => setPratoSel(e.target.value)} className={cn(inputBase, "min-w-[12rem] flex-1")}>
            <option value="">Adicionar prato…</option>
            {pratos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!pratoSel || adicionando}
            onClick={() => { onAdicionar(pratoSel); setPratoSel(""); }}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PainelCopiar({
  destinoData,
  destinoRestricao,
  onFechar,
}: {
  destinoData: string;
  destinoRestricao: TipoRestricaoCardapio;
  onFechar: () => void;
}) {
  const copiar = useCopiarCardapio();
  const [origemData, setOrigemData] = useState(dataISO(somarDias(new Date(destinoData + "T00:00:00"), -1)));
  const [origemRestricao, setOrigemRestricao] = useState<TipoRestricaoCardapio>(destinoRestricao);

  async function executar() {
    try {
      await copiar.mutateAsync({ origemData, origemRestricao, destinoData, destinoRestricao });
      toast.success("Cardápio copiado (substituiu o destino).");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível copiar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 py-4">
        <p className="text-sm font-semibold text-secondary">
          Copiar para {formatarDataBR(destinoData)} · {RESTRICAO_LABEL[destinoRestricao]}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Data de origem</span>
            <input type="date" value={origemData} onChange={(e) => setOrigemData(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Restrição de origem</span>
            <select value={origemRestricao} onChange={(e) => setOrigemRestricao(e.target.value as TipoRestricaoCardapio)} className={inputBase}>
              {TIPOS_RESTRICAO.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <Button size="sm" disabled={copiar.isPending} onClick={executar}>
            <Copy className="size-4" /> {copiar.isPending ? "Copiando…" : "Copiar (substitui)"}
          </Button>
          <Button size="sm" variant="outline" onClick={onFechar}>Cancelar</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Substitui os itens do dia/restrição atual pelos da origem.</p>
      </CardContent>
    </Card>
  );
}

// ─── Visão semanal (planejamento, leitura) ────────────────────────────────────

function inicioSemana(dataStr: string): Date {
  const d = new Date(dataStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return d;
}

function VisaoSemana({
  restricao,
  pratoPorId,
  custoPorcao,
}: {
  restricao: TipoRestricaoCardapio;
  pratoPorId: Map<string, Prato>;
  custoPorcao: Map<string, number>;
}) {
  const [refData, setRefData] = useState(hojeISO());
  const seg = inicioSemana(refData);
  const dias = Array.from({ length: 7 }, (_, i) => dataISO(somarDias(seg, i)));
  const fim = dias[6];
  const semana = useCardapiosSemana(dias[0], fim, restricao);

  const itensPorData = useMemo(() => {
    const cardId = new Map((semana.data?.cardapios ?? []).map((c) => [c.id, c.data]));
    const m = new Map<string, string[]>(); // data → prato_ids
    for (const it of semana.data?.itens ?? []) {
      const d = cardId.get(it.cardapio_id);
      if (!d) continue;
      const arr = m.get(d) ?? [];
      arr.push(it.prato_id);
      m.set(d, arr);
    }
    return m;
  }, [semana.data]);

  if (semana.isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button variant="outline" size="icon" onClick={() => setRefData(dataISO(somarDias(seg, -7)))}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-bold text-secondary">
            {formatarDataBR(dias[0])} – {formatarDataBR(fim)} · {RESTRICAO_LABEL[restricao]}
          </span>
          <Button variant="outline" size="icon" onClick={() => setRefData(dataISO(somarDias(seg, 7)))}><ChevronRight className="size-4" /></Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dias.map((d) => {
          const pratoIds = itensPorData.get(d) ?? [];
          const custoDia = pratoIds.reduce((s, id) => s + (custoPorcao.get(id) ?? 0), 0);
          return (
            <Card key={d}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize">
                    {new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}
                  </span>
                  {pratoIds.length > 0 && <Badge variant="muted">{formatarMoeda(custoDia)}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pratoIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem cardápio.</p>
                ) : (
                  <ul className="space-y-0.5 text-xs text-secondary/90">
                    {pratoIds.map((id, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <UtensilsCrossed className="size-3 shrink-0 text-muted-foreground" />
                        {pratoPorId.get(id)?.nome ?? "Não informado"}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
