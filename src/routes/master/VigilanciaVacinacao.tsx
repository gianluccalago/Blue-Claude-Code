import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Syringe, ExternalLink, ShieldCheck, AlertTriangle, UserX } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useCarteirasVacinais } from "@/hooks/useVacinacao";
import { urlAssinadaCarteira } from "@/lib/storage";
import {
  carteiraVigente,
  statusCarteira,
  STATUS_CARTEIRA_LABEL,
  STATUS_CARTEIRA_VARIANTE,
  MESES_VALIDADE_CARTEIRA,
  type StatusCarteira,
} from "@/lib/vacinacao";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR } from "@/lib/utils";
import type { CarteiraVacinal } from "@/types/database";

// ===========================================================================
// VIGILÂNCIA SANITÁRIA · Controle de vacinação (RT/Master). Cobertura e
// pendências da carteira vacinal (RDC 502/2021 Art. 39). Anexar é feito na
// ficha do hóspede (Coordenação/Médico/Master). Dado de saúde — sem família.
// ===========================================================================

interface LinhaCobertura {
  residenteId: string;
  nome: string;
  quarto: string | null;
  status: StatusCarteira;
  vigente: CarteiraVacinal | null;
}

export function VigilanciaVacinacao() {
  const residentes = useResidentes();
  const carteiras = useCarteirasVacinais();
  const [filtro, setFiltro] = useState<StatusCarteira | "todos">("todos");

  const linhas: LinhaCobertura[] = useMemo(() => {
    const porResidente = new Map<string, CarteiraVacinal[]>();
    for (const c of carteiras.data ?? []) {
      const arr = porResidente.get(c.residente_id) ?? [];
      arr.push(c);
      porResidente.set(c.residente_id, arr);
    }
    return (residentes.data ?? [])
      .map((r) => {
        const vigente = carteiraVigente(porResidente.get(r.id) ?? []);
        return { residenteId: r.id, nome: r.nome, quarto: r.quarto, status: statusCarteira(vigente), vigente };
      })
      .sort((a, b) => {
        const peso = (s: StatusCarteira) => (s === "pendente" ? 0 : s === "desatualizada" ? 1 : 2);
        return peso(a.status) - peso(b.status) || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [residentes.data, carteiras.data]);

  if (residentes.isLoading || carteiras.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (carteiras.isError) return <ErrorState error={carteiras.error} />;

  const total = linhas.length;
  const comCarteira = linhas.filter((l) => l.status !== "pendente").length;
  const pendentes = linhas.filter((l) => l.status === "pendente").length;
  const desatualizadas = linhas.filter((l) => l.status === "desatualizada").length;

  const filtradas = filtro === "todos" ? linhas : linhas.filter((l) => l.status === filtro);

  async function abrir(path: string) {
    const url = await urlAssinadaCarteira(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o arquivo.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <Syringe className="size-6 text-primary" /> Controle de vacinação
        </h2>
      </div>

      {/* Cobertura */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success"><ShieldCheck className="size-5" /></span>
          <div>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{comCarteira} <span className="text-base font-semibold text-muted-foreground">de {total}</span></p>
            <p className="text-sm text-muted-foreground">Com carteira anexada</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-3 rounded-xl border p-4", pendentes > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20")}>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", pendentes > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}><UserX className="size-5" /></span>
          <div>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{pendentes}</p>
            <p className="text-sm text-muted-foreground">Pendentes (sem carteira)</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-3 rounded-xl border p-4", desatualizadas > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-muted/20")}>
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", desatualizadas > 0 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground")}><AlertTriangle className="size-5" /></span>
          <div>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{desatualizadas}</p>
            <p className="text-sm text-muted-foreground">Desatualizadas (+{MESES_VALIDADE_CARTEIRA} meses)</p>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap gap-1.5">
        {(["todos", "pendente", "desatualizada", "em_dia"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filtro === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f === "todos" ? "Todos" : STATUS_CARTEIRA_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <EmptyState label="Nenhum hóspede neste filtro." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map((l) => (
              <div key={l.residenteId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{l.nome}</span>
                    <span className="text-xs text-muted-foreground">Quarto {l.quarto ?? "—"}</span>
                    <Badge variant={STATUS_CARTEIRA_VARIANTE[l.status]}>{STATUS_CARTEIRA_LABEL[l.status]}</Badge>
                  </div>
                  {l.vigente ? (
                    <p className="text-xs text-muted-foreground">
                      Atualizada em {formatarDataBR(l.vigente.atualizada_em ?? l.vigente.data_upload)}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">Nenhuma carteira anexada — pendente</p>
                  )}
                </div>
                {l.vigente && (
                  <Button size="sm" variant="outline" onClick={() => abrir(l.vigente!.arquivo_url)}>
                    <ExternalLink className="size-4" /> Ver carteira
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
