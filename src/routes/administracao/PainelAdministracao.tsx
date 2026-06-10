/**
 * Painel da Administração — Visão geral (BLOCO Adm3)
 *
 * Indicadores do mês atual calculados a partir dos dados reais: ocupação,
 * receita prevista (mensalidades + upselling), inadimplência e
 * recebido vs. pendente.
 */
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { formatarMoeda, formatarMesReferencia, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/states";

export function PainelAdministracao() {
  const mes = mesAtual();
  const demo = useDemonstrativoMes(mes);

  if (demo.isLoading) return <LoadingState />;
  if (demo.isError) return <ErrorState error={demo.error} />;

  const totalHospedes = demo.linhas.length;
  const totalMensalidades = demo.linhas.reduce((acc, l) => acc + l.mensalidade, 0);
  const totalUpselling = demo.linhas.reduce((acc, l) => acc + l.upselling, 0);
  const receitaTotalPrevista = totalMensalidades + totalUpselling;

  const inadimplentes = demo.linhas.filter((l) => !l.pago);
  const valorInadimplente = inadimplentes.reduce((acc, l) => acc + l.mensalidade, 0);
  const valorRecebido = totalMensalidades - valorInadimplente;
  const percentRecebido = totalMensalidades > 0 ? Math.round((valorRecebido / totalMensalidades) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Painel da Administração</h1>
        <p className="text-sm text-muted-foreground">Indicadores de {formatarMesReferencia(mes)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <BedDouble className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">{totalHospedes}</p>
              <p className="text-sm text-muted-foreground">Hóspede(s) ocupando suítes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(totalMensalidades)}</p>
              <p className="text-sm text-muted-foreground">Receita prevista (mensalidades)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
              <Receipt className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(totalUpselling)}</p>
              <p className="text-sm text-muted-foreground">Upselling do mês</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(receitaTotalPrevista)}</p>
              <p className="text-sm text-muted-foreground">Receita total prevista</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">
                {inadimplentes.length} · {formatarMoeda(valorInadimplente)}
              </p>
              <p className="text-sm text-muted-foreground">Inadimplência (mensalidades pendentes)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning-foreground">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-secondary">{formatarMoeda(valorRecebido)}</p>
              <p className="text-sm text-muted-foreground">Recebido no mês ({percentRecebido}%)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-secondary">
          <p>
            {totalHospedes} hóspede(s) cadastrado(s), totalizando {formatarMoeda(totalMensalidades)} em
            mensalidades e {formatarMoeda(totalUpselling)} em upselling no mês —{" "}
            <span className="font-semibold">{formatarMoeda(receitaTotalPrevista)}</span> de receita total prevista.
          </p>
          <p>
            {valorRecebido > 0 || totalMensalidades === 0 ? (
              <>
                Já recebido: <span className="font-semibold">{formatarMoeda(valorRecebido)}</span> ({percentRecebido}
                %).{" "}
              </>
            ) : null}
            {inadimplentes.length > 0 ? (
              <>
                Pendente: <span className="font-semibold">{formatarMoeda(valorInadimplente)}</span> em{" "}
                {inadimplentes.length} hóspede(s).
              </>
            ) : (
              "Nenhuma mensalidade pendente neste mês."
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
