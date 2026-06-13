/**
 * Mensalidades — Administração (BLOCO Adm1)
 *
 * Lista de hóspedes com tipo de suíte, grau, ocupação, mensalidade vigente
 * (sugerida pela tabela de preços ou ajustada individualmente) e controle
 * manual de pagamento por mês de referência. Sem integração de
 * pagamento/boleto.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Wallet,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useAjustarMensalidade,
  useMarcarPagamento,
  useMarcarPagamentosLote,
  usePagamentosDoMes,
  useSalvarResponsavelFinanceiro,
  useTabelaPreco,
} from "@/hooks/useMensalidades";
import {
  ResponsavelFinanceiroFields,
  type RespFinValor,
} from "@/components/financeiro/ResponsavelFinanceiroFields";
import {
  OCUPACOES,
  TIPOS_SUITE,
  chavePreco,
  deslocarMes,
  formatarMesReferencia,
  formatarMoeda,
  mesAtual,
} from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { HistoricoAlteracoes } from "@/components/HistoricoAlteracoes";
import { cn, formatarDataHoraBR } from "@/lib/utils";
import type { Ocupacao, PagamentoMensalidade, Residente, TipoSuite } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function Mensalidades() {
  const [mes, setMes] = useState(mesAtual());
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const residentes = useResidentes();
  const tabelaPreco = useTabelaPreco();
  const pagamentos = usePagamentosDoMes(mes);
  const marcarLote = useMarcarPagamentosLote();

  if (residentes.isLoading || tabelaPreco.isLoading || pagamentos.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (tabelaPreco.isError) return <ErrorState error={tabelaPreco.error} />;
  if (pagamentos.isError) return <ErrorState error={pagamentos.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const precoMap = new Map((tabelaPreco.data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau), p.valor]));
  const pagamentoMap = new Map((pagamentos.data ?? []).map((p) => [p.residente_id, p]));
  const mesEhPassado = mes < mesAtual();

  function valorDe(r: Residente): number {
    return r.mensalidade_valor ?? precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia)) ?? 0;
  }

  let totalPendente = 0;
  let countInadimplentes = 0;
  for (const r of residentes.data) {
    const pago = pagamentoMap.get(r.id)?.status === "paga";
    if (!pago) {
      totalPendente += valorDe(r);
      if (mesEhPassado) countInadimplentes++;
    }
  }

  // Pendentes do mês — base para a seleção em lote.
  const pendentes = residentes.data.filter((r) => pagamentoMap.get(r.id)?.status !== "paga");

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function toggleTodos() {
    if (selecionados.size === pendentes.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(pendentes.map((r) => r.id)));
    }
  }

  async function marcarSelecionados() {
    const itens = pendentes
      .filter((r) => selecionados.has(r.id))
      .map((r) => ({ residenteId: r.id, valor: valorDe(r) }));
    if (itens.length === 0) return;
    if (!window.confirm(`Marcar ${itens.length} mensalidade(s) como paga(s)?`)) return;
    try {
      await marcarLote.mutateAsync({ mes, itens });
      toast.success(`${itens.length} mensalidade(s) marcada(s) como paga(s).`);
      setSelecionados(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar pagamentos.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button variant="outline" size="icon" onClick={() => { setMes((m) => deslocarMes(m, -1)); setSelecionados(new Set()); }}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-bold text-secondary">{formatarMesReferencia(mes)}</span>
          <Button variant="outline" size="icon" onClick={() => { setMes((m) => deslocarMes(m, 1)); setSelecionados(new Set()); }}>
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-secondary">{countInadimplentes}</p>
              <p className="text-sm text-muted-foreground">Inadimplente(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-foreground">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-secondary">{formatarMoeda(totalPendente)}</p>
              <p className="text-sm text-muted-foreground">Total pendente no mês</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de ações em lote (apenas se houver pendentes) */}
      {pendentes.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-secondary">
              <input
                type="checkbox"
                checked={selecionados.size === pendentes.length && pendentes.length > 0}
                onChange={toggleTodos}
                className="size-4 rounded border-input"
              />
              Selecionar todos os pendentes ({pendentes.length})
            </label>
            <Button
              size="sm"
              disabled={selecionados.size === 0 || marcarLote.isPending}
              onClick={marcarSelecionados}
            >
              <CheckCheck className="size-4" />
              {marcarLote.isPending
                ? "Salvando…"
                : `Marcar ${selecionados.size > 0 ? selecionados.size : ""} como paga(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {residentes.data.map((r) => {
          const pago = pagamentoMap.get(r.id)?.status === "paga";
          return (
            <ResidenteMensalidade
              key={r.id}
              residente={r}
              mes={mes}
              mesEhPassado={mesEhPassado}
              valorSugerido={precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia)) ?? null}
              pagamento={pagamentoMap.get(r.id)}
              selecionavel={!pago}
              selecionado={selecionados.has(r.id)}
              onToggleSelecionado={() => toggleSelecionado(r.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ResidenteMensalidade({
  residente: r,
  mes,
  mesEhPassado,
  valorSugerido,
  pagamento,
  selecionavel,
  selecionado,
  onToggleSelecionado,
}: {
  residente: Residente;
  mes: string;
  mesEhPassado: boolean;
  valorSugerido: number | null;
  pagamento: PagamentoMensalidade | undefined;
  selecionavel: boolean;
  selecionado: boolean;
  onToggleSelecionado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const marcar = useMarcarPagamento();
  const [erro, setErro] = useState<string | null>(null);

  const valorVigente = r.mensalidade_valor ?? valorSugerido;
  const pago = pagamento?.status === "paga";
  const vencido = !pago && mesEhPassado;

  async function handleTogglePagamento() {
    setErro(null);
    try {
      await marcar.mutateAsync({
        residenteId: r.id,
        mes,
        valor: valorVigente ?? 0,
        pago: !pago,
      });
      toast.success(!pago ? "Mensalidade marcada como paga." : "Mensalidade marcada como pendente.");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card className={cn(selecionado && "border-primary/50 ring-1 ring-primary/30")}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          {selecionavel && (
            <input
              type="checkbox"
              checked={selecionado}
              onChange={onToggleSelecionado}
              className="mt-1 size-4 shrink-0 rounded border-input"
              aria-label={`Selecionar ${r.nome}`}
            />
          )}
          <div>
          <CardTitle>{r.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">Quarto {r.quarto ?? "—"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{r.tipo_suite ?? "Não informado"}</Badge>
            <Badge variant="muted">Grau {r.grau_dependencia ?? "—"}</Badge>
            <Badge variant="outline">
              {r.ocupacao === "dupla" ? "Dupla" : r.ocupacao === "individual" ? "Individual" : "Não informado"}
            </Badge>
          </div>
          </div>
        </div>
        <Button variant={editando ? "outline" : "ghost"} size="sm" onClick={() => setEditando((v) => !v)}>
          <Pencil className="size-4" /> {editando ? "Cancelar" : "Editar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {editando ? (
          <div className="space-y-4">
            <FormAjuste
              residente={r}
              valorSugerido={valorSugerido}
              onSalvo={() => setEditando(false)}
              onCancelar={() => setEditando(false)}
            />
            <ResponsavelFinanceiroEditor residente={r} />
            {/* Trilha de auditoria — somente leitura */}
            <HistoricoAlteracoes tabelaOrigem="residentes" registroId={r.id} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(valorVigente)}</p>
                {r.mensalidade_valor === null && valorSugerido !== null && (
                  <p className="text-xs text-muted-foreground">Sugerido pela tabela de preços</p>
                )}
                {r.mensalidade_ajuste_obs && (
                  <p className="mt-1 text-xs text-secondary/80">{r.mensalidade_ajuste_obs}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {vencido ? (
                  <Badge variant="destructive">Vencido</Badge>
                ) : pago ? (
                  <Badge variant="success">Pago</Badge>
                ) : (
                  <Badge variant="warning">Pendente</Badge>
                )}
                {pago && pagamento?.pago_em && (
                  <span className="text-xs text-muted-foreground">
                    Pago em {formatarDataHoraBR(pagamento.pago_em)}
                  </span>
                )}
              </div>
            </div>

            {erro && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" /> {erro}
              </div>
            )}

            <Button
              variant={pago ? "outline" : "default"}
              onClick={handleTogglePagamento}
              disabled={marcar.isPending}
            >
              <CheckCircle2 className="size-4" />
              {marcar.isPending ? "Salvando…" : pago ? "Marcar como pendente" : "Marcar como pago"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResponsavelFinanceiroEditor({ residente: r }: { residente: Residente }) {
  const salvar = useSalvarResponsavelFinanceiro(r.id);
  const [v, setV] = useState<RespFinValor>({
    nome: r.resp_fin_nome ?? "",
    cpf: r.resp_fin_cpf ?? "",
    email: r.resp_fin_email ?? "",
    telefone: r.resp_fin_telefone ?? "",
    relacao: r.resp_fin_relacao ?? "",
  });

  function set(campo: keyof RespFinValor, valor: string) {
    setV((atual) => ({ ...atual, [campo]: valor }));
  }
  const t = (s: string) => (s.trim() === "" ? null : s.trim());

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({
        nome: t(v.nome),
        cpf: t(v.cpf),
        email: t(v.email),
        telefone: t(v.telefone),
        relacao: t(v.relacao),
      });
      toast.success("Responsável financeiro salvo.");
    } catch (e) {
      toast.error(extrairErro(e));
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-semibold text-secondary">Responsável financeiro (quem paga)</p>
      <ResponsavelFinanceiroFields valor={v} onChange={set} />
      <Button onClick={handleSalvar} disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : "Salvar responsável financeiro"}
      </Button>
    </div>
  );
}

function FormAjuste({
  residente: r,
  valorSugerido,
  onSalvo,
  onCancelar,
}: {
  residente: Residente;
  valorSugerido: number | null;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [tipoSuite, setTipoSuite] = useState<TipoSuite | "">(r.tipo_suite ?? "");
  const [ocupacao, setOcupacao] = useState<Ocupacao | "">(r.ocupacao ?? "");
  const [valor, setValor] = useState(String(r.mensalidade_valor ?? valorSugerido ?? ""));
  const [ajusteObs, setAjusteObs] = useState(r.mensalidade_ajuste_obs ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const ajustar = useAjustarMensalidade(r.id);

  async function handleSalvar() {
    setErro(null);
    try {
      const valorNum = valor.trim() === "" ? null : Number(valor.replace(",", "."));
      await ajustar.mutateAsync({
        tipoSuite: tipoSuite || null,
        ocupacao: ocupacao || null,
        valor: valorNum,
        ajusteObs: ajusteObs.trim() || null,
      });
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-secondary">Tipo de suíte</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS_SUITE.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoSuite(t)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  tipoSuite === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-secondary">Ocupação</p>
          <div className="flex flex-wrap gap-2">
            {OCUPACOES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOcupacao(o.value)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  ocupacao === o.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Mensalidade (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={valorSugerido !== null ? String(valorSugerido) : ""}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {valorSugerido !== null && (
            <p className="text-xs text-muted-foreground">
              Sugestão pela tabela de preços: {formatarMoeda(valorSugerido)}
            </p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <label className="text-sm font-semibold text-secondary">
            Motivo do ajuste <span className="text-destructive">*</span>{" "}
            <span className="font-normal text-muted-foreground">(obrigatório se o valor mudar)</span>
          </label>
          <textarea
            value={ajusteObs}
            onChange={(e) => setAjusteObs(e.target.value)}
            placeholder="Ex: promoção, desconto fidelidade…"
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={ajustar.isPending}>
          {ajustar.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={ajustar.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
