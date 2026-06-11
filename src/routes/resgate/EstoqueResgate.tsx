import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import {
  ShieldPlus,
  Plus,
  Minus,
  PackagePlus,
  ClipboardList,
  AlertCircle,
  Check,
  History,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useEstoqueResgate,
  useBaixasResgate,
  useCriarItemResgate,
  useReporItemResgate,
  useRegistrarBaixaResgate,
} from "@/hooks/useResgate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { BaixaResgate, EstoqueResgate } from "@/types/database";

// ─── Contexto de perfil ───────────────────────────────────────────────────────

type PerfilResgate = "farmacia" | "coordenacao" | "medico";

function usePerfilResgate() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const p = (perfil ?? "farmacia") as PerfilResgate;
  const isFarmacia = p === "farmacia";
  const adminPor =
    p === "medico" ? "Médico" : p === "coordenacao" ? "Coordenação" : "Farmácia";
  return { perfil: p, isFarmacia, adminPor };
}

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ─── Componente principal ─────────────────────────────────────────────────────

export function EstoqueResgate() {
  const { isFarmacia } = usePerfilResgate();
  const estoque = useEstoqueResgate();
  const baixas = useBaixasResgate();
  const residentes = useResidentes();

  const [modoBaixa, setModoBaixa] = useState(false);
  const [modoNovoItem, setModoNovoItem] = useState(false);

  // useMemo ANTES dos early returns — regra de hooks exige ordem constante
  const nomeResidente = useMemo(() => {
    const m = new Map((residentes.data ?? []).map((r) => [r.id, r.nome]));
    return (id: string) => m.get(id) ?? "Não informado";
  }, [residentes.data]);

  const nomeMed = useMemo(() => {
    const m = new Map((estoque.data ?? []).map((i) => [i.id, i.medicamento]));
    return (id: string) => m.get(id) ?? "Não informado";
  }, [estoque.data]);

  const isLoading = estoque.isLoading || residentes.isLoading;
  const erro = estoque.error ?? residentes.error;

  if (isLoading) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const itens = estoque.data ?? [];

  return (
    <div className="space-y-6">
      {/* ── Ações no topo ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant={modoBaixa ? "default" : "outline"}
          onClick={() => { setModoBaixa((v) => !v); setModoNovoItem(false); }}
          className="gap-2"
        >
          <Minus className="size-4" />
          Registrar uso / baixa
        </Button>
        {/* Reposição/cadastro — apenas Farmácia. TODO: reforçar via RLS quando auth existir. */}
        {isFarmacia && (
          <Button
            variant={modoNovoItem ? "default" : "outline"}
            onClick={() => { setModoNovoItem((v) => !v); setModoBaixa(false); }}
            className="gap-2"
          >
            <PackagePlus className="size-4" />
            Cadastrar / repor item
          </Button>
        )}
      </div>

      {/* ── Formulário de baixa ─────────────────────────────────── */}
      {modoBaixa && (
        <FormBaixa
          itens={itens}
          residentes={residentes.data ?? []}
          onConcluido={() => setModoBaixa(false)}
        />
      )}

      {/* ── Formulário de novo item / reposição (Farmácia) ─────── */}
      {modoNovoItem && isFarmacia && (
        <FormReposicao
          itens={itens}
          onConcluido={() => setModoNovoItem(false)}
        />
      )}

      {/* ── Estoque atual ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldPlus className="size-5 text-primary" />
            Estoque de resgate
            {itens.length > 0 && (
              <Badge variant="muted" className="ml-1">
                {itens.length} item{itens.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itens.length === 0 ? (
            <EmptyState label="Nenhum item de resgate cadastrado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs font-semibold text-muted-foreground">
                    <th className="pb-2 text-left">Medicamento</th>
                    <th className="pb-2 text-right">Saldo</th>
                    <th className="pb-2 text-left pl-4">Unidade</th>
                    <th className="pb-2 text-center">Status</th>
                    {isFarmacia && <th className="pb-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itens.map((item) => (
                    <LinhaResgate key={item.id} item={item} isFarmacia={isFarmacia} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Histórico de baixas ─────────────────────────────────── */}
      <Historico
        baixas={baixas.data ?? []}
        isLoading={baixas.isLoading}
        nomeResidente={nomeResidente}
        nomeMed={nomeMed}
      />
    </div>
  );
}

// ─── Linha de estoque ─────────────────────────────────────────────────────────

function LinhaResgate({
  item,
  isFarmacia,
}: {
  item: EstoqueResgate;
  isFarmacia: boolean;
}) {
  const [repondoId, setRepondoId] = useState<string | null>(null);
  const [qtdRepo, setQtdRepo] = useState(1);
  const repor = useReporItemResgate();
  const [erro, setErro] = useState<string | null>(null);

  const status = item.quantidade_atual < 0 ? "negativo" : item.quantidade_atual === 0 ? "zero" : item.quantidade_atual <= 5 ? "baixo" : "ok";
  const abrindo = repondoId === item.id;

  async function confirmarRepo() {
    if (qtdRepo <= 0) return;
    setErro(null);
    try {
      await repor.mutateAsync({ id: item.id, quantidadeAnterior: item.quantidade_atual, quantidadeRecebida: qtdRepo });
      setRepondoId(null);
      setQtdRepo(1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "Erro ao salvar.");
    }
  }

  return (
    <>
      <tr className="text-secondary">
        <td className="py-2.5 font-medium">{item.medicamento}</td>
        <td className={cn(
          "py-2.5 text-right tabular-nums font-bold",
          status === "negativo" || status === "zero" ? "text-destructive" :
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
        {isFarmacia && (
          <td className="py-2.5 text-right">
            <button
              type="button"
              onClick={() => setRepondoId(abrindo ? null : item.id)}
              className="text-xs text-primary hover:underline"
            >
              {abrindo ? "Cancelar" : "Repor"}
            </button>
          </td>
        )}
      </tr>
      {abrindo && (
        <tr>
          <td colSpan={5} className="pb-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="text-sm text-secondary">Quantidade recebida:</span>
              <input
                type="number"
                min={1}
                value={qtdRepo}
                onChange={(e) => setQtdRepo(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm text-muted-foreground">{item.unidade}</span>
              <Button size="sm" onClick={confirmarRepo} disabled={repor.isPending}>
                <Check className="size-3.5" />
                {repor.isPending ? "Salvando…" : "Confirmar"}
              </Button>
              {erro && <span className="w-full text-xs text-destructive">{erro}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Formulário de baixa ──────────────────────────────────────────────────────

function FormBaixa({
  itens,
  residentes,
  onConcluido,
}: {
  itens: EstoqueResgate[];
  residentes: { id: string; nome: string; quarto: string | null }[];
  onConcluido: () => void;
}) {
  const { perfil, adminPor } = usePerfilResgate();
  const registrar = useRegistrarBaixaResgate();

  const [estoqueId, setEstoqueId] = useState(itens[0]?.id ?? "");
  const [residenteId, setResidenteId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const itemSelecionado = itens.find((i) => i.id === estoqueId);

  async function handleRegistrar() {
    if (!estoqueId || !residenteId || !motivo.trim() || quantidade < 1) return;
    setErro(null);
    try {
      await registrar.mutateAsync({
        estoqueId,
        residenteId,
        quantidade,
        motivo: motivo.trim(),
        administradoPor: adminPor,
        perfilResponsavel: perfil as "farmacia" | "coordenacao" | "medico",
        quantidadeAtualAntes: itemSelecionado?.quantidade_atual ?? 0,
      });
      // Reset
      setResidenteId("");
      setQuantidade(1);
      setMotivo("");
      onConcluido();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message :
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : "Erro ao registrar. Verifique se a migration 0017 foi executada.",
      );
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Minus className="size-5 text-primary" />
          Registrar uso / baixa de resgate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Medicamento</label>
            <select
              value={estoqueId}
              onChange={(e) => setEstoqueId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione…</option>
              {itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.medicamento} (saldo: {i.quantidade_atual} {i.unidade})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
            <select
              value={residenteId}
              onChange={(e) => setResidenteId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione…</option>
              {residentes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}{r.quarto ? ` · Quarto ${r.quarto}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Quantidade</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantidade((v) => Math.max(1, v - 1))}
                className="grid size-11 shrink-0 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-center text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setQuantidade((v) => v + 1)}
                className="grid size-11 shrink-0 place-items-center rounded-md border border-input bg-card text-muted-foreground hover:bg-muted"
              >
                <Plus className="size-4" />
              </button>
              {itemSelecionado && (
                <span className="text-sm text-muted-foreground">{itemSelecionado.unidade}</span>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Motivo / indicação</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRegistrar(); }}
              placeholder="Ex: febre 38.5°C, dor aguda…"
              className={inputClass}
            />
          </div>
        </div>

        {itemSelecionado && quantidade > itemSelecionado.quantidade_atual && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-secondary/80">
            <AlertCircle className="size-4 shrink-0 text-warning" />
            Quantidade maior que o saldo ({itemSelecionado.quantidade_atual}). O saldo ficará negativo — farmácia deve reconciliar.
          </div>
        )}

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRegistrar}
            disabled={!estoqueId || !residenteId || !motivo.trim() || registrar.isPending}
          >
            <Check className="size-4" />
            {registrar.isPending ? "Registrando…" : "Confirmar baixa"}
          </Button>
          <Button variant="outline" onClick={onConcluido} disabled={registrar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Formulário de reposição / novo item (Farmácia) ───────────────────────────

function FormReposicao({
  itens,
  onConcluido,
}: {
  itens: EstoqueResgate[];
  onConcluido: () => void;
}) {
  const criar = useCriarItemResgate();
  const [medicamento, setMedicamento] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [unidade, setUnidade] = useState("comprimido");
  const [erro, setErro] = useState<string | null>(null);

  const nomeExistente = itens.some(
    (i) => i.medicamento.toLowerCase() === medicamento.trim().toLowerCase(),
  );

  async function handleCriar() {
    if (!medicamento.trim() || quantidade < 1) return;
    setErro(null);
    try {
      await criar.mutateAsync({ medicamento: medicamento.trim(), quantidade, unidade });
      setMedicamento("");
      setQuantidade(1);
      setUnidade("comprimido");
      onConcluido();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message :
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : "Erro ao salvar. Verifique se a migration 0017 foi executada.",
      );
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackagePlus className="size-5 text-primary" />
          Cadastrar novo item de resgate
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Para repor itens existentes, use o botão "Repor" ao lado de cada medicamento no estoque.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Medicamento</label>
            <input
              type="text"
              value={medicamento}
              onChange={(e) => setMedicamento(e.target.value)}
              placeholder="Ex: Metoclopramida 10mg"
              className={cn(inputClass, nomeExistente && "border-warning/50")}
            />
            {nomeExistente && (
              <p className="mt-1 text-xs text-warning">Nome já existe no estoque.</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Quantidade inicial</label>
            <input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Unidade</label>
            <input
              type="text"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="comprimido, ml, ampola…"
              className={inputClass}
            />
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCriar}
            disabled={!medicamento.trim() || criar.isPending}
          >
            <Check className="size-4" />
            {criar.isPending ? "Salvando…" : "Cadastrar item"}
          </Button>
          <Button variant="outline" onClick={onConcluido} disabled={criar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Histórico de baixas ──────────────────────────────────────────────────────

const PERFIL_LABEL: Record<string, string> = {
  farmacia: "Farmácia",
  coordenacao: "Coordenação",
  medico: "Médico",
};

function Historico({
  baixas,
  isLoading,
  nomeResidente,
  nomeMed,
}: {
  baixas: BaixaResgate[];
  isLoading: boolean;
  nomeResidente: (id: string) => string;
  nomeMed: (id: string) => string;
}) {
  if (isLoading) return <LoadingState label="Carregando histórico…" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          Histórico de baixas
          {baixas.length > 0 && (
            <Badge variant="muted" className="ml-1">{baixas.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {baixas.length === 0 ? (
          <EmptyState label="Nenhuma baixa registrada ainda." />
        ) : (
          <div className="space-y-2">
            {baixas.map((b) => (
              <div key={b.id} className="flex flex-col gap-1 rounded-lg border bg-card p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-secondary">
                  <ClipboardList className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{nomeMed(b.estoque_resgate_id)}</span>
                    <Badge variant="muted" className="text-xs tabular-nums">
                      −{b.quantidade} unid.
                    </Badge>
                    <Badge variant="muted" className="text-xs">
                      {PERFIL_LABEL[b.perfil_responsavel] ?? b.perfil_responsavel}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-secondary/80">
                    {ouNaoInformado(nomeResidente(b.residente_id))} · {ouNaoInformado(b.motivo)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ouNaoInformado(b.administrado_por)} · {formatarDataHoraBR(b.registrado_em)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
