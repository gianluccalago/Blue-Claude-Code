/**
 * Mensalidades — Administração / Direção
 *
 * Define o VALOR da mensalidade de cada hóspede (sugerido pela tabela de preços
 * ou ajustado individualmente) e o responsável financeiro. O STATUS de
 * pagamento (enviado/pago/vencido/inadimplência) fica concentrado em
 * "Cobrança" — fonte única — para não existirem duas verdades sobre o mesmo
 * pagamento.
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Pencil } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useAjustarMensalidade,
  useSalvarResponsavelFinanceiro,
  useTabelaPreco,
} from "@/hooks/useMensalidades";
import {
  ResponsavelFinanceiroFields,
  type RespFinValor,
} from "@/components/financeiro/ResponsavelFinanceiroFields";
import {
  OCUPACOES,
  OCUPACAO_LABEL,
  ocupacoesValidas,
  TIPOS_SUITE,
  precoVigenteEm,
  hojeISO,
  formatarMoeda,
} from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { HistoricoAlteracoes } from "@/components/HistoricoAlteracoes";
import { cn } from "@/lib/utils";
import type { Ocupacao, Residente, TipoSuite } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function Mensalidades() {
  const residentes = useResidentes();
  const tabelaPreco = useTabelaPreco();

  if (residentes.isLoading || tabelaPreco.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (tabelaPreco.isError) return <ErrorState error={tabelaPreco.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const precos = tabelaPreco.data ?? [];

  // Sugestão = preço VIGENTE na data de ENTRADA do hóspede, p/ tipo × grau ×
  // ocupação dele (ajuste individual continua editável). Um reajuste de preço
  // não muda a sugestão de quem já entrou — só vale para novos contratos.
  function precoSugerido(r: Residente): number | null {
    return precoVigenteEm(precos, r.tipo_suite, r.grau_dependencia, r.ocupacao, r.data_admissao ?? hojeISO());
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {residentes.data.map((r) => (
          <ResidenteMensalidade key={r.id} residente={r} valorSugerido={precoSugerido(r)} />
        ))}
      </div>
    </div>
  );
}

function ResidenteMensalidade({
  residente: r,
  valorSugerido,
}: {
  residente: Residente;
  valorSugerido: number | null;
}) {
  const [editando, setEditando] = useState(false);
  const valorVigente = r.mensalidade_valor ?? valorSugerido;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{r.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">Quarto {r.quarto ?? "—"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{r.tipo_suite ?? "Não informado"}</Badge>
            <Badge variant="muted">Grau {r.grau_dependencia ?? "—"}</Badge>
            <Badge variant="outline">{r.ocupacao ? OCUPACAO_LABEL[r.ocupacao] : "Não informado"}</Badge>
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
          <div>
            <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(valorVigente)}</p>
            {r.mensalidade_valor === null && valorSugerido !== null && (
              <p className="text-xs text-muted-foreground">Sugerido pela tabela de preços</p>
            )}
            {r.mensalidade_ajuste_obs && (
              <p className="mt-1 text-xs text-secondary/80">{r.mensalidade_ajuste_obs}</p>
            )}
          </div>
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

  // Só as ocupações válidas para o tipo (Long Stay permite triplo; demais até duplo).
  const ocupacoesDoTipo = ocupacoesValidas(tipoSuite || null);
  function escolherTipo(t: TipoSuite) {
    setTipoSuite(t);
    // Se a ocupação atual não vale para o novo tipo (ex.: triplo fora do Long Stay), zera.
    if (ocupacao && !ocupacoesValidas(t).includes(ocupacao)) setOcupacao("");
  }
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
                onClick={() => escolherTipo(t)}
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
            {OCUPACOES.filter((o) => ocupacoesDoTipo.includes(o.value)).map((o) => (
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
