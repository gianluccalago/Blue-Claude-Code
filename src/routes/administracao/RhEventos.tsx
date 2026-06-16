/**
 * RH — Eventos de pessoal (CAPTURA). Administração/Direção e Master.
 * Três seções: ausências, afastamentos e desligamentos dos profissionais.
 *
 * Estes registros ALIMENTARÃO os painéis de RH (turnover, absenteísmo, cobertura
 * de escala) no próximo bloco — aqui é só a coleta.
 *
 * PRIVACIDADE: o afastamento guarda APENAS o GRUPO do CID (categoria), nunca o
 * diagnóstico — dado SENSÍVEL de saúde do funcionário. Acesso restrito à gestão
 * (RLS reforça: Administração/Direção/Master).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users2,
  CalendarOff,
  HeartPulse,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useProfissionaisRH,
  useAusenciasDoMes,
  useSalvarAusencia,
  useRemoverAusencia,
  useAfastamentosDoMes,
  useSalvarAfastamento,
  useRemoverAfastamento,
  useDesligamentosDoMes,
  useSalvarDesligamento,
  useRemoverDesligamento,
} from "@/hooks/useRh";
import {
  TIPOS_AUSENCIA,
  TIPO_AUSENCIA_LABEL,
  MOTIVOS_DESLIGAMENTO,
  MOTIVO_DESLIGAMENTO_LABEL,
  GRUPOS_CID,
  diasEntre,
  tempoCasaMeses,
  formatarTempoCasa,
} from "@/lib/rh";
import { mesAtual, deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { hojeISO, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import type {
  MotivoDesligamento,
  RhAfastamento,
  RhAusencia,
  RhDesligamento,
  TipoAusencia,
  Usuario,
} from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RhEventos() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const profissionais = useProfissionaisRH();

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (profissionais.isLoading) return <LoadingState />;
  if (profissionais.isError) return <ErrorState error={profissionais.error} />;

  const lista = profissionais.data ?? [];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Users2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">RH — Eventos de pessoal</h1>
          <p className="text-sm text-muted-foreground">Ausências, afastamentos e desligamentos · base para turnover/absenteísmo/cobertura</p>
        </div>
      </div>

      <Tabs defaultValue="ausencias">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="ausencias" className="gap-1.5"><CalendarOff className="size-4" /> Ausências</TabsTrigger>
          <TabsTrigger value="afastamentos" className="gap-1.5"><HeartPulse className="size-4" /> Afastamentos</TabsTrigger>
          <TabsTrigger value="desligamentos" className="gap-1.5"><UserMinus className="size-4" /> Desligamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="ausencias" className="mt-4"><SecaoAusencias profissionais={lista} /></TabsContent>
        <TabsContent value="afastamentos" className="mt-4"><SecaoAfastamentos profissionais={lista} /></TabsContent>
        <TabsContent value="desligamentos" className="mt-4"><SecaoDesligamentos profissionais={lista} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Utilitários compartilhados ───────────────────────────────────────────────

function MesNav({ mes, setMes }: { mes: string; setMes: (f: (m: string) => string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setMes((m) => deslocarMes(m, -1))} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted"><ChevronLeft className="size-4" /></button>
      <span className="min-w-[140px] text-center text-sm font-semibold text-secondary">{formatarMesReferencia(mes)}</span>
      <button onClick={() => setMes((m) => deslocarMes(m, 1))} disabled={mes >= mesAtual()} className="grid size-9 place-items-center rounded-md border border-input bg-card hover:bg-muted disabled:opacity-40"><ChevronRight className="size-4" /></button>
    </div>
  );
}

function ProfSelect({ profissionais, value, onChange }: { profissionais: Usuario[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputBase}>
      <option value="">Selecione o profissional…</option>
      {profissionais.map((p) => (
        <option key={p.id} value={p.id}>{p.nome}{p.funcao ? ` · ${p.funcao}` : ""}{p.sem_acesso ? " (sem acesso)" : ""}</option>
      ))}
    </select>
  );
}

function nomeProf(profissionais: Usuario[], id: string): string {
  return profissionais.find((p) => p.id === id)?.nome ?? "Não informado";
}

function Cabecalho({ titulo, onNovo, children }: { titulo: string; onNovo: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">{children}</div>
      <Button onClick={onNovo} className="gap-2"><Plus className="size-4" /> {titulo}</Button>
    </div>
  );
}

// ─── Seção AUSÊNCIAS ──────────────────────────────────────────────────────────

function SecaoAusencias({ profissionais }: { profissionais: Usuario[] }) {
  const [mes, setMes] = useState(mesAtual());
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoAusencia>("todos");
  const [form, setForm] = useState<{ aberto: boolean; editar: RhAusencia | null }>({ aberto: false, editar: null });
  const [aRemover, setARemover] = useState<RhAusencia | null>(null);
  const q = useAusenciasDoMes(mes);
  const remover = useRemoverAusencia();

  const itens = useMemo(
    () => (q.data ?? []).filter((a) => filtroTipo === "todos" || a.tipo === filtroTipo),
    [q.data, filtroTipo],
  );

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} />;

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Nova ausência" onNovo={() => setForm({ aberto: true, editar: null })}>
        <MesNav mes={mes} setMes={setMes} />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
          <option value="todos">Todos os tipos</option>
          {TIPOS_AUSENCIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Cabecalho>

      {form.aberto && <FormAusencia profissionais={profissionais} editar={form.editar} onFechar={() => setForm({ aberto: false, editar: null })} />}

      {itens.length === 0 ? (
        <EmptyState label="Nenhuma ausência neste mês/filtro." />
      ) : (
        <div className="space-y-2">
          {itens.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{nomeProf(profissionais, a.profissional_id)}</span>
                    <Badge variant="muted">{TIPO_AUSENCIA_LABEL[a.tipo]}</Badge>
                    {a.gerou_cobertura && <Badge variant="warning">Gerou cobertura</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatarDataBR(a.data_inicio)} a {formatarDataBR(a.data_fim)} · {a.dias} dia{a.dias !== 1 ? "s" : ""}
                    {a.observacao ? ` · ${a.observacao}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setForm({ aberto: true, editar: a })}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setARemover(a)}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        aberto={!!aRemover}
        titulo="Remover ausência?"
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const a = aRemover; setARemover(null);
          if (!a) return;
          try { await remover.mutateAsync(a.id); toast.success("Ausência removida."); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao remover."); }
        }}
        onCancelar={() => setARemover(null)}
      />
    </div>
  );
}

function FormAusencia({ profissionais, editar, onFechar }: { profissionais: Usuario[]; editar: RhAusencia | null; onFechar: () => void }) {
  const salvar = useSalvarAusencia();
  const [profissionalId, setProfissionalId] = useState(editar?.profissional_id ?? "");
  const [tipo, setTipo] = useState<TipoAusencia>(editar?.tipo ?? "atestado");
  const [dataInicio, setDataInicio] = useState(editar?.data_inicio ?? hojeISO());
  const [dataFim, setDataFim] = useState(editar?.data_fim ?? hojeISO());
  const [dias, setDias] = useState(editar ? String(editar.dias) : String(diasEntre(hojeISO(), hojeISO())));
  const [gerouCobertura, setGerouCobertura] = useState(editar?.gerou_cobertura ?? false);
  const [observacao, setObservacao] = useState(editar?.observacao ?? "");

  function sincronizarDias(ini: string, fim: string) { setDias(String(diasEntre(ini, fim))); }
  const valido = !!profissionalId && !!dataInicio && !!dataFim;

  async function submit() {
    if (!valido) { toast.error("Selecione o profissional e o período."); return; }
    try {
      await salvar.mutateAsync({
        id: editar?.id, profissionalId, tipo, dataInicio, dataFim,
        dias: Math.max(1, parseInt(dias, 10) || 1), gerouCobertura, observacao: observacao.trim() || null,
      });
      toast.success(editar ? "Ausência atualizada." : "Ausência registrada.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Profissional</span><ProfSelect profissionais={profissionais} value={profissionalId} onChange={setProfissionalId} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAusencia)} className={inputBase}>
              {TIPOS_AUSENCIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Dias</span><input type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} className={inputBase} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Início</span><input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); sincronizarDias(e.target.value, dataFim); }} className={inputBase} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Fim</span><input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); sincronizarDias(dataInicio, e.target.value); }} className={inputBase} /></label>
          <label className="flex items-center gap-2 text-sm font-medium text-secondary sm:col-span-2"><input type="checkbox" checked={gerouCobertura} onChange={(e) => setGerouCobertura(e.target.checked)} className="size-4 rounded border-input" /> Precisou cobrir o plantão (gerou cobertura)</label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Observação (opcional)</span><input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} /></label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={!valido || salvar.isPending}><Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button size="sm" variant="outline" onClick={onFechar}><X className="size-4" /> Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Seção AFASTAMENTOS ───────────────────────────────────────────────────────

function SecaoAfastamentos({ profissionais }: { profissionais: Usuario[] }) {
  const [mes, setMes] = useState(mesAtual());
  const [form, setForm] = useState<{ aberto: boolean; editar: RhAfastamento | null }>({ aberto: false, editar: null });
  const [aRemover, setARemover] = useState<RhAfastamento | null>(null);
  const q = useAfastamentosDoMes(mes);
  const remover = useRemoverAfastamento();

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} />;
  const itens = q.data ?? [];

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Novo afastamento" onNovo={() => setForm({ aberto: true, editar: null })}>
        <MesNav mes={mes} setMes={setMes} />
      </Cabecalho>

      <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5 shrink-0 text-warning" /> Dado sensível de saúde: registra-se só o GRUPO do CID, nunca o diagnóstico. Acesso restrito à gestão.
      </div>

      {form.aberto && <FormAfastamento profissionais={profissionais} editar={form.editar} onFechar={() => setForm({ aberto: false, editar: null })} />}

      {itens.length === 0 ? (
        <EmptyState label="Nenhum afastamento neste mês." />
      ) : (
        <div className="space-y-2">
          {itens.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{nomeProf(profissionais, a.profissional_id)}</span>
                    {a.cid_grupo && <Badge variant="muted">{a.cid_grupo}</Badge>}
                    {!a.data_fim && <Badge variant="warning">Em aberto</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatarDataBR(a.data_inicio)}{a.data_fim ? ` a ${formatarDataBR(a.data_fim)}` : ""} · {a.dias_perdidos} dia(s) perdidos
                    {a.observacao ? ` · ${a.observacao}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setForm({ aberto: true, editar: a })}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setARemover(a)}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        aberto={!!aRemover}
        titulo="Remover afastamento?"
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const a = aRemover; setARemover(null);
          if (!a) return;
          try { await remover.mutateAsync(a.id); toast.success("Afastamento removido."); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao remover."); }
        }}
        onCancelar={() => setARemover(null)}
      />
    </div>
  );
}

function FormAfastamento({ profissionais, editar, onFechar }: { profissionais: Usuario[]; editar: RhAfastamento | null; onFechar: () => void }) {
  const salvar = useSalvarAfastamento();
  const [profissionalId, setProfissionalId] = useState(editar?.profissional_id ?? "");
  const [dataInicio, setDataInicio] = useState(editar?.data_inicio ?? hojeISO());
  const [emAberto, setEmAberto] = useState(editar ? !editar.data_fim : false);
  const [dataFim, setDataFim] = useState(editar?.data_fim ?? hojeISO());
  const [diasPerdidos, setDiasPerdidos] = useState(editar ? String(editar.dias_perdidos) : "1");
  const [cidGrupo, setCidGrupo] = useState(editar?.cid_grupo ?? "");
  const [observacao, setObservacao] = useState(editar?.observacao ?? "");

  const valido = !!profissionalId && !!dataInicio;

  async function submit() {
    if (!valido) { toast.error("Selecione o profissional e o início."); return; }
    try {
      await salvar.mutateAsync({
        id: editar?.id, profissionalId, dataInicio,
        dataFim: emAberto ? null : dataFim,
        diasPerdidos: Math.max(0, parseInt(diasPerdidos, 10) || 0),
        cidGrupo: cidGrupo || null, observacao: observacao.trim() || null,
      });
      toast.success(editar ? "Afastamento atualizado." : "Afastamento registrado.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Profissional</span><ProfSelect profissionais={profissionais} value={profissionalId} onChange={setProfissionalId} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Início</span><input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); if (!emAberto) setDiasPerdidos(String(diasEntre(e.target.value, dataFim))); }} className={inputBase} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Dias perdidos</span><input type="number" min={0} value={diasPerdidos} onChange={(e) => setDiasPerdidos(e.target.value)} className={inputBase} /></label>
          <label className="flex items-center gap-2 text-sm font-medium text-secondary"><input type="checkbox" checked={emAberto} onChange={(e) => setEmAberto(e.target.checked)} className="size-4 rounded border-input" /> Ainda afastado (em aberto)</label>
          {!emAberto && (
            <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Fim</span><input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setDiasPerdidos(String(diasEntre(dataInicio, e.target.value))); }} className={inputBase} /></label>
          )}
          <label className="space-y-1 sm:col-span-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-secondary"><ShieldAlert className="size-3.5 text-warning" /> Grupo do CID (só a categoria — sensível)</span>
            <select value={cidGrupo} onChange={(e) => setCidGrupo(e.target.value)} className={inputBase}>
              <option value="">Não informado</option>
              {GRUPOS_CID.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Observação (opcional, sem diagnóstico)</span><input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} /></label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={!valido || salvar.isPending}><Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button size="sm" variant="outline" onClick={onFechar}><X className="size-4" /> Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Seção DESLIGAMENTOS ──────────────────────────────────────────────────────

function SecaoDesligamentos({ profissionais }: { profissionais: Usuario[] }) {
  const [mes, setMes] = useState(mesAtual());
  const [form, setForm] = useState<{ aberto: boolean; editar: RhDesligamento | null }>({ aberto: false, editar: null });
  const [aRemover, setARemover] = useState<RhDesligamento | null>(null);
  const q = useDesligamentosDoMes(mes);
  const remover = useRemoverDesligamento();

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} />;
  const itens = q.data ?? [];

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Novo desligamento" onNovo={() => setForm({ aberto: true, editar: null })}>
        <MesNav mes={mes} setMes={setMes} />
      </Cabecalho>

      {form.aberto && <FormDesligamento profissionais={profissionais} editar={form.editar} onFechar={() => setForm({ aberto: false, editar: null })} />}

      {itens.length === 0 ? (
        <EmptyState label="Nenhum desligamento neste mês." />
      ) : (
        <div className="space-y-2">
          {itens.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{nomeProf(profissionais, d.profissional_id)}</span>
                    <Badge variant="muted">{MOTIVO_DESLIGAMENTO_LABEL[d.motivo]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatarDataBR(d.data_desligamento)} · {ouNaoInformado(d.cargo)} · {formatarTempoCasa(d.tempo_casa_meses)} de casa
                    {d.observacao ? ` · ${d.observacao}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setForm({ aberto: true, editar: d })}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setARemover(d)}><Trash2 className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        aberto={!!aRemover}
        titulo="Remover desligamento?"
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const d = aRemover; setARemover(null);
          if (!d) return;
          try { await remover.mutateAsync(d.id); toast.success("Desligamento removido."); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao remover."); }
        }}
        onCancelar={() => setARemover(null)}
      />
    </div>
  );
}

function FormDesligamento({ profissionais, editar, onFechar }: { profissionais: Usuario[]; editar: RhDesligamento | null; onFechar: () => void }) {
  const salvar = useSalvarDesligamento();
  const [profissionalId, setProfissionalId] = useState(editar?.profissional_id ?? "");
  const [dataDesligamento, setDataDesligamento] = useState(editar?.data_desligamento ?? hojeISO());
  const [motivo, setMotivo] = useState<MotivoDesligamento>(editar?.motivo ?? "pedido_demissao_voluntario");
  const [cargo, setCargo] = useState(editar?.cargo ?? "");
  const [tempo, setTempo] = useState(editar?.tempo_casa_meses != null ? String(editar.tempo_casa_meses) : "");
  const [observacao, setObservacao] = useState(editar?.observacao ?? "");

  const prof = profissionais.find((p) => p.id === profissionalId);

  // Ao escolher profissional / data, pré-preenche cargo e tempo de casa (editável).
  function aoTrocarProf(id: string) {
    setProfissionalId(id);
    const p = profissionais.find((x) => x.id === id);
    if (p && !editar) {
      if (p.funcao) setCargo(p.funcao);
      const t = tempoCasaMeses(p.data_admissao, dataDesligamento);
      if (t != null) setTempo(String(t));
    }
  }
  function aoTrocarData(d: string) {
    setDataDesligamento(d);
    if (prof && !editar) {
      const t = tempoCasaMeses(prof.data_admissao, d);
      if (t != null) setTempo(String(t));
    }
  }

  const valido = !!profissionalId && !!dataDesligamento;

  async function submit() {
    if (!valido) { toast.error("Selecione o profissional e a data."); return; }
    try {
      await salvar.mutateAsync({
        id: editar?.id, profissionalId, dataDesligamento, motivo,
        cargo: cargo.trim() || null,
        tempoCasaMeses: tempo.trim() === "" ? null : Math.max(0, parseInt(tempo, 10) || 0),
        observacao: observacao.trim() || null,
      });
      toast.success(editar ? "Desligamento atualizado." : "Desligamento registrado.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Profissional</span><ProfSelect profissionais={profissionais} value={profissionalId} onChange={aoTrocarProf} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Data do desligamento</span><input type="date" value={dataDesligamento} onChange={(e) => aoTrocarData(e.target.value)} className={inputBase} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Motivo</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesligamento)} className={inputBase}>
              {MOTIVOS_DESLIGAMENTO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Cargo (snapshot)</span><input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputBase} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-secondary">Tempo de casa (meses)</span><input type="number" min={0} value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder={prof ? "calculado da admissão" : ""} className={inputBase} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-semibold text-secondary">Observação (opcional)</span><input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} /></label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={!valido || salvar.isPending}><Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button size="sm" variant="outline" onClick={onFechar}><X className="size-4" /> Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
