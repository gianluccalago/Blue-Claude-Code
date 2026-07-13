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
import { useSolicitacoesPorDestino } from "@/hooks/useSolicitacoes";
import {
  useEstoqueTodosMes,
  useEstoqueResgateAll,
  useResidentesComProvisionamento,
  mesAtualISO,
} from "@/hooks/usePainelFarmacia";
import { useChamadosManutencao } from "@/hooks/useManutencao";
import { useInspecoesHoje } from "@/hooks/useHotelaria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Medalhao } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";
import { CoberturaAssistencial } from "@/routes/coordenacao/CoberturaAssistencial";
import { cn, formatarDataBR, formatarHoraBR } from "@/lib/utils";
import type { ReactNode } from "react";

// ===========================================================================
// MASTER-2 · Painel operacional consolidado — supervisão de toda a operação
// em tempo real, em modo LEITURA. Cada bloco traz contadores + lista resumida
// e linka para a tela de detalhe: assistencial, coordenação (com solicitações
// da família), farmácia (estoque/provisionamento/resgate), hotelaria/manutenção
// e escalas — todos com dados reais.
// ===========================================================================

export function PainelOperacional() {
  const residentes = useResidentes();
  const aderencia = useAderenciaHoje();
  const medicacoes = useMedicacoesPendentesHoje();
  const intercorrencias = useTodasIntercorrencias();
  const tratamentos = useTratamentos();
  const alertasElim = useAlertasEliminacaoPainel();
  const turnosVagos = useTurnosVagosProximos(14);
  // Fontes reais (pós-unificação): família, farmácia, hotelaria, manutenção.
  const mesRef = mesAtualISO();
  const solCoord = useSolicitacoesPorDestino("coordenacao");
  const solMedico = useSolicitacoesPorDestino("medico");
  const solAdmin = useSolicitacoesPorDestino("administracao");
  const estoque = useEstoqueTodosMes(mesRef);
  const estoqueResgate = useEstoqueResgateAll();
  const provisionados = useResidentesComProvisionamento(mesRef);
  const chamados = useChamadosManutencao();
  const inspecoes = useInspecoesHoje();

  const carregando =
    residentes.isLoading ||
    aderencia.isLoading ||
    medicacoes.isLoading ||
    intercorrencias.isLoading ||
    tratamentos.isLoading ||
    alertasElim.isLoading ||
    turnosVagos.isLoading ||
    solCoord.isLoading ||
    solMedico.isLoading ||
    solAdmin.isLoading ||
    estoque.isLoading ||
    estoqueResgate.isLoading ||
    provisionados.isLoading ||
    chamados.isLoading ||
    inspecoes.isLoading;

  const erro =
    residentes.error ??
    aderencia.error ??
    medicacoes.error ??
    intercorrencias.error ??
    tratamentos.error ??
    alertasElim.error ??
    turnosVagos.error ??
    solCoord.error ??
    estoque.error ??
    chamados.error ??
    inspecoes.error;

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const nomePorId = new Map((residentes.data ?? []).map((r) => [r.id, r.nome]));
  const nome = (id: string) => nomePorId.get(id) ?? "Não informado";
  const trat = tratamentos.data ?? [];

  // ---- Assistencial ----
  // Só hóspedes ATIVOS (inativado não infla as pendências operacionais).
  const ativosIds = new Set((residentes.data ?? []).map((r) => r.id));
  const ad = calcularAderencia(aderencia.data?.itens ?? [], aderencia.data?.registros ?? []);
  const medsAbertas = (medicacoes.data ?? [])
    .filter((m) => ativosIds.has(m.residente_id))
    .map((m) => ({ reg: m, estado: estadoDaPendencia(trat, "medicacao", m.id) }))
    .filter((x) => !x.estado.resolvido);
  const intercAbertas = (intercorrencias.data ?? [])
    .filter((i) => ativosIds.has(i.residente_id))
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

  // ---- Coordenação: solicitações da família em aberto, por destino ----
  const abertas = (d: ReturnType<typeof useSolicitacoesPorDestino>) =>
    (d.data ?? []).filter((s) => s.status === "aberta").length;
  const solAbertasCoord = abertas(solCoord);
  const solAbertasMedico = abertas(solMedico);
  const solAbertasAdmin = abertas(solAdmin);
  const solAbertasTotal = solAbertasCoord + solAbertasMedico + solAbertasAdmin;

  // ---- Farmácia ----
  const estoqueBaixo = (estoque.data ?? []).filter((e) => e.quantidade_atual <= 0).length;
  const totalResidentes = residentes.data?.length ?? 0;
  const semProvisionamento = Math.max(0, totalResidentes - (provisionados.data ?? []).length);
  const resgateBaixo = (estoqueResgate.data ?? []).filter((e) => e.quantidade_atual <= 2).length;

  // ---- Hotelaria / Manutenção ----
  const inspHoje = inspecoes.data ?? [];
  const idsInspecionados = new Set(inspHoje.map((i) => i.residente_id));
  const pendentesInspecao = Math.max(0, totalResidentes - idsInspecionados.size);
  const naoConformes = inspHoje.filter((i) => i.tem_nao_conformidade).length;
  const chamadosAbertos = (chamados.data ?? []).filter((c) => c.status !== "resolvido");
  const emergencias = chamadosAbertos.filter((c) => c.urgencia === "emergencia").length;

  // ---- Escalas ----
  const vagos = turnosVagos.data ?? [];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm">
            <Sparkles className="size-3.5" /> Tempo real
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Painel operacional</h2>
        </div>
      </div>

      {/* COBERTURA ASSISTENCIAL — mapa vivo de quem cuida de cada hóspede no
          turno. Master vê e edita aqui mesmo (componente da Coordenação). */}
      <CoberturaAssistencial />

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
          <Contador
            rotulo="Solicitações da família"
            valor={solAbertasTotal}
            destaque={solAbertasTotal > 0}
          />
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
        {solAbertasTotal > 0 && (
          <p className="mt-3 text-xs text-muted-foreground/80">
            Solicitações da família em aberto — Coordenação {solAbertasCoord} · Médico{" "}
            {solAbertasMedico} · Administração {solAbertasAdmin}.
          </p>
        )}
      </Bloco>

      {/* FARMÁCIA */}
      <Bloco icon={PackageOpen} titulo="Farmácia" to="/app/farmacia/painel">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador
            rotulo="Estoque baixo/negativo"
            valor={estoqueBaixo}
            destaque={estoqueBaixo > 0}
          />
          <Contador
            rotulo="Pendentes de provisionamento"
            valor={semProvisionamento}
            destaque={semProvisionamento > 0}
          />
          <Contador rotulo="Resgate baixo (≤ 2)" valor={resgateBaixo} destaque={resgateBaixo > 0} />
        </div>
      </Bloco>

      {/* HOTELARIA / MANUTENÇÃO */}
      <Bloco icon={Sparkles} titulo="Hotelaria e manutenção" to="/app/hotelaria/visao-dia">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Contador
            rotulo="Suítes pendentes de inspeção"
            valor={pendentesInspecao}
            destaque={pendentesInspecao > 0}
          />
          <Contador rotulo="Não-conformidades" valor={naoConformes} destaque={naoConformes > 0} />
          <Contador
            rotulo="Manutenção (abertos/emerg.)"
            valor={chamadosAbertos.length}
            destaque={emergencias > 0}
            icon={Wrench}
          />
        </div>
        {emergencias > 0 && (
          <p className="mt-3 text-xs font-semibold text-destructive">
            {emergencias} chamado(s) de EMERGÊNCIA aberto(s).
          </p>
        )}
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
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/30 pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2.5">
            <Medalhao icon={Icon} tom="secondary" className="size-8 rounded-lg" /> {titulo}
          </span>
          {to && (
            <Link
              to={to}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary/20"
            >
              Detalhe <ChevronRight className="size-3.5" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
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
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-card p-3 shadow-xs",
        destaque && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide">{rotulo}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 font-extrabold tracking-tight tabular-nums",
          semDados ? "text-base text-muted-foreground/70" : "text-2xl text-secondary",
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
