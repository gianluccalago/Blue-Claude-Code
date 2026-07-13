/**
 * Mapa das Suítes — Administração/Direção e Master (leitura).
 * Visão tabular dos hóspedes ATIVOS, ordenada por TEMPO DE CASA (entrada mais
 * antiga primeiro). Mensalidade + upsellings FIXOS (recorrentes) = total.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Map as MapIcon, Users, Wallet, Sparkles, Download, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentes } from "@/hooks/usePlanos";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { RegistrarSaidaModal } from "@/components/RegistrarSaidaModal";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarMoeda, mesAtual, formatarMesReferencia } from "@/lib/mensalidade";
import { formatarDataBR } from "@/lib/utils";
import { formatarQuarto } from "@/lib/quarto";
import { temporariasTerminando, diasAteFim } from "@/lib/modalidade";
import { SeloModalidade } from "@/components/SeloModalidade";
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
  const perfil = usuarioEfetivo?.perfil;
  // Registrar saída: só Master e Direção.
  const podeRegistrarSaida = perfil === "master" || perfil === "direcao";
  const residentes = useResidentes();
  const mes = mesAtual();
  const upsell = useUpsellingTodosDoMes(mes);
  const [saindo, setSaindo] = useState<Residente | null>(null);
  // Filtro por modalidade (todos / longa / curta). Day care não aparece aqui
  // (não ocupa leito) — vive na tela própria de Day Care.
  const [filtroMod, setFiltroMod] = useState<"todos" | "longa_permanencia" | "curta_permanencia">("todos");

  // Upselling FIXO (recorrente) por hóspede no mês.
  const fixoPorResidente = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of upsell.data ?? []) {
      if (!u.recorrente) continue;
      m.set(u.residente_id, (m.get(u.residente_id) ?? 0) + u.valor);
    }
    return m;
  }, [upsell.data]);

  // Curta permanência com término próximo (alerta de estadia temporária).
  const terminando = useMemo(
    () => temporariasTerminando((residentes.data ?? []).filter((r) => r.status_hospede === "ativo"), 15),
    [residentes.data],
  );

  // Ativos (ocupam leito), filtrados por modalidade, ordenados por tempo de casa.
  const linhas: LinhaMapa[] = useMemo(() => {
    const ativos = (residentes.data ?? []).filter(
      (r) => r.status_hospede === "ativo" && (filtroMod === "todos" || r.modalidade === filtroMod),
    );
    ativos.sort((a, b) => {
      const da = a.data_admissao ?? "9999-12-31";
      const db = b.data_admissao ?? "9999-12-31";
      return da.localeCompare(db);
    });
    return ativos.map((r) => {
      const upsellFixo = fixoPorResidente.get(r.id) ?? 0;
      return { residente: r, upsellFixo, total: (r.mensalidade_valor ?? 0) + upsellFixo };
    });
  }, [residentes.data, fixoPorResidente, filtroMod]);

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
              Hóspedes ativos · {formatarMesReferencia(mes)}
            </p>
          </div>
        </div>
        <Button onClick={exportar} className="gap-2" disabled={linhas.length === 0}>
          <Download className="size-4" /> Exportar Excel
        </Button>
      </div>

      {/* Alerta: curta permanência com término próximo (estadia temporária). */}
      {terminando.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warning-foreground">
            <AlertTriangle className="size-4" /> Curta permanência chegando ao fim
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {terminando.map((r) => {
              const d = diasAteFim(r.data_fim_prevista);
              return (
                <li key={r.id}>
                  <Badge variant="outline" className="border-warning/40 text-secondary">
                    {r.nome} · {d != null && d < 0 ? "vencida" : `termina em ${d} dia${d === 1 ? "" : "s"}`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Totais (ocupação de LEITOS = longa + curta; day care é à parte) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} tom="secondary" rotulo="Hóspedes (leito)" valor={totais.hospedes} />
        <StatCard icon={Wallet} tom="secondary" rotulo="Mensalidades" valor={formatarMoeda(totais.mensalidade)} />
        <StatCard icon={Sparkles} tom="secondary" rotulo="Upsell fixo" valor={formatarMoeda(totais.upsell)} />
        <StatCard icon={Wallet} tom="primary" destaque rotulo="Total geral" valor={formatarMoeda(totais.total)} />
      </div>

      {/* Filtro por modalidade */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Modalidade:</span>
        {([
          { v: "todos", label: "Todas" },
          { v: "longa_permanencia", label: "Longa permanência" },
          { v: "curta_permanencia", label: "Curta permanência" },
        ] as const).map((o) => (
          <Button key={o.v} size="sm" variant={filtroMod === o.v ? "default" : "outline"} onClick={() => setFiltroMod(o.v)}>
            {o.label}
          </Button>
        ))}
      </div>

      {/* Tabela */}
      {linhas.length === 0 ? (
        <EmptyState label="Nenhum hóspede ativo." />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hóspedes ativos ({linhas.length})</CardTitle>
          </CardHeader>
          <CardContent className="planilha-fixa">
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
                  {podeRegistrarSaida && <th className="pb-2 pl-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhas.map((l) => (
                  <LinhaSuite
                    key={l.residente.id}
                    linha={l}
                    podeRegistrarSaida={podeRegistrarSaida}
                    onSaida={() => setSaindo(l.residente)}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold text-secondary">
                  <td className="pt-2 pr-3" colSpan={8}>TOTAL · {totais.hospedes} ativos</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{formatarMoeda(totais.mensalidade)}</td>
                  <td className="pt-2 pr-3 text-right tabular-nums">{formatarMoeda(totais.upsell)}</td>
                  <td className="pt-2 text-right tabular-nums">{formatarMoeda(totais.total)}</td>
                  {podeRegistrarSaida && <td className="pt-2" />}
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {saindo && (
        <RegistrarSaidaModal residente={saindo} onFechar={() => setSaindo(null)} />
      )}
    </div>
  );
}

function LinhaSuite({
  linha,
  podeRegistrarSaida,
  onSaida,
}: {
  linha: LinhaMapa;
  podeRegistrarSaida: boolean;
  onSaida: () => void;
}) {
  const r: Residente = linha.residente;
  const divergeGrau =
    !!r.grau_contratual && !!r.grau_dependencia && r.grau_contratual !== r.grau_dependencia;

  return (
    <tr className="text-secondary">
      <td className="py-2.5 pr-3">
        <div className="flex flex-wrap items-center gap-1.5 font-medium">
          {r.nome}
          <SeloModalidade modalidade={r.modalidade} />
        </div>
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
      {podeRegistrarSaida && (
        <td className="py-2.5 pl-3 text-right">
          <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={onSaida}>
            <LogOut className="size-3.5" /> Saída
          </Button>
        </td>
      )}
    </tr>
  );
}

// Modal de saída compartilhado: src/components/RegistrarSaidaModal.tsx.
