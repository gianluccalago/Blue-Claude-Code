/**
 * Painel da Farmácia — BLOCO D
 * Alertas calculados ao abrir a tela; sem polling em segundo plano.
 * React Query faz cache de 5 min (staleTime default 0 — refetch on mount).
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  PackageX,
  PackageMinus,
  RefreshCw,
  CalendarCheck,
  CalendarX,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Medalhao } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import { useResidentes } from "@/hooks/usePlanos";
import {
  mesAtualISO,
  useEstoqueTodosMes,
  useEstoqueResgateAll,
  useTodasPrescricoesAtivas,
  useResidentesComProvisionamento,
} from "@/hooks/usePainelFarmacia";
import type { EstoqueHospede } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarMesExtenso(mesRef: string): string {
  const [ano, mes] = mesRef.split("-").map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

function diaAtual(): number {
  return new Date().getDate();
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

// Mapeia o filete de cor herdado (border-l-*) para o tom do medalhão.
function tomDaCor(cor: string): "success" | "warning" | "destructive" {
  if (cor.includes("destructive")) return "destructive";
  if (cor.includes("warning")) return "warning";
  return "success";
}

function ContadorCard({
  label,
  value,
  cor,
  icon: Icon,
}: {
  label: string;
  value: number;
  cor: string;
  icon: LucideIcon;
}) {
  const tom = tomDaCor(cor);
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-card p-4 shadow-xs transition-all duration-200 hover:shadow-card">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </p>
        <Medalhao icon={Icon} tom={tom} className="size-9 rounded-lg" />
      </div>
      <p className="relative mt-2 text-3xl font-extrabold leading-none tracking-tight tabular-nums text-secondary">
        {value}
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PainelFarmacia() {
  const mesRef = mesAtualISO();

  // Todos os dados carregados em paralelo via React Query
  const { data: residentes = [], isLoading: loadingRes, error: errRes } = useResidentes();
  const { data: estoqueHospede = [], isLoading: loadingEH, error: errEH } = useEstoqueTodosMes(mesRef);
  const { data: estoqueResgate = [], isLoading: loadingER, error: errER } = useEstoqueResgateAll();
  const { data: prescricoes = [], isLoading: loadingPx, error: errPx } = useTodasPrescricoesAtivas();
  const { data: resComProv = [], isLoading: loadingProv } = useResidentesComProvisionamento(mesRef);

  const isLoading = loadingRes || loadingEH || loadingER || loadingPx || loadingProv;
  const anyError = errRes || errEH || errER || errPx;

  // ── 1. Estoque baixo/negativo por hóspede ─────────────────────────────────
  // Itens com quantidade_atual ≤ 5 ou < 0 no mês atual
  const itensCriticos = useMemo(() => {
    const porResidente: Record<string, { nome: string; itens: EstoqueHospede[] }> = {};
    for (const item of estoqueHospede) {
      if (item.quantidade_atual <= 5) {
        if (!porResidente[item.residente_id]) {
          const res = residentes.find((r) => r.id === item.residente_id);
          porResidente[item.residente_id] = { nome: res?.nome ?? item.residente_id, itens: [] };
        }
        porResidente[item.residente_id].itens.push(item);
      }
    }
    return Object.entries(porResidente).sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
  }, [estoqueHospede, residentes]);

  // ── 2. Resgate baixo ──────────────────────────────────────────────────────
  const resgatesBaixos = useMemo(
    () => estoqueResgate.filter((r) => r.quantidade_atual <= 5),
    [estoqueResgate]
  );

  // ── 3. Prescrição alterada — residentes que têm provisionamento no mês
  //       mas possuem medicamentos ativos SEM item correspondente no estoque
  //       (indica que uma nova prescrição foi adicionada após o provisionamento)
  const prescricoesAlteradas = useMemo(() => {
    if (resComProv.length === 0) return [];

    const result: { residenteId: string; residenteNome: string; medicamentos: string[] }[] = [];

    for (const resId of resComProv) {
      const estoqueDoRes = estoqueHospede.filter((e) => e.residente_id === resId);
      const medicamentosProvisionados = new Set(estoqueDoRes.map((e) => e.medicamento.toLowerCase()));

      const pxDoRes = prescricoes.filter((p) => p.residente_id === resId);
      const semEstoque = pxDoRes.filter(
        (p) => !medicamentosProvisionados.has(p.medicamento.toLowerCase())
      );

      if (semEstoque.length > 0) {
        const res = residentes.find((r) => r.id === resId);
        result.push({
          residenteId: resId,
          residenteNome: res?.nome ?? resId,
          medicamentos: semEstoque.map((p) => p.medicamento),
        });
      }
    }

    return result.sort((a, b) => a.residenteNome.localeCompare(b.residenteNome, "pt-BR"));
  }, [resComProv, estoqueHospede, prescricoes, residentes]);

  // ── 4. Ciclo mensal ───────────────────────────────────────────────────────
  const provSet = useMemo(() => new Set(resComProv), [resComProv]);
  const resSemProv = useMemo(
    () => residentes.filter((r) => !provSet.has(r.id)),
    [residentes, provSet]
  );
  const resComProvLista = useMemo(
    () => residentes.filter((r) => provSet.has(r.id)),
    [residentes, provSet]
  );

  const totalItensProblema = itensCriticos.reduce((s, [, v]) => s + v.itens.length, 0);
  const dia = diaAtual();

  if (isLoading) return <LoadingState />;
  if (anyError) return <ErrorState error={anyError} />;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Painel da Farmácia</h1>
        <p className="text-sm text-muted-foreground">{formatarMesExtenso(mesRef)}</p>
      </div>

      {/* ── Contadores de resumo ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ContadorCard
          label="Itens baixo/negativo"
          value={totalItensProblema}
          cor={totalItensProblema > 0 ? "border-l-destructive" : "border-l-success"}
          icon={totalItensProblema > 0 ? PackageMinus : CheckCircle2}
        />
        <ContadorCard
          label="Hóspedes sem prov."
          value={resSemProv.length}
          cor={resSemProv.length > 0 ? "border-l-warning" : "border-l-success"}
          icon={resSemProv.length > 0 ? CalendarX : CalendarCheck}
        />
        <ContadorCard
          label="Pres. alteradas"
          value={prescricoesAlteradas.length}
          cor={prescricoesAlteradas.length > 0 ? "border-l-warning" : "border-l-success"}
          icon={prescricoesAlteradas.length > 0 ? RefreshCw : CheckCircle2}
        />
        <ContadorCard
          label="Resgate crítico"
          value={resgatesBaixos.length}
          cor={resgatesBaixos.length > 0 ? "border-l-destructive" : "border-l-success"}
          icon={resgatesBaixos.length > 0 ? PackageX : CheckCircle2}
        />
      </div>

      {/* ── 1. Estoque baixo/negativo por hóspede ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageMinus className="h-4 w-4 text-destructive" />
            Estoque baixo ou negativo por hóspede
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itensCriticos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item crítico este mês.</p>
          ) : (
            <div className="space-y-3">
              {itensCriticos.map(([resId, { nome, itens }]) => (
                <div key={resId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{nome}</p>
                    <Link to="/app/farmacia/estoque" search={{ hospede: resId }}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        Ver estoque <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {itens.map((item) => (
                      <Badge
                        key={item.id}
                        variant="outline"
                        className={cn(
                          "text-xs",
                          item.quantidade_atual < 0
                            ? "border-destructive text-destructive"
                            : item.quantidade_atual === 0
                            ? "border-destructive text-destructive"
                            : "border-warning text-warning-foreground"
                        )}
                      >
                        {item.medicamento} — {item.quantidade_atual} {item.unidade}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Resgate crítico ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageX className="h-4 w-4 text-destructive" />
            Estoque de resgate crítico (≤ 5 unidades)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resgatesBaixos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Resgate OK.</p>
          ) : (
            <div className="space-y-2">
              {resgatesBaixos.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{item.medicamento}</p>
                    <p
                      className={cn(
                        "text-xs",
                        item.quantidade_atual < 0 ? "text-destructive" : "text-warning-foreground"
                      )}
                    >
                      {item.quantidade_atual} {item.unidade} disponíveis
                    </p>
                  </div>
                  <Link to="/app/farmacia/resgate">
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      Repor <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Prescrições alteradas ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-warning" />
            Prescrições alteradas após provisionamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prescricoesAlteradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma prescrição nova fora do estoque provisionado.
            </p>
          ) : (
            <div className="space-y-3">
              {prescricoesAlteradas.map(({ residenteId, residenteNome, medicamentos }) => (
                <div key={residenteId} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{residenteNome}</p>
                    <Link to="/app/farmacia/estoque" search={{ hospede: residenteId }}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                        Reprovisionar <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {medicamentos.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Ciclo mensal ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Ciclo mensal — {formatarMesExtenso(mesRef)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dia >= 20 && resSemProv.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/40 p-3 text-sm text-warning-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Dia {dia} — prazo de provisionamento (referência: dia 20) com{" "}
                <strong>{resSemProv.length}</strong> hóspede{resSemProv.length !== 1 ? "s" : ""} pendente
                {resSemProv.length !== 1 ? "s" : ""}.
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Pendentes */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Sem provisionamento ({resSemProv.length})
              </p>
              {resSemProv.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos provisionados!</p>
              ) : (
                <ul className="space-y-1">
                  {resSemProv.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <CalendarX className="h-3.5 w-3.5 text-warning" />
                        {r.nome}
                      </span>
                      <Link to="/app/farmacia/estoque">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                          Provisionar
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Concluídos */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Provisionados ({resComProvLista.length})
              </p>
              {resComProvLista.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum ainda.</p>
              ) : (
                <ul className="space-y-1">
                  {resComProvLista.map((r) => (
                    <li key={r.id} className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {r.nome}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
