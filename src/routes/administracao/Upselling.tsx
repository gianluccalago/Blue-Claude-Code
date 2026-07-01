/**
 * Upselling — Administração (BLOCO Adm2)
 *
 * Despesas extras dos hóspedes (manicure, fisioterapia avulsa, medicamentos
 * não cobertos, etc). Lançamento manual por ora; a automação via módulo de
 * compras da farmácia poderá alimentar esta tabela no futuro (ver
 * useLancarUpselling).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useEditarUpselling,
  useLancamentosDoMes,
  useLancarUpselling,
  useRemoverUpselling,
  useUpsellingTodosDoMes,
} from "@/hooks/useUpselling";
import { CATEGORIAS_UPSELLING } from "@/lib/upselling";
import { AnexoSeguro } from "@/components/AnexoSeguro";
import { BUCKET_UPSELLING_COMPROVANTES } from "@/lib/storage";
import { deslocarMes, formatarMesReferencia, formatarMoeda, mesAtual } from "@/lib/mensalidade";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, hojeISO } from "@/lib/utils";
import type { CategoriaUpselling, Upselling as UpsellingRow } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function Upselling() {
  const [mes, setMes] = useState(mesAtual());

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

      <Tabs defaultValue="hospede">
        <TabsList>
          <TabsTrigger value="hospede">Hóspede</TabsTrigger>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
        </TabsList>
        <TabsContent value="hospede">
          <UpsellingHospede mes={mes} />
        </TabsContent>
        <TabsContent value="geral">
          <VisaoGeral mes={mes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Hóspede ────────────────────────────────────────────────────────────────────

function UpsellingHospede({ mes }: { mes: string }) {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector hospedes={residentes.data} selecionadoId={hospedeId} onSelect={setSelecionadoId} />
      {hospedeId && <LancamentosDoHospede key={`${hospedeId}-${mes}`} residenteId={hospedeId} mes={mes} />}
    </div>
  );
}

function LancamentosDoHospede({ residenteId, mes }: { residenteId: string; mes: string }) {
  const lancamentos = useLancamentosDoMes(residenteId, mes);
  const mesAnterior = deslocarMes(mes, -1);
  const lancamentosAnterior = useLancamentosDoMes(residenteId, mesAnterior);
  const lancar = useLancarUpselling(residenteId);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [repetindo, setRepetindo] = useState(false);

  if (lancamentos.isLoading) return <LoadingState />;
  if (lancamentos.isError) return <ErrorState error={lancamentos.error} />;

  const itens = lancamentos.data ?? [];
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  const itensAnterior = lancamentosAnterior.data ?? [];

  // Itens do mês anterior que ainda não existem no mês atual (mesma categoria+descrição).
  const chaveItem = (categoria: string, descricao: string | null) => `${categoria}::${descricao ?? ""}`;
  const jaExistentes = new Set(itens.map((i) => chaveItem(i.categoria, i.descricao)));
  const repetiveis = itensAnterior.filter((i) => !jaExistentes.has(chaveItem(i.categoria, i.descricao)));

  async function repetirMesAnterior() {
    if (repetiveis.length === 0) return;
    if (!window.confirm(`Repetir ${repetiveis.length} lançamento(s) do mês anterior neste mês?`)) return;
    setRepetindo(true);
    try {
      for (const item of repetiveis) {
        await lancar.mutateAsync({
          categoria: item.categoria,
          descricao: item.descricao,
          valor: item.valor,
          data: hojeISO(),
          mesReferencia: mes,
          comprovante: null,
        });
      }
      toast.success(`${repetiveis.length} lançamento(s) repetido(s) — revise os valores.`);
    } catch (e) {
      toast.error(extrairErro(e));
    } finally {
      setRepetindo(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-secondary">{formatarMoeda(total)}</p>
              <p className="text-sm text-muted-foreground">Total de upselling no mês</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {repetiveis.length > 0 && (
              <Button variant="outline" onClick={repetirMesAnterior} disabled={repetindo || lancar.isPending}>
                <CopyPlus className="size-4" />
                {repetindo ? "Repetindo…" : `Repetir do mês anterior (${repetiveis.length})`}
              </Button>
            )}
            <Button onClick={() => setMostrarForm((v) => !v)}>
              <Plus className="size-4" /> {mostrarForm ? "Cancelar" : "Lançar despesa extra"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mostrarForm && (
        <FormLancamento
          residenteId={residenteId}
          mes={mes}
          onSalvo={() => setMostrarForm(false)}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      {itens.length === 0 ? (
        <EmptyState label="Nenhum lançamento de upselling neste mês." />
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <ItemUpselling key={item.id} item={item} residenteId={residenteId} mes={mes} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formulário de lançamento/edição ───────────────────────────────────────────

function CamposLancamento({
  categoria,
  setCategoria,
  descricao,
  setDescricao,
  valor,
  setValor,
  data,
  setData,
  setComprovante,
  comprovanteAtualUrl,
}: {
  categoria: CategoriaUpselling;
  setCategoria: (c: CategoriaUpselling) => void;
  descricao: string;
  setDescricao: (v: string) => void;
  valor: string;
  setValor: (v: string) => void;
  data: string;
  setData: (v: string) => void;
  setComprovante: (f: File | null) => void;
  comprovanteAtualUrl?: string | null;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaUpselling)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CATEGORIAS_UPSELLING.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        <label className="text-sm font-semibold text-secondary">
          Descrição {categoria === "Outros" && <span className="text-destructive">*</span>}
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={categoria === "Outros" ? 'Obrigatória para a categoria "Outros"' : "Opcional"}
          rows={2}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Comprovante (opcional)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {comprovanteAtualUrl && (
            <AnexoSeguro bucket={BUCKET_UPSELLING_COMPROVANTES} stored={comprovanteAtualUrl}>
              {(url) => (
                <a href={url} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary underline">
                  Ver comprovante atual
                </a>
              )}
            </AnexoSeguro>
          )}
        </div>
      </div>
    </>
  );
}

function validarLancamento(categoria: CategoriaUpselling, descricao: string, valor: string): string | null {
  if (categoria === "Outros" && descricao.trim() === "") {
    return 'Descrição é obrigatória para a categoria "Outros".';
  }
  const valorNum = Number(valor.replace(",", "."));
  if (!valor || Number.isNaN(valorNum) || valorNum <= 0) {
    return "Informe um valor válido.";
  }
  return null;
}

function FormLancamento({
  residenteId,
  mes,
  onSalvo,
  onCancelar,
}: {
  residenteId: string;
  mes: string;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaUpselling>(CATEGORIAS_UPSELLING[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const lancar = useLancarUpselling(residenteId);

  async function handleSalvar() {
    setErro(null);
    const msg = validarLancamento(categoria, descricao, valor);
    if (msg) {
      setErro(msg);
      return;
    }
    try {
      await lancar.mutateAsync({
        categoria,
        descricao: descricao.trim() || null,
        valor: Number(valor.replace(",", ".")),
        data,
        mesReferencia: mes,
        comprovante,
      });
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-5 text-primary" />
          Lançar despesa extra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CamposLancamento
          categoria={categoria}
          setCategoria={setCategoria}
          descricao={descricao}
          setDescricao={setDescricao}
          valor={valor}
          setValor={setValor}
          data={data}
          setData={setData}
          setComprovante={setComprovante}
        />

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={lancar.isPending}>
            {lancar.isPending ? "Salvando…" : "Salvar lançamento"}
          </Button>
          <Button variant="outline" onClick={onCancelar} disabled={lancar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FormEdicao({
  item,
  residenteId,
  mes,
  onSalvo,
  onCancelar,
}: {
  item: UpsellingRow;
  residenteId: string;
  mes: string;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaUpselling>(item.categoria);
  const [descricao, setDescricao] = useState(item.descricao ?? "");
  const [valor, setValor] = useState(String(item.valor));
  const [data, setData] = useState(item.data);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const editar = useEditarUpselling(residenteId);

  async function handleSalvar() {
    setErro(null);
    const msg = validarLancamento(categoria, descricao, valor);
    if (msg) {
      setErro(msg);
      return;
    }
    try {
      await editar.mutateAsync({
        id: item.id,
        mes,
        categoria,
        descricao: descricao.trim() || null,
        valor: Number(valor.replace(",", ".")),
        data,
        comprovante,
      });
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="size-5 text-primary" />
          Editar lançamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CamposLancamento
          categoria={categoria}
          setCategoria={setCategoria}
          descricao={descricao}
          setDescricao={setDescricao}
          valor={valor}
          setValor={setValor}
          data={data}
          setData={setData}
          setComprovante={setComprovante}
          comprovanteAtualUrl={item.comprovante_url}
        />

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={editar.isPending}>
            {editar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} disabled={editar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemUpselling({ item, residenteId, mes }: { item: UpsellingRow; residenteId: string; mes: string }) {
  const [editando, setEditando] = useState(false);
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const remover = useRemoverUpselling(residenteId);

  async function handleRemover() {
    setErro(null);
    setConfirmarRemover(false);
    try {
      await remover.mutateAsync({ id: item.id, mes });
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  if (editando) {
    return (
      <FormEdicao
        item={item}
        residenteId={residenteId}
        mes={mes}
        onSalvo={() => setEditando(false)}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{item.categoria}</Badge>
              <span className="text-xs text-muted-foreground">{formatarDataBR(item.data)}</span>
            </div>
            {item.descricao && <p className="mt-1 text-sm text-secondary">{item.descricao}</p>}
            {item.comprovante_url && (
              <AnexoSeguro bucket={BUCKET_UPSELLING_COMPROVANTES} stored={item.comprovante_url}>
                {(url) => (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-primary underline"
              >
                Ver comprovante
              </a>
                )}
              </AnexoSeguro>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold tabular-nums text-secondary">{formatarMoeda(item.valor)}</p>
            <Button variant="ghost" size="icon" onClick={() => setEditando(true)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setConfirmarRemover(true)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        aberto={confirmarRemover}
        titulo="Remover lançamento?"
        descricao={`${item.categoria} · ${formatarMoeda(item.valor)} · ${formatarDataBR(item.data)}`}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={handleRemover}
        onCancelar={() => setConfirmarRemover(false)}
      />
    </Card>
  );
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

function VisaoGeral({ mes }: { mes: string }) {
  const residentes = useResidentes();
  const upselling = useUpsellingTodosDoMes(mes);

  if (residentes.isLoading || upselling.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (upselling.isError) return <ErrorState error={upselling.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const totalPorResidente = new Map<string, number>();
  let totalGeral = 0;
  for (const item of upselling.data ?? []) {
    totalPorResidente.set(item.residente_id, (totalPorResidente.get(item.residente_id) ?? 0) + item.valor);
    totalGeral += item.valor;
  }

  const lista = residentes.data
    .map((r) => ({ residente: r, total: totalPorResidente.get(r.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight tabular-nums text-secondary">{formatarMoeda(totalGeral)}</p>
            <p className="text-sm text-muted-foreground">Total geral de upselling da casa no mês</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Upselling por hóspede
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lista.map(({ residente, total }) => (
              <div
                key={residente.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-secondary">{residente.nome}</p>
                  <p className="text-xs text-muted-foreground">Quarto {residente.quarto ?? "—"}</p>
                </div>
                {total > 0 ? (
                  <p className="text-lg font-bold tabular-nums text-secondary">{formatarMoeda(total)}</p>
                ) : (
                  <Badge variant="muted">Sem lançamentos</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
