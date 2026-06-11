import { Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  Pill,
  AlertTriangle,
  Droplet,
  Stethoscope,
  Users2,
  PackageOpen,
  Sparkles,
  Wrench,
  CalendarX,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useTratamentos,
  useTodasIntercorrencias,
  useMedicacoesPendentesHoje,
  useAlertasEliminacaoPainel,
  estadoDaPendencia,
} from "@/hooks/useCoordenacao";
import {
  calcularAderencia,
  useAderenciaHoje,
  useTurnosVagosProximos,
} from "@/hooks/useMaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarHoraBR } from "@/lib/utils";
import type { ReactNode } from "react";

// ===========================================================================
// MASTER-2 · Painel operacional consolidado — supervisão de toda a operação
// em tempo real, em modo LEITURA. Cada bloco traz contadores + lista resumida
// e, quando faz sentido, linka para a tela de detalhe. Blocos sem fonte no
// schema atual (Farmácia, Hotelaria, solicitações da família) mostram "sem
// dados" com a origem futura comentada — nunca número fictício.
// ===========================================================================

export function PainelOperacional() {
  const residentes = useResidentes();
  const aderencia = useAderenciaHoje();
  const medicacoes = useMedicacoesPendentesHoje();
  const intercorrencias = useTodasIntercorrencias();
  const tratamentos = useTratamentos();
  const alertasElim = useAlertasEliminacaoPainel();
  const turnosVagos = useTurnosVagosProximos(14);

  const carregando =
    residentes.isLoading ||
    aderencia.isLoading ||
    medicacoes.isLoading ||
    intercorrencias.isLoading ||
    tratamentos.isLoading ||
    alertasElim.isLoading ||
    turnosVagos.isLoading;

  const erro =
    residentes.error ??
    aderencia.error ??
    medicacoes.error ??
    intercorrencias.error ??
    tratamentos.error ??
    alertasElim.error ??
    turnosVagos.error;

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const nomePorId = new Map((residentes.data ?? []).map((r) => [r.id, r.nome]));
  const nome = (id: string) => nomePorId.get(id) ?? "Não informado";
  const trat = tratamentos.data ?? [];

  // ---- Assistencial ----
  const ad = calcularAderencia(aderencia.data?.itens ?? [], aderencia.data?.registros ?? []);
  const medsAbertas = (medicacoes.data ?? [])
    .map((m) => ({ reg: m, estado: estadoDaPendencia(trat, "medicacao", m.id) }))
    .filter((x) => !x.estado.resolvido);
  const intercAbertas = (intercorrencias.data ?? [])
    .map((i) => ({ reg: i, estado: estadoDaPendencia(trat, "intercorrencia", i.id) }))
    .filter((x) => !x.estado.resolvido);
  const alertas = alertasElim.data ?? [];

  // ---- Coordenação ----
  const pendenciasAbertas = medsAbertas.length + intercAbertas.length;
  const escalados = [
    ...medsAbertas.filter((x) => x.estado.escaladoEm).map((x) => ({
      titulo: `Medicação — ${nome(x.reg.residente_id)}`,
      em: x.estado.escaladoEm!,
    })),
    ...intercAbertas.filter((x) => x.estado.escaladoEm).map((x) => ({
      titulo: `${x.reg.tipo} — ${nome(x.reg.residente_id)}`,
      em: x.estado.escaladoEm!,
    })),
    ...alertas.filter((a) => a.escaladoEm).map((a) => ({
      titulo: `Eliminação (${a.tipo}) — ${nome(a.residenteId)}`,
      em: a.escaladoEm!,
    })),
  ];

  // ---- Escalas ----
  const vagos = turnosVagos.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-secondary">
          Painel operacional
        </h2>
        <p className="text-sm text-muted-foreground">
          Supervisão consolidada de toda a operação · tempo real, modo leitura
        </p>
      </div>

      {/* ASSISTENCIAL */}
      <Bloco icon={ClipboardCheck} titulo="Assistencial" to="/app/coordenacao">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador
            rotulo="Aderência hoje"
            valor={ad.pct === null ? "sem dados" : `${ad.pct}%`}
            destaque={ad.pct !== null && ad.pct < 80}
            sub={ad.pct === null ? undefined : `${ad.noPrazo} ok · ${ad.atrasados} atrasadas`}
          />
          <Contador
            rotulo="Medicações não administradas"
            valor={medsAbertas.length}
            destaque={medsAbertas.length > 0}
            icon={Pill}
          />
          <Contador
            rotulo="Intercorrências abertas"
            valor={intercAbertas.length}
            destaque={intercAbertas.length > 0}
            icon={AlertTriangle}
          />
          <Contador
            rotulo="Alertas de eliminação"
            valor={alertas.length}
            destaque={alertas.length > 0}
            icon={Droplet}
          />
        </div>
        {(medsAbertas.length > 0 || intercAbertas.length > 0) && (
          <Resumo>
            {medsAbertas.slice(0, 4).map((x) => (
              <ItemResumo
                key={x.reg.id}
                titulo={`Medicação ${x.reg.periodo} — ${nome(x.reg.residente_id)}`}
                detalhe={x.reg.status === "nao" ? "Não administrada" : "Parcial"}
                tom="destrutivo"
              />
            ))}
            {intercAbertas.slice(0, 4).map((x) => (
              <ItemResumo
                key={x.reg.id}
                titulo={`${x.reg.tipo} — ${nome(x.reg.residente_id)}`}
                detalhe="Intercorrência em aberto"
                tom="alerta"
              />
            ))}
          </Resumo>
        )}
      </Bloco>

      {/* COORDENAÇÃO */}
      <Bloco icon={Users2} titulo="Coordenação" to="/app/coordenacao">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador
            rotulo="Pendências abertas"
            valor={pendenciasAbertas}
            destaque={pendenciasAbertas > 0}
          />
          <Contador
            rotulo="Escalados ao médico"
            valor={escalados.length}
            destaque={escalados.length > 0}
            icon={Stethoscope}
          />
          {/* SEM DADOS: não há tabela de solicitações da família. Origem futura:
              portal Família (solicitações por destino: coordenação, nutrição…). */}
          <Contador rotulo="Solicitações da família" valor="sem dados" />
        </div>
        {escalados.length > 0 && (
          <Resumo>
            {escalados.slice(0, 5).map((e, i) => (
              <ItemResumo
                key={i}
                titulo={e.titulo}
                detalhe={`Escalado · ${formatarDataBR(e.em)}`}
                tom="alerta"
              />
            ))}
          </Resumo>
        )}
        <p className="mt-3 text-xs text-muted-foreground/80">
          Solicitações da família por destino — portal Família (futuro).
        </p>
      </Bloco>

      {/* FARMÁCIA — sem fonte no schema atual */}
      <Bloco icon={PackageOpen} titulo="Farmácia">
        {/* SEM DADOS: não há tabelas de estoque/provisionamento/resgate.
            Origem futura: módulo Farmácia (modelo caixinha). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador rotulo="Estoque baixo/negativo" valor="sem dados" />
          <Contador rotulo="Pendentes de provisionamento" valor="sem dados" />
          <Contador rotulo="Resgate baixo" valor="sem dados" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground/80">
          Estoque, provisionamento e resgate — módulo Farmácia (futuro).
        </p>
      </Bloco>

      {/* HOTELARIA — sem fonte no schema atual */}
      <Bloco icon={Sparkles} titulo="Hotelaria e manutenção">
        {/* SEM DADOS: não há tabelas de inspeção/não-conformidade nem de
            chamados de manutenção. Origem futura: módulos Hotelaria e Manutenção. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador rotulo="Suítes pendentes de inspeção" valor="sem dados" />
          <Contador rotulo="Não-conformidades" valor="sem dados" />
          <Contador rotulo="Manutenção (abertos/emergências)" valor="sem dados" icon={Wrench} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground/80">
          Inspeção, não-conformidades e chamados — módulos Hotelaria e Manutenção (futuro).
        </p>
      </Bloco>

      {/* ESCALAS */}
      <Bloco icon={CalendarX} titulo="Escalas — furos (próximos 14 dias)" to="/app/coordenacao/escalas">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador rotulo="Turnos vagos" valor={vagos.length} destaque={vagos.length > 0} />
        </div>
        {vagos.length > 0 && (
          <Resumo>
            {vagos.slice(0, 6).map((t) => (
              <ItemResumo
                key={t.id}
                titulo={`${formatarDataBR(t.data)} · ${t.categoria}`}
                detalhe={`${t.tag} · ${formatarHoraBR(t.inicio)}–${formatarHoraBR(t.fim)}${
                  t.observacao_interna ? ` · ${t.observacao_interna}` : ""
                }`}
                tom="alerta"
              />
            ))}
          </Resumo>
        )}
      </Bloco>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Bloco({
  icon: Icon,
  titulo,
  to,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  to?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-secondary" /> {titulo}
          </span>
          {to && (
            <Link
              to={to}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Detalhe <ChevronRight className="size-3.5" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Contador({
  rotulo,
  valor,
  sub,
  destaque,
  icon: Icon,
}: {
  rotulo: string;
  valor: ReactNode;
  sub?: string;
  destaque?: boolean;
  icon?: LucideIcon;
}) {
  const semDados = valor === "sem dados";
  return (
    <div className={cn("rounded-lg border p-3", destaque && "border-primary/40 bg-primary/5")}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        <span className="text-[11px] font-semibold leading-tight">{rotulo}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 font-extrabold tabular-nums",
          semDados ? "text-base text-muted-foreground" : "text-2xl text-secondary",
        )}
      >
        {valor}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Resumo({ children }: { children: ReactNode }) {
  return <div className="mt-4 space-y-2">{children}</div>;
}

function ItemResumo({
  titulo,
  detalhe,
  tom,
}: {
  titulo: string;
  detalhe: string;
  tom: "alerta" | "destrutivo";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5",
        tom === "destrutivo" ? "border-destructive/30 bg-destructive/5" : "border-warning/40 bg-warning/10",
      )}
    >
      <span className="text-sm font-semibold text-secondary">{titulo}</span>
      <Badge variant={tom === "destrutivo" ? "destructive" : "warning"}>{detalhe}</Badge>
    </div>
  );
}
