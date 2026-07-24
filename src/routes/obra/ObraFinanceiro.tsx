import { useState } from "react";
import { toast } from "sonner";
import { Wallet, TrendingUp, CalendarClock, Download, Ruler, X, Pencil } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra } from "@/hooks/useObra";
import { useMedicoes } from "@/hooks/useObraMedicoes";
import { useMarcos, useDisciplinas } from "@/hooks/useObraProjetos";
import { useOrdensCompra } from "@/hooks/useObraMateriais";
import { useCustosIndiretos } from "@/hooks/useObraCustos";
import { useBaseline, useAtualizarBaseline } from "@/hooks/useObraFinanceiro";
import {
  serieAcumuladaMensal,
  somaPorMes,
  custoM2,
  saldoOrcamentario,
  type LinhaResumo,
} from "@/lib/obraFinanceiro";
import { arred, somarDiasISO } from "@/lib/obraCalc";
import { exportarCSV } from "@/lib/exportCsv";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraBaseline } from "@/types/database";

const GRUPO_LABEL: Record<string, string> = {
  mo: "Mão de obra", projetos: "Projetos", materiais: "Materiais",
  fornecedores: "Fornecedores diretos", ensaios: "Ensaios", taxas: "Taxas",
  indiretos: "Custos indiretos",
};

export function ObraFinanceiro() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const baseline = useBaseline();
  const fases = useFasesObra();
  const medicoes = useMedicoes();
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const ordens = useOrdensCompra();
  const custos = useCustosIndiretos();

  // Edição do orçado: um grupo pode ter várias linhas (MO tem 4 fases) — o
  // modal lista todas as linhas do grupo, cada uma editável.
  const [editandoGrupo, setEditandoGrupo] = useState<ObraBaseline[] | null>(null);

  const carregando = baseline.isLoading || fases.isLoading || medicoes.isLoading;
  if (carregando) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaBase = baseline.data ?? [];
  if (listaBase.length === 0)
    return <EmptyState label="Baseline não encontrado — rode a migration 0103 no Supabase (financeiro é master/direção)." />;

  const listaFases = fases.data ?? [];
  const areaPorFase = new Map(listaFases.map((f) => [f.id, f.area_m2]));
  const totalArea = listaFases.reduce((s, f) => s + f.area_m2, 0);
  const listaMed = medicoes.data ?? [];
  const listaMarcos = marcos.data ?? [];
  const listaOC = ordens.data ?? [];
  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
  const marcoDisc = new Map(listaMarcos.map((m) => [m.id, m.disciplina_id]));

  // ── Resumo por grupo (orçado × comprometido × realizado) ──
  const orcPorGrupo = (g: string) => listaBase.filter((b) => b.grupo === g).reduce((s, b) => s + b.valor_orcado, 0);
  const resumo: LinhaResumo[] = [
    {
      grupo: "mo", rotulo: GRUPO_LABEL.mo, orcado: orcPorGrupo("mo"),
      comprometido: listaMed.filter((m) => m.status !== "Reprovado").reduce((s, m) => s + m.valor_bruto, 0),
      realizado: listaMed.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor_bruto, 0),
    },
    {
      grupo: "projetos", rotulo: GRUPO_LABEL.projetos, orcado: orcPorGrupo("projetos"),
      comprometido: listaMarcos.filter((m) => m.status !== "Reprovado").reduce((s, m) => s + m.valor, 0),
      realizado: listaMarcos.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor, 0),
    },
    {
      grupo: "materiais", rotulo: GRUPO_LABEL.materiais, orcado: orcPorGrupo("materiais"),
      comprometido: listaOC.filter((o) => o.status !== "Cancelada").reduce((s, o) => s + o.valor_total, 0),
      realizado: listaOC.filter((o) => o.status === "Entregue").reduce((s, o) => s + o.valor_total, 0),
    },
    {
      // Custos indiretos: já incorridos → comprometido = realizado = soma dos lançamentos.
      grupo: "indiretos", rotulo: GRUPO_LABEL.indiretos, orcado: orcPorGrupo("indiretos"),
      comprometido: (custos.data ?? []).reduce((s, c) => s + c.valor, 0),
      realizado: (custos.data ?? []).reduce((s, c) => s + c.valor, 0),
    },
    ...(["fornecedores", "ensaios", "taxas"] as const).map((g) => ({
      grupo: g, rotulo: GRUPO_LABEL[g], orcado: orcPorGrupo(g), comprometido: 0, realizado: 0,
    })),
  ].map((l) => ({ ...l, orcado: arred(l.orcado), comprometido: arred(l.comprometido), realizado: arred(l.realizado) }));

  // ── Separação: CONTRATO DA CONSTRUTORA (MO + projetos = R$ 12,52M) vs
  //    CUSTOS DO CONTRATANTE (materiais, fornecedores, ensaios, taxas,
  //    indiretos — dinheiro nosso, fora do contrato da TRÍADE). ──
  const GRUPOS_CONTRATO = ["mo", "projetos"];
  const secaoContrato = resumo.filter((l) => GRUPOS_CONTRATO.includes(l.grupo));
  const secaoContratante = resumo.filter((l) => !GRUPOS_CONTRATO.includes(l.grupo));
  const somaSecao = (linhas: LinhaResumo[]) => ({
    orcado: arred(linhas.reduce((s, l) => s + l.orcado, 0)),
    comprometido: arred(linhas.reduce((s, l) => s + l.comprometido, 0)),
    realizado: arred(linhas.reduce((s, l) => s + l.realizado, 0)),
  });
  const subContrato = somaSecao(secaoContrato);
  const subContratante = somaSecao(secaoContratante);

  const totOrcado = arred(subContrato.orcado + subContratante.orcado);
  const totComprometido = arred(resumo.reduce((s, l) => s + l.comprometido, 0));
  const totRealizado = arred(resumo.reduce((s, l) => s + l.realizado, 0));

  // ── Curva S física × financeira ──
  const evFisica = listaMed
    .filter((m) => m.status === "Aprovado" || m.status === "Pago")
    .map((m) => ({ mes: m.mes, valor: m.percentual_medido * (areaPorFase.get(m.fase_id) ?? 0) }));
  const serieFisica = serieAcumuladaMensal(evFisica);
  const evFin = [
    ...listaMed.filter((m) => m.status === "Pago" && m.data_pagamento).map((m) => ({ mes: m.data_pagamento!.slice(0, 7), valor: m.valor_bruto })),
    ...listaMarcos.filter((m) => m.status === "Pago" && m.data_pagamento).map((m) => ({ mes: m.data_pagamento!.slice(0, 7), valor: m.valor })),
  ];
  const serieFin = serieAcumuladaMensal(evFin);
  const areaFisicaFinal = serieFisica.length ? serieFisica[serieFisica.length - 1].acumulado : 0; // em m²·%? → normaliza abaixo
  const meses = [...new Set([...serieFisica.map((p) => p.mes), ...serieFin.map((p) => p.mes)])].sort();
  const curva = meses.map((mes) => {
    const fis = serieFisica.filter((p) => p.mes <= mes).at(-1)?.acumulado ?? 0;
    const fin = serieFin.filter((p) => p.mes <= mes).at(-1)?.acumulado ?? 0;
    return {
      mes,
      // fis = Σ(pct×área) já traz o % embutido (0–100) → divide só pela área.
      fisicaPct: totalArea > 0 ? arred(fis / totalArea) : 0,
      // Base financeira = CONTRATO da construtora (MO+projetos), não o total.
      financeiraPct: subContrato.orcado > 0 ? arred((fin / subContrato.orcado) * 100) : 0,
    };
  });

  // Custo/m² acumulado = realizado ÷ área física concluída.
  const areaFisicaM2 = totalArea > 0 ? areaFisicaFinal / 100 : 0; // acumulado = Σ(%×área); /100 = m² equivalentes
  const custoPorM2 = custoM2(totRealizado, areaFisicaM2);

  // Data-base por disciplina: a ENTRADA (50%) vence na data de início do
  // projeto (cronograma TRÍADE) — entra na agenda mesmo antes de aprovada.
  const baseDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.data_base]));

  // ── Contas a pagar (agenda por vencimento) ──
  const contas = [
    // Cláusula 8.1.2: pagamento do BM em até 15 dias corridos após a aprovação.
    ...listaMed.filter((m) => m.status === "Aprovado").map((m) => ({
      tipo: "Medição", ref: `BM ${m.mes}`, valor: m.valor_liquido,
      venc: somarDiasISO(m.data_aprovacao ?? hojeISO(), 15)!,
    })),
    ...listaMarcos.filter((m) => m.status === "Aprovado").map((m) => ({
      tipo: "Projeto", ref: `${nomeDisc.get(marcoDisc.get(m.id) ?? "") ?? "?"} · ${m.rotulo}`, valor: m.valor, venc: m.data_aprovacao ?? hojeISO(),
    })),
    ...listaMarcos
      .filter((m) => m.chave === "inicio" && m.status === "Pendente" && baseDisc.get(m.disciplina_id))
      .map((m) => ({
        tipo: "Projeto — entrada prevista",
        ref: `${nomeDisc.get(m.disciplina_id) ?? "?"} · ${m.rotulo}`,
        valor: m.valor,
        venc: baseDisc.get(m.disciplina_id)!,
      })),
    // R00/R01/entrega ainda não aprovados: previstos para o FIM do prazo da
    // atividade — dá a agenda completa de desembolso dos R$ 500 mil.
    ...listaMarcos
      .filter((m) => m.chave !== "inicio" && (m.status === "Pendente" || m.status === "Em análise" || m.status === "Reprovado"))
      .map((m) => {
        const d = (disciplinas.data ?? []).find((x) => x.id === m.disciplina_id);
        const venc = d ? somarDiasISO(d.data_base, d.prazo_dias) : null;
        return venc ? {
          tipo: "Projeto — previsto no prazo",
          ref: `${nomeDisc.get(m.disciplina_id) ?? "?"} · ${m.rotulo}`,
          valor: m.valor,
          venc,
        } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null),
    ...listaOC.filter((o) => (o.status === "Emitida" || o.status === "Entregue parcial") && o.previsao_entrega).map((o) => ({
      tipo: "Material (OC)", ref: `${o.item} · ${o.fornecedor}`, valor: o.valor_total, venc: o.previsao_entrega!,
    })),
  ].sort((a, b) => a.venc.localeCompare(b.venc));
  const totalAPagar = arred(contas.reduce((s, c) => s + c.valor, 0));
  const fluxo = somaPorMes(contas.map((c) => ({ mes: c.venc.slice(0, 7), valor: c.valor })));

  function exportBaseline() {
    const ok = exportarCSV("obra-orcamento", resumo.map((l) => ({
      Grupo: l.rotulo, "Orçado (R$)": l.orcado, "Comprometido (R$)": l.comprometido,
      "Realizado (R$)": l.realizado, "Saldo (R$)": saldoOrcamentario(l),
    })));
    if (!ok) toast.error("Nada para exportar.");
  }
  function exportContas() {
    const ok = exportarCSV("obra-contas-a-pagar", contas.map((c) => ({
      Vencimento: formatarDataBR(c.venc), Tipo: c.tipo, Referência: c.ref, "Valor (R$)": c.valor,
    })));
    if (!ok) toast.error("Nada para exportar.");
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Totais — o contrato da construtora NÃO se mistura com custos nossos */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icone={<Wallet className="size-5" />} rotulo="Contrato construtora (MO + projetos)" valor={formatarMoeda(subContrato.orcado)} />
        <Kpi icone={<TrendingUp className="size-5" />} rotulo="Custos do Contratante (orçado)" valor={formatarMoeda(subContratante.orcado)} />
        <Kpi icone={<Wallet className="size-5" />} rotulo="Realizado (pago) — tudo" valor={formatarMoeda(totRealizado)} tom="success" />
        <Kpi icone={<Ruler className="size-5" />} rotulo="Custo/m² acumulado" valor={formatarMoeda(custoPorM2)} />
      </div>

      {/* Baseline por pacote */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Wallet className="size-5 text-primary" /> Orçamento por pacote</h2>
            <Button size="sm" variant="outline" onClick={exportBaseline}><Download className="size-4" /> CSV</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Pacote</th>
                <th className="pb-2 text-right">Orçado</th>
                <th className="pb-2 text-right">Comprometido</th>
                <th className="pb-2 text-right">Realizado</th>
                <th className="pb-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* ── Seção 1: contrato da construtora (R$ 12,52M — só TRÍADE) ── */}
              <tr>
                <td colSpan={5} className="pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-primary-strong">
                  Contrato construtora — TRÍADE (MO + projetos)
                </td>
              </tr>
              {secaoContrato.map((l) => (
                <LinhaPacote key={l.grupo} linha={l} listaBase={listaBase} podeEditar={podeEditar} onEditar={setEditandoGrupo} />
              ))}
              <tr className="bg-muted/20 font-semibold text-secondary">
                <td className="py-1.5 pl-2 text-xs">Subtotal do contrato</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(subContrato.orcado)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(subContrato.comprometido)}</td>
                <td className="py-1.5 text-right tabular-nums text-success">{formatarMoeda(subContrato.realizado)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(arred(subContrato.orcado - subContrato.comprometido))}</td>
              </tr>

              {/* ── Seção 2: custos do Contratante (fora do contrato) ── */}
              <tr>
                <td colSpan={5} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Custos do Contratante (fora do contrato da construtora)
                </td>
              </tr>
              {secaoContratante.map((l) => (
                <LinhaPacote key={l.grupo} linha={l} listaBase={listaBase} podeEditar={podeEditar} onEditar={setEditandoGrupo} />
              ))}
              <tr className="bg-muted/20 font-semibold text-secondary">
                <td className="py-1.5 pl-2 text-xs">Subtotal do Contratante</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(subContratante.orcado)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(subContratante.comprometido)}</td>
                <td className="py-1.5 text-right tabular-nums text-success">{formatarMoeda(subContratante.realizado)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatarMoeda(arred(subContratante.orcado - subContratante.comprometido))}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold text-secondary">
                <td className="pt-2">EMPREENDIMENTO (contrato + Contratante)</td>
                <td className="pt-2 text-right tabular-nums">{formatarMoeda(totOrcado)}</td>
                <td className="pt-2 text-right tabular-nums">{formatarMoeda(totComprometido)}</td>
                <td className="pt-2 text-right tabular-nums text-success">{formatarMoeda(totRealizado)}</td>
                <td className="pt-2 text-right tabular-nums">{formatarMoeda(arred(totOrcado - totComprometido))}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-muted-foreground">
            O contrato da construtora ({formatarMoeda(subContrato.orcado)}) cobre APENAS mão de obra + projetos.
            Materiais, fornecedores, ensaios, taxas e custos indiretos são desembolsos do Contratante, somados à parte.
          </p>
        </CardContent>
      </Card>

      {/* Curva S */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><TrendingUp className="size-5 text-primary" /> Curva S — física × financeira</h2>
          {curva.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda sem medições/pagamentos para traçar a curva.</p>
          ) : (
            <CurvaS pontos={curva} />
          )}
        </CardContent>
      </Card>

      {/* Contas a pagar */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><CalendarClock className="size-5 text-primary" /> Contas a pagar · {formatarMoeda(totalAPagar)}</h2>
            <Button size="sm" variant="outline" onClick={exportContas} disabled={contas.length === 0}><Download className="size-4" /> CSV</Button>
          </div>
          {contas.length === 0 ? <EmptyState label="Nada a pagar no momento." /> : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2">Vencimento</th><th className="pb-2">Tipo</th><th className="pb-2">Referência</th><th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contas.map((c, i) => (
                    <tr key={i} className="text-secondary">
                      <td className="py-2 tabular-nums">{formatarDataBR(c.venc)}</td>
                      <td className="py-2"><Badge variant="muted">{c.tipo}</Badge></td>
                      <td className="py-2 text-muted-foreground">{c.ref}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{formatarMoeda(c.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Fluxo de caixa mensal projetado */}
              <div>
                <p className="mb-1 text-sm font-semibold text-secondary">Fluxo projetado por mês</p>
                <div className="flex flex-wrap gap-2">
                  {fluxo.map((f) => (
                    <span key={f.mes} className="rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{f.mes}</span> · <strong className="tabular-nums text-secondary">{formatarMoeda(f.valor)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editandoGrupo && <ModalBaselineGrupo linhas={editandoGrupo} onFechar={() => setEditandoGrupo(null)} />}
    </div>
  );
}

function Kpi({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "warning" | "success" }) {
  const cor = tom === "warning" ? "text-warning" : tom === "success" ? "text-success" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div className="min-w-0">
        <p title={valor} className={cn("truncate text-lg font-extrabold tabular-nums", cor)}>{valor}</p>
        <p className="text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

/** Linha de um grupo do orçamento (editável pelo master/direção). */
function LinhaPacote({
  linha: l,
  listaBase,
  podeEditar,
  onEditar,
}: {
  linha: LinhaResumo;
  listaBase: ObraBaseline[];
  podeEditar: boolean;
  onEditar: (linhas: ObraBaseline[]) => void;
}) {
  const linhasGrupo = listaBase.filter((b) => b.grupo === l.grupo);
  return (
    <tr className="text-secondary">
      <td className="py-2">
        {l.rotulo}
        {l.grupo === "projetos" && (
          <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">integra o contrato</span>
        )}
        {podeEditar && linhasGrupo.length > 0 && (
          <button onClick={() => onEditar(linhasGrupo)} className="ml-2 text-muted-foreground hover:text-primary" title="Editar valor orçado"><Pencil className="inline size-3.5" /></button>
        )}
      </td>
      <td className="py-2 text-right tabular-nums text-muted-foreground">{formatarMoeda(l.orcado)}</td>
      <td className="py-2 text-right tabular-nums">{formatarMoeda(l.comprometido)}</td>
      <td className="py-2 text-right tabular-nums text-success">{formatarMoeda(l.realizado)}</td>
      <td className={cn("py-2 text-right tabular-nums font-semibold", saldoOrcamentario(l) < 0 ? "text-destructive" : "text-secondary")}>{formatarMoeda(saldoOrcamentario(l))}</td>
    </tr>
  );
}

/** Curva S em SVG (duas polilinhas: física × financeira, 0–100%). */
function CurvaS({ pontos }: { pontos: { mes: string; fisicaPct: number; financeiraPct: number }[] }) {
  const W = 640, H = 200, P = 28;
  const n = pontos.length;
  const x = (i: number) => P + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - (Math.min(100, v) / 100) * (H - 2 * P);
  const linha = (sel: (p: typeof pontos[number]) => number) => pontos.map((p, i) => `${x(i)},${y(sel(p))}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Curva S">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="hsl(var(--border))" strokeWidth={1} />
            <text x={4} y={y(g) + 3} fontSize={9} fill="hsl(var(--muted-foreground))">{g}%</text>
          </g>
        ))}
        <polyline points={linha((p) => p.fisicaPct)} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        <polyline points={linha((p) => p.financeiraPct)} fill="none" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="4 3" />
        {pontos.map((p, i) => (
          <text key={p.mes} x={x(i)} y={H - 8} fontSize={8} fill="hsl(var(--muted-foreground))" textAnchor="middle">{p.mes.slice(2)}</text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-primary" /> Física</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-success" /> Financeira</span>
      </div>
    </div>
  );
}

/**
 * Edita o ORÇADO de um grupo do baseline. Grupos com várias linhas (MO tem uma
 * por fase) mostram todas de uma vez; salva apenas as que mudaram.
 */
function ModalBaselineGrupo({ linhas, onFechar }: { linhas: ObraBaseline[]; onFechar: () => void }) {
  const atualizar = useAtualizarBaseline();
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(linhas.map((b) => [b.id, String(b.valor_orcado)])),
  );
  const [obs, setObs] = useState(linhas.length === 1 ? linhas[0].observacao ?? "" : "");

  const parse = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));

  async function salvar() {
    const mudadas = linhas.filter((b) => parse(valores[b.id]) !== b.valor_orcado || (linhas.length === 1 && (obs || null) !== b.observacao));
    for (const b of mudadas) {
      const v = parse(valores[b.id]);
      if (!Number.isFinite(v) || v < 0) { toast.error(`Valor inválido em "${b.rotulo}".`); return; }
    }
    if (mudadas.length === 0) { onFechar(); return; }
    try {
      for (const b of mudadas) {
        await atualizar.mutateAsync({
          id: b.id,
          valorOrcado: parse(valores[b.id]),
          observacao: linhas.length === 1 ? obs || null : b.observacao,
        });
      }
      toast.success("Orçado atualizado.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }

  const total = linhas.reduce((s, b) => { const v = parse(valores[b.id]); return s + (Number.isFinite(v) ? v : 0); }, 0);
  const titulo = GRUPO_LABEL[linhas[0].grupo] ?? linhas[0].rotulo;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Orçado — {titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        {linhas[0].grupo === "mo" && (
          <p className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-secondary">
            Ponto de partida do contrato: área × preço/m² <span className="font-semibold">menos o rateio dos projetos</span> (os R$ 500.000 integram o total — desconto incorporado).
          </p>
        )}
        <div className="space-y-3">
          {linhas.map((b) => (
            <label key={b.id} className="block space-y-1">
              <span className="text-sm font-semibold text-secondary">{b.rotulo}</span>
              <input value={valores[b.id]} onChange={(e) => setValores((p) => ({ ...p, [b.id]: e.target.value }))} inputMode="decimal" className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </label>
          ))}
          {linhas.length > 1 && (
            <p className="text-right text-sm font-semibold tabular-nums text-secondary">Total do grupo: {formatarMoeda(arred(total))}</p>
          )}
          {linhas.length === 1 && (
            <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Observação</span>
              <input value={obs} onChange={(e) => setObs(e.target.value)} className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" /></label>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={atualizar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={atualizar.isPending}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
