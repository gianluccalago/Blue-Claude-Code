import { useMemo, useState } from "react";
import { Plus, BedDouble, Users2, AlertTriangle, ChevronRight, ArrowLeft } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useCriarResidente,
  useEditarResidente,
  type ResidenteValor,
} from "@/hooks/useResidentesGestao";
import { ResidenteFicha, BadgeDivergencia } from "@/components/master/ResidenteFicha";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, grauNivel, ouNaoInformado, formatarDataBR } from "@/lib/utils";
import type { Residente } from "@/types/database";
import type { ReactNode } from "react";

// ===========================================================================
// MASTER · Residentes — lista + ficha completa editável. Contadores no topo
// (total ativos, por grau atual, por tipo de suíte, divergências de grau).
// ===========================================================================

/** Divergência de grau ≥ 1 nível entre contratual e atual (ambos presentes). */
function temDivergencia(r: Residente): boolean {
  const c = grauNivel(r.grau_contratual);
  const a = grauNivel(r.grau_dependencia);
  return c !== null && a !== null && Math.abs(c - a) >= 1;
}

export function Residentes() {
  const residentes = useResidentes();
  const criar = useCriarResidente();
  const editar = useEditarResidente();

  // null = lista; "novo" = criar; string = editar id.
  const [modo, setModo] = useState<"lista" | "novo" | string>("lista");

  const lista = residentes.data ?? [];

  const contadores = useMemo(() => {
    const porGrau = { I: 0, II: 0, III: 0, sem: 0 };
    const porSuite = new Map<string, number>();
    let divergencias = 0;
    for (const r of lista) {
      if (r.grau_dependencia) porGrau[r.grau_dependencia] += 1;
      else porGrau.sem += 1;
      const suite = r.tipo_suite?.trim() || "Não informado";
      porSuite.set(suite, (porSuite.get(suite) ?? 0) + 1);
      if (temDivergencia(r)) divergencias += 1;
    }
    return {
      total: lista.length,
      porGrau,
      porSuite: [...porSuite.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")),
      divergencias,
    };
  }, [lista]);

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.error) return <ErrorState error={residentes.error} />;

  const salvando = criar.isPending || editar.isPending;

  // ----- Ficha (criar/editar) -----
  if (modo === "novo") {
    return (
      <div className="space-y-4">
        <BotaoVoltar onClick={() => setModo("lista")} />
        <ResidenteFicha
          salvando={salvando}
          onCancelar={() => setModo("lista")}
          onSalvar={(valor: ResidenteValor) =>
            criar.mutate(valor, { onSuccess: () => setModo("lista") })
          }
        />
      </div>
    );
  }
  if (modo !== "lista") {
    const r = lista.find((x) => x.id === modo);
    if (r) {
      return (
        <div className="space-y-4">
          <BotaoVoltar onClick={() => setModo("lista")} />
          <ResidenteFicha
            inicial={r}
            salvando={salvando}
            onCancelar={() => setModo("lista")}
            onSalvar={(valor) =>
              editar.mutate({ id: r.id, valor }, { onSuccess: () => setModo("lista") })
            }
          />
        </div>
      );
    }
  }

  // ----- Lista -----
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-secondary">Hóspedes</h2>
          <p className="text-sm text-muted-foreground">
            {contadores.total} hóspedes ativos
          </p>
        </div>
        <Button onClick={() => setModo("novo")}>
          <Plus className="size-4" /> Adicionar hóspede
        </Button>
      </div>

      {/* CONTADORES */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador icon={Users2} rotulo="Hóspedes ativos" valor={contadores.total} />
        <Contador
          icon={BedDouble}
          rotulo="Por grau atual"
          valor={
            <span className="text-sm font-semibold text-secondary">
              I: {contadores.porGrau.I} · II: {contadores.porGrau.II} · III: {contadores.porGrau.III}
              {contadores.porGrau.sem > 0 ? ` · s/: ${contadores.porGrau.sem}` : ""}
            </span>
          }
        />
        <Contador
          icon={BedDouble}
          rotulo="Por tipo de suíte"
          valor={
            <span className="text-sm font-semibold text-secondary">
              {contadores.porSuite.map(([s, n]) => `${s}: ${n}`).join(" · ")}
            </span>
          }
        />
        <Contador
          icon={AlertTriangle}
          rotulo="Divergência de grau"
          valor={contadores.divergencias}
          destaque={contadores.divergencias > 0}
        />
      </div>

      {/* LISTA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todos os hóspedes</CardTitle>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <EmptyState label="Nenhum hóspede cadastrado." />
          ) : (
            <ul className="space-y-2">
              {lista.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setModo(r.id)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:shadow-soft"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-secondary">{r.nome}</span>
                        {temDivergencia(r) && <BadgeDivergencia />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>Quarto {ouNaoInformado(r.quarto)}</span>
                        <span>· Suíte {ouNaoInformado(r.tipo_suite)}</span>
                        <span>· Entrada {formatarDataBR(r.data_admissao)}</span>
                        <Badge variant="outline">Contratual {r.grau_contratual ?? "—"}</Badge>
                        <Badge variant="muted">Real (IVCF) {r.grau_dependencia ?? "sem avaliação"}</Badge>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
    >
      <ArrowLeft className="size-4" /> Voltar à lista
    </button>
  );
}

function Contador({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon: typeof Users2;
  rotulo: string;
  valor: ReactNode;
  destaque?: boolean;
}) {
  return (
    <Card className={cn("p-4", destaque && "border-destructive/40 bg-destructive/5")}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-semibold">{rotulo}</span>
      </div>
      <div className="mt-2">
        {typeof valor === "number" ? (
          <span className="text-3xl font-extrabold tabular-nums text-secondary">{valor}</span>
        ) : (
          valor
        )}
      </div>
    </Card>
  );
}
