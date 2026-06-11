import { useState, useMemo, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import {
  Package,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Pencil,
  PackagePlus,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useEstoqueHospede,
  usePrescricoesParaFarmacia,
  useProvisionarEstoque,
  type ItemProvisionamento,
} from "@/hooks/useFarmacia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LembreteProvisionamento } from "@/components/farmacia/LembreteProvisionamento";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { EstoqueHospede, Prescricao } from "@/types/database";

// ─── Helpers de mês ───────────────────────────────────────────────────────────

function mesAtualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function navegarMes(mesRef: string, delta: number): string {
  const [ano, mes] = mesRef.split("-").map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatarMesExtenso(mesRef: string): string {
  const [ano, mes] = mesRef.split("-").map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

function diasNoMes(mesRef: string): number {
  const [ano, mes] = mesRef.split("-").map(Number);
  return new Date(ano, mes, 0).getDate();
}

// ─── Cálculo de sugestão a partir das prescrições ────────────────────────────

type SugestaoItem = {
  medicamento: string;
  doseDiaria: number;
  unidade: string;
  quantidadeSugerida: number;
  detalhes: string;
  /** Quantidade editável pelo farmacêutico — começa igual à sugerida ou ao provisionado existente. */
  quantidadeEditada: number;
  /** Indica que já existe entrada para este mês (ajuste). */
  jaProvisionado: boolean;
  quantidadeAtualExistente: number | null;
};

function parsearQuantidade(q: string | null): { numero: number; unidade: string } {
  if (!q) return { numero: 1, unidade: "unidade" };
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)/);
  if (!m) return { numero: 1, unidade: q.trim() };
  const numero = parseFloat(m[1].replace(",", "."));
  return { numero: isNaN(numero) ? 1 : numero, unidade: m[2].trim() || "unidade" };
}

function calcularSugestoes(
  prescricoes: Prescricao[],
  mesRef: string,
  estoqueExistente: EstoqueHospede[],
): SugestaoItem[] {
  const dias = diasNoMes(mesRef);
  const grupos = new Map<string, { doseDiaria: number; unidade: string }>();

  for (const p of prescricoes) {
    const { numero, unidade } = parsearQuantidade(p.quantidade);
    const key = p.medicamento;
    if (!grupos.has(key)) {
      grupos.set(key, { doseDiaria: 0, unidade });
    }
    grupos.get(key)!.doseDiaria += numero;
  }

  const estoqueMap = new Map(estoqueExistente.map((e) => [e.medicamento, e]));

  return Array.from(grupos.entries()).map(([med, { doseDiaria, unidade }]) => {
    const sugerida = Math.ceil(doseDiaria * dias);
    const existente = estoqueMap.get(med) ?? null;
    const doseFmt = Number.isInteger(doseDiaria)
      ? String(doseDiaria)
      : doseDiaria.toFixed(1).replace(".", ",");
    return {
      medicamento: med,
      doseDiaria,
      unidade,
      quantidadeSugerida: sugerida,
      detalhes: `${doseFmt}/dia × ${dias} dias`,
      quantidadeEditada: existente?.quantidade_provisionada ?? sugerida,
      jaProvisionado: !!existente,
      quantidadeAtualExistente: existente?.quantidade_atual ?? null,
    };
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EstoqueHospedeScreen() {
  const { data: residentes, isLoading: loadRes, isError: errRes, error: errResMsg } = useResidentes();
  const [residenteId, setResidenteId] = useState<string | null>(null);
  const [mesRef, setMesRef] = useState(mesAtualISO());
  const [modoProvisionamento, setModoProvisionamento] = useState(false);

  // Pré-seleção via ?hospede=ID (vindo dos alertas do Painel da Farmácia).
  const search = useSearch({ strict: false }) as { hospede?: string };
  const [autoPreencheu, setAutoPreencheu] = useState(false);
  useEffect(() => {
    if (autoPreencheu || !search.hospede || !residentes) return;
    if (residentes.some((r) => r.id === search.hospede)) {
      setResidenteId(search.hospede);
    }
    setAutoPreencheu(true);
  }, [search.hospede, residentes, autoPreencheu]);

  if (loadRes) return <LoadingState />;
  if (errRes) return <ErrorState error={errResMsg} />;

  return (
    <div className="space-y-6">
      <LembreteProvisionamento />
      {/* ── Seletores ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Estoque por hóspede
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Hóspede */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
              <select
                value={residenteId ?? ""}
                onChange={(e) => {
                  setResidenteId(e.target.value || null);
                  setModoProvisionamento(false);
                }}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um hóspede…</option>
                {(residentes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}{r.quarto ? ` · Quarto ${r.quarto}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {/* Mês */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">
                Mês de referência
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setMesRef((m) => navegarMes(m, -1)); setModoProvisionamento(false); }}
                  className="grid size-11 shrink-0 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex h-11 flex-1 items-center justify-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold text-secondary">
                  {formatarMesExtenso(mesRef)}
                </div>
                <button
                  type="button"
                  onClick={() => { setMesRef((m) => navegarMes(m, 1)); setModoProvisionamento(false); }}
                  className="grid size-11 shrink-0 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Conteúdo para o hóspede selecionado ────────────────── */}
      {residenteId && (
        <ConteudoEstoque
          residenteId={residenteId}
          mesRef={mesRef}
          modoProvisionamento={modoProvisionamento}
          onAbrirProvisionamento={() => setModoProvisionamento(true)}
          onFecharProvisionamento={() => setModoProvisionamento(false)}
        />
      )}
    </div>
  );
}

// ─── Conteúdo do estoque ──────────────────────────────────────────────────────

function ConteudoEstoque({
  residenteId,
  mesRef,
  modoProvisionamento,
  onAbrirProvisionamento,
  onFecharProvisionamento,
}: {
  residenteId: string;
  mesRef: string;
  modoProvisionamento: boolean;
  onAbrirProvisionamento: () => void;
  onFecharProvisionamento: () => void;
}) {
  const estoque = useEstoqueHospede(residenteId, mesRef);
  const prescricoes = usePrescricoesParaFarmacia(residenteId);

  const isLoading = estoque.isLoading || prescricoes.isLoading;
  const erro = estoque.error ?? prescricoes.error;

  if (isLoading) return <LoadingState label="Carregando estoque…" />;
  if (erro) return <ErrorState error={erro} />;

  const itensEstoque = estoque.data ?? [];
  const semPrescricoes = (prescricoes.data ?? []).length === 0;

  return (
    <>
      {/* Estoque atual do mês */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="size-5 text-primary" />
              Estoque — {formatarMesExtenso(mesRef)}
              {itensEstoque.length > 0 && (
                <Badge variant="muted" className="ml-1">{itensEstoque.length} item{itensEstoque.length !== 1 ? "s" : ""}</Badge>
              )}
            </CardTitle>
            <Button
              variant={modoProvisionamento ? "default" : "outline"}
              size="sm"
              onClick={modoProvisionamento ? onFecharProvisionamento : onAbrirProvisionamento}
              disabled={semPrescricoes}
              className="gap-2"
            >
              <PackagePlus className="size-4" />
              {itensEstoque.length > 0 ? "Ajustar provisionamento" : "Provisionar mês"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {itensEstoque.length === 0 ? (
            <EmptyState label="Nenhum estoque provisionado para este mês." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground">
                    <th className="pb-2 text-left">Medicamento</th>
                    <th className="pb-2 text-right">Provisionado</th>
                    <th className="pb-2 text-right">Saldo atual</th>
                    <th className="pb-2 text-left pl-4">Unidade</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itensEstoque.map((item) => (
                    <LinhaEstoque key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de provisionamento */}
      {modoProvisionamento && (
        <FormProvisionamento
          residenteId={residenteId}
          mesRef={mesRef}
          prescricoes={prescricoes.data ?? []}
          estoqueExistente={itensEstoque}
          onConcluido={onFecharProvisionamento}
        />
      )}
    </>
  );
}

// ─── Linha de estoque ─────────────────────────────────────────────────────────

function LinhaEstoque({ item }: { item: EstoqueHospede }) {
  const status =
    item.quantidade_atual < 0 ? "negativo" :
    item.quantidade_atual === 0 ? "zero" :
    item.quantidade_atual <= 5 ? "baixo" : "ok";

  return (
    <tr className="text-secondary">
      <td className="py-2.5 font-medium">{item.medicamento}</td>
      <td className="py-2.5 text-right tabular-nums text-muted-foreground">{item.quantidade_provisionada}</td>
      <td className={cn(
        "py-2.5 text-right tabular-nums font-bold",
        status === "negativo" ? "text-destructive" :
        status === "baixo" ? "text-warning" : "",
      )}>
        {item.quantidade_atual}
      </td>
      <td className="py-2.5 pl-4 text-muted-foreground">{item.unidade}</td>
      <td className="py-2.5 text-center">
        {status === "negativo" ? (
          <Badge variant="destructive" className="text-xs">Negativo</Badge>
        ) : status === "zero" ? (
          <Badge variant="destructive" className="text-xs">Esgotado</Badge>
        ) : status === "baixo" ? (
          <Badge variant="warning" className="text-xs">Baixo ≤5</Badge>
        ) : (
          <Badge variant="success" className="text-xs">OK</Badge>
        )}
      </td>
    </tr>
  );
}

// ─── Formulário de provisionamento ───────────────────────────────────────────

function FormProvisionamento({
  residenteId,
  mesRef,
  prescricoes,
  estoqueExistente,
  onConcluido,
}: {
  residenteId: string;
  mesRef: string;
  prescricoes: Prescricao[];
  estoqueExistente: EstoqueHospede[];
  onConcluido: () => void;
}) {
  const provisionar = useProvisionarEstoque();
  const [erro, setErro] = useState<string | null>(null);

  const sugestoes = useMemo(
    () => calcularSugestoes(prescricoes, mesRef, estoqueExistente),
    [prescricoes, mesRef, estoqueExistente],
  );

  const [quantidades, setQuantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(sugestoes.map((s) => [s.medicamento, s.quantidadeEditada])),
  );

  function setQtd(med: string, val: number) {
    setQuantidades((prev) => ({ ...prev, [med]: Math.max(0, val) }));
  }

  async function handleConfirmar() {
    setErro(null);
    const itens: ItemProvisionamento[] = sugestoes.map((s) => ({
      medicamento: s.medicamento,
      quantidadeProvisionada: quantidades[s.medicamento] ?? s.quantidadeEditada,
      unidade: s.unidade,
      quantidadeAtualExistente: s.quantidadeAtualExistente,
    }));
    try {
      await provisionar.mutateAsync({ residenteId, mesReferencia: mesRef, itens });
      onConcluido();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Erro ao salvar. Verifique se a migration 0016 foi executada no Supabase.";
      setErro(msg);
    }
  }

  if (sugestoes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState label="Nenhuma prescrição ativa encontrada para calcular o estoque." />
        </CardContent>
      </Card>
    );
  }

  const temAjuste = sugestoes.some(
    (s) => (quantidades[s.medicamento] ?? s.quantidadeEditada) !== s.quantidadeSugerida,
  );

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackagePlus className="size-5 text-primary" />
          Provisionar — {formatarMesExtenso(mesRef)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sugestão calculada a partir das prescrições ativas ({diasNoMes(mesRef)} dias no mês).
          Ajuste as quantidades se necessário.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sugestoes.map((s) => (
            <LinhaProvisionamento
              key={s.medicamento}
              sugestao={s}
              quantidade={quantidades[s.medicamento] ?? s.quantidadeEditada}
              onChange={(v) => setQtd(s.medicamento, v)}
            />
          ))}
        </div>

        {temAjuste && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-secondary/80">
            <Pencil className="size-4 shrink-0 text-warning" />
            Algumas quantidades foram ajustadas em relação à sugestão automática.
          </div>
        )}

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={handleConfirmar} disabled={provisionar.isPending}>
            <CheckCircle2 className="size-4" />
            {provisionar.isPending ? "Salvando…" : "Confirmar provisionamento"}
          </Button>
          <Button variant="outline" onClick={onConcluido} disabled={provisionar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Linha de provisionamento (editável) ─────────────────────────────────────

function LinhaProvisionamento({
  sugestao,
  quantidade,
  onChange,
}: {
  sugestao: SugestaoItem;
  quantidade: number;
  onChange: (v: number) => void;
}) {
  const ajustado = quantidade !== sugestao.quantidadeSugerida;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3",
        sugestao.jaProvisionado && "border-primary/20 bg-primary/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-secondary">{sugestao.medicamento}</span>
          {sugestao.jaProvisionado && (
            <Badge variant="muted" className="text-xs">Já provisionado</Badge>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Sugerido: <span className="font-medium text-secondary">{sugestao.quantidadeSugerida} {sugestao.unidade}</span>
          {" "}· {sugestao.detalhes}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(quantidade - 1)}
          className="grid size-8 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted disabled:opacity-40"
          disabled={quantidade <= 0}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={quantidade}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className={cn(
            "w-20 rounded-md border px-2 py-1.5 text-center text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ajustado ? "border-warning/40 bg-warning/5 text-warning" : "border-input bg-card text-secondary",
          )}
        />
        <button
          type="button"
          onClick={() => onChange(quantidade + 1)}
          className="grid size-8 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted"
        >
          +
        </button>
        <span className="min-w-[4rem] text-sm text-muted-foreground">{sugestao.unidade}</span>
      </div>
    </div>
  );
}

// re-export para o router
export { EstoqueHospedeScreen as EstoqueHospede };
