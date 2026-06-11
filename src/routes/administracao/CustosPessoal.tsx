/**
 * Custos de pessoal / Pagamento — Administração (BLOCO Adm4)
 *
 * Para cada profissional com remuneração definida, calcula o pagamento do
 * mês (mensal fixo ou por plantão, com PREVISTO x REALIZADO vindos da
 * escala). O valor final é editável (ajuste manual) e o status pago/pendente
 * é controlado por profissional/mês. NÃO calcula folha CLT
 * (impostos/encargos) — é referência de custo e produção.
 */
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Wallet,
} from "lucide-react";
import {
  useCustosPessoalDoMes,
  useSalvarPagamentoPessoal,
  type LinhaPagamentoPessoal,
} from "@/hooks/usePagamentoPessoal";
import { exportarPagamentoPessoalExcel } from "@/lib/exportPagamentoPessoal";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function CustosPessoal() {
  const [mes, setMes] = useState(mesAtual());
  const custos = useCustosPessoalDoMes(mes);

  if (custos.isLoading) return <LoadingState />;
  if (custos.isError) return <ErrorState error={custos.error} />;

  const { linhas } = custos;

  const totalMensalFixo = linhas
    .filter((l) => l.tipoRemuneracao === "mensal_fixo")
    .reduce((acc, l) => acc + l.valorFinal, 0);
  const totalPorPlantao = linhas
    .filter((l) => l.tipoRemuneracao === "por_plantao")
    .reduce((acc, l) => acc + l.valorFinal, 0);
  const totalGeral = totalMensalFixo + totalPorPlantao;
  const totalPago = linhas.filter((l) => l.status === "pago").reduce((acc, l) => acc + l.valorFinal, 0);
  const totalPendente = totalGeral - totalPago;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Custos de pessoal</h1>
          <p className="text-sm text-muted-foreground">
            Pagamento da equipe por mês — referência de custo e produção (não inclui folha CLT).
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportarPagamentoPessoalExcel(mes, linhas)}
          disabled={linhas.length === 0}
        >
          <Download className="size-4" /> Exportar Excel
        </Button>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(totalMensalFixo)}</p>
            <p className="text-sm text-muted-foreground">Mensal fixo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(totalPorPlantao)}</p>
            <p className="text-sm text-muted-foreground">Por plantão</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(totalGeral)}</p>
            <p className="text-sm text-muted-foreground">Custo total de pessoal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-bold tabular-nums text-secondary">
              {formatarMoeda(totalPago)} / {formatarMoeda(totalPendente)}
            </p>
            <p className="text-sm text-muted-foreground">Pago / Pendente</p>
          </CardContent>
        </Card>
      </div>

      {linhas.length === 0 ? (
        <EmptyState label='Nenhum profissional com remuneração cadastrada. Defina os valores em "Remuneração da equipe".' />
      ) : (
        <div className="space-y-4">
          {linhas.map((l) => (
            <ProfissionalCusto key={l.profissional.id} linha={l} mes={mes} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfissionalCusto({ linha, mes }: { linha: LinhaPagamentoPessoal; mes: string }) {
  const [valorFinal, setValorFinal] = useState(String(linha.valorFinal));
  const [observacao, setObservacao] = useState(linha.observacao);
  const [status, setStatus] = useState(linha.status);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarPagamentoPessoal();

  const totalPrevisto = linha.previstoDiurno + linha.previstoNoturno;
  const totalRealizado = linha.realizadoDiurno + linha.realizadoNoturno;

  async function persistir(novoStatus: typeof status) {
    setErro(null);
    try {
      const valorNum = valorFinal.trim() === "" ? linha.valorCalculado : Number(valorFinal.replace(",", "."));
      await salvar.mutateAsync({
        profissionalId: linha.profissional.id,
        mes,
        tipoRemuneracao: linha.tipoRemuneracao,
        plantoesPrevistos: linha.tipoRemuneracao === "por_plantao" ? totalPrevisto : null,
        plantoesRealizados: linha.tipoRemuneracao === "por_plantao" ? totalRealizado : null,
        valorCalculado: linha.valorCalculado,
        valorFinal: valorNum,
        status: novoStatus,
        observacao: observacao.trim() || null,
      });
      setStatus(novoStatus);
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{linha.profissional.nome}</CardTitle>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{linha.profissional.funcao ?? "Equipe Multidisciplinar"}</Badge>
            <Badge variant={linha.tipoRemuneracao === "mensal_fixo" ? "default" : "purple"}>
              {linha.tipoRemuneracao === "mensal_fixo" ? "Mensal fixo" : "Por plantão"}
            </Badge>
          </div>
        </div>
        {status === "pago" ? <Badge variant="success">Pago</Badge> : <Badge variant="warning">Pendente</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {linha.tipoRemuneracao === "por_plantao" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-muted/30 p-3 text-sm">
              <p className="font-semibold text-secondary">Diurno</p>
              <p className="text-muted-foreground">
                Previsto {linha.previstoDiurno} / Realizado {linha.realizadoDiurno}
              </p>
            </div>
            <div className="rounded-md bg-muted/30 p-3 text-sm">
              <p className="font-semibold text-secondary">Noturno</p>
              <p className="text-muted-foreground">
                Previsto {linha.previstoNoturno} / Realizado {linha.realizadoNoturno}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              O pagamento usa os plantões REALIZADOS (com check-in e check-out registrados).
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Valor calculado</p>
            <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(linha.valorCalculado)}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Valor final (editável)</label>
            <input
              type="number"
              step="0.01"
              value={valorFinal}
              onChange={(e) => setValorFinal(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: ajuste por falta, adiantamento…"
            rows={2}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => persistir(status)} disabled={salvar.isPending}>
            <Wallet className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant={status === "pago" ? "outline" : "success"}
            onClick={() => persistir(status === "pago" ? "pendente" : "pago")}
            disabled={salvar.isPending}
          >
            <CheckCircle2 className="size-4" />
            {status === "pago" ? "Marcar como pendente" : "Marcar como pago"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
