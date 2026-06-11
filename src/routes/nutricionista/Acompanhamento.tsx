/**
 * Acompanhamento — Nutricionista (BLOCO N1)
 *
 * Aceitação alimentar registrada pelos cuidadores (tarefa_registro,
 * "Aceitação <refeição>: <nível>") e visão geral de hóspedes com baixa
 * aceitação recorrente, para priorização da nutricionista.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Scale, Utensils } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useAceitacaoPeriodo, useAceitacaoTodos, useUltimoPeso } from "@/hooks/useNutricao";
import { NIVEIS_BAIXOS, NIVEL_BADGE, REFEICOES_NUTRI, parseAceitacao } from "@/lib/nutricao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import type { Residente } from "@/types/database";

const DIAS_PERIODO = 7;
const LIMIAR_ATENCAO = 3;

export function Acompanhamento() {
  return (
    <Tabs defaultValue="hospede">
      <TabsList>
        <TabsTrigger value="hospede">Hóspede</TabsTrigger>
        <TabsTrigger value="geral">Visão geral</TabsTrigger>
      </TabsList>
      <TabsContent value="hospede">
        <AcompanhamentoHospede />
      </TabsContent>
      <TabsContent value="geral">
        <VisaoGeral />
      </TabsContent>
    </Tabs>
  );
}

// ─── Hóspede ────────────────────────────────────────────────────────────────────

function AcompanhamentoHospede() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && <AceitacaoDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function AceitacaoDoHospede({ residenteId }: { residenteId: string }) {
  const aceitacao = useAceitacaoPeriodo(residenteId, DIAS_PERIODO);
  const peso = useUltimoPeso(residenteId);

  if (aceitacao.isError) return <ErrorState error={aceitacao.error} />;
  if (aceitacao.isLoading) return <LoadingState />;

  // Agrupa por data -> refeição -> nível
  const porData = new Map<string, Map<string, string>>();
  let totalBaixos = 0;
  for (const reg of aceitacao.data ?? []) {
    const parsed = parseAceitacao(reg.tarefa);
    if (!parsed) continue;
    if (!porData.has(reg.data)) porData.set(reg.data, new Map());
    porData.get(reg.data)!.set(parsed.refeicao, parsed.nivel);
    if (NIVEIS_BAIXOS.has(parsed.nivel)) totalBaixos++;
  }
  const datas = [...porData.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {totalBaixos >= LIMIAR_ATENCAO && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Baixa aceitação alimentar recorrente: {totalBaixos} registro(s) "Nada"/"Pouco" nos últimos {DIAS_PERIODO} dias.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="size-5 text-primary" />
            Aceitação alimentar — últimos {DIAS_PERIODO} dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {datas.length === 0 ? (
            <EmptyState label="Nenhum registro de aceitação alimentar no período." />
          ) : (
            <div className="space-y-4">
              {datas.map((data) => {
                const porRefeicao = porData.get(data)!;
                return (
                  <div key={data} className="rounded-lg border bg-card p-4">
                    <p className="mb-2 text-sm font-semibold text-secondary">{formatarDataBR(data)}</p>
                    <div className="flex flex-wrap gap-2">
                      {REFEICOES_NUTRI.map((ref) => {
                        const nivel = porRefeicao.get(ref);
                        return (
                          <div key={ref} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{ref}:</span>
                            {nivel ? (
                              <Badge variant={NIVEL_BADGE[nivel] ?? "muted"} className="text-xs">
                                {nivel}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Peso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {peso.isLoading ? (
            <LoadingState label="Carregando peso…" />
          ) : peso.isError ? (
            <ErrorState error={peso.error} />
          ) : peso.data ? (
            <div className="text-sm text-secondary">
              <p className="font-semibold">{peso.data.tarefa}</p>
              <p className="text-xs text-muted-foreground">
                Registrado em {formatarDataHoraBR(peso.data.feito_em)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem registro de peso. {/* O peso mensal poderá ser estruturado em uma tabela própria futuramente. */}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

function VisaoGeral() {
  const residentes = useResidentes();
  const aceitacao = useAceitacaoTodos(DIAS_PERIODO);

  const isLoading = residentes.isLoading || aceitacao.isLoading;

  const contagemPorResidente = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const reg of aceitacao.data ?? []) {
      const parsed = parseAceitacao(reg.tarefa);
      if (!parsed) continue;
      if (!NIVEIS_BAIXOS.has(parsed.nivel)) continue;
      mapa.set(reg.residente_id, (mapa.get(reg.residente_id) ?? 0) + 1);
    }
    return mapa;
  }, [aceitacao.data]);

  if (isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (aceitacao.isError) return <ErrorState error={aceitacao.error} />;

  const lista = (residentes.data ?? []).map((r: Residente) => ({
    residente: r,
    baixos: contagemPorResidente.get(r.id) ?? 0,
  }));
  lista.sort((a, b) => b.baixos - a.baixos);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-primary" />
          Atenção alimentar — últimos {DIAS_PERIODO} dias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lista.length === 0 ? (
          <EmptyState label="Nenhum residente cadastrado." />
        ) : (
          <div className="space-y-2">
            {lista.map(({ residente, baixos }) => (
              <div
                key={residente.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-secondary">{residente.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Quarto {residente.quarto ?? "—"}
                  </p>
                </div>
                {baixos >= LIMIAR_ATENCAO ? (
                  <Badge variant="destructive">Atenção · {baixos} baixa(s)</Badge>
                ) : baixos > 0 ? (
                  <Badge variant="warning">{baixos} baixa(s)</Badge>
                ) : (
                  <Badge variant="muted">Sem registros baixos</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
