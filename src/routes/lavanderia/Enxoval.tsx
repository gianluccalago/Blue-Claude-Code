/**
 * Enxoval da casa — Lavanderia interna (substitui a antiga Rouparia em trânsito).
 *
 * Controla o PATRIMÔNIO: quantas peças a casa tem (total), quantas estão limpas
 * disponíveis (disponível) e quando repor (mínimo). O ciclo diário de lavagem e
 * a roupa pessoal dos hóspedes são resolvidos FORA do app.
 *
 * Edita: Lavanderia e Master. Administração e Direção veem em LEITURA.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Shirt,
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  Boxes,
  Check,
  X,
  Plus,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useEnxoval,
  useMovimentosEnxoval,
  useSalvarEnxovalItem,
  useRemoverEnxovalItem,
  useMovimentoEnxoval,
} from "@/hooks/useEnxoval";
import {
  CATEGORIAS_ENXOVAL,
  MOVIMENTO_ENXOVAL_LABEL,
  abaixoDoMinimo,
  emCirculacao,
  baixasPerdaDoMes,
} from "@/lib/enxoval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { Enxoval, EnxovalCategoria, EnxovalMovimentoTipo } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Enxoval() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEditar = perfil === "lavanderia" || perfil === "master";

  const enxoval = useEnxoval();
  const movimentos = useMovimentosEnxoval();
  const [cadastrando, setCadastrando] = useState(false);
  const [editando, setEditando] = useState<Enxoval | null>(null);

  const itens = useMemo(() => enxoval.data ?? [], [enxoval.data]);
  const aRepor = useMemo(() => itens.filter(abaixoDoMinimo), [itens]);
  const patrimonio = useMemo(() => itens.reduce((s, i) => s + i.quantidade_total, 0), [itens]);
  const baixasMes = useMemo(() => baixasPerdaDoMes(movimentos.data ?? []), [movimentos.data]);

  // Agrupa por categoria preservando a ordem definida em CATEGORIAS_ENXOVAL.
  const grupos = useMemo(() => {
    return CATEGORIAS_ENXOVAL.map((c) => ({
      categoria: c.value,
      label: c.label,
      itens: itens.filter((i) => i.categoria === c.value),
    })).filter((g) => g.itens.length > 0);
  }, [itens]);

  if (enxoval.isLoading || movimentos.isLoading) return <LoadingState />;
  if (enxoval.isError) return <ErrorState error={enxoval.error} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Shirt className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Enxoval da casa</h1>
            <p className="text-sm text-muted-foreground">
              Patrimônio (jogos de cama, toalhas, cobertores): quanto existe, disponível limpo e reposição.
            </p>
          </div>
        </div>
        {podeEditar && !cadastrando && !editando && (
          <Button onClick={() => setCadastrando(true)} className="gap-2">
            <Plus className="size-4" /> Novo item
          </Button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={AlertTriangle}
          tom={aRepor.length > 0 ? "destructive" : "success"}
          destaque={aRepor.length > 0}
          rotulo="Itens a repor"
          valor={aRepor.length}
          apoio={aRepor.length > 0 ? "abaixo do mínimo" : "todos acima do mínimo"}
        />
        <StatCard
          icon={PackageMinus}
          tom={baixasMes.pecas > 0 ? "warning" : "secondary"}
          rotulo="Baixas no mês (perda/descarte)"
          valor={baixasMes.pecas}
          sufixo=" peças"
          apoio={`${baixasMes.lancamentos} lançamento${baixasMes.lancamentos !== 1 ? "s" : ""} · custo de reposição`}
        />
        <StatCard
          icon={Boxes}
          tom="secondary"
          rotulo="Patrimônio total"
          valor={patrimonio}
          sufixo=" peças"
          apoio={`${itens.length} ${itens.length === 1 ? "item" : "itens"} cadastrados`}
        />
      </div>

      {/* Cadastro / edição */}
      {(cadastrando || editando) && podeEditar && (
        <FormItem
          item={editando}
          onFechar={() => {
            setCadastrando(false);
            setEditando(null);
          }}
        />
      )}

      {/* Lista por categoria */}
      {itens.length === 0 ? (
        <EmptyState label="Nenhum item de enxoval cadastrado." />
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.categoria} className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
              <div className="space-y-2">
                {g.itens.map((item) => (
                  <ItemEnxoval
                    key={item.id}
                    item={item}
                    podeEditar={podeEditar}
                    onEditar={() => setEditando(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Últimos movimentos */}
      <HistoricoMovimentos />
    </div>
  );
}

// ─── Item de enxoval (com ações de movimento) ────────────────────────────────

function ItemEnxoval({
  item,
  podeEditar,
  onEditar,
}: {
  item: Enxoval;
  podeEditar: boolean;
  onEditar: () => void;
}) {
  const remover = useRemoverEnxovalItem();
  const [acao, setAcao] = useState<EnxovalMovimentoTipo | null>(null);
  const [confirmarRemover, setConfirmarRemover] = useState(false);
  const baixo = abaixoDoMinimo(item);

  return (
    <Card className={cn(baixo && "border-destructive/40 bg-destructive/5")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-secondary">{item.descricao}</span>
              {baixo && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="size-3" /> Abaixo do mínimo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Atualizado em {formatarDataHoraBR(item.atualizado_em)}
              {item.observacao ? ` · ${item.observacao}` : ""}
            </p>
          </div>

          {/* Números: total / disponível / mínimo / em circulação */}
          <div className="flex flex-wrap items-center gap-4 text-center">
            <Numero rotulo="Total" valor={item.quantidade_total} />
            <Numero
              rotulo="Disponível"
              valor={item.quantidade_disponivel}
              destaque={baixo ? "destructive" : "success"}
            />
            <Numero rotulo="Mínimo" valor={item.estoque_minimo} suave />
            <Numero rotulo="Em uso" valor={emCirculacao(item)} suave />
          </div>
        </div>

        {/* Ações (apenas quem edita) */}
        {podeEditar && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              variant={acao === "entrada" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setAcao((a) => (a === "entrada" ? null : "entrada"))}
            >
              <PackagePlus className="size-4" /> Entrada
            </Button>
            <Button
              variant={acao === "baixa_perda" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setAcao((a) => (a === "baixa_perda" ? null : "baixa_perda"))}
            >
              <PackageMinus className="size-4" /> Baixa por perda
            </Button>
            <Button
              variant={acao === "ajuste" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setAcao((a) => (a === "ajuste" ? null : "ajuste"))}
            >
              <SlidersHorizontal className="size-4" /> Ajuste
            </Button>
            <div className="ml-auto flex gap-1.5">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={onEditar}>
                <Pencil className="size-3.5" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={() => setConfirmarRemover(true)}
              >
                <Trash2 className="size-3.5" /> Remover
              </Button>
            </div>
          </div>
        )}

        {acao && podeEditar && (
          <FormMovimento item={item} tipo={acao} onFechar={() => setAcao(null)} />
        )}
      </CardContent>

      <ConfirmDialog
        aberto={confirmarRemover}
        titulo="Remover item de enxoval?"
        descricao={`"${item.descricao}" e seus movimentos serão removidos. Para registrar perda/descarte, use "Baixa por perda".`}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          setConfirmarRemover(false);
          try {
            await remover.mutateAsync(item.id);
            toast.success("Item removido.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
          }
        }}
        onCancelar={() => setConfirmarRemover(false)}
      />
    </Card>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
  suave,
}: {
  rotulo: string;
  valor: number;
  destaque?: "destructive" | "success";
  suave?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-xl font-extrabold leading-none tabular-nums",
          destaque === "destructive" && "text-destructive",
          destaque === "success" && "text-success",
          !destaque && (suave ? "text-muted-foreground" : "text-secondary"),
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
    </div>
  );
}

// ─── Form de movimento (entrada / baixa / ajuste) ────────────────────────────

function FormMovimento({
  item,
  tipo,
  onFechar,
}: {
  item: Enxoval;
  tipo: EnxovalMovimentoTipo;
  onFechar: () => void;
}) {
  const mov = useMovimentoEnxoval();
  const ajuste = tipo === "ajuste";
  const [valor, setValor] = useState(ajuste ? String(item.quantidade_disponivel) : "1");
  const [motivo, setMotivo] = useState(tipo === "entrada" ? "compra/reposição" : "");

  const num = Math.max(0, Math.floor(Number(valor) || 0));
  const motivoObrigatorio = tipo === "baixa_perda";
  const valido =
    (ajuste || num > 0) && (!motivoObrigatorio || motivo.trim().length > 0);

  async function submit() {
    if (!valido) {
      toast.error(motivoObrigatorio ? "Informe o motivo da baixa." : "Informe uma quantidade válida.");
      return;
    }
    try {
      await mov.mutateAsync({
        enxovalId: item.id,
        tipo,
        valor: num,
        motivo: motivo.trim() || null,
      });
      toast.success(`${MOVIMENTO_ENXOVAL_LABEL[tipo]} registrada.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    }
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3",
        tipo === "entrada" && "border-success/40 bg-success/5",
        tipo === "baixa_perda" && "border-destructive/40 bg-destructive/5",
        tipo === "ajuste" && "border-primary/30 bg-primary/5",
      )}
    >
      <p className="text-sm font-semibold text-secondary">{MOVIMENTO_ENXOVAL_LABEL[tipo]}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-secondary">
            {ajuste ? "Nova contagem de disponível (limpas)" : "Quantidade de peças"}
          </span>
          <input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={inputBase}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-secondary">
            Motivo {motivoObrigatorio && <span className="text-destructive">*</span>}
          </span>
          {tipo === "baixa_perda" ? (
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputBase}>
              <option value="">Selecione…</option>
              <option value="peça danificada">Peça danificada</option>
              <option value="extraviada">Extraviada</option>
              <option value="desgaste/descarte">Desgaste/descarte</option>
              <option value="outro">Outro</option>
            </select>
          ) : (
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "ajuste" ? "acerto de inventário" : "compra/reposição"}
              className={inputBase}
            />
          )}
        </label>
      </div>
      {ajuste && (
        <p className="text-xs text-muted-foreground">
          Acerto da contagem de peças limpas (reflete o que voltou da lavagem / saiu para uso).
          O patrimônio total não muda.
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={!valido || mov.isPending}>
          <Check className="size-4" /> {mov.isPending ? "Salvando…" : "Confirmar"}
        </Button>
        <Button size="sm" variant="outline" onClick={onFechar} disabled={mov.isPending}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Form de cadastro / edição de item ───────────────────────────────────────

function FormItem({ item, onFechar }: { item: Enxoval | null; onFechar: () => void }) {
  const salvar = useSalvarEnxovalItem();
  const editando = !!item;
  const [categoria, setCategoria] = useState<EnxovalCategoria>(item?.categoria ?? "roupa_cama");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [total, setTotal] = useState(item ? String(item.quantidade_total) : "0");
  const [minimo, setMinimo] = useState(item ? String(item.estoque_minimo) : "0");
  const [observacao, setObservacao] = useState(item?.observacao ?? "");

  const totalNum = Math.max(0, Math.floor(Number(total) || 0));
  const minimoNum = Math.max(0, Math.floor(Number(minimo) || 0));
  const valido = descricao.trim().length > 0 && minimoNum >= 0 && (editando || totalNum >= 0);

  async function submit() {
    if (!valido) {
      toast.error("Informe a descrição do item.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: item?.id,
        categoria,
        descricao: descricao.trim(),
        estoqueMinimo: minimoNum,
        observacao: observacao.trim() || null,
        quantidadeTotal: editando ? undefined : totalNum,
      });
      toast.success(editando ? "Item atualizado." : "Item cadastrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{editando ? "Editar item" : "Novo item de enxoval"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Categoria</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as EnxovalCategoria)}
              className={inputBase}
            >
              {CATEGORIAS_ENXOVAL.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Descrição</span>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Lençol casal branco"
              className={inputBase}
            />
          </label>
          {!editando && (
            <label className="space-y-1">
              <span className="text-xs font-semibold text-secondary">Quantidade total (patrimônio)</span>
              <input type="number" min={0} value={total} onChange={(e) => setTotal(e.target.value)} className={inputBase} />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Estoque mínimo</span>
            <input type="number" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-secondary">Observação (opcional)</span>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className={inputBase}
            />
          </label>
        </div>
        {editando && (
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            As quantidades (total e disponível) mudam pelos movimentos: Entrada, Baixa por perda e Ajuste.
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!valido || salvar.isPending}>
            <Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Histórico de movimentos (compacto) ──────────────────────────────────────

function HistoricoMovimentos() {
  const movimentos = useMovimentosEnxoval();
  const enxoval = useEnxoval();
  const lista = (movimentos.data ?? []).slice(0, 12);
  if (lista.length === 0) return null;

  const nomePorId = new Map((enxoval.data ?? []).map((i) => [i.id, i.descricao]));

  const tom: Record<EnxovalMovimentoTipo, "success" | "destructive" | "muted"> = {
    entrada: "success",
    baixa_perda: "destructive",
    ajuste: "muted",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Últimos movimentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {lista.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tom[m.tipo]} className="text-xs">
                {MOVIMENTO_ENXOVAL_LABEL[m.tipo]}
              </Badge>
              <span className="font-medium text-secondary">
                {ouNaoInformado(nomePorId.get(m.enxoval_id) ?? null)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {m.tipo === "ajuste" ? "" : m.tipo === "entrada" ? "+" : "−"}
                {Math.abs(m.quantidade)} peças
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {ouNaoInformado(m.motivo)} · {formatarDataHoraBR(m.registrado_em)} ·{" "}
              {ouNaoInformado(m.registrado_por)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
