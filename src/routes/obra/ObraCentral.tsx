import { useState } from "react";
import { toast } from "sonner";
import {
  Gauge, Wallet, CalendarClock, AlertTriangle, CircleDollarSign, CalendarCheck2,
  ArrowRight, Play, CheckCircle2, Hourglass, Package, MessageSquareText, Camera, X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useObraConfig } from "@/hooks/useObraMedicoes";
import {
  useDisciplinas,
  useMarcos,
  useBimRodadas,
  useAtualizarMarco,
  usePagarMarco,
  useDesfazerPagamentoMarco,
} from "@/hooks/useObraProjetos";
import { ModalDisciplina } from "@/routes/obra/ObraProjetos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { usePlanejamento, useResponderPedidoInsumo } from "@/hooks/useObraMateriais";
import { useSolicitacoesObra, useResponderSolicitacaoObra, useFotosAndamento } from "@/hooks/useObraColab";
import { FotoSegura } from "@/components/AnexoSeguro";
import { BUCKET_OBRA } from "@/lib/storage";
import { somarDiasISO, arred } from "@/lib/obraCalc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { formatarMoeda, formatarMesReferencia } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraDisciplina, ObraDisciplinaMarco } from "@/types/database";

// ===========================================================================
// MÓDULO OBRA · CENTRAL — o centro de CONTROLE do dia a dia (master/direção).
// Fase atual do empreendimento: desenvolvimento de projetos (TRÍADE). Aqui o
// cronograma, o financeiro e o ciclo de cada atividade se encontram:
//   · Ações pendentes: pagar entrada, aprovar entrega, pagar marco aprovado;
//   · Esta semana: o que começa, termina, está em andamento ou atrasado;
//   · Desembolso mês a mês: previsto × pago dos R$ 500.000 de projetos.
// Toda linha abre o WORKSPACE da atividade (progresso, entregas, pagamentos).
// ===========================================================================

/** Segunda-feira da semana da data. */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dia = d.getUTCDay(); // 0=dom
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

export function ObraCentral() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const disciplinas = useDisciplinas();
  const marcos = useMarcos();
  const bim = useBimRodadas();
  const config = useObraConfig();
  const aprovarMarco = useAtualizarMarco();
  const pagarMarco = usePagarMarco();
  const desfazerPagamento = useDesfazerPagamentoMarco();

  const [aberta, setAberta] = useState<ObraDisciplina | null>(null);
  // Pagamento SEMPRE pede confirmação; o toast de sucesso oferece "Desfazer".
  const [confirmando, setConfirmando] = useState<{ titulo: string; descricao: string; acao: () => void } | null>(null);

  if (disciplinas.isLoading || marcos.isLoading) return <LoadingState />;
  if (disciplinas.isError) return <ErrorState error={disciplinas.error} />;

  const hoje = hojeISO();
  const listaDisc = disciplinas.data ?? [];
  const listaMarcos = marcos.data ?? [];
  const compatFinal = (bim.data ?? []).some((r) => r.final && !!r.ifc_url);
  const multaCfg = {
    multaDiaPct: parseFloat(config.data?.multa_projeto_dia_pct ?? "0.15"),
    tetoPct: parseFloat(config.data?.multa_projeto_teto_pct ?? "10"),
  };

  const discPorId = new Map(listaDisc.map((d) => [d.id, d]));
  const marcosPorDisc = new Map<string, ObraDisciplinaMarco[]>();
  for (const m of listaMarcos) {
    const arr = marcosPorDisc.get(m.disciplina_id) ?? [];
    arr.push(m);
    marcosPorDisc.set(m.disciplina_id, arr);
  }
  const fimDe = (d: ObraDisciplina) => somarDiasISO(d.data_base, d.prazo_dias);

  // ── KPIs ──
  const pagasComValor = listaDisc.filter((d) => d.valor > 0);
  const totalContratado = arred(pagasComValor.reduce((s, d) => s + d.valor, 0));
  const totalPago = arred(listaMarcos.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor, 0));
  const avancoProjetos = totalContratado > 0
    ? pagasComValor.reduce((s, d) => s + d.valor * d.progresso_pct, 0) / totalContratado
    : 0;
  // "Concluída" = progresso 100 (fonte da verdade — sincronizada com o status).
  const atrasadas = listaDisc.filter((d) => {
    const fim = fimDe(d);
    return d.progresso_pct < 100 && fim != null && fim < hoje;
  });

  // ── Ações pendentes (o que precisa de VOCÊ agora) ──
  const entradasAPagar = listaMarcos
    .filter((m) => m.chave === "inicio" && (m.status === "Pendente" || m.status === "Aprovado"))
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc?.data_base && x.disc.data_base <= somarDiasISO(hoje, 7)!)
    .sort((a, b) => a.disc.data_base!.localeCompare(b.disc.data_base!));
  const entregasEmAnalise = listaMarcos
    .filter((m) => m.status === "Em análise")
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc);
  const aprovadosAPagar = listaMarcos
    .filter((m) => m.status === "Aprovado" && m.chave !== "inicio")
    .map((m) => ({ marco: m, disc: discPorId.get(m.disciplina_id)! }))
    .filter((x) => x.disc);
  const totalAcoes = entradasAPagar.length + entregasEmAnalise.length + aprovadosAPagar.length;

  // ── Esta semana ──
  const segunda = segundaDaSemana(hoje);
  const domingo = somarDiasISO(segunda, 6)!;
  const naSemana = (iso: string | null) => !!iso && iso >= segunda && iso <= domingo;
  const comecamSemana = listaDisc.filter((d) => naSemana(d.data_base) && d.progresso_pct < 100);
  const terminamSemana = listaDisc.filter((d) => naSemana(fimDe(d)) && d.progresso_pct < 100);
  const emAndamento = listaDisc.filter((d) => {
    const fim = fimDe(d);
    return d.data_base != null && d.data_base <= hoje && (!fim || fim >= hoje) && d.progresso_pct < 100;
  });

  // ── Desembolso mês a mês (previsto × pago) ──
  // Previsto: entrada no mês do INÍCIO; R00/R01/entrega no mês do FIM previsto.
  // Pago: pelo mês do pagamento efetivo.
  const porMes = new Map<string, { previsto: number; pago: number }>();
  const soma = (mes: string | null | undefined, campo: "previsto" | "pago", v: number) => {
    if (!mes) return;
    const chave = mes.slice(0, 7);
    const atual = porMes.get(chave) ?? { previsto: 0, pago: 0 };
    atual[campo] += v;
    porMes.set(chave, atual);
  };
  for (const m of listaMarcos) {
    const d = discPorId.get(m.disciplina_id);
    if (!d) continue;
    soma(m.chave === "inicio" ? d.data_base : fimDe(d), "previsto", m.valor);
    if (m.status === "Pago") soma(m.data_pagamento ?? hoje, "pago", m.valor);
  }
  const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMes = Math.max(1, ...meses.map(([, v]) => Math.max(v.previsto, v.pago)));

  function abrir(d: ObraDisciplina) { setAberta(d); }

  /** Toast de sucesso com "Desfazer" (rollback em 1 clique, 12s de janela). */
  function toastPagoComDesfazer(mensagem: string, marco: ObraDisciplinaMarco) {
    toast.success(mensagem, {
      duration: 12_000,
      action: {
        label: "Desfazer",
        onClick: () =>
          desfazerPagamento.mutate(
            { id: marco.id, disciplina_id: marco.disciplina_id },
            {
              onSuccess: () => toast.success("Pagamento desfeito — marco voltou para Aprovado."),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao desfazer."),
            },
          ),
      },
    });
  }

  function pagarEntrada(x: { marco: ObraDisciplinaMarco; disc: ObraDisciplina }) {
    setConfirmando({
      titulo: "Confirmar pagamento da entrada?",
      descricao: `${x.disc.nome} — Entrada (50%) de ${formatarMoeda(x.marco.valor)}. Você poderá desfazer depois (no aviso ou dentro da atividade).`,
      acao: async () => {
        try {
          if (x.marco.status === "Pendente") await aprovarMarco.mutateAsync({ id: x.marco.id, status: "Aprovado" });
          await pagarMarco.mutateAsync(x.marco.id);
          toastPagoComDesfazer(`Entrada de ${x.disc.nome} paga (${formatarMoeda(x.marco.valor)}).`, x.marco);
        } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar."); }
      },
    });
  }
  function pagar(x: { marco: ObraDisciplinaMarco; disc: ObraDisciplina }) {
    setConfirmando({
      titulo: "Confirmar pagamento?",
      descricao: `${x.disc.nome} — ${x.marco.rotulo} de ${formatarMoeda(x.marco.valor)}. Você poderá desfazer depois (no aviso ou dentro da atividade).`,
      acao: async () => {
        try {
          await pagarMarco.mutateAsync(x.marco.id);
          toastPagoComDesfazer(`${x.marco.rotulo} de ${x.disc.nome} pago (${formatarMoeda(x.marco.valor)}).`, x.marco);
        } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao pagar."); }
      },
    });
  }

  const ocupado = aprovarMarco.isPending || pagarMarco.isPending;

  return (
    <div className="space-y-6 pb-8">
      {/* KPIs da fase atual (projetos) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icone={<Gauge className="size-5" />} rotulo="Avanço dos projetos (por valor)" valor={`${avancoProjetos.toFixed(1)}%`} />
        <Kpi icone={<Wallet className="size-5" />} rotulo={`Pago de ${formatarMoeda(totalContratado)}`} valor={formatarMoeda(totalPago)} tom="success" />
        <Kpi icone={<CalendarClock className="size-5" />} rotulo="Ações pendentes" valor={String(totalAcoes)} tom={totalAcoes > 0 ? "warning" : "secondary"} />
        <Kpi icone={<AlertTriangle className="size-5" />} rotulo="Atividades atrasadas" valor={String(atrasadas.length)} tom={atrasadas.length > 0 ? "destructive" : "secondary"} />
      </div>

      {/* Ações pendentes — o que precisa de decisão AGORA */}
      <Card>
        <CardContent className="space-y-1 p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-secondary">
            <CircleDollarSign className="size-5 text-primary" /> Ações pendentes
            {totalAcoes > 0 && <Badge variant="warning">{totalAcoes}</Badge>}
          </h2>
          {totalAcoes === 0 ? (
            <p className="text-sm text-muted-foreground">Nada aguardando decisão. ✔</p>
          ) : (
            <div className="divide-y">
              {entradasAPagar.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`Entrada (50%) · vence ${formatarDataBR(x.disc.data_base!)}${x.disc.data_base! < hoje ? " — VENCIDA" : ""}`}
                  valor={x.marco.valor}
                  vencida={x.disc.data_base! < hoje}
                  acao={podeEditar && <Button size="sm" onClick={() => pagarEntrada(x)} disabled={ocupado}><Play className="size-4" /> Pagar entrada</Button>}
                />
              ))}
              {entregasEmAnalise.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`${x.marco.rotulo} entregue — aguardando sua análise`}
                  valor={x.marco.valor}
                  acao={podeEditar && (
                    <Button size="sm" variant="outline" onClick={() => abrir(x.disc)}>
                      Analisar <ArrowRight className="size-4" />
                    </Button>
                  )}
                />
              ))}
              {aprovadosAPagar.map((x) => (
                <LinhaAcao
                  key={x.marco.id}
                  onAbrir={() => abrir(x.disc)}
                  titulo={x.disc.nome}
                  detalhe={`${x.marco.rotulo} aprovado — liberado para pagamento`}
                  valor={x.marco.valor}
                  acao={podeEditar && <Button size="sm" onClick={() => pagar(x)} disabled={ocupado}><CircleDollarSign className="size-4" /> Pagar</Button>}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canais da TRÍADE: pedidos de insumos, solicitações e fotos */}
      <CanaisTriade podeEditar={podeEditar} />

      {/* Esta semana */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <CalendarCheck2 className="size-5 text-primary" /> Esta semana
            <span className="text-xs font-normal text-muted-foreground">{formatarDataBR(segunda)} – {formatarDataBR(domingo)}</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <GrupoSemana titulo="Começam" icone={<Play className="size-4 text-primary" />} vazio="Nada começa esta semana.">
              {comecamSemana.map((d) => <LinhaSemana key={d.id} d={d} extra={formatarDataBR(d.data_base!)} onAbrir={() => abrir(d)} />)}
            </GrupoSemana>
            <GrupoSemana titulo="Terminam (prazo)" icone={<Hourglass className="size-4 text-warning" />} vazio="Nenhum prazo vence esta semana.">
              {terminamSemana.map((d) => <LinhaSemana key={d.id} d={d} extra={formatarDataBR(fimDe(d)!)} onAbrir={() => abrir(d)} />)}
            </GrupoSemana>
            <GrupoSemana titulo={`Em andamento (${emAndamento.length})`} icone={<CheckCircle2 className="size-4 text-success" />} vazio="Nada em andamento.">
              {emAndamento.slice(0, 8).map((d) => <LinhaSemana key={d.id} d={d} onAbrir={() => abrir(d)} />)}
              {emAndamento.length > 8 && <p className="text-[11px] text-muted-foreground">+ {emAndamento.length - 8} na aba Projetos</p>}
            </GrupoSemana>
          </div>
          {atrasadas.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="mb-1 text-sm font-bold text-destructive">Atrasadas ({atrasadas.length})</p>
              <div className="space-y-1">
                {atrasadas.map((d) => (
                  <button key={d.id} onClick={() => abrir(d)} className="flex w-full items-center justify-between gap-2 text-left text-sm hover:underline">
                    <span className="text-secondary">{d.nome}</span>
                    <span className="shrink-0 tabular-nums text-destructive">{d.progresso_pct}% · prazo {formatarDataBR(fimDe(d)!)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desembolso mês a mês */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Wallet className="size-5 text-primary" /> Desembolso dos projetos — mês a mês
          </h2>
          <div className="space-y-2">
            {meses.map(([mes, v]) => (
              <div key={mes} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-semibold capitalize text-secondary">{formatarMesReferencia(mes)}</span>
                <div className="space-y-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-secondary/30" style={{ width: `${(v.previsto / maxMes) * 100}%` }} />
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(v.pago / maxMes) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-xs text-muted-foreground">prev. {formatarMoeda(arred(v.previsto))}</p>
                  <p className="text-xs font-semibold text-secondary">pago {formatarMoeda(arred(v.pago))}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-secondary/30" /> Previsto (entrada no início · R00/R01 no prazo)</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full bg-brand-gradient" /> Pago</span>
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        aberto={!!confirmando}
        titulo={confirmando?.titulo ?? ""}
        descricao={confirmando?.descricao}
        textoConfirmar="Confirmar pagamento"
        varianteConfirmar="default"
        onConfirmar={() => { const c = confirmando; setConfirmando(null); c?.acao(); }}
        onCancelar={() => setConfirmando(null)}
      />

      {aberta && (
        <ModalDisciplina
          disciplina={listaDisc.find((d) => d.id === aberta.id) ?? aberta}
          marcos={(marcosPorDisc.get(aberta.id) ?? []).sort((a, b) => a.ordem - b.ordem)}
          compatFinal={compatFinal}
          podeEditar={podeEditar}
          multaCfg={multaCfg}
          onFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

// ───────────────────────────────────────────────────────────────────────────
// CANAIS DA TRÍADE — pedidos de insumos (responder com data), solicitações
// gerais (responder) e fotos do canteiro. É a nossa metade da parceria.
// ───────────────────────────────────────────────────────────────────────────

function CanaisTriade({ podeEditar }: { podeEditar: boolean }) {
  const planejamento = usePlanejamento();
  const solicitacoes = useSolicitacoesObra();
  const fotos = useFotosAndamento();
  const responderPedido = useResponderPedidoInsumo();
  const responderSolic = useResponderSolicitacaoObra();

  const hoje = hojeISO();
  const pedidosAbertos = (planejamento.data ?? [])
    .filter((p) => p.status_atendimento === "solicitado")
    .sort((a, b) => (a.data_necessidade ?? "9999").localeCompare(b.data_necessidade ?? "9999"));
  const solicAbertas = (solicitacoes.data ?? []).filter((s) => s.status === "aberta" || s.status === "em_atendimento");
  const fotosRecentes = (fotos.data ?? []).slice(0, 6);

  const [respondendoPedido, setRespondendoPedido] = useState<(typeof pedidosAbertos)[number] | null>(null);
  const [respondendoSolic, setRespondendoSolic] = useState<(typeof solicAbertas)[number] | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const nadaPendente = pedidosAbertos.length === 0 && solicAbertas.length === 0;

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <Package className="size-5 text-primary" /> Canais da TRÍADE
            {(pedidosAbertos.length + solicAbertas.length) > 0 && (
              <Badge variant="warning">{pedidosAbertos.length + solicAbertas.length} aguardando resposta</Badge>
            )}
          </h2>

          {nadaPendente && <p className="text-sm text-muted-foreground">Nenhum pedido ou solicitação aguardando resposta. ✔</p>}

          {/* Pedidos de insumos aguardando nossa resposta */}
          {pedidosAbertos.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-secondary">Pedidos de insumos (responder com data)</p>
              <div className="divide-y">
                {pedidosAbertos.map((p) => {
                  const urgente = p.data_necessidade && p.data_necessidade <= somarDiasISO(hoje, 15)!;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-secondary">
                          {p.item} <span className="text-xs font-normal text-muted-foreground">· {p.quantidade_prevista} {p.unidade}</span>
                        </p>
                        <p className={cn("text-xs", urgente ? "font-semibold text-warning" : "text-muted-foreground")}>
                          necessário em {p.data_necessidade ? formatarDataBR(p.data_necessidade) : "—"}
                          {p.observacao ? ` · ${p.observacao}` : ""}
                        </p>
                      </div>
                      {podeEditar && (
                        <Button size="sm" onClick={() => setRespondendoPedido(p)}>Responder</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Solicitações gerais */}
          {solicAbertas.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-secondary"><MessageSquareText className="size-4 text-primary" /> Solicitações gerais</p>
              <div className="divide-y">
                {solicAbertas.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-secondary">{s.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.descricao ?? ""}{s.data_desejada ? ` · desejado p/ ${formatarDataBR(s.data_desejada)}` : ""}
                      </p>
                    </div>
                    {podeEditar && <Button size="sm" variant="outline" onClick={() => setRespondendoSolic(s)}>Responder</Button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos recentes do canteiro */}
          {fotosRecentes.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary"><Camera className="size-4 text-primary" /> Fotos recentes do canteiro</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {fotosRecentes.map((f) => (
                  <button key={f.id} onClick={() => setFotoAmpliada(f.foto_url)} className="overflow-hidden rounded-lg border transition-transform hover:scale-[1.03]" title={f.descricao ?? undefined}>
                    <FotoSegura bucket={BUCKET_OBRA} stored={f.foto_url} alt={f.descricao ?? "Foto"} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: responder pedido de insumo */}
      {respondendoPedido && (
        <ModalRespostaPedido
          pedido={respondendoPedido}
          salvando={responderPedido.isPending}
          onSalvar={async (status, dataPrometida, resposta) => {
            await responderPedido.mutateAsync({ id: respondendoPedido.id, statusAtendimento: status, dataPrometida, resposta });
            toast.success("Resposta enviada — a TRÍADE já vê no portal.");
            setRespondendoPedido(null);
          }}
          onFechar={() => setRespondendoPedido(null)}
        />
      )}

      {/* Modal: responder solicitação */}
      {respondendoSolic && (
        <ModalRespostaSolic
          solicitacao={respondendoSolic}
          salvando={responderSolic.isPending}
          onSalvar={async (status, resposta) => {
            await responderSolic.mutateAsync({ id: respondendoSolic.id, status, resposta });
            toast.success("Resposta registrada.");
            setRespondendoSolic(null);
          }}
          onFechar={() => setRespondendoSolic(null)}
        />
      )}

      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button aria-hidden tabIndex={-1} onClick={() => setFotoAmpliada(null)} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/70 backdrop-blur-sm" />
          <div className="relative max-h-[90vh] max-w-3xl animate-modal-in overflow-hidden rounded-lg shadow-lifted">
            <FotoSegura bucket={BUCKET_OBRA} stored={fotoAmpliada} alt="Foto do canteiro" className="max-h-[85vh] w-auto object-contain" />
            <button onClick={() => setFotoAmpliada(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-secondary/70 text-white hover:bg-secondary"><X className="size-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}

function ModalRespostaPedido({ pedido, salvando, onSalvar, onFechar }: {
  pedido: { item: string; quantidade_prevista: number; unidade: string; data_necessidade: string | null };
  salvando: boolean;
  onSalvar: (status: "programado" | "comprado" | "negado", dataPrometida: string | null, resposta: string | null) => Promise<void>;
  onFechar: () => void;
}) {
  const [status, setStatus] = useState<"programado" | "comprado" | "negado">("programado");
  const [data, setData] = useState("");
  const [resposta, setResposta] = useState("");
  const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  async function salvar() {
    if (status !== "negado" && !data) { toast.error("Informe a data prometida."); return; }
    try { await onSalvar(status, data || null, resposta || null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao responder."); }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Responder pedido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {pedido.item} · {pedido.quantidade_prevista} {pedido.unidade}
          {pedido.data_necessidade ? ` · necessário em ${formatarDataBR(pedido.data_necessidade)}` : ""}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Situação</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputBase}>
              <option value="programado">Programado (compra planejada)</option>
              <option value="comprado">Comprado (aguardando entrega)</option>
              <option value="negado">Negado</option>
            </select></label>
          {status !== "negado" && (
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Data prometida em obra *</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} /></label>
          )}
          <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Resposta / observação</span>
            <input value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder={status === "negado" ? "Motivo da negativa" : "Fornecedor, condição…"} className={inputBase} /></label>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={salvando}>Enviar resposta</Button>
        </div>
      </div>
    </div>
  );
}

function ModalRespostaSolic({ solicitacao, salvando, onSalvar, onFechar }: {
  solicitacao: { titulo: string; descricao: string | null };
  salvando: boolean;
  onSalvar: (status: "em_atendimento" | "concluida" | "negada", resposta: string | null) => Promise<void>;
  onFechar: () => void;
}) {
  const [status, setStatus] = useState<"em_atendimento" | "concluida" | "negada">("concluida");
  const [resposta, setResposta] = useState("");
  const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  async function salvar() {
    try { await onSalvar(status, resposta || null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao responder."); }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Responder solicitação</h2>
        <p className="mt-1 text-sm text-muted-foreground">{solicitacao.titulo}</p>
        {solicitacao.descricao && <p className="text-xs text-muted-foreground">{solicitacao.descricao}</p>}
        <div className="mt-4 space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Situação</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputBase}>
              <option value="em_atendimento">Em atendimento</option>
              <option value="concluida">Concluída</option>
              <option value="negada">Negada</option>
            </select></label>
          <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Resposta</span>
            <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} className={cn(inputBase, "h-auto py-2")} /></label>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={salvando}>Enviar resposta</Button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "warning" | "success" | "destructive" }) {
  const cor = tom === "warning" ? "text-warning" : tom === "success" ? "text-success" : tom === "destructive" ? "text-destructive" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      {/* min-w-0 + truncate: valor nunca escapa do card (title mostra o completo) */}
      <div className="min-w-0">
        <p title={valor} className={cn("truncate text-lg font-extrabold tabular-nums xl:text-xl", cor)}>{valor}</p>
        <p className="truncate text-xs text-muted-foreground" title={rotulo}>{rotulo}</p>
      </div>
    </div>
  );
}

function LinhaAcao({ titulo, detalhe, valor, vencida = false, acao, onAbrir }: {
  titulo: string; detalhe: string; valor: number; vencida?: boolean; acao?: React.ReactNode; onAbrir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold text-secondary hover:underline">{titulo}</p>
        <p className={cn("text-xs", vencida ? "font-semibold text-destructive" : "text-muted-foreground")}>{detalhe}</p>
      </button>
      <span className="shrink-0 font-bold tabular-nums text-secondary">{formatarMoeda(valor)}</span>
      {acao}
    </div>
  );
}

function GrupoSemana({ titulo, icone, vazio, children }: { titulo: string; icone: React.ReactNode; vazio: string; children: React.ReactNode }) {
  const temFilhos = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-secondary">{icone} {titulo}</p>
      {temFilhos ? <div className="space-y-1.5">{children}</div> : <p className="text-xs text-muted-foreground">{vazio}</p>}
    </div>
  );
}

function LinhaSemana({ d, extra, onAbrir }: { d: ObraDisciplina; extra?: string; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir} className="block w-full text-left">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-secondary hover:underline">{d.nome}</span>
        {extra && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{extra}</span>}
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
      </div>
    </button>
  );
}
