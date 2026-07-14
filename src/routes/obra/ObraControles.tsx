import { useState, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Zap, FlaskConical, BookText, ShieldAlert, FileWarning, FilePlus2, Plus, X, Upload,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra } from "@/hooks/useObra";
import {
  useInsumos, useEnsaios, useDiario, useNaoConformidades, useDocumentosObra, useAditivos,
  useAtualizarInsumo, useCriarEnsaio, useRegistrarResultadoEnsaio, useCriarDiario,
  useCriarNC, useAtualizarNC, useCriarDocumentoObra, useCriarAditivo,
} from "@/hooks/useObraTransversais";
import { nivelPrazo, type NivelPrazo } from "@/lib/obraFinanceiro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraInsumoCritico, ObraNaoConformidade } from "@/types/database";

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SEMAFORO: Record<NivelPrazo, string> = { ok: "bg-success", atencao: "bg-warning", critico: "bg-destructive", neutro: "bg-muted-foreground/40" };
const NC_STATUS: Record<string, "destructive" | "warning" | "default" | "success"> = { aberta: "destructive", em_correcao: "warning", reinspecao: "default", encerrada: "success" };
const NC_PROXIMO: Record<string, "em_correcao" | "reinspecao" | "encerrada"> = { aberta: "em_correcao", em_correcao: "reinspecao", reinspecao: "encerrada" };

export function ObraControles() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";
  const insumos = useInsumos();
  if (insumos.isLoading) return <LoadingState />;
  return (
    <div className="space-y-6 pb-8">
      <InsumosCriticos podeEditar={podeEditar} />
      <Ensaios podeEditar={podeEditar} />
      <NaoConformidades podeEditar={podeEditar} />
      <DocumentosObra podeEditar={podeEditar} />
      <Aditivos podeEditar={podeEditar} />
      <Diario podeEditar={podeEditar} />
    </div>
  );
}

function Secao({ titulo, icone, acao, children }: { titulo: string; icone: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <Card><CardContent className="space-y-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">{icone} {titulo}</h2>{acao}
      </div>{children}
    </CardContent></Card>
  );
}

function ModalBase({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

// ── Insumos críticos ────────────────────────────────────────────────────────
function InsumosCriticos({ podeEditar }: { podeEditar: boolean }) {
  const insumos = useInsumos();
  const [editar, setEditar] = useState<ObraInsumoCritico | null>(null);
  const hoje = hojeISO();
  return (
    <Secao titulo="Insumos críticos do Contratante" icone={<Zap className="size-5 text-primary" />}>
      <div className="divide-y">
        {(insumos.data ?? []).map((i) => {
          const nivel: NivelPrazo = i.status === "ok" ? "ok" : nivelPrazo(i.prazo_limite, hoje, 30);
          return (
            <button key={i.id} onClick={() => podeEditar && setEditar(i)} className={cn("flex w-full items-center gap-3 py-2.5 text-left", podeEditar && "hover:bg-muted/20")}>
              <span className={cn("size-3 shrink-0 rounded-full", SEMAFORO[nivel])} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-secondary">{i.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {i.dependencia}
                  {i.responsavel ? ` · ${i.responsavel}` : ""}
                  {i.prazo_limite ? ` · limite ${formatarDataBR(i.prazo_limite)}` : ""}
                </p>
              </div>
              <Badge variant={i.status === "ok" ? "success" : i.status === "em_andamento" ? "warning" : "muted"}>{i.status}</Badge>
            </button>
          );
        })}
      </div>
      {editar && <ModalInsumo insumo={editar} onFechar={() => setEditar(null)} />}
    </Secao>
  );
}
function ModalInsumo({ insumo, onFechar }: { insumo: ObraInsumoCritico; onFechar: () => void }) {
  const atualizar = useAtualizarInsumo();
  const [responsavel, setResponsavel] = useState(insumo.responsavel ?? "");
  const [prazo, setPrazo] = useState(insumo.prazo_limite ?? "");
  const [status, setStatus] = useState(insumo.status);
  async function salvar() {
    try { await atualizar.mutateAsync({ id: insumo.id, responsavel: responsavel || null, prazoLimite: prazo || null, status }); toast.success("Atualizado."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <ModalBase titulo={insumo.nome} onFechar={onFechar}>
      <p className="mb-3 text-sm text-muted-foreground">{insumo.dependencia}</p>
      <div className="space-y-3">
        <label className="block space-y-1"><span className="text-sm text-secondary">Responsável</span><input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputBase} /></label>
        <label className="block space-y-1"><span className="text-sm text-secondary">Prazo-limite</span><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={inputBase} /></label>
        <label className="block space-y-1"><span className="text-sm text-secondary">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputBase}>
            <option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="ok">OK</option>
          </select></label>
        <Button className="w-full" onClick={salvar} loading={atualizar.isPending}>Salvar</Button>
      </div>
    </ModalBase>
  );
}

// ── Ensaios ───────────────────────────────────────────────────────────────
function Ensaios({ podeEditar }: { podeEditar: boolean }) {
  const ensaios = useEnsaios();
  const fases = useFasesObra();
  const criar = useCriarEnsaio();
  const resultado = useRegistrarResultadoEnsaio();
  const [novo, setNovo] = useState(false);
  const hoje = hojeISO();

  async function registrar(id: string, r: "conforme" | "nao_conforme") {
    try { await resultado.mutateAsync({ id, resultado: r }); toast.success("Resultado registrado."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <Secao titulo="Ensaios / controle tecnológico" icone={<FlaskConical className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Agendar</Button>}>
      {(ensaios.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ensaio agendado.</p> : (
        <div className="divide-y">
          {(ensaios.data ?? []).map((e) => {
            const atrasado = e.resultado === "pendente" && e.data_agendada && e.data_agendada < hoje;
            return (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  {e.resultado === "pendente" && <span className={cn("size-3 rounded-full", atrasado ? "bg-destructive" : "bg-warning")} />}
                  <div>
                    <p className="font-semibold text-secondary">{e.tipo}{e.referencia ? ` · ${e.referencia}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{e.data_agendada ? `agendado ${formatarDataBR(e.data_agendada)}` : "sem data"}{atrasado ? " · ATRASADO" : ""}</p>
                  </div>
                </div>
                {e.resultado === "pendente" && podeEditar ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={resultado.isPending} onClick={() => registrar(e.id, "conforme")}>Conforme</Button>
                    <Button size="sm" variant="destructive" disabled={resultado.isPending} onClick={() => registrar(e.id, "nao_conforme")}>Não conforme</Button>
                  </div>
                ) : e.resultado === "pendente" ? <Badge variant="warning">aguardando resultado</Badge> : <Badge variant={e.resultado === "conforme" ? "success" : "destructive"}>{e.resultado === "conforme" ? "Conforme" : "Não conforme"}</Badge>}
              </div>
            );
          })}
        </div>
      )}
      {novo && (
        <FormModal titulo="Agendar ensaio" onFechar={() => setNovo(false)} onSalvar={async (v) => {
          await criar.mutateAsync({ tipo: v.tipo, referencia: v.referencia || null, fase_id: v.faseId || null, data_agendada: v.data || null });
        }} campos={[
          { key: "tipo", label: "Tipo (ex.: corpo de prova de concreto)", tipo: "text", req: true },
          { key: "referencia", label: "Referência (concretagem/local)", tipo: "text" },
          { key: "data", label: "Data agendada", tipo: "date" },
          { key: "faseId", label: "Fase", tipo: "fase", fases: fases.data ?? [] },
        ]} pending={criar.isPending} />
      )}
    </Secao>
  );
}

// ── Não-conformidades ────────────────────────────────────────────────────
function NaoConformidades({ podeEditar }: { podeEditar: boolean }) {
  const ncs = useNaoConformidades();
  const criar = useCriarNC();
  const atualizar = useAtualizarNC();
  const [nova, setNova] = useState(false);

  async function avancar(nc: ObraNaoConformidade) {
    const prox = NC_PROXIMO[nc.status];
    if (!prox) return;
    try { await atualizar.mutateAsync({ id: nc.id, status: prox }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  async function reinspecao(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await atualizar.mutateAsync({ id, status: "reinspecao", fotoReinspecao: file }); toast.success("Reinspeção anexada."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha."); }
  }
  const abertas = (ncs.data ?? []).filter((n) => n.status !== "encerrada").length;
  return (
    <Secao titulo="Não-conformidades" icone={<ShieldAlert className="size-5 text-primary" />} acao={
      <div className="flex items-center gap-2">{abertas > 0 && <Badge variant="destructive">{abertas} aberta(s)</Badge>}{podeEditar && <Button size="sm" onClick={() => setNova(true)}><Plus className="size-4" /> Apontar</Button>}</div>
    }>
      {(ncs.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma NC registrada.</p> : (
        <div className="divide-y">
          {(ncs.data ?? []).map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-secondary">{n.descricao}</span>
                  <Badge variant={NC_STATUS[n.status]}>{n.status}</Badge>
                  {n.etapa_id && <Badge variant="warning">bloqueia etapa</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{n.responsavel ? `${n.responsavel} · ` : ""}{n.prazo ? `prazo ${formatarDataBR(n.prazo)}` : "sem prazo"} · origem {n.origem}</p>
              </div>
              {podeEditar && n.status !== "encerrada" && (
                <div className="flex gap-1">
                  {n.status === "em_correcao" && (
                    <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs font-semibold text-primary hover:bg-accent"><Upload className="mr-1 inline size-3.5" />Reinspeção<input type="file" accept="image/*" className="hidden" onChange={(e) => reinspecao(n.id, e)} /></label>
                  )}
                  <Button size="sm" variant="outline" disabled={atualizar.isPending} onClick={() => avancar(n)}>
                    {n.status === "aberta" ? "Iniciar correção" : n.status === "em_correcao" ? "Enviar p/ reinspeção" : "Encerrar"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {nova && (
        <FormModal titulo="Nova não-conformidade" onFechar={() => setNova(false)} onSalvar={async (v) => {
          await criar.mutateAsync({ descricao: v.descricao, responsavel: v.responsavel, prazo: v.prazo || null });
        }} campos={[
          { key: "descricao", label: "Descrição do apontamento", tipo: "text", req: true },
          { key: "responsavel", label: "Responsável", tipo: "text" },
          { key: "prazo", label: "Prazo", tipo: "date" },
        ]} pending={criar.isPending} />
      )}
    </Secao>
  );
}

// ── Documentos da obra ────────────────────────────────────────────────────
function DocumentosObra({ podeEditar }: { podeEditar: boolean }) {
  const docs = useDocumentosObra();
  const criar = useCriarDocumentoObra();
  const [novo, setNovo] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const hoje = hojeISO();
  return (
    <Secao titulo="Documentos da obra" icone={<FileWarning className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Adicionar</Button>}>
      {(docs.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento da obra.</p> : (
        <div className="divide-y">
          {(docs.data ?? []).map((d) => {
            const nivel = nivelPrazo(d.data_validade, hoje, 30);
            return (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("size-3 shrink-0 rounded-full", SEMAFORO[nivel])} />
                <div className="min-w-0 flex-1"><p className="font-semibold text-secondary">{d.nome} <span className="text-xs text-muted-foreground">({d.tipo})</span></p>
                  <p className="text-xs text-muted-foreground">{d.identificador ? `${d.identificador} · ` : ""}{d.data_validade ? `vence ${formatarDataBR(d.data_validade)}` : "sem vencimento"}</p></div>
                {nivel === "critico" && <Badge variant="destructive">vencido</Badge>}
                {nivel === "atencao" && <Badge variant="warning">vence em breve</Badge>}
              </div>
            );
          })}
        </div>
      )}
      {novo && (
        <FormModal titulo="Documento da obra" onFechar={() => { setNovo(false); setArquivo(null); }} extra={
          <label className="block cursor-pointer text-sm font-semibold text-primary hover:underline"><Upload className="mr-1 inline size-4" />{arquivo ? "Arquivo selecionado" : "Anexar arquivo"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></label>
        } onSalvar={async (v) => {
          await criar.mutateAsync({ tipo: v.tipo || "outro", nome: v.nome, identificador: v.identificador, dataValidade: v.validade || null, arquivo });
        }} campos={[
          { key: "nome", label: "Nome (ex.: Alvará de construção)", tipo: "text", req: true },
          { key: "tipo", label: "Tipo", tipo: "select", opcoes: [
            { value: "alvara", label: "Alvará" },
            { value: "art", label: "ART" },
            { value: "cno_inss", label: "CNO / INSS da obra" },
            { value: "apolice", label: "Apólice de seguro" },
            { value: "licenca_ambiental", label: "Licença ambiental" },
            { value: "outro", label: "Outro" },
          ] },
          { key: "identificador", label: "Nº / protocolo", tipo: "text" },
          { key: "validade", label: "Validade", tipo: "date" },
        ]} pending={criar.isPending} />
      )}
    </Secao>
  );
}

// ── Aditivos ──────────────────────────────────────────────────────────────
function Aditivos({ podeEditar }: { podeEditar: boolean }) {
  const aditivos = useAditivos();
  const fases = useFasesObra();
  const criar = useCriarAditivo();
  const [novo, setNovo] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  return (
    <Secao titulo="Aditivos" icone={<FilePlus2 className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Registrar</Button>}>
      {(aditivos.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aditivo registrado.</p> : (
        <div className="divide-y">
          {(aditivos.data ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><p className="font-semibold text-secondary">{a.numero ? `${a.numero} · ` : ""}{a.descricao} <Badge variant="muted">{a.tipo}</Badge></p>
                <p className="text-xs text-muted-foreground">
                  {(a.valor_delta ?? 0) !== 0 ? `${formatarMoeda(a.valor_delta ?? 0)} · ` : ""}
                  {(a.prazo_delta_dias ?? 0) !== 0 ? `${a.prazo_delta_dias}d · ` : ""}
                  {a.data_assinatura ? `assinado ${formatarDataBR(a.data_assinatura)}` : "sem assinatura"}
                </p></div>
              {a.pdf_url && <Badge variant="success">PDF</Badge>}
            </div>
          ))}
        </div>
      )}
      {novo && (
        <FormModal titulo="Novo aditivo" onFechar={() => { setNovo(false); setPdf(null); }} extra={
          <label className="block cursor-pointer text-sm font-semibold text-primary hover:underline"><Upload className="mr-1 inline size-4" />{pdf ? "PDF selecionado" : "Anexar PDF assinado"}<input type="file" accept="application/pdf" className="hidden" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} /></label>
        } onSalvar={async (v) => {
          await criar.mutateAsync({ numero: v.numero, tipo: (v.tipo as "escopo" | "valor" | "prazo" | "misto") || "misto", descricao: v.descricao, valorDelta: v.valor ? parseFloat(v.valor.replace(",", ".")) : 0, prazoDeltaDias: v.prazo ? parseInt(v.prazo, 10) : 0, faseId: v.faseId || null, pdf, dataAssinatura: v.assinatura || null });
        }} campos={[
          { key: "numero", label: "Número do aditivo", tipo: "text" },
          { key: "descricao", label: "O que muda (escopo)", tipo: "text", req: true },
          { key: "tipo", label: "Tipo", tipo: "select", opcoes: [
            { value: "misto", label: "Misto (valor + prazo)" },
            { value: "escopo", label: "Escopo" },
            { value: "valor", label: "Valor" },
            { value: "prazo", label: "Prazo" },
          ] },
          { key: "valor", label: "Mudança de valor (R$, se houver)", tipo: "text" },
          { key: "prazo", label: "Mudança de prazo (dias, se houver)", tipo: "text" },
          { key: "assinatura", label: "Data de assinatura", tipo: "date" },
          { key: "faseId", label: "Fase", tipo: "fase", fases: fases.data ?? [] },
        ]} pending={criar.isPending} />
      )}
    </Secao>
  );
}

// ── Diário ────────────────────────────────────────────────────────────────
function Diario({ podeEditar }: { podeEditar: boolean }) {
  const diario = useDiario();
  const criar = useCriarDiario();
  const [novo, setNovo] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  return (
    <Secao titulo="Diário de obra" icone={<BookText className="size-5 text-primary" />} acao={podeEditar && <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Novo registro</Button>}>
      {(diario.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem registros.</p> : (
        <div className="divide-y">
          {(diario.data ?? []).slice(0, 20).map((d) => (
            <div key={d.id} className="py-2.5">
              <p className="text-xs font-semibold text-muted-foreground">{formatarDataBR(d.data)}{d.registrado_por ? ` · ${d.registrado_por}` : ""}</p>
              <p className="text-sm text-secondary">{d.ocorrencias}</p>
            </div>
          ))}
        </div>
      )}
      {novo && (
        <FormModal titulo="Registro do diário" onFechar={() => { setNovo(false); setFoto(null); }} extra={
          <label className="block cursor-pointer text-sm font-semibold text-primary hover:underline"><Upload className="mr-1 inline size-4" />{foto ? "Foto selecionada" : "Foto (semanal)"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} /></label>
        } onSalvar={async (v) => { await criar.mutateAsync({ data: v.data || hojeISO(), ocorrencias: v.ocorrencias, foto }); }} campos={[
          { key: "data", label: "Data", tipo: "date" },
          { key: "ocorrencias", label: "Ocorrências", tipo: "text", req: true },
        ]} pending={criar.isPending} />
      )}
    </Secao>
  );
}

// ── Form genérico reutilizável ──────────────────────────────────────────────
type Campo = { key: string; label: string; tipo: "text" | "date" | "fase" | "select"; req?: boolean; fases?: { id: string; nome: string }[]; opcoes?: { value: string; label: string }[] };
function FormModal({ titulo, campos, onSalvar, onFechar, pending, extra }: {
  titulo: string; campos: Campo[]; onSalvar: (v: Record<string, string>) => Promise<void>; onFechar: () => void; pending: boolean; extra?: ReactNode;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  async function salvar() {
    for (const c of campos) if (c.req && !(v[c.key] ?? "").trim()) { toast.error(`Preencha: ${c.label}`); return; }
    try { await onSalvar(v); toast.success("Salvo."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }
  return (
    <ModalBase titulo={titulo} onFechar={onFechar}>
      <div className="space-y-3">
        {campos.map((c) => (
          <label key={c.key} className="block space-y-1">
            <span className="text-sm text-secondary">{c.label}{c.req ? " *" : ""}</span>
            {c.tipo === "fase" ? (
              <select value={v[c.key] ?? ""} onChange={(e) => setV((p) => ({ ...p, [c.key]: e.target.value }))} className={inputBase}>
                <option value="">— Sem fase —</option>{(c.fases ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            ) : c.tipo === "select" ? (
              <select value={v[c.key] ?? (c.opcoes?.[0]?.value ?? "")} onChange={(e) => setV((p) => ({ ...p, [c.key]: e.target.value }))} className={inputBase}>
                {(c.opcoes ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={c.tipo} value={v[c.key] ?? ""} onChange={(e) => setV((p) => ({ ...p, [c.key]: e.target.value }))} className={inputBase} />
            )}
          </label>
        ))}
        {extra}
        <Button className="w-full" onClick={salvar} loading={pending}>Salvar</Button>
      </div>
    </ModalBase>
  );
}
