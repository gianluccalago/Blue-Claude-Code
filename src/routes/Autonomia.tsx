import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Sparkles, ClipboardList, Gauge, RefreshCcw } from "lucide-react";
import { useHospedesAtendidos } from "@/hooks/usePlanos";
import { useAutonomiaCasa, useAutonomiaHospede } from "@/hooks/useAutonomia";
import {
  DOMINIOS,
  DOMINIO_POR_ID,
  MOTIVO_LABEL,
  dominioDoPerfil,
  textoPrazo,
  type StatusDominio,
} from "@/lib/autonomia";
import { HospedeSelector } from "@/components/HospedeSelector";
import { StatusDominios } from "@/components/autonomia/StatusDominios";
import { ResumoAutonomiaCard } from "@/components/autonomia/ResumoAutonomiaCard";
import { AvaliacaoAutonomiaForm, AvaliacaoAutonomiaLeitura } from "@/components/autonomia/AvaliacaoAutonomia";
import { ObjetivosAutonomia } from "@/components/autonomia/ObjetivosAutonomia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, hojeISO } from "@/lib/utils";
import type { DominioAutonomia, Residente } from "@/types/database";

// ===========================================================================
// AUTONOMIA — preservar autonomia, mensurável em cada plano de cuidados.
// Médico, Coordenação, Fisio (multidisciplinar) e Nutrição avaliam o SEU
// domínio; todos leem os demais. Objetivos funcionais e revisões. O
// indicador sai só de registros feitos por pessoas.
// ===========================================================================

export function Autonomia() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const meuDominio = dominioDoPerfil(perfil);
  const ehMaster = perfil === "master";
  const podeEscrever = !!meuDominio || ehMaster;
  const [dominioMaster, setDominioMaster] = useState<DominioAutonomia>("coordenacao");
  const dominio: DominioAutonomia | null = ehMaster ? dominioMaster : meuDominio;

  const residentes = useHospedesAtendidos();
  const casa = useAutonomiaCasa();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hoje = hojeISO();

  // Pendências do MEU domínio (Master: do domínio escolhido), mais urgentes primeiro.
  const pendencias = useMemo(() => {
    if (!casa.data || !dominio) return [];
    return casa.data.hospedes
      .map((h) => ({ h, s: h.status.find((x) => x.dominio === dominio)! }))
      .filter((x) => x.s.situacao === "pendente")
      .sort((a, b) => (a.s.prazo ?? "").localeCompare(b.s.prazo ?? ""));
  }, [casa.data, dominio]);

  if (residentes.isLoading || casa.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (casa.isError) return <ErrorState error={casa.error} />;
  const lista = residentes.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede ativo." />;
  const hospedeId = selecionadoId ?? pendencias[0]?.h.residente.id ?? lista[0].id;
  const hospede = lista.find((r) => r.id === hospedeId) ?? lista[0];
  const ind = casa.data!.indicador;

  return (
    <div className="space-y-6">
      {/* Indicador da casa — sempre decomposto */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-primary" /> Autonomia na casa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Numero valor={ind.pctDocumentada} rotulo="Documentada" detalhe={`${ind.documentadas} de ${ind.total}: 4 avaliações em dia, preferência registrada e objetivo ativo`} />
            <Numero valor={ind.pctVerificada} rotulo="Verificada" detalhe={`${ind.verificadas} de ${ind.total}: objetivo revisto nos últimos 90 dias, com observação e fala do residente`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Faltam: {ind.semAvaliacaoEmDia} sem as 4 avaliações em dia · {ind.semPreferencia} sem preferência registrada ·{" "}
            {ind.semObjetivo} sem objetivo ativo · {ind.semRevisaoRecente} sem revisão nos últimos 90 dias.
          </p>
        </CardContent>
      </Card>

      {/* Pendências do meu domínio */}
      {dominio && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" /> Avaliações pendentes · {DOMINIO_POR_ID.get(dominio)!.quemAvalia}
              <Badge variant={pendencias.some((p) => p.s.vencida) ? "destructive" : "muted"}>{pendencias.length}</Badge>
            </CardTitle>
            {ehMaster && (
              <select
                value={dominioMaster}
                onChange={(e) => setDominioMaster(e.target.value as DominioAutonomia)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                aria-label="Domínio"
              >
                {DOMINIOS.map((d) => (
                  <option key={d.id} value={d.id}>{d.quemAvalia}</option>
                ))}
              </select>
            )}
          </CardHeader>
          <CardContent>
            {pendencias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação pendente neste domínio.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pendencias.map(({ h, s }) => (
                  <button
                    key={h.residente.id}
                    onClick={() => setSelecionadoId(h.residente.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/60",
                      s.vencida ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/5",
                      h.residente.id === hospedeId && "ring-2 ring-primary",
                    )}
                  >
                    <span className="font-semibold text-secondary">{h.residente.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {MOTIVO_LABEL[s.motivo ?? "entrada"]} · {textoPrazo(s.prazo!, hoje)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <HospedeSelector hospedes={lista} selecionadoId={hospedeId} onSelect={setSelecionadoId} />
      <AutonomiaDoHospede
        key={hospede.id}
        residente={hospede}
        dominio={dominio}
        podeEscrever={podeEscrever}
        onEscolherDominio={ehMaster ? setDominioMaster : undefined}
      />
    </div>
  );
}

function Numero({ valor, rotulo, detalhe }: { valor: number | null; rotulo: string; detalhe: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor === null ? "—" : `${valor}%`}</p>
      <p className="text-sm font-semibold text-secondary">{rotulo}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function AutonomiaDoHospede({
  residente,
  dominio,
  podeEscrever,
  onEscolherDominio,
}: {
  residente: Residente;
  dominio: DominioAutonomia | null;
  podeEscrever: boolean;
  onEscolherDominio?: (d: DominioAutonomia) => void;
}) {
  const q = useAutonomiaHospede(residente);
  const [reavaliando, setReavaliando] = useState(false);
  const hoje = hojeISO();
  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <ErrorState error={q.error} />;
  const { status, avaliacoes, objetivos, revisoes } = q.data;
  const meu: StatusDominio | undefined = dominio ? status.find((s) => s.dominio === dominio) : undefined;
  const mostrarForm = !!meu && podeEscrever && (meu.situacao === "pendente" || !!meu.rascunho || reavaliando);
  const outros = status.filter((s) => s.dominio !== dominio && s.ultima);

  return (
    <div className="space-y-4">
      <StatusDominios status={status} hoje={hoje} selecionado={dominio} onSelecionar={onEscolherDominio} />
      <ResumoAutonomiaCard residente={residente} />

      {meu && podeEscrever && (
        mostrarForm ? (
          <AvaliacaoAutonomiaForm
            key={`${residente.id}-${meu.dominio}-${meu.rascunho?.id ?? "novo"}-${meu.ultima?.id ?? "sem"}`}
            residenteId={residente.id}
            status={meu}
          />
        ) : (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> {DOMINIO_POR_ID.get(meu.dominio)!.quemAvalia} · avaliação em dia
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setReavaliando(true)}>
                <RefreshCcw className="size-4" /> Reavaliar agora
              </Button>
            </CardHeader>
            <CardContent>{meu.ultima && <AvaliacaoAutonomiaLeitura avaliacao={meu.ultima} />}</CardContent>
          </Card>
        )
      )}

      {outros.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avaliações dos outros domínios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outros.map((s) => (
              <details key={s.dominio} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-semibold text-secondary">
                  {DOMINIO_POR_ID.get(s.dominio)!.quemAvalia} · {DOMINIO_POR_ID.get(s.dominio)!.rotulo}
                </summary>
                <div className="mt-2">
                  <AvaliacaoAutonomiaLeitura avaliacao={s.ultima!} />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      <ObjetivosAutonomia
        residenteId={residente.id}
        objetivos={objetivos}
        revisoes={revisoes}
        avaliacoes={avaliacoes}
        dominioPadrao={dominio ?? "coordenacao"}
        podeEditar={podeEscrever}
      />
    </div>
  );
}
