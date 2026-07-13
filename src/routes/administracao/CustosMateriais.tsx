/**
 * Custos de materiais (limpeza e manutenção) — Administração/Direção.
 * Lançamento de despesas em duas categorias separadas, com subtotais e total.
 * Alimenta o RESULTADO do mês (useResumoMes.custoMateriais) — fonte única.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Paperclip,
  SprayCan,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useCustosMateriaisDoMes,
  useSalvarCustoMaterial,
  useRemoverCustoMaterial,
} from "@/hooks/useCustosMateriais";
import { AnexoSeguro } from "@/components/AnexoSeguro";
import { BUCKET_CUSTOS_MATERIAIS } from "@/lib/storage";
import { formatarMoeda, mesAtual, deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { hojeISO, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import { exportarCustosMateriaisExcel } from "@/lib/exportCustosMateriais";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import type { CategoriaMaterial, CustoMaterial } from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
const CATEGORIAS: { value: CategoriaMaterial; label: string; icon: typeof SprayCan }[] = [
  { value: "limpeza", label: "Limpeza", icon: SprayCan },
  { value: "manutencao", label: "Manutenção", icon: Wrench },
];
const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CustosMateriais() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const [mes, setMes] = useState(mesAtual());
  const [form, setForm] = useState<{ aberto: boolean; editar: CustoMaterial | null }>({ aberto: false, editar: null });
  const lista = useCustosMateriaisDoMes(mes);
  const remover = useRemoverCustoMaterial();
  const [aRemover, setARemover] = useState<CustoMaterial | null>(null);

  const itens = useMemo(() => lista.data ?? [], [lista.data]);
  const limpeza = itens.filter((m) => m.categoria === "limpeza");
  const manutencao = itens.filter((m) => m.categoria === "manutencao");
  const subtotalLimpeza = limpeza.reduce((s, m) => s + m.valor, 0);
  const subtotalManut = manutencao.reduce((s, m) => s + m.valor, 0);
  const total = subtotalLimpeza + subtotalManut;

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (lista.isLoading) return <LoadingState />;
  if (lista.isError) return <ErrorState error={lista.error} />;

  async function exportar() {
    const ok = await exportarCustosMateriaisExcel(itens, mes);
    if (ok) toast.success("Custos exportados em Excel.");
    else toast.error("Não foi possível exportar.");
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Boxes className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Custos de materiais</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMes((m) => deslocarMes(m, -1))} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted"><ChevronLeft className="size-4" /></button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-secondary">{formatarMesReferencia(mes)}</span>
          <button onClick={() => setMes((m) => deslocarMes(m, 1))} disabled={mes >= mesAtual()} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      {/* Subtotais */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={SprayCan} tom="secondary" rotulo="Limpeza" valor={formatarMoeda(subtotalLimpeza)} apoio={`${limpeza.length} lançamento(s)`} />
        <StatCard icon={Wrench} tom="secondary" rotulo="Manutenção" valor={formatarMoeda(subtotalManut)} apoio={`${manutencao.length} lançamento(s)`} />
        <StatCard icon={Boxes} tom="primary" destaque rotulo="Total do mês" valor={formatarMoeda(total)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setForm({ aberto: true, editar: null })} className="gap-2"><Plus className="size-4" /> Lançar despesa</Button>
        <Button variant="outline" onClick={exportar} className="gap-2" disabled={itens.length === 0}><Download className="size-4" /> Excel</Button>
      </div>

      {(form.aberto) && (
        <FormMaterial mes={mes} editar={form.editar} onFechar={() => setForm({ aberto: false, editar: null })} />
      )}

      {/* Listas por categoria */}
      {itens.length === 0 ? (
        <EmptyState label="Nenhuma despesa de material neste mês." />
      ) : (
        <div className="space-y-6">
          {CATEGORIAS.map((cat) => {
            const linhas = itens.filter((m) => m.categoria === cat.value);
            if (linhas.length === 0) return null;
            const sub = linhas.reduce((s, m) => s + m.valor, 0);
            return (
              <Card key={cat.value}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <cat.icon className="size-4 text-secondary" /> {cat.label}
                  </CardTitle>
                  <Badge variant="muted">{formatarMoeda(sub)}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {linhas.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-secondary">{m.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatarDataBR(m.data)} · {ouNaoInformado(m.fornecedor)}
                          {m.comprovante_url && (
                            <AnexoSeguro bucket={BUCKET_CUSTOS_MATERIAIS} stored={m.comprovante_url}>
                              {(url) => (
                                <a href={url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                                  <Paperclip className="size-3" /> comprovante
                                </a>
                              )}
                            </AnexoSeguro>
                          )}
                        </p>
                      </div>
                      <span className="font-bold tabular-nums text-secondary">{formatarMoeda(m.valor)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setForm({ aberto: true, editar: m })}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => setARemover(m)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        aberto={!!aRemover}
        titulo="Remover despesa?"
        descricao={aRemover ? `"${aRemover.descricao}" (${formatarMoeda(aRemover.valor)}) será removida.` : ""}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const m = aRemover;
          setARemover(null);
          if (!m) return;
          try {
            await remover.mutateAsync({ id: m.id, mes });
            toast.success("Despesa removida.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
          }
        }}
        onCancelar={() => setARemover(null)}
      />
    </div>
  );
}

function FormMaterial({ mes, editar, onFechar }: { mes: string; editar: CustoMaterial | null; onFechar: () => void }) {
  const salvar = useSalvarCustoMaterial();
  const [categoria, setCategoria] = useState<CategoriaMaterial>(editar?.categoria ?? "limpeza");
  const [descricao, setDescricao] = useState(editar?.descricao ?? "");
  const [valor, setValor] = useState(editar ? String(editar.valor) : "");
  const [fornecedor, setFornecedor] = useState(editar?.fornecedor ?? "");
  const [data, setData] = useState(editar?.data ?? hojeISO());
  const [comprovante, setComprovante] = useState<File | null>(null);

  const valorNum = Number(valor.replace(",", "."));
  const valido = descricao.trim().length > 0 && Number.isFinite(valorNum) && valorNum >= 0;

  async function submit() {
    if (!valido) {
      toast.error("Informe a descrição e um valor válido.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: editar?.id,
        categoria,
        descricao: descricao.trim(),
        valor: valorNum,
        fornecedor: fornecedor.trim() || null,
        data,
        mesReferencia: mes,
        comprovante,
      });
      toast.success(editar ? "Despesa atualizada." : "Despesa lançada.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{editar ? "Editar despesa" : "Lançar despesa de material"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Categoria</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMaterial)} className={inputBase}>
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Valor (R$)</span>
            <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-secondary">Descrição</span>
            <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Detergente, desinfetante…" className={inputBase} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Fornecedor (opcional)</span>
            <input type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-secondary">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary"><Paperclip className="size-3.5" /> Comprovante (opcional)</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!valido || salvar.isPending}><Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}><X className="size-4" /> Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
