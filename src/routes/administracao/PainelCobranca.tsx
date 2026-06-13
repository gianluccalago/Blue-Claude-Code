/**
 * Painel de Cobrança — Administração
 *
 * TERRENO para a futura integração de cobrança (ex.: Asaas), funcionando HOJE
 * como controle MANUAL e visual. Mostra, por mês, a "fatura por responsável
 * financeiro" (mensalidade + upselling), com status estruturado, vencimento e
 * totais (em aberto / enviado / pago / vencido), destacando a inadimplência.
 *
 * SEM integração real: este ambiente é só front + Supabase, sem backend para
 * webhook. Criar cobrança no provedor e receber a confirmação exigirá uma
 * camada de backend (ex.: Supabase Edge Function) — a ser feita no futuro.
 * Por isso o status é movido na mão e os ids externos ficam reservados.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Receipt,
  Mail,
  Phone,
  CreditCard,
  Info,
} from "lucide-react";
import { useFechamentoCobranca, type ItemCobranca, type GrupoCobranca } from "@/hooks/useFechamentoCobranca";
import { useAtualizarCobranca } from "@/hooks/useMensalidades";
import {
  STATUS_COBRANCA,
  STATUS_COBRANCA_LABEL,
  STATUS_COBRANCA_VARIANTE,
  FORMAS_PAGAMENTO,
} from "@/lib/cobranca";
import { exportarFechamentoCobrancaExcel } from "@/lib/exportCobranca";
import {
  deslocarMes,
  formatarMesReferencia,
  formatarMoeda,
  mesAtual,
} from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { FormaPagamento, StatusPagamentoMensalidade } from "@/types/database";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PainelCobranca() {
  const [mes, setMes] = useState(mesAtual());
  const fechamento = useFechamentoCobranca(mes);
  const [exportando, setExportando] = useState(false);

  if (fechamento.isLoading) return <LoadingState />;
  if (fechamento.isError) return <ErrorState error={fechamento.error} />;

  const { grupos, totais } = fechamento;
  const vencido = totais.porStatus.vencida;

  async function exportar() {
    setExportando(true);
    const ok = await exportarFechamentoCobrancaExcel(mes, grupos);
    setExportando(false);
    if (ok) toast.success("Fechamento de cobrança exportado (.xlsx).");
    else toast.error("Não foi possível exportar.");
  }

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Receipt className="size-3.5" /> Cobrança · controle manual
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Painel de Cobrança</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-white/70">
              Fatura por responsável financeiro (mensalidade + extras), com status e vencimento.
            </p>
          </div>
          <Button variant="secondary" onClick={exportar} disabled={exportando || grupos.length === 0}>
            <FileDown className="size-4" /> {exportando ? "Exportando…" : "Exportar (Excel)"}
          </Button>
        </div>
      </div>

      {/* Aviso honesto sobre a ausência de integração */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-secondary">
            Controle <span className="font-semibold">manual</span>: mova o status na mão (ex.: "Enviada" ao mandar o
            boleto por fora, "Paga" ao confirmar). A cobrança automática (criar cobrança e receber a confirmação)
            será integrada no futuro por uma camada de backend — ainda não disponível.
          </p>
        </CardContent>
      </Card>

      {/* Navegação de mês */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button variant="outline" size="icon" onClick={() => setMes((m) => deslocarMes(m, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-bold text-secondary">{formatarMesReferencia(mes)}</span>
          <Button variant="outline" size="icon" onClick={() => setMes((m) => deslocarMes(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* KPIs por status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Receipt} tom="warning" rotulo="Em aberto" valor={formatarMoeda(totais.porStatus.em_aberto.soma)} apoio={`${totais.porStatus.em_aberto.qtd} hóspede(s)`} />
        <StatCard icon={Mail} tom="secondary" rotulo="Enviado" valor={formatarMoeda(totais.porStatus.enviada.soma)} apoio={`${totais.porStatus.enviada.qtd} hóspede(s)`} />
        <StatCard icon={CreditCard} tom="success" rotulo="Pago" valor={formatarMoeda(totais.porStatus.paga.soma)} apoio={`${totais.porStatus.paga.qtd} hóspede(s)`} />
        <StatCard
          icon={AlertTriangle}
          tom="destructive"
          destaque={vencido.qtd > 0}
          rotulo="Vencido (inadimplência)"
          valor={formatarMoeda(vencido.soma)}
          apoio={`${vencido.qtd} hóspede(s)`}
        />
      </div>

      {grupos.length === 0 ? (
        <EmptyState label="Nenhum responsável financeiro / cobrança no mês." />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <GrupoResponsavel key={g.key} grupo={g} mes={mes} />
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoResponsavel({ grupo: g, mes }: { grupo: GrupoCobranca; mes: string }) {
  return (
    <Card className={cn(g.temVencida && "border-destructive/40")}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {g.respNome}
            {g.respRelacao && <Badge variant="muted">{g.respRelacao}</Badge>}
            {g.temVencida && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" /> inadimplente
              </Badge>
            )}
          </CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> {ouNaoInformado(g.respEmail)}</span>
            <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> {ouNaoInformado(g.respTelefone)}</span>
            {g.respCpf && <span>CPF {g.respCpf}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor a cobrar</p>
          <p className="text-xl font-extrabold tabular-nums text-secondary">{formatarMoeda(g.valorACobrar)}</p>
          <p className="text-xs text-muted-foreground">
            venc. {g.vencimento ? formatarDataBR(g.vencimento) : "—"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {g.hospedes.map((h) => (
          <LinhaHospede key={h.residente.id} item={h} mes={mes} />
        ))}
      </CardContent>
    </Card>
  );
}

function LinhaHospede({ item: h, mes }: { item: ItemCobranca; mes: string }) {
  const atualizar = useAtualizarCobranca();
  const [status, setStatus] = useState<StatusPagamentoMensalidade>(
    h.pagamento?.status ?? "em_aberto",
  );
  const [forma, setForma] = useState<FormaPagamento | "">(h.pagamento?.forma_pagamento ?? "");

  async function salvar() {
    try {
      await atualizar.mutateAsync({
        residenteId: h.residente.id,
        mes,
        valor: h.mensalidade, // pagamento.valor = mensalidade (upselling é à parte)
        status,
        dataVencimento: h.vencimento,
        formaPagamento: forma || null,
      });
      toast.success(`Cobrança de ${h.residente.nome}: ${STATUS_COBRANCA_LABEL[status]}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-secondary">{h.residente.nome}</p>
        <p className="text-xs text-muted-foreground">
          Mensalidade {formatarMoeda(h.mensalidade)}
          {h.upselling > 0 && <> · extras {formatarMoeda(h.upselling)}</>}
          {" · "}
          <span className="font-semibold text-secondary/80">a cobrar {formatarMoeda(h.valorACobrar)}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_COBRANCA_VARIANTE[h.statusEfetivo]}>{STATUS_COBRANCA_LABEL[h.statusEfetivo]}</Badge>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusPagamentoMensalidade)} className={inputBase}>
          {STATUS_COBRANCA.filter((s) => s.value !== "vencida").map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")} className={inputBase}>
          <option value="">Forma…</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={salvar} disabled={atualizar.isPending}>
          Salvar
        </Button>
      </div>
    </div>
  );
}
