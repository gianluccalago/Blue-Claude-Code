/**
 * Custos de medicamento — Farmácia (Parte 2)
 *
 * Lança o custo da "caixinha" mensal por hóspede. Grava na MESMA tabela
 * `upselling` que a Administração e o demonstrativo da família leem
 * (categoria "Medicamentos", lancado_por "Farmácia") — sem tabela nova nem
 * duplicação. A Administração apenas VÊ esses lançamentos.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pill,
  Plus,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import {
  useLancarCustoMedicamento,
  useEditarCustoMedicamento,
  useRemoverCustoMedicamento,
  DESCRICAO_CAIXINHA,
} from "@/hooks/useFarmaciaMedicamentos";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";
import type { Residente, Upselling } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function CustosMedicamento() {
  const [mes, setMes] = useState(mesAtual());

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Pill className="size-3.5" /> Caixinha mensal
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Custos de medicamento</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">
            Lance o custo da caixinha de cada hóspede no mês. Vai direto para o upselling que a
            Administração e a família já enxergam.
          </p>
        </div>
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

      <ListaCustos mes={mes} />
    </div>
  );
}

function ListaCustos({ mes }: { mes: string }) {
  const residentes = useResidentes();
  const upselling = useUpsellingTodosDoMes(mes);

  // Lançamentos de medicamento do mês, agrupados por residente.
  const porResidente = useMemo(() => {
    const mapa = new Map<string, Upselling[]>();
    for (const u of upselling.data ?? []) {
      if (u.categoria !== "Medicamentos") continue;
      const arr = mapa.get(u.residente_id) ?? [];
      arr.push(u);
      mapa.set(u.residente_id, arr);
    }
    return mapa;
  }, [upselling.data]);

  if (residentes.isLoading || upselling.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (upselling.isError) return <ErrorState error={upselling.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const totalGeral = [...porResidente.values()]
    .flat()
    .reduce((acc, u) => acc + u.valor, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums text-secondary">
              {formatarMoeda(totalGeral)}
            </p>
            <p className="text-sm text-muted-foreground">Total de medicamentos da casa no mês</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {residentes.data.map((r) => (
          <ResidenteCusto
            key={`${r.id}-${mes}`}
            residente={r}
            entradas={porResidente.get(r.id) ?? []}
            mes={mes}
          />
        ))}
      </div>
    </div>
  );
}

function ResidenteCusto({
  residente,
  entradas,
  mes,
}: {
  residente: Residente;
  entradas: Upselling[];
  mes: string;
}) {
  const [lancando, setLancando] = useState(false);
  const total = entradas.reduce((acc, u) => acc + u.valor, 0);
  const temLancamento = entradas.length > 0;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-secondary">{residente.nome}</p>
            <p className="text-xs text-muted-foreground">Quarto {ouNaoInformado(residente.quarto)}</p>
          </div>
          <div className="flex items-center gap-3">
            {temLancamento ? (
              <p className="text-lg font-bold tabular-nums text-secondary">{formatarMoeda(total)}</p>
            ) : (
              <Badge variant="muted">Não lançado</Badge>
            )}
            {!temLancamento && !lancando && (
              <Button size="sm" onClick={() => setLancando(true)}>
                <Plus className="size-4" /> Lançar custo
              </Button>
            )}
          </div>
        </div>

        {/* Lançamentos existentes do mês (editar/remover) */}
        {entradas.map((entrada) => (
          <ItemCusto key={entrada.id} entrada={entrada} residenteId={residente.id} mes={mes} />
        ))}

        {/* Formulário de novo lançamento */}
        {lancando && (
          <FormCusto
            residenteId={residente.id}
            mes={mes}
            onSalvo={() => setLancando(false)}
            onCancelar={() => setLancando(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ItemCusto({
  entrada,
  residenteId,
  mes,
}: {
  entrada: Upselling;
  residenteId: string;
  mes: string;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const remover = useRemoverCustoMedicamento(mes);

  async function handleRemover() {
    setErro(null);
    setConfirmar(false);
    try {
      await remover.mutateAsync({ id: entrada.id, residenteId });
      toast.success("Lançamento removido.");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  if (editando) {
    return (
      <FormCusto
        residenteId={residenteId}
        mes={mes}
        inicial={entrada}
        onSalvo={() => setEditando(false)}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  const observacao = entrada.descricao && entrada.descricao !== DESCRICAO_CAIXINHA ? entrada.descricao : null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary">{formatarMoeda(entrada.valor)}</p>
        <p className="text-xs text-muted-foreground">
          {formatarDataBR(entrada.data)}
          {observacao ? ` · ${observacao}` : ` · ${DESCRICAO_CAIXINHA}`}
        </p>
        {erro && (
          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" /> {erro}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setEditando(true)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setConfirmar(true)}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      <ConfirmDialog
        aberto={confirmar}
        titulo="Remover custo de medicamento?"
        descricao={`${formatarMoeda(entrada.valor)} · ${formatarDataBR(entrada.data)}`}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={handleRemover}
        onCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}

function FormCusto({
  residenteId,
  mes,
  inicial,
  onSalvo,
  onCancelar,
}: {
  residenteId: string;
  mes: string;
  inicial?: Upselling;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const editando = !!inicial;
  const [valor, setValor] = useState(inicial ? String(inicial.valor) : "");
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [observacao, setObservacao] = useState(
    inicial && inicial.descricao !== DESCRICAO_CAIXINHA ? (inicial.descricao ?? "") : "",
  );
  const [erro, setErro] = useState<string | null>(null);

  const lancar = useLancarCustoMedicamento(mes);
  const editar = useEditarCustoMedicamento(mes);
  const salvando = lancar.isPending || editar.isPending;

  async function handleSalvar() {
    setErro(null);
    const valorNum = Number(valor.replace(",", "."));
    if (!valor || Number.isNaN(valorNum) || valorNum <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    try {
      if (editando && inicial) {
        await editar.mutateAsync({
          id: inicial.id,
          residenteId,
          valor: valorNum,
          data,
          observacao: observacao.trim() || null,
        });
      } else {
        await lancar.mutateAsync({
          residenteId,
          valor: valorNum,
          data,
          observacao: observacao.trim() || null,
        });
      }
      toast.success(editando ? "Custo atualizado." : "Custo lançado.");
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            autoFocus
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-secondary">Observação (opcional)</label>
        <input
          type="text"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder={DESCRICAO_CAIXINHA}
          className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={salvando}>
          {salvando ? "Salvando…" : editando ? "Salvar" : "Lançar custo"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
