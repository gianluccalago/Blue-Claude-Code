/**
 * Mapa das Suítes — Administração/Direção e Master (leitura).
 * Visão tabular dos hóspedes ATIVOS, ordenada por TEMPO DE CASA (entrada mais
 * antiga primeiro). Mensalidade + upsellings FIXOS (recorrentes) = total.
 */
import { useMemo } from "react";
import { toast } from "sonner";
import { Map as MapIcon, Users, Wallet, Sparkles, Download, AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentes } from "@/hooks/usePlanos";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda, mesAtual, formatarMesReferencia } from "@/lib/mensalidade";
import { formatarDataBR } from "@/lib/utils";
import { formatarQuarto } from "@/lib/quarto";
import { exportarMapaSuitesExcel, type LinhaMapa } from "@/lib/exportMapaSuites";
import type { Residente } from "@/types/database";

const SEXO_LABEL: Record<string, string> = { masculino: "Homem", feminino: "Mulher" };
const OCUPACAO_LABEL: Record<string, string> = { simples: "Individual", duplo: "Duplo", triplo: "Triplo" };

function grauLabel(g: string | null): string {
  return g ? `Grau ${g}` : "Não informado";
}

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);

export function MapaSuites() {
  const { usuarioEfetivo } = useAuth();
  const residentes = useResidentes();
  const mes = mesAtual();
  const upsell = useUpsellingTodosDoMes(mes);

  // Upselling FIXO (recorrente) por hóspede no mês.
  const fixoPorResidente = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of upsell.data ?? []) {
      if (!u.recorrente) continue;
      m.set(u.residente_id, (m.get(u.residente_id) ?? 0) + u.valor);
    }
    return m;
  }, [upsell.data]);

  // Ativos, ordenados por tempo de casa (data_admissao asc; sem data ao fim).
  const linhas: LinhaMapa[] = useMemo(() => {
    const ativos = (residentes.data ?? []).filter((r) => r.status_hospede === "ativo");
    ativos.sort((a, b) => {
      const da = a.data_admissao ?? "9999-12-31";
      const db = b.data_admissao ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return ativos.map((r) => {
      const upsellFixo = fixoPorResidente.get(r.id) ?? 0;
      return { residente: r, upsellFixo, total: (r.mensalidade_valor ?? 0) + upsellFixo };
    });
  }, [residentes.data, fixoPorResidente]);

  const totais = useMemo(() => {
    return {
      hospedes: linhas.length,
      mensalidade: linhas.reduce((s, l) => s + (l.residente.mensalidade_valor ?? 0), 0),
      upsell: linhas.reduce((s, l) => s + l.upsellFixo, 0),
      total: linhas.reduce((s, l) => s + l.total, 0),
    };
  }, [linhas]);

  if (!PERFIS_GESTAO.has(usuarioEfetivo?.perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (residentes.isLoading || upsell.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;

  async function exportar() {
    const ok = await exportarMapaSuitesExcel(linhas, mes);
    if (ok) toast.success("Mapa exportado em Excel.");
    else toast.error("Não foi possível exportar.");
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <MapIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Mapa das Suítes</h1>
            <p className="text-sm text-muted-foreground">
              Hóspedes ativos por tempo de casa · {formatarMesReferencia(mes)}
            </p>
          </div>
        </div>
        <Button onClick={exportar} className="gap-2" disabled={linhas.length === 0}>
          <Download className="size-4" /> Exportar Excel
        </Button>
      </div>

      {/* Totais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} tom="secondary" rotulo="Hóspedes ativos" valor={totais.hospedes} />
        <StatCard icon={Wallet} tom="secondary" rotulo="Mensalidades" valor={formatarMoeda(totais.mensalidade)} />
        <StatCard icon={Sparkles} tom="secondary" rotulo="Upsell fixo" valor={formatarMoeda(totais.upsell)} />
        <StatCard icon={Wallet} tom="primary" destaque rotulo="Total geral" valor={formatarMoeda(totais.total)} />
      </div>

      {/* Tabela */}
      {linhas.length === 0 ? (
        <EmptyState label="Nenhum hóspede ativo." />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hóspedes ativos ({linhas.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Hóspede</th>
                  <th className="pb-2 pr-3">Sexo</th>
                  <th className="pb-2 pr-3">Suíte</th>
                  <th className="pb-2 pr-3">Tipo</th>
                  <th className="pb-2 pr-3">Ocupação</th>
                  <th className="pb-2 pr-3">Entrada</th>
                  <th className="pb-2 pr-3">Grau ingresso</th>
                  <th className="pb-2 pr-3">Grau atual</th>
                  <th className="pb-2 pr-3 text-right">Mensalidade</th>
                  <th className="pb-2 pr-3 text-right">Upsell fixo</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <LinhaSuite key={l.residente.id} linha={l} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold text-secondary">
                  <td className="pt-2 pr-3" colSpan={8}>TOTAL · {totais.hospedes} ativos</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{formatarMoeda(totais.mensalidade)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{formatarMoeda(totais.upsell)}</td>
                  <td className="pt-2 text-right tabular-nums">{formatarMoeda(totais.total)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaSuite({ linha }: { linha: LinhaMapa }) {
  const r: Residente = linha.residente;
  const divergeGrau =
    !!r.grau_contratual && !!r.grau_dependencia && r.grau_contratual !== r.grau_dependencia;

  return (
    <tr className="text-secondary">
      <td className="py-2.5 pr-3">
        <div className="font-medium">{r.nome}</div>
        <div className="text-xs text-muted-foreground">{r.numero_hospede ?? "Não informado"}</div>
      </td>
      <td className="py-2.5 pr-3">{r.sexo ? SEXO_LABEL[r.sexo] : "Não informado"}</td>
      <td className="py-2.5 pr-3 font-medium">{formatarQuarto(r.quarto) ?? "Não informado"}</td>
      <td className="py-2.5 pr-3">{r.tipo_suite ?? "Não informado"}</td>
      <td className="py-2.5 pr-3">{r.ocupacao ? OCUPACAO_LABEL[r.ocupacao] : "Não informado"}</td>
      <td className="py-2.5 pr-3 tabular-nums">{r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado"}</td>
      <td className="py-2.5 pr-3">{grauLabel(r.grau_contratual)}</td>
      <td className="py-2.5 pr-3">
        {divergeGrau ? (
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="size-3" /> {grauLabel(r.grau_dependencia)}
          </Badge>
        ) : (
          grauLabel(r.grau_dependencia)
        )}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{formatarMoeda(r.mensalidade_valor ?? 0)}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{linha.upsellFixo > 0 ? formatarMoeda(linha.upsellFixo) : "—"}</td>
      <td className="py-2.5 text-right font-bold tabular-nums">{formatarMoeda(linha.total)}</td>
    </tr>
  );
}
