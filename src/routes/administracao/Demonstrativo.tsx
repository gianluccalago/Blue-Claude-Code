/**
 * Demonstrativo mensal — Administração (BLOCO Adm3)
 *
 * Consolida, por hóspede, mensalidade + upselling do mês de referência —
 * o demonstrativo enviado ao mantenedor. Permite exportar em Excel (.xlsx)
 * o consolidado de todos os hóspedes (com detalhamento de upselling) e o
 * demonstrativo individual de um hóspede (Excel ou texto).
 */
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Receipt,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useLancamentosDoMes } from "@/hooks/useUpselling";
import { useDemonstrativoMes, type LinhaDemonstrativo } from "@/hooks/useDemonstrativo";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import {
  exportarDemonstrativoConsolidadoExcel,
  exportarDemonstrativoIndividualExcel,
  exportarDemonstrativoIndividualTexto,
} from "@/lib/exportDemonstrativo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR } from "@/lib/utils";

export function Demonstrativo() {
  const [mes, setMes] = useState(mesAtual());
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const demo = useDemonstrativoMes(mes);

  if (demo.isLoading) return <LoadingState />;
  if (demo.isError) return <ErrorState error={demo.error} />;
  if (demo.linhas.length === 0) return <EmptyState label="Nenhum residente cadastrado." />;

  const totalMensalidades = demo.linhas.reduce((acc, l) => acc + l.mensalidade, 0);
  const totalUpselling = demo.linhas.reduce((acc, l) => acc + l.upselling, 0);
  const totalGeral = totalMensalidades + totalUpselling;

  const detalheLinha = demo.linhas.find((l) => l.residente.id === detalheId);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMes((m) => deslocarMes(m, -1))}
            disabled={!!detalheLinha}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-bold text-secondary">{formatarMesReferencia(mes)}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMes((m) => deslocarMes(m, 1))}
            disabled={!!detalheLinha}
          >
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {detalheLinha ? (
        <DetalheHospede linha={detalheLinha} mes={mes} onVoltar={() => setDetalheId(null)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(totalMensalidades)}</p>
                  <p className="text-sm text-muted-foreground">Mensalidades</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(totalUpselling)}</p>
                  <p className="text-sm text-muted-foreground">Upselling</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(totalGeral)}</p>
                  <p className="text-sm text-muted-foreground">Total geral do mês</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await exportarDemonstrativoConsolidadoExcel(mes, demo.linhas, demo.upsellingTodos);
                if (!ok) toast.error("Não foi possível gerar o Excel. Tente novamente.");
              }}
            >
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </Button>
          </div>

          <div className="space-y-3">
            {demo.linhas.map((l) => (
              <LinhaConsolidada key={l.residente.id} linha={l} onAbrir={() => setDetalheId(l.residente.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LinhaConsolidada({ linha, onAbrir }: { linha: LinhaDemonstrativo; onAbrir: () => void }) {
  const r = linha.residente;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="font-semibold text-secondary">{r.nome}</p>
          <p className="text-xs text-muted-foreground">
            Quarto {r.quarto ?? "Não informado"} · {r.tipo_suite ?? "Não informado"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>Mensalidade: <span className="font-semibold text-secondary">{formatarMoeda(linha.mensalidade)}</span></span>
            <span>Upselling: <span className="font-semibold text-secondary">{formatarMoeda(linha.upselling)}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-secondary">{formatarMoeda(linha.total)}</p>
            {linha.pago ? <Badge variant="success">Pago</Badge> : <Badge variant="warning">Pendente</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={onAbrir}>
            Ver detalhe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DetalheHospede({
  linha,
  mes,
  onVoltar,
}: {
  linha: LinhaDemonstrativo;
  mes: string;
  onVoltar: () => void;
}) {
  const r = linha.residente;
  const lancamentos = useLancamentosDoMes(r.id, mes);

  if (lancamentos.isLoading) return <LoadingState />;
  if (lancamentos.isError) return <ErrorState error={lancamentos.error} />;

  const itens = lancamentos.data ?? [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVoltar}>
        <ArrowLeft className="size-4" /> Voltar à lista
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{r.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quarto {r.quarto ?? "Não informado"} · {r.tipo_suite ?? "Não informado"} · Grau{" "}
            {r.grau_dependencia ?? "Não informado"} · {formatarMesReferencia(mes)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Mensalidade</p>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(linha.mensalidade)}</p>
              {linha.pago ? <Badge variant="success">Pago</Badge> : <Badge variant="warning">Pendente</Badge>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upselling do mês</p>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(linha.upselling)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total do mês</p>
              <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(linha.total)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await exportarDemonstrativoIndividualExcel(mes, linha, itens);
                if (!ok) toast.error("Não foi possível gerar o Excel. Tente novamente.");
              }}
            >
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => exportarDemonstrativoIndividualTexto(mes, linha, itens)}>
              <FileText className="size-4" /> Exportar texto
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Upselling do mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itens.length === 0 ? (
            <EmptyState label="Nenhum lançamento de upselling neste mês." />
          ) : (
            <div className="space-y-2">
              {itens.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
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
