import { useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, Receipt, CheckCircle2 } from "lucide-react";
import { useDemonstrativoFamilia } from "@/hooks/useFamilia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import { formatarDataBR } from "@/lib/utils";

/**
 * Demonstrativo do mês do hóspede (mensalidade + extras = total), em modo
 * leitura — espelha o demonstrativo gerado pela Administração. Transparência
 * de cobrança para a família.
 */
export function Mensalidade() {
  const [mes, setMes] = useState(mesAtual());
  const { isLoading, isError, error, demonstrativo } = useDemonstrativoFamilia(mes);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!demonstrativo) return <EmptyState label="Hóspede não encontrado." />;

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(demonstrativo.mensalidade)}</p>
              <p className="text-sm text-muted-foreground">Mensalidade</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
              <Receipt className="size-5" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(demonstrativo.upselling)}</p>
              <p className="text-sm text-muted-foreground">Extras (upselling)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(demonstrativo.total)}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Total do mês
                {demonstrativo.pago ? (
                  <Badge variant="success">Pago</Badge>
                ) : (
                  <Badge variant="warning">Pendente</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" /> Extras do mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demonstrativo.itensUpselling.length === 0 ? (
            <EmptyState label="Nenhum extra lançado neste mês." />
          ) : (
            <div className="space-y-2">
              {demonstrativo.itensUpselling.map((u, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{u.categoria}</Badge>
                      <span className="text-xs text-muted-foreground">{formatarDataBR(u.data)}</span>
                    </div>
                    {u.descricao && <p className="mt-1 text-sm text-secondary">{u.descricao}</p>}
                  </div>
                  <p className="text-lg font-bold tabular-nums text-secondary">{formatarMoeda(u.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
