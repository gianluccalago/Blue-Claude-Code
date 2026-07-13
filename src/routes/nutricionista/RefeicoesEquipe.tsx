/**
 * Custo de refeições da equipe — Nutricionista (BLOCO N7).
 *
 * ESTIMATIVA de custo (não contábil). Os funcionários comem de graça; não se
 * registra prato a prato. O custo do mês é estimado por:
 *   refeições/dia da equipe × dias do mês × custo médio por refeição.
 * O custo médio é uma constante configurável (proxy enxuto do custo por porção
 * do cardápio/N3). NÃO gera cobrança — é benefício à equipe.
 *
 * Edição: Nutricionista e Master. Administração e Direção veem em LEITURA.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Soup, Check, X, Pencil, Calculator, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useConfigsRefeicaoEquipe, useSalvarConfigRefeicaoEquipe } from "@/hooks/useRefeicaoEquipe";
import {
  custoMesEquipe,
  configVigenteNoMes,
  CUSTO_MEDIO_REFEICAO_PADRAO,
  REFEICOES_EQUIPE_POR_DIA_PADRAO,
} from "@/lib/refeicaoEquipe";
import { formatarMoeda, mesAtual, deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, Sparkbars } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";
import { formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { ConfigRefeicaoEquipe } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RefeicoesEquipe() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEditar = perfil === "nutricionista" || perfil === "master";

  const configs = useConfigsRefeicaoEquipe();
  const [mes, setMes] = useState(mesAtual());
  const [editando, setEditando] = useState(false);

  // Tendência: o mês selecionado e os 5 anteriores (hook antes de qualquer return).
  const meses = useMemo(() => {
    const out: string[] = [];
    for (let i = 5; i >= 0; i--) out.push(deslocarMes(mes, -i));
    return out;
  }, [mes]);

  if (configs.isLoading) return <LoadingState />;
  if (configs.isError) return <ErrorState error={configs.error} />;
  const historico = configs.data ?? [];
  const vigenteAgora = configVigenteNoMes(historico, mesAtual());

  const custos = meses.map((m) => custoMesEquipe(historico, m));
  const custoSelecionado = custoMesEquipe(historico, mes);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Soup className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Custo de refeições da equipe</h1>
        </div>
      </div>

      {/* Configuração (edita Nutri/Master; demais veem o valor vigente). */}
      {editando && podeEditar ? (
        <FormConfig
          atual={vigenteAgora}
          onFechar={() => setEditando(false)}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Configuração vigente</CardTitle>
            {podeEditar && (
              <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                <Pencil className="size-4" /> Editar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {vigenteAgora ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Info rotulo="Refeições/dia da equipe" valor={`${vigenteAgora.refeicoes_equipe_por_dia.toLocaleString("pt-BR")}`} />
                <Info rotulo="Custo médio por refeição" valor={formatarMoeda(vigenteAgora.custo_medio_refeicao_fallback)} />
                <Info
                  rotulo="Vigente desde"
                  valor={formatarDataBR(vigenteAgora.vigente_desde)}
                  apoio={`por ${ouNaoInformado(vigenteAgora.atualizado_por)}`}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma configuração definida. {podeEditar ? "Defina as refeições/dia e o custo médio." : "Não informado."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Visão do mês — cálculo aberto */}
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-secondary" /> Visão do mês
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMes((m) => deslocarMes(m, -1))}>Anterior</Button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-secondary">{formatarMesReferencia(mes)}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMes((m) => deslocarMes(m, 1))}
              disabled={mes >= mesAtual()}
            >
              Próximo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> Custo estimado (não contábil)</Badge>
          </div>

          {custoSelecionado.temConfig ? (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo estimado do mês</p>
                <p className="text-3xl font-extrabold tabular-nums text-secondary">{formatarMoeda(custoSelecionado.custoTotal)}</p>
                {/* Cálculo aberto — transparência */}
                <p className="mt-1 text-sm text-muted-foreground">
                  {custoSelecionado.refeicoesPorDia.toLocaleString("pt-BR")} refeições/dia ×{" "}
                  {custoSelecionado.dias} dias × {formatarMoeda(custoSelecionado.custoMedio)} ={" "}
                  <strong className="text-secondary">{formatarMoeda(custoSelecionado.custoTotal)}</strong>
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={Soup} tom="secondary" rotulo="Refeições no mês" valor={custoSelecionado.refeicoesNoMes.toLocaleString("pt-BR")} />
                <StatCard icon={Calculator} tom="secondary" rotulo="Custo médio/refeição" valor={formatarMoeda(custoSelecionado.custoMedio)} />
                <StatCard icon={Soup} tom="secondary" rotulo="Refeições/dia" valor={custoSelecionado.refeicoesPorDia.toLocaleString("pt-BR")} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Não informado — sem configuração vigente neste mês.</p>
          )}
        </CardContent>
      </Card>

      {/* Tendência (6 meses) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-secondary" /> Tendência (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Sparkbars valores={custos.map((c) => c.custoTotal)} tom="primary" />
          <div className="space-y-1.5">
            {custos
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.mes} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <span className="font-semibold text-secondary">{formatarMesReferencia(c.mes)}</span>
                  {c.temConfig ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {c.refeicoesPorDia.toLocaleString("pt-BR")}/dia × {c.dias} × {formatarMoeda(c.custoMedio)}
                      </span>
                      <span className="font-bold tabular-nums text-secondary">{formatarMoeda(c.custoTotal)}</span>
                    </span>
                  ) : (
                    <Badge variant="muted">Não informado</Badge>
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-bold tabular-nums text-secondary">{valor}</p>
      {apoio && <p className="text-[11px] text-muted-foreground">{apoio}</p>}
    </div>
  );
}

// ─── Form de configuração (grava nova vigência, mantém histórico) ───────────

function FormConfig({ atual, onFechar }: { atual: ConfigRefeicaoEquipe | null; onFechar: () => void }) {
  const salvar = useSalvarConfigRefeicaoEquipe();
  const [refeicoes, setRefeicoes] = useState(
    atual ? String(atual.refeicoes_equipe_por_dia) : String(REFEICOES_EQUIPE_POR_DIA_PADRAO),
  );
  const [custo, setCusto] = useState(
    atual ? String(atual.custo_medio_refeicao_fallback) : String(CUSTO_MEDIO_REFEICAO_PADRAO),
  );

  const refeicoesNum = Number(refeicoes.replace(",", "."));
  const custoNum = Number(custo.replace(",", "."));
  const valido = Number.isFinite(refeicoesNum) && refeicoesNum >= 0 && Number.isFinite(custoNum) && custoNum >= 0;

  async function submit() {
    if (!valido) {
      toast.error("Informe valores válidos (≥ 0).");
      return;
    }
    try {
      await salvar.mutateAsync({ refeicoesEquipePorDia: refeicoesNum, custoMedioRefeicao: custoNum });
      toast.success("Configuração atualizada.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configurar custo de refeições da equipe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Refeições/dia da equipe (estimativa)</span>
            <input type="number" min={0} step="1" value={refeicoes} onChange={(e) => setRefeicoes(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Custo médio por refeição (R$)</span>
            <input type="number" min={0} step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} className={inputBase} />
          </label>
        </div>
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Estimativa enxuta: o custo médio aproxima o custo por porção do cardápio (N3). Ao salvar, a nova
          vigência passa a valer e a anterior fica no histórico.
        </p>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!valido || salvar.isPending}>
            <Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
