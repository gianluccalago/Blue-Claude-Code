/**
 * Desperdício de alimento — Nutricionista (BLOCO N4).
 *
 * O VALOR É ESTIMADO (não contábil): peso descartado × custo médio por kg, onde
 * o custo médio por kg vem do custo/porção do cardápio do dia (N3) ÷ peso médio
 * por porção (ver lib/desperdicio — constantes calibráveis). Este indicador
 * (peso + valor estimado/mês) pode subir ao painel do Master/Administração.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Pencil,
  Check,
  X,
  Scale,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { usePratos, useTodosPratoInsumos } from "@/hooks/usePratos";
import { useInsumos } from "@/hooks/useInsumos";
import { useCardapioDoDia } from "@/hooks/useCardapios";
import {
  useDesperdicioDoMes,
  useRegistrarDesperdicio,
  useEditarDesperdicio,
  useRemoverDesperdicio,
} from "@/hooks/useDesperdicio";
import { custoPorcaoPorPrato } from "@/lib/cardapio";
import {
  REFEICOES_DESPERDICIO,
  REFEICAO_DESPERDICIO_LABEL,
  estimarDesperdicio,
} from "@/lib/desperdicio";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, Sparkbars } from "@/components/dashboard/primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { Desperdicio as DesperdicioRow, RefeicaoDesperdicio } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function fmtPeso(kg: number): string {
  return `${(Math.round(kg * 10) / 10).toLocaleString("pt-BR")} kg`;
}

export function Desperdicio() {
  const pratos = usePratos();
  const pratoInsumos = useTodosPratoInsumos();
  const insumos = useInsumos();
  const [mes, setMes] = useState(mesAtual());
  const registros = useDesperdicioDoMes(mes);

  const remover = useRemoverDesperdicio();
  const [editando, setEditando] = useState<DesperdicioRow | null>(null);
  const [confirmar, setConfirmar] = useState<DesperdicioRow | null>(null);

  const custoPorcao = useMemo(
    () => custoPorcaoPorPrato(pratos.data ?? [], pratoInsumos.data ?? [], insumos.data ?? []),
    [pratos.data, pratoInsumos.data, insumos.data],
  );

  const lista = registros.data ?? [];
  const totalPeso = lista.reduce((s, r) => s + r.peso_kg, 0);
  const totalValor = lista.reduce((s, r) => s + r.custo_estimado, 0);
  const diasComRegistro = new Set(lista.map((r) => r.data)).size;
  const mediaPesoDia = diasComRegistro > 0 ? totalPeso / diasComRegistro : 0;

  // Tendência diária (valor estimado por dia do mês).
  const [ano, mesNum] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, mesNum, 0).getDate();
  const valorPorDia = useMemo(() => {
    const arr = new Array(diasNoMes).fill(0);
    for (const r of lista) {
      const dia = Number(r.data.slice(8, 10));
      if (dia >= 1 && dia <= diasNoMes) arr[dia - 1] += r.custo_estimado;
    }
    return arr;
  }, [lista, diasNoMes]);

  // Por refeição (quais mais desperdiçam).
  const porRefeicao = useMemo(() => {
    const m = new Map<string, { peso: number; valor: number }>();
    for (const r of lista) {
      const cur = m.get(r.refeicao) ?? { peso: 0, valor: 0 };
      cur.peso += r.peso_kg;
      cur.valor += r.custo_estimado;
      m.set(r.refeicao, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].valor - a[1].valor);
  }, [lista]);

  if (pratos.isLoading || insumos.isLoading || registros.isLoading) return <LoadingState />;
  if (registros.isError) return <ErrorState error={registros.error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <TrendingDown className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Desperdício</h1>
          <p className="text-sm text-muted-foreground">Peso descartado e valor ESTIMADO (aproximado).</p>
        </div>
      </div>

      {/* Aviso de estimativa */}
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-2 py-3 text-xs text-secondary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <span>
            O <strong>valor é estimado</strong> (peso × custo médio por kg), não é dado contábil. Serve para
            acompanhar tendência e calibrar a produção.
          </span>
        </CardContent>
      </Card>

      {/* Registrar */}
      <FormDesperdicio custoPorcao={custoPorcao} />

      {/* Navegação de mês */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button variant="outline" size="sm" onClick={() => setMes((m) => deslocarMes(m, -1))}>Anterior</Button>
          <span className="text-lg font-bold text-secondary">{formatarMesReferencia(mes)}</span>
          <Button variant="outline" size="sm" onClick={() => setMes((m) => deslocarMes(m, 1))}>Próximo</Button>
        </CardContent>
      </Card>

      {/* KPIs do mês */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Scale} tom="secondary" rotulo="Peso descartado (mês)" valor={fmtPeso(totalPeso)} />
        <StatCard icon={TrendingDown} tom="warning" rotulo="Valor estimado (mês)" valor={formatarMoeda(totalValor)} />
        <StatCard icon={Scale} tom="secondary" rotulo="Média por dia registrado" valor={fmtPeso(mediaPesoDia)} />
      </div>

      {lista.length === 0 ? (
        <EmptyState label="Nenhum registro de desperdício neste mês." />
      ) : (
        <>
          {/* Tendência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendência diária (valor estimado)</CardTitle>
            </CardHeader>
            <CardContent>
              <Sparkbars valores={valorPorDia} tom="warning" />
              <p className="mt-1 text-xs text-muted-foreground">Dia 1 a {diasNoMes} do mês.</p>
            </CardContent>
          </Card>

          {/* Por refeição */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por refeição (onde mais sobra)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {porRefeicao.map(([ref, v]) => (
                <div key={ref} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-secondary">{REFEICAO_DESPERDICIO_LABEL[ref] ?? ref}</span>
                  <span className="text-muted-foreground">
                    {fmtPeso(v.peso)} · <span className="font-semibold text-secondary">{formatarMoeda(v.valor)}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Lista de registros */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Registros do mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lista.map((r) =>
                editando?.id === r.id ? (
                  <FormDesperdicio key={r.id} custoPorcao={custoPorcao} inicial={r} onFechar={() => setEditando(null)} />
                ) : (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-secondary">{formatarDataBR(r.data)}</span>
                        <Badge variant="muted">{REFEICAO_DESPERDICIO_LABEL[r.refeicao] ?? r.refeicao}</Badge>
                        <span className="text-muted-foreground">{fmtPeso(r.peso_kg)}</span>
                        <span className="font-semibold text-secondary">{formatarMoeda(r.custo_estimado)} <span className="text-xs font-normal text-muted-foreground">(estimado)</span></span>
                      </div>
                      {r.observacao && <p className="text-xs text-muted-foreground">{r.observacao}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditando(r)} aria-label="Editar"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmar(r)} aria-label="Remover"><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        aberto={!!confirmar}
        titulo="Remover este registro de desperdício?"
        descricao={confirmar ? `${formatarDataBR(confirmar.data)} · ${fmtPeso(confirmar.peso_kg)} · ${formatarMoeda(confirmar.custo_estimado)}` : undefined}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={() => {
          if (confirmar) remover.mutate(confirmar.id, { onSuccess: () => toast.success("Registro removido.") });
          setConfirmar(null);
        }}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}

function FormDesperdicio({
  custoPorcao,
  inicial,
  onFechar,
}: {
  custoPorcao: Map<string, number>;
  inicial?: DesperdicioRow;
  onFechar?: () => void;
}) {
  const registrar = useRegistrarDesperdicio();
  const editar = useEditarDesperdicio();
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [refeicao, setRefeicao] = useState<RefeicaoDesperdicio>(inicial?.refeicao ?? "almoco");
  const [peso, setPeso] = useState(inicial ? String(inicial.peso_kg) : "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");

  // Custo/porção do cardápio "Livre" do dia → base do custo médio por kg.
  const cardapio = useCardapioDoDia(data, "livre");
  const custoPorcaoDia = (cardapio.data?.itens ?? []).reduce(
    (s, it) => s + (custoPorcao.get(it.prato_id) ?? 0),
    0,
  );

  const pesoNum = Number(peso.replace(",", "."));
  const pesoValido = Number.isFinite(pesoNum) && pesoNum > 0;
  const estimativa = estimarDesperdicio(pesoValido ? pesoNum : 0, custoPorcaoDia);
  const salvando = registrar.isPending || editar.isPending;

  async function salvar() {
    if (!pesoValido) {
      toast.error("Informe um peso válido (kg).");
      return;
    }
    const payload = {
      data,
      refeicao,
      pesoKg: pesoNum,
      custoEstimado: Math.round(estimativa.custoEstimado * 100) / 100,
      metodoEstimativa: estimativa.metodo,
      observacao: observacao || null,
    };
    try {
      if (inicial) await editar.mutateAsync({ id: inicial.id, ...payload });
      else await registrar.mutateAsync(payload);
      toast.success(inicial ? "Registro atualizado." : "Descarte registrado.");
      if (inicial) onFechar?.();
      else { setPeso(""); setObservacao(""); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{inicial ? "Editar registro" : "Registrar descarte"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Refeição</span>
            <select value={refeicao} onChange={(e) => setRefeicao(e.target.value as RefeicaoDesperdicio)} className={inputBase}>
              {REFEICOES_DESPERDICIO.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Peso descartado (kg)</span>
            <input type="number" step="0.1" min={0} value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0,0" className={inputBase} />
          </label>
        </div>

        {/* Valor estimado em destaque */}
        <div className={cn("rounded-lg border p-3", estimativa.fallback ? "border-warning/40 bg-warning/5" : "border-primary/30 bg-primary/5")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor estimado</p>
          <p className="text-2xl font-extrabold tabular-nums text-secondary">{formatarMoeda(estimativa.custoEstimado)}</p>
          <p className="text-[11px] text-muted-foreground">{estimativa.metodo}</p>
          {estimativa.fallback && (
            <p className="text-[11px] font-semibold text-warning-foreground">Sem cardápio no dia — usando custo médio de fallback.</p>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: sobra de arroz e feijão…" className={inputBase} />
        </label>

        <div className="flex gap-2">
          <Button onClick={salvar} disabled={!pesoValido || salvando}>
            <Check className="size-4" /> {salvando ? "Salvando…" : inicial ? "Salvar" : "Registrar"}
          </Button>
          {inicial && (
            <Button variant="outline" onClick={onFechar} disabled={salvando}>
              <X className="size-4" /> Cancelar
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Estimativa aproximada — não é dado contábil.</p>
      </CardContent>
    </Card>
  );
}
