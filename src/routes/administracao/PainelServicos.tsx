/**
 * Supervisão de Serviços — Administração / Master (leitura + sinalização)
 *
 * A gestão acompanha os três serviços operacionais (Hotelaria, Serviços Gerais
 * e Lavanderia) em LEITURA e pode SINALIZAR um chamado como "priorizado pela
 * gestão" (um empurrão). NÃO executa nem resolve — só sinaliza e acompanha.
 * Os indicadores vêm dos dados reais; a RLS entrega todos os chamados à gestão.
 */
import { useMemo } from "react";
import { toast } from "sonner";
import {
  Wrench,
  BedDouble,
  Shirt,
  AlertTriangle,
  Siren,
  Clock,
  CheckCircle2,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useInspecoesHoje } from "@/hooks/useHotelaria";
import { useChamadosManutencao, useCobrarChamado } from "@/hooks/useManutencao";
import { useEnxoval } from "@/hooks/useEnxoval";
import { abaixoDoMinimo } from "@/lib/enxoval";
import { DESTINO_CHAMADO_LABEL } from "@/lib/manutencao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type {
  ChamadoManutencao,
  DestinoChamado,
  InspecaoSuite,
} from "@/types/database";

function emergenciaAtiva(c: ChamadoManutencao): boolean {
  return c.urgencia === "emergencia" && c.status !== "resolvido";
}

/** Contadores de chamados em aberto de um destino. */
function contar(chamados: ChamadoManutencao[]) {
  return {
    abertos: chamados.filter((c) => c.status === "aberto").length,
    emAndamento: chamados.filter((c) => c.status === "em_andamento").length,
    emergencias: chamados.filter(emergenciaAtiva).length,
    naoResolvidos: chamados.filter((c) => c.status !== "resolvido").length,
  };
}

function suitePendente(residenteId: string, inspecoes: InspecaoSuite[]): boolean {
  return !inspecoes.some((i) => i.residente_id === residenteId && i.tipo === "diaria");
}
function suiteNaoConforme(residenteId: string, inspecoes: InspecaoSuite[]): boolean {
  return inspecoes.some(
    (i) => i.residente_id === residenteId && i.tipo === "diaria" && i.tem_nao_conformidade,
  );
}

export function PainelServicos() {
  const residentes = useResidentes();
  const inspecoes = useInspecoesHoje();
  const chamados = useChamadosManutencao();
  const enxoval = useEnxoval();

  const isLoading =
    residentes.isLoading || inspecoes.isLoading || chamados.isLoading || enxoval.isLoading;
  const erro = residentes.error ?? inspecoes.error ?? chamados.error ?? enxoval.error;

  const lista = useMemo(() => chamados.data ?? [], [chamados.data]);
  const porServicosGerais = useMemo(
    () => lista.filter((c) => c.destino === "servicos_gerais"),
    [lista],
  );
  const porHotelaria = useMemo(() => lista.filter((c) => c.destino === "hotelaria"), [lista]);

  // Hotelaria — inspeção do dia.
  const comQuarto = useMemo(() => (residentes.data ?? []).filter((r) => r.quarto), [residentes.data]);
  const insp = inspecoes.data ?? [];
  const suitesPendentes = comQuarto.filter((r) => suitePendente(r.id, insp)).length;
  const suitesNaoConformes = comQuarto.filter((r) => suiteNaoConforme(r.id, insp)).length;

  // Lavanderia — enxoval (patrimônio da casa).
  const itensEnx = enxoval.data ?? [];
  const aReporEnx = itensEnx.filter(abaixoDoMinimo).length;
  const patrimonioEnx = itensEnx.reduce((s, i) => s + i.quantidade_total, 0);

  // Fila de chamados em aberto (todos os destinos) p/ a gestão priorizar.
  const abertos = useMemo(
    () =>
      lista
        .filter((c) => c.status !== "resolvido")
        .sort((a, b) => {
          const aE = emergenciaAtiva(a);
          const bE = emergenciaAtiva(b);
          if (aE !== bE) return aE ? -1 : 1;
          if (a.cobrado_gestao !== b.cobrado_gestao) return a.cobrado_gestao ? -1 : 1;
          return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
        }),
    [lista],
  );

  if (isLoading) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const sg = contar(porServicosGerais);
  const ht = contar(porHotelaria);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="size-3.5" /> Supervisão · leitura + sinalização
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Serviços</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">
            Acompanhe Hotelaria, Serviços Gerais e Lavanderia. A gestão prioriza chamados (um
            empurrão), mas não executa nem resolve.
          </p>
        </div>
      </div>

      {/* SERVIÇOS GERAIS */}
      <BlocoServico icon={Wrench} titulo="Serviços Gerais" subtitulo="Manutenção predial/corretiva">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={AlertTriangle} tom={sg.abertos > 0 ? "warning" : "success"} rotulo="Abertos" valor={sg.abertos} />
          <StatCard icon={Clock} tom="secondary" rotulo="Em andamento" valor={sg.emAndamento} />
          <StatCard icon={Siren} tom={sg.emergencias > 0 ? "destructive" : "success"} destaque={sg.emergencias > 0} rotulo="Emergências" valor={sg.emergencias} />
        </div>
      </BlocoServico>

      {/* HOTELARIA */}
      <BlocoServico icon={BedDouble} titulo="Hotelaria" subtitulo="Inspeção de suítes + governança">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={Clock} tom={suitesPendentes > 0 ? "warning" : "success"} rotulo="Suítes pendentes" valor={suitesPendentes} />
          <StatCard icon={AlertTriangle} tom={suitesNaoConformes > 0 ? "destructive" : "success"} destaque={suitesNaoConformes > 0} rotulo="Não-conformidades" valor={suitesNaoConformes} />
          <StatCard icon={Wrench} tom={ht.naoResolvidos > 0 ? "warning" : "success"} rotulo="Chamados (Hotelaria)" valor={ht.naoResolvidos} />
          <StatCard icon={Siren} tom={ht.emergencias > 0 ? "destructive" : "success"} destaque={ht.emergencias > 0} rotulo="Emergências" valor={ht.emergencias} />
        </div>
      </BlocoServico>

      {/* LAVANDERIA */}
      <BlocoServico icon={Shirt} titulo="Lavanderia" subtitulo="Enxoval da casa (patrimônio)">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={AlertTriangle}
            tom={aReporEnx > 0 ? "destructive" : "success"}
            destaque={aReporEnx > 0}
            rotulo="Itens a repor"
            valor={aReporEnx}
            apoio={aReporEnx > 0 ? "abaixo do mínimo" : "todos acima do mínimo"}
          />
          <StatCard icon={Shirt} tom="secondary" rotulo="Patrimônio total" valor={patrimonioEnx} sufixo=" peças" />
          <StatCard icon={CheckCircle2} tom="secondary" rotulo="Itens cadastrados" valor={itensEnx.length} />
        </div>
      </BlocoServico>

      {/* FILA DE COBRANÇA — priorizar chamados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-primary" /> Chamados em aberto — priorizar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {abertos.length === 0 ? (
            <EmptyState label="Nenhum chamado em aberto nos serviços." />
          ) : (
            <div className="space-y-2">
              {abertos.map((c) => (
                <LinhaChamado key={c.id} chamado={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const DESTINO_BADGE: Record<DestinoChamado, "secondary" | "muted"> = {
  servicos_gerais: "secondary",
  hotelaria: "muted",
};

function LinhaChamado({ chamado: c }: { chamado: ChamadoManutencao }) {
  const cobrar = useCobrarChamado();
  const emergencia = emergenciaAtiva(c);

  async function alternar() {
    try {
      await cobrar.mutateAsync({ id: c.id, cobrar: !c.cobrado_gestao });
      toast.success(c.cobrado_gestao ? "Priorização removida." : "Chamado priorizado pela gestão.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível sinalizar.");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
        emergencia && "border-destructive/40 bg-destructive/5",
        !emergencia && c.cobrado_gestao && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-secondary">{c.local}</span>
          <Badge variant={DESTINO_BADGE[c.destino]}>{DESTINO_CHAMADO_LABEL[c.destino]}</Badge>
          {emergencia && (
            <Badge variant="destructive" className="gap-1">
              <Siren className="size-3" /> emergência
            </Badge>
          )}
          {c.cobrado_gestao && (
            <Badge variant="default" className="gap-1">
              <Megaphone className="size-3" /> priorizado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{ouNaoInformado(c.problema)}</p>
      </div>
      <Button
        size="sm"
        variant={c.cobrado_gestao ? "outline" : "default"}
        onClick={alternar}
        disabled={cobrar.isPending}
        className="gap-1.5 shrink-0"
      >
        <Megaphone className="size-4" />
        {c.cobrado_gestao ? "Remover" : "Priorizar"}
      </Button>
    </div>
  );
}

function BlocoServico({
  icon: Icon,
  titulo,
  subtitulo,
  children,
}: {
  icon: typeof Wrench;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-secondary" /> {titulo}
          <span className="text-xs font-normal text-muted-foreground">· {subtitulo}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
