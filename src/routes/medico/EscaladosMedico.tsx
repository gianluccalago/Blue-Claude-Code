import { useState } from "react";
import { AlertTriangle, Droplet, CircleDot, Check, CheckCircle2, Stethoscope } from "lucide-react";
import {
  useEscaladosMedico,
  useRegistrarResolucaoMedica,
  type ItemEscaladoIntercorrencia,
  type ItemEscaladoEliminacao,
} from "@/hooks/useMedico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ELIM_LABEL: Record<string, string> = {
  urina: "Sem registro de urina hoje",
  evacuacao: "Sem evacuação nas últimas 72h",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function EscaladosMedico() {
  const { data, isLoading, isError, error } = useEscaladosMedico();
  const resolver = useRegistrarResolucaoMedica();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const intercEscalados = data?.intercEscalados ?? [];
  const elimEscalados = data?.elimEscalados ?? [];
  const total = intercEscalados.length + elimEscalados.length;

  return (
    <div className="space-y-6">
      {/* Contador */}
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border p-4",
          total > 0 ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5",
        )}
      >
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            total > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
          )}
        >
          {total > 0 ? (
            <Stethoscope className="size-5" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold text-secondary">Escalados para mim</p>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "Nenhum item pendente. Tudo em dia!"
              : `${total} item${total !== 1 ? "s" : ""} aguardando resolução médica`}
          </p>
        </div>
        {total > 0 && (
          <Badge variant="warning" className="px-3 py-1.5 text-sm tabular-nums">
            {total}
          </Badge>
        )}
      </div>

      {total === 0 && (
        <EmptyState label="Nenhum item escalado pendente. Tudo em dia!" />
      )}

      {/* ── Intercorrências ─────────────────────────────────────────────── */}
      {intercEscalados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              Intercorrências
              <Badge variant="warning" className="ml-1">
                {intercEscalados.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {intercEscalados.map((item) => (
              <IntercorrenciaEscaladaCard
                key={item.intercorrencia.id}
                item={item}
                salvando={resolver.isPending}
                onResolver={(obs) =>
                  resolver.mutate({
                    tipoOrigem: "intercorrencia",
                    referenciaId: item.intercorrencia.id,
                    observacao: obs,
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Alertas de eliminação ───────────────────────────────────────── */}
      {elimEscalados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="size-5 text-primary" />
              Alertas de eliminação
              <Badge variant="muted" className="ml-1">
                {elimEscalados.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {elimEscalados.map((item) => (
              <EliminacaoEscaladaCard
                key={item.escalacao.id}
                item={item}
                salvando={resolver.isPending}
                onResolver={(obs) =>
                  resolver.mutate({
                    tipoOrigem: "eliminacao",
                    referenciaId: item.escalacao.id,
                    observacao: obs,
                  })
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Card de intercorrência escalada ─────────────────────────────────────────

function IntercorrenciaEscaladaCard({
  item,
  salvando,
  onResolver,
}: {
  item: ItemEscaladoIntercorrencia;
  salvando: boolean;
  onResolver: (obs: string | null) => void;
}) {
  const [resolvendo, setResolvendo] = useState(false);
  const [obs, setObs] = useState("");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Ícone + info */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-secondary">{item.intercorrencia.tipo}</div>
            <div className="text-sm font-semibold text-secondary">
              {item.residente.nome} · Quarto {item.residente.quarto ?? "—"}
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {ouNaoInformado(item.intercorrencia.observacao)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>Registrada em {formatarDataHoraBR(item.intercorrencia.registrado_em)}</span>
              <span className="font-medium text-warning">
                · Escalada em {formatarDataHoraBR(item.escaladoEm)}
              </span>
            </div>
          </div>
        </div>

        {!resolvendo && (
          <Button variant="success" size="sm" onClick={() => setResolvendo(true)}>
            <Check className="size-4" /> Resolver
          </Button>
        )}
      </div>

      {/* Formulário inline de resolução */}
      {resolvendo && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <input
            autoFocus
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Conduta médica (opcional), ex: ajustada medicação"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                onResolver(obs.trim() || null);
                setResolvendo(false);
                setObs("");
              }}
              disabled={salvando}
            >
              <Check className="size-4" /> Confirmar resolução
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResolvendo(false);
                setObs("");
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card de alerta de eliminação escalado ────────────────────────────────────

function EliminacaoEscaladaCard({
  item,
  salvando,
  onResolver,
}: {
  item: ItemEscaladoEliminacao;
  salvando: boolean;
  onResolver: (obs: string | null) => void;
}) {
  const [resolvendo, setResolvendo] = useState(false);
  const [obs, setObs] = useState("");

  const Icone = item.escalacao.tipo_alerta === "urina" ? Droplet : CircleDot;
  const textoAlerta = ELIM_LABEL[item.escalacao.tipo_alerta] ?? item.escalacao.tipo_alerta;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icone className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-secondary">{item.residente.nome}</div>
            <div className="text-sm text-muted-foreground">
              Quarto {item.residente.quarto ?? "—"}
            </div>
            <div className="mt-0.5 text-sm font-medium text-secondary/80">{textoAlerta}</div>
            {item.escalacao.observacao && (
              <div className="text-sm text-muted-foreground">"{item.escalacao.observacao}"</div>
            )}
            <div className="mt-1 text-xs font-medium text-primary">
              Escalado em {formatarDataHoraBR(item.escalacao.tratado_em)}
            </div>
          </div>
        </div>

        {!resolvendo && (
          <Button variant="success" size="sm" onClick={() => setResolvendo(true)}>
            <Check className="size-4" /> Resolver
          </Button>
        )}
      </div>

      {resolvendo && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <input
            autoFocus
            type="text"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Conduta médica (opcional), ex: iniciado laxante"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                onResolver(obs.trim() || null);
                setResolvendo(false);
                setObs("");
              }}
              disabled={salvando}
            >
              <Check className="size-4" /> Confirmar resolução
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResolvendo(false);
                setObs("");
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
