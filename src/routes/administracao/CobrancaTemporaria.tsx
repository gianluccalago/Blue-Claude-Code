/**
 * Precificação e cobrança de TEMPORÁRIOS (curta permanência / day care).
 * Administração/Direção e Master. A precificação é ABERTA/manual — o sistema só
 * SUGERE a partir da tabela de referência (baliza); o valor final é livre.
 * As cobranças entram no demonstrativo e no faturamento (useResumoMes).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  CircleDollarSign,
  Table2,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentes, useFrequentadoresDayCare } from "@/hooks/usePlanos";
import {
  useTabelaDiaria,
  useSalvarReferenciaDiaria,
  valorReferencia,
  useCobrancasTemporariasDoMes,
  useSalvarCobrancaTemporaria,
  useDefinirStatusCobranca,
  useRemoverCobrancaTemporaria,
} from "@/hooks/useCobrancaTemporaria";
import { formatarMoeda, mesAtual, deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { hojeISO, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import { MODALIDADE_LABEL } from "@/lib/modalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { SeloModalidade } from "@/components/SeloModalidade";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import type { CobrancaTemporaria, ModalidadeTemporaria, Residente, TabelaDiaria } from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CobrancaTemporaria() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEditarRef = perfil === "direcao" || perfil === "master";

  const [mes, setMes] = useState(mesAtual());
  const residentes = useResidentes();
  const dayCare = useFrequentadoresDayCare();
  const tabela = useTabelaDiaria();
  const cobrancas = useCobrancasTemporariasDoMes(mes);

  const temporarios = useMemo(() => {
    const curta = (residentes.data ?? []).filter((r) => r.modalidade === "curta_permanencia");
    return [...curta, ...(dayCare.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [residentes.data, dayCare.data]);

  const porResidente = useMemo(() => {
    const m = new Map<string, CobrancaTemporaria[]>();
    for (const c of cobrancas.data ?? []) {
      const arr = m.get(c.residente_id) ?? [];
      arr.push(c);
      m.set(c.residente_id, arr);
    }
    return m;
  }, [cobrancas.data]);

  const totais = useMemo(() => {
    const lista = cobrancas.data ?? [];
    const total = lista.reduce((s, c) => s + c.valor, 0);
    const pago = lista.filter((c) => c.status === "pago").reduce((s, c) => s + c.valor, 0);
    return { total, pago, pendente: total - pago };
  }, [cobrancas.data]);

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (residentes.isLoading || dayCare.isLoading || tabela.isLoading || cobrancas.isLoading) return <LoadingState />;
  const erro = residentes.error ?? dayCare.error ?? tabela.error ?? cobrancas.error;
  if (erro) return <ErrorState error={erro} />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Receipt className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Cobrança de temporários</h1>
            <p className="text-sm text-muted-foreground">Curta permanência e day care · diária/pacote (valor livre)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMes((m) => deslocarMes(m, -1))} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted"><ChevronLeft className="size-4" /></button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-secondary">{formatarMesReferencia(mes)}</span>
          <button onClick={() => setMes((m) => deslocarMes(m, 1))} disabled={mes >= mesAtual()} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      {/* Totais do mês */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CircleDollarSign} tom="primary" destaque rotulo="Cobranças do mês" valor={formatarMoeda(totais.total)} />
        <StatCard icon={Check} tom="success" rotulo="Pago" valor={formatarMoeda(totais.pago)} />
        <StatCard icon={Receipt} tom={totais.pendente > 0 ? "warning" : "secondary"} rotulo="Pendente" valor={formatarMoeda(totais.pendente)} />
      </div>

      {/* Tabela de REFERÊNCIA (baliza; edita Master/Direção) */}
      <TabelaReferencia tabela={tabela.data ?? []} podeEditar={podeEditarRef} />

      {/* Cobranças por hóspede temporário */}
      {temporarios.length === 0 ? (
        <EmptyState label="Nenhum hóspede temporário (curta permanência ou day care) ativo." />
      ) : (
        <div className="space-y-3">
          {temporarios.map((r) => (
            <CardTemporario
              key={r.id}
              residente={r}
              mes={mes}
              cobrancas={porResidente.get(r.id) ?? []}
              referencia={valorReferencia(tabela.data ?? [], r.modalidade as ModalidadeTemporaria, r.grau_dependencia)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A tabela é só referência — pacotes e combinações são livres (não tabelados). As cobranças entram no
        demonstrativo do hóspede e no faturamento do mês.
      </p>
    </div>
  );
}

// ─── Tabela de referência ────────────────────────────────────────────────────

function TabelaReferencia({ tabela, podeEditar }: { tabela: TabelaDiaria[]; podeEditar: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Table2 className="size-4 text-secondary" /> Tabela de referência (baliza)
          {!podeEditar && <span className="text-xs font-normal text-muted-foreground">· leitura</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tabela.length === 0 ? (
          <EmptyState label="Tabela de referência não cadastrada." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {tabela.map((t) => (
              <LinhaReferencia key={t.id} t={t} podeEditar={podeEditar} />
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Valores orientativos por modalidade × grau. A cobrança real é lançada aberta.</p>
      </CardContent>
    </Card>
  );
}

function LinhaReferencia({ t, podeEditar }: { t: TabelaDiaria; podeEditar: boolean }) {
  const salvar = useSalvarReferenciaDiaria();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(t.valor_referencia));

  async function handleSalvar() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Valor inválido.");
      return;
    }
    try {
      await salvar.mutateAsync({ id: t.id, valorReferencia: n, observacao: t.observacao });
      toast.success("Referência atualizada.");
      setEditando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary">
          {MODALIDADE_LABEL[t.modalidade]} · Grau {t.grau}
        </p>
        <p className="text-xs text-muted-foreground">{t.tipo_valor === "diaria" ? "por diária" : "por período (tarde)"}</p>
      </div>
      {editando ? (
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="h-9 w-28 rounded-md border border-input bg-card px-2 text-sm" />
          <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}><Check className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)}><X className="size-4" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-bold tabular-nums text-secondary">{formatarMoeda(t.valor_referencia)}</span>
          {podeEditar && (
            <Button size="sm" variant="ghost" onClick={() => { setValor(String(t.valor_referencia)); setEditando(true); }}>
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cobranças de um hóspede temporário ──────────────────────────────────────

function CardTemporario({
  residente: r,
  mes,
  cobrancas,
  referencia,
}: {
  residente: Residente;
  mes: string;
  cobrancas: CobrancaTemporaria[];
  referencia: number | null;
}) {
  const status = useDefinirStatusCobranca();
  const remover = useRemoverCobrancaTemporaria();
  const [form, setForm] = useState<{ aberto: boolean; editar: CobrancaTemporaria | null }>({ aberto: false, editar: null });
  const [aRemover, setARemover] = useState<CobrancaTemporaria | null>(null);

  const total = cobrancas.reduce((s, c) => s + c.valor, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-secondary">{r.nome}</span>
            <SeloModalidade modalidade={r.modalidade} />
            {r.grau_dependencia && <Badge variant="muted">Grau {r.grau_dependencia}</Badge>}
            {r.data_fim_prevista && <span className="text-xs text-muted-foreground">até {formatarDataBR(r.data_fim_prevista)}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums text-secondary">{formatarMoeda(total)}</span>
            <Button size="sm" onClick={() => setForm({ aberto: true, editar: null })} className="gap-1"><Plus className="size-4" /> Cobrança</Button>
          </div>
        </div>

        {cobrancas.length > 0 && (
          <div className="space-y-1.5">
            {cobrancas.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-secondary">{c.descricao}</p>
                  <p className="text-xs text-muted-foreground">{formatarDataBR(c.data)} · {ouNaoInformado(c.registrado_por)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums text-secondary">{formatarMoeda(c.valor)}</span>
                  <button
                    onClick={() => status.mutate({ id: c.id, mes, pago: c.status !== "pago" })}
                    className="cursor-pointer"
                    title="Alternar pago/pendente"
                  >
                    {c.status === "pago" ? <Badge variant="success">Pago</Badge> : <Badge variant="warning">Pendente</Badge>}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ aberto: true, editar: c })}><Pencil className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setARemover(c)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {form.aberto && (
          <FormCobranca
            residente={r}
            mes={mes}
            editar={form.editar}
            referencia={referencia}
            onFechar={() => setForm({ aberto: false, editar: null })}
          />
        )}
      </CardContent>

      <ConfirmDialog
        aberto={!!aRemover}
        titulo="Remover cobrança?"
        descricao={aRemover ? `"${aRemover.descricao}" (${formatarMoeda(aRemover.valor)}) será removida.` : ""}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const c = aRemover;
          setARemover(null);
          if (!c) return;
          try {
            await remover.mutateAsync({ id: c.id, mes });
            toast.success("Cobrança removida.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
          }
        }}
        onCancelar={() => setARemover(null)}
      />
    </Card>
  );
}

function FormCobranca({
  residente: r,
  mes,
  editar,
  referencia,
  onFechar,
}: {
  residente: Residente;
  mes: string;
  editar: CobrancaTemporaria | null;
  referencia: number | null;
  onFechar: () => void;
}) {
  const salvar = useSalvarCobrancaTemporaria();
  const [descricao, setDescricao] = useState(editar?.descricao ?? "");
  const [valor, setValor] = useState(editar ? String(editar.valor) : "");
  const [data, setData] = useState(editar?.data ?? hojeISO());

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
        residenteId: r.id,
        modalidade: r.modalidade as ModalidadeTemporaria,
        descricao: descricao.trim(),
        valor: valorNum,
        periodoReferencia: mes,
        data,
      });
      toast.success(editar ? "Cobrança atualizada." : "Cobrança lançada.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold text-secondary">Descrição</span>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={r.modalidade === "day_care" ? "Ex.: Day Care — pacote 3ª e 5ª (mês)" : "Ex.: Curta permanência 12 dias — pós-operatório"}
            className={inputBase}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-secondary">Valor (R$)</span>
          <input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inputBase} />
          {referencia != null && (
            <button
              type="button"
              onClick={() => setValor(String(referencia))}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Referência: {formatarMoeda(referencia)}{r.modalidade === "day_care" ? "/período" : "/diária"} — usar como base
            </button>
          )}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-secondary">Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Período de referência: <strong>{formatarMesReferencia(mes)}</strong>. O valor é livre — a referência é só sugestão.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={!valido || salvar.isPending}><Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}</Button>
        <Button size="sm" variant="outline" onClick={onFechar}><X className="size-4" /> Cancelar</Button>
      </div>
    </div>
  );
}
