import { useMemo, useState } from "react";
import { HeartPulse, AlertCircle, Filter } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useTodasIntercorrencias, useAlertasEliminacaoPainel } from "@/hooks/useCoordenacao";
import { useAceitacaoBaixaRecente, DIAS_INTERCORRENCIAS_RECENTES } from "@/hooks/useMaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { GrauDependencia } from "@/types/database";
import type { ReactNode } from "react";

// ===========================================================================
// MASTER-2 · Supervisão clínica — visão clínica de TODA a casa, modo LEITURA.
//
// Lista todos os hóspedes com grau atual, status do IVCF, intercorrências
// recentes, alertas de eliminação e risco nutricional. Destaca quem precisa
// de atenção. O status do IVCF fica "sem avaliação" porque ainda não há tabela
// de avaliações IVCF no schema — origem futura: módulo clínico/avaliação.
// ===========================================================================

type FiltroGrau = "todos" | GrauDependencia;
type FiltroAlerta = "todos" | "atencao" | "intercorrencia" | "eliminacao" | "nutricional";

interface LinhaClinica {
  id: string;
  nome: string;
  quarto: string | null;
  grau: GrauDependencia | null;
  intercorrenciasRecentes: number;
  alertasEliminacao: number;
  riscoNutricional: boolean;
  /** Precisa de atenção clínica (qualquer sinal forte). */
  atencao: boolean;
}

export function SupervisaoClinica() {
  const residentes = useResidentes();
  const intercorrencias = useTodasIntercorrencias();
  const alertasElim = useAlertasEliminacaoPainel();
  const aceitacao = useAceitacaoBaixaRecente();

  const [filtroGrau, setFiltroGrau] = useState<FiltroGrau>("todos");
  const [filtroAlerta, setFiltroAlerta] = useState<FiltroAlerta>("todos");

  const linhas = useMemo<LinhaClinica[]>(() => {
    const limite = Date.now() - DIAS_INTERCORRENCIAS_RECENTES * 24 * 60 * 60 * 1000;
    const intercPorResidente = new Map<string, number>();
    for (const i of intercorrencias.data ?? []) {
      if (new Date(i.registrado_em).getTime() >= limite) {
        intercPorResidente.set(i.residente_id, (intercPorResidente.get(i.residente_id) ?? 0) + 1);
      }
    }
    const elimPorResidente = new Map<string, number>();
    for (const a of alertasElim.data ?? []) {
      elimPorResidente.set(a.residenteId, (elimPorResidente.get(a.residenteId) ?? 0) + 1);
    }
    const risco = new Set((aceitacao.data?.riscos ?? []).map((r) => r.residenteId));

    return (residentes.data ?? []).map((r) => {
      const ic = intercPorResidente.get(r.id) ?? 0;
      const el = elimPorResidente.get(r.id) ?? 0;
      const nut = risco.has(r.id);
      return {
        id: r.id,
        nome: r.nome,
        quarto: r.quarto,
        grau: r.grau_dependencia,
        intercorrenciasRecentes: ic,
        alertasEliminacao: el,
        riscoNutricional: nut,
        // Atenção clínica: intercorrências frequentes (2+), eliminação em alerta
        // ou risco nutricional. (IVCF vencido entrará quando houver a avaliação.)
        atencao: ic >= 2 || el > 0 || nut,
      };
    });
  }, [residentes.data, intercorrencias.data, alertasElim.data, aceitacao.data]);

  const filtradas = useMemo(() => {
    return linhas.filter((l) => {
      if (filtroGrau !== "todos" && l.grau !== filtroGrau) return false;
      switch (filtroAlerta) {
        case "atencao":
          return l.atencao;
        case "intercorrencia":
          return l.intercorrenciasRecentes > 0;
        case "eliminacao":
          return l.alertasEliminacao > 0;
        case "nutricional":
          return l.riscoNutricional;
        default:
          return true;
      }
    });
  }, [linhas, filtroGrau, filtroAlerta]);

  if (
    residentes.isLoading ||
    intercorrencias.isLoading ||
    alertasElim.isLoading ||
    aceitacao.isLoading
  )
    return <LoadingState />;
  const erro = residentes.error ?? intercorrencias.error ?? alertasElim.error ?? aceitacao.error;
  if (erro) return <ErrorState error={erro} />;

  const totalAtencao = linhas.filter((l) => l.atencao).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-secondary">
            Supervisão clínica
          </h2>
          <p className="text-sm text-muted-foreground">
            Todos os hóspedes · {linhas.length} no total ·{" "}
            <span className={totalAtencao > 0 ? "font-semibold text-destructive" : ""}>
              {totalAtencao} precisam de atenção
            </span>
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Grau</span>
            <Segmentado<FiltroGrau>
              valor={filtroGrau}
              onChange={setFiltroGrau}
              opcoes={[
                { v: "todos", label: "Todos" },
                { v: "I", label: "I" },
                { v: "II", label: "II" },
                { v: "III", label: "III" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Alerta</span>
            <Segmentado<FiltroAlerta>
              valor={filtroAlerta}
              onChange={setFiltroAlerta}
              opcoes={[
                { v: "todos", label: "Todos" },
                { v: "atencao", label: "Atenção" },
                { v: "intercorrencia", label: "Intercorrência" },
                { v: "eliminacao", label: "Eliminação" },
                { v: "nutricional", label: "Nutricional" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* LISTA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="size-4 text-secondary" /> Hóspedes ({filtradas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtradas.length === 0 ? (
            <EmptyState label="Nenhum hóspede para os filtros selecionados." />
          ) : (
            <>
              {/* Cabeçalho (desktop) */}
              <div className="hidden grid-cols-12 gap-2 border-b px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                <div className="col-span-4">Hóspede</div>
                <div className="col-span-2 text-center">Grau</div>
                <div className="col-span-2 text-center">IVCF</div>
                <div className="col-span-2 text-center">Intercorr. (7d)</div>
                <div className="col-span-1 text-center">Elim.</div>
                <div className="col-span-1 text-center">Nutric.</div>
              </div>
              <ul className="divide-y">
                {filtradas.map((l) => (
                  <li
                    key={l.id}
                    className={cn(
                      "grid grid-cols-2 gap-2 px-2 py-3 sm:grid-cols-12 sm:items-center",
                      l.atencao && "rounded-md bg-destructive/5",
                    )}
                  >
                    <div className="col-span-2 sm:col-span-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-secondary">{l.nome}</span>
                        {l.atencao && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="size-3" /> atenção
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Quarto {l.quarto ?? "—"}
                      </div>
                    </div>
                    <Celula rotulo="Grau" className="sm:col-span-2">
                      {l.grau ? <Badge variant="muted">{l.grau}</Badge> : <Traco />}
                    </Celula>
                    <Celula rotulo="IVCF" className="sm:col-span-2">
                      {/* Sem tabela de avaliações IVCF no schema atual. */}
                      <Badge variant="muted">sem avaliação</Badge>
                    </Celula>
                    <Celula rotulo="Intercorr. (7d)" className="sm:col-span-2">
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          l.intercorrenciasRecentes >= 2
                            ? "text-destructive"
                            : l.intercorrenciasRecentes > 0
                              ? "text-warning-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {l.intercorrenciasRecentes}
                      </span>
                    </Celula>
                    <Celula rotulo="Elim." className="sm:col-span-1">
                      {l.alertasEliminacao > 0 ? (
                        <Badge variant="warning">{l.alertasEliminacao}</Badge>
                      ) : (
                        <Traco />
                      )}
                    </Celula>
                    <Celula rotulo="Nutricional" className="sm:col-span-1">
                      {l.riscoNutricional ? (
                        <Badge variant="destructive">risco</Badge>
                      ) : (
                        <Badge variant="success">ok</Badge>
                      )}
                    </Celula>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground/80">
                Status do IVCF (atualizado / desatualizado &gt; 6 meses / sem avaliação) entra
                quando o módulo clínico de avaliação for construído.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Segmentado<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { v: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            valor === o.v
              ? "bg-card text-secondary shadow-card"
              : "text-muted-foreground hover:text-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Célula da "tabela" responsiva: mostra o rótulo no mobile e centraliza no desktop. */
function Celula({
  rotulo,
  className,
  children,
}: {
  rotulo: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between sm:justify-center", className)}>
      <span className="text-xs font-semibold text-muted-foreground sm:hidden">{rotulo}</span>
      {children}
    </div>
  );
}

function Traco() {
  return <span className="text-muted-foreground">—</span>;
}
