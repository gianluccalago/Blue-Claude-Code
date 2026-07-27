import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  HardHat, Bell, FileText, Landmark, Ruler, Upload, Check, AlertTriangle, X, ClipboardCheck,
  DraftingCompass, CircleDollarSign, TrendingUp, Package, Camera, MessageSquarePlus,
  PackageCheck, Wallet,
} from "lucide-react";
import { useFasesObra, useEtapasObra, useChecklistObra } from "@/hooks/useObra";
import { useMedicoes, useEtapasMedidas, useDocumentosMensais, useSubirDocumentoMensal, usePendencias } from "@/hooks/useObraMedicoes";
import { useMarcos, useDisciplinas, useBimRodadas, useRegistrarRodadaBim } from "@/hooks/useObraProjetos";
import { useSubmeterBM, useSubmeterEntrega, useNotificacoesObra, useMarcarNotificacaoLida } from "@/hooks/useObraPortal";
import { usePlanejamento, useConsumo, useCriarPlanejamento, useMarcarInsumoEntregue, useRegistrarConsumo } from "@/hooks/useObraMateriais";
import { useFotosAndamento, useEnviarFotosAndamento, useSolicitacoesObra, useCriarSolicitacaoObra } from "@/hooks/useObraColab";
import { ObraCronograma } from "@/routes/obra/ObraCronograma";
import { DiarioObra } from "@/routes/obra/DiarioObra";
import { FaturamentoPrestador } from "@/routes/obra/ObraNotasFiscais";
import { ultimaVerificacaoPorEtapa, etapaConcluida, avancoFisico, OBRA_FASE_STATUS_LABEL } from "@/lib/obra";
import { somarDiasISO, arred } from "@/lib/obraCalc";
import { FotoSegura } from "@/components/AnexoSeguro";
import { BUCKET_OBRA } from "@/lib/storage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import { formatarMesReferencia, formatarMoeda } from "@/lib/mensalidade";
import type { ObraDisciplina, ObraDisciplinaMarco, ObraFase } from "@/types/database";

// ===========================================================================
// PORTAL DA CONSTRUTORA (TRÍADE) — canal de TRABALHO em parceria, por abas:
//  Início        resumo do contrato de projetos + fases + pendências
//  Cronograma    o MESMO Gantt do Contratante (fases + atividades; sem custos)
//  Insumos       pedido de materiais com data ↔ nossa resposta com data;
//                recebimento em obra e baixa de uso (alimenta perdas/glosa)
//  Medições      valores medidos/retidos/pagos + submeter BM (inclusive
//                medição antecipada de etapas 100%)
//  Fotos         fotos do andamento do canteiro (visíveis dos dois lados)
//  Entregas      entregas de projeto R00/R01 + BIM + documentos do mês
//  Solicitações  pedidos gerais com resposta do Contratante
// Financeiro do Contratante (cotações, OCs, preços, indiretos) segue oculto.
// ===========================================================================

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DOC_TIPOS = ["inss", "fgts", "iss", "folha"] as const;
const DOC_LABEL: Record<string, string> = { inss: "Guia INSS", fgts: "Guia FGTS", iss: "Guia ISS", folha: "Folha de pagamento" };
const MED_VARIANTE: Record<string, "muted" | "warning" | "default" | "destructive" | "success"> = {
  Pendente: "muted", "Em análise": "warning", Aprovado: "default", Reprovado: "destructive", Pago: "success",
};
const CATEGORIAS_INSUMO = [
  { value: "concreto", label: "Concreto" }, { value: "aco", label: "Aço" },
  { value: "blocos", label: "Blocos" }, { value: "ceramicos", label: "Cerâmicos" },
  { value: "tintas", label: "Tintas" }, { value: "demais", label: "Demais" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIAS_INSUMO.map((c) => [c.value, c.label]));
const ATEND_BADGE: Record<string, { label: string; variante: "warning" | "default" | "success" | "destructive" | "muted" }> = {
  solicitado: { label: "aguardando resposta", variante: "warning" },
  programado: { label: "programado", variante: "default" },
  comprado: { label: "comprado", variante: "default" },
  entregue: { label: "entregue", variante: "success" },
  negado: { label: "negado", variante: "destructive" },
};
const SOLIC_BADGE: Record<string, { label: string; variante: "warning" | "default" | "success" | "destructive" }> = {
  aberta: { label: "aberta", variante: "warning" },
  em_atendimento: { label: "em atendimento", variante: "default" },
  concluida: { label: "concluída", variante: "success" },
  negada: { label: "negada", variante: "destructive" },
};
const SOLIC_TIPO_LABEL: Record<string, string> = { geral: "Geral", insumo: "Insumos", medicao: "Medição" };

export function PortalPrestador() {
  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const medicoes = useMedicoes();
  const documentos = useDocumentosMensais();
  const pendencias = usePendencias();
  const notificacoes = useNotificacoesObra();

  const [submeterBM, setSubmeterBM] = useState(false);

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist.data ?? []), [checklist.data]);

  if (fases.isLoading || etapas.isLoading || medicoes.isLoading) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaFases = fases.data ?? [];
  const emAndamento = listaFases.find((f) => f.status === "em_andamento");
  const naoLidas = (notificacoes.data ?? []).filter((n) => !n.lida);
  const listaMed = medicoes.data ?? [];

  // Resumo financeiro da MO (valores DELES, das medições).
  const validas = listaMed.filter((m) => m.status !== "Reprovado");
  const medidoBruto = arred(validas.reduce((s, m) => s + m.valor_bruto, 0));
  const retidoAcum = arred(validas.reduce((s, m) => s + m.retencao_valor, 0));
  const pagoLiquido = arred(listaMed.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor_liquido, 0));
  const aReceberLiquido = arred(listaMed.filter((m) => m.status === "Aprovado").reduce((s, m) => s + m.valor_liquido, 0));

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><HardHat className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Portal da obra — TRÍADE</h1>
          <p className="text-xs text-muted-foreground">Cronograma · diário · insumos · medições · fotos · entregas · solicitações.</p>
        </div>
      </div>

      {/* Avisos (sempre visíveis, acima das abas) */}
      {naoLidas.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-secondary"><Bell className="size-4 text-warning" /> Avisos</h3>
            {naoLidas.map((n) => <NotifLinha key={n.id} id={n.id} titulo={n.titulo} corpo={n.corpo} quando={n.criado_em} />)}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="inicio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inicio">Início</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="medicoes">Medições & NF</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="entregas">Entregas & Docs</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
        </TabsList>

        {/* ── INÍCIO ── */}
        <TabsContent value="inicio" className="space-y-5">
          <ContratoProjetosPrestador />

          {/* Fases físicas */}
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Ruler className="size-5 text-primary" /> Obra física — fases</h2>
                {emAndamento && <Button size="sm" onClick={() => setSubmeterBM(true)}><ClipboardCheck className="size-4" /> Submeter medição</Button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {listaFases.map((f) => {
                  const av = avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa);
                  return (
                    <div key={f.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-secondary">{f.nome}</span>
                        <Badge variant="muted">{OBRA_FASE_STATUS_LABEL[f.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.modulos}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, av)}%` }} /></div>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">{av.toFixed(1)}% físico</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Pendências */}
          {(pendencias.data ?? []).length > 0 && (
            <Card>
              <CardContent className="space-y-1 p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><AlertTriangle className="size-5 text-warning" /> Pendências</h2>
                {(pendencias.data ?? []).map((p) => (
                  <p key={p.id} className={cn("text-sm", p.sanada ? "text-muted-foreground line-through" : "text-secondary")}>{p.descricao}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CRONOGRAMA (o mesmo Gantt do Contratante; RLS esconde custos) ── */}
        <TabsContent value="cronograma">
          <ObraCronograma />
        </TabsContent>

        {/* ── DIÁRIO DE OBRA (RDO compartilhado — cláusulas 13.2 e 6.4) ── */}
        <TabsContent value="diario">
          <DiarioObra />
        </TabsContent>

        {/* ── INSUMOS ── */}
        <TabsContent value="insumos">
          <AbaInsumosPrestador fases={listaFases} />
        </TabsContent>

        {/* ── MEDIÇÕES ── */}
        <TabsContent value="medicoes" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniKpi icone={<Ruler className="size-4" />} rotulo="Medido (bruto)" valor={formatarMoeda(medidoBruto)} />
            <MiniKpi icone={<Wallet className="size-4" />} rotulo="Recebido (líquido)" valor={formatarMoeda(pagoLiquido)} tom="success" />
            <MiniKpi icone={<CircleDollarSign className="size-4" />} rotulo="Aprovado — a receber" valor={formatarMoeda(aReceberLiquido)} tom={aReceberLiquido > 0 ? "warning" : "secondary"} />
            <MiniKpi icone={<Landmark className="size-4" />} rotulo="Retido (garantia 5%)" valor={formatarMoeda(retidoAcum)} />
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><FileText className="size-5 text-primary" /> Minhas medições</h2>
                {emAndamento && <Button size="sm" onClick={() => setSubmeterBM(true)}><ClipboardCheck className="size-4" /> Submeter medição</Button>}
              </div>
              <p className="text-xs text-muted-foreground">
                Etapas 100% concluídas podem ser medidas a qualquer momento — inclusive antes do fim do mês (medição antecipada). O pagamento ocorre em até 15 dias corridos após a aprovação.
              </p>
              {listaMed.length === 0 ? <EmptyState label="Nenhuma medição submetida." /> : (
                <div className="divide-y">
                  {listaMed.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-secondary">Medição de {formatarMesReferencia(m.mes)}</span>
                          <Badge variant={MED_VARIANTE[m.status]}>{m.status}</Badge>
                          <span className="text-xs tabular-nums text-muted-foreground">{m.percentual_medido}% medido</span>
                        </div>
                        {m.status === "Reprovado" && m.motivo && <p className="text-xs text-destructive">Reprovada: {m.motivo}</p>}
                      </div>
                      <div className="shrink-0 text-right text-xs tabular-nums">
                        <p className="font-semibold text-secondary">{formatarMoeda(m.valor_liquido)} líquido</p>
                        <p className="text-muted-foreground">{formatarMoeda(m.valor_bruto)} bruto · {formatarMoeda(m.retencao_valor)} retido</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Faturamento: janelas 1 e 11 · dados do tomador · aprovados → NF */}
          <FaturamentoPrestador />
        </TabsContent>

        {/* ── FOTOS DO ANDAMENTO ── */}
        <TabsContent value="fotos">
          <AbaFotosPrestador fases={listaFases} />
        </TabsContent>

        {/* ── ENTREGAS & DOCUMENTOS ── */}
        <TabsContent value="entregas" className="space-y-5">
          <ProjetosPrestador />
          <DocumentosPrestador documentos={documentos.data ?? []} />
        </TabsContent>

        {/* ── SOLICITAÇÕES ── */}
        <TabsContent value="solicitacoes">
          <AbaSolicitacoesPrestador />
        </TabsContent>
      </Tabs>

      {submeterBM && emAndamento && (
        <ModalSubmeterBM
          fase={emAndamento}
          etapasFase={(etapas.data ?? []).filter((e) => e.fase_id === emAndamento.id)}
          ultimaPorEtapa={ultimaPorEtapa}
          onFechar={() => setSubmeterBM(false)}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ABA INSUMOS — pedido com data ↔ resposta com data + recebimento + baixa.
// ───────────────────────────────────────────────────────────────────────────

function AbaInsumosPrestador({ fases }: { fases: ObraFase[] }) {
  const planejamento = usePlanejamento();
  const consumo = useConsumo();
  const criar = useCriarPlanejamento();
  const marcarEntregue = useMarcarInsumoEntregue();
  const registrarConsumo = useRegistrarConsumo();

  const [novoAberto, setNovoAberto] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);

  const pedidos = [...(planejamento.data ?? [])].sort((a, b) =>
    (a.data_necessidade ?? "9999").localeCompare(b.data_necessidade ?? "9999"),
  );
  const consumos = (consumo.data ?? []).slice(0, 12);
  const hoje = hojeISO();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Package className="size-5 text-primary" /> Pedidos de insumos</h2>
              <p className="text-xs text-muted-foreground">
                Peça com a data necessária (antecedência contratual: 45 dias úteis · 60 para aço/esquadrias/encomendas). Nós respondemos com a data prometida.
              </p>
            </div>
            <Button size="sm" onClick={() => setNovoAberto(true)}><Package className="size-4" /> Novo pedido</Button>
          </div>

          {pedidos.length === 0 ? (
            <EmptyState label="Nenhum pedido ainda — clique em Novo pedido para solicitar materiais." />
          ) : (
            <div className="divide-y">
              {pedidos.map((p) => {
                const badge = ATEND_BADGE[p.status_atendimento] ?? ATEND_BADGE.programado;
                const atrasado = p.status_atendimento !== "entregue" && p.status_atendimento !== "negado" && p.data_necessidade && p.data_necessidade < hoje;
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-secondary">{p.item}</span>
                        <Badge variant="muted">{CAT_LABEL[p.categoria] ?? p.categoria}</Badge>
                        <Badge variant={badge.variante}>{badge.label}</Badge>
                        {atrasado && <Badge variant="destructive">data vencida</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.quantidade_prevista} {p.unidade}
                        {p.data_necessidade ? ` · necessário em ${formatarDataBR(p.data_necessidade)}` : ""}
                        {p.data_prometida ? ` · prometido para ${formatarDataBR(p.data_prometida)}` : ""}
                        {p.data_entrega ? ` · recebido em ${formatarDataBR(p.data_entrega)}` : ""}
                      </p>
                      {p.resposta && <p className="text-xs text-primary-strong">Resposta: {p.resposta}</p>}
                      {p.observacao && <p className="text-xs text-muted-foreground">{p.observacao}</p>}
                    </div>
                    {(p.status_atendimento === "programado" || p.status_atendimento === "comprado") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => marcarEntregue.mutate({ id: p.id, dataEntrega: hoje }, {
                          onSuccess: () => toast.success("Recebimento registrado — obrigado por conferir!"),
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Falha."),
                        })}
                        disabled={marcarEntregue.isPending}
                      >
                        <PackageCheck className="size-4" /> Recebido em obra
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Baixa de uso */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><PackageCheck className="size-5 text-primary" /> Baixa de uso (consumo)</h2>
              <p className="text-xs text-muted-foreground">Registre o consumo de materiais em obra — mantém o controle de estoque e perdas em dia.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setBaixaAberta(true)}>Registrar baixa</Button>
          </div>
          {consumos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma baixa registrada ainda.</p>
          ) : (
            <div className="divide-y">
              {consumos.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><strong className="text-secondary">{c.item}</strong> <Badge variant="muted">{CAT_LABEL[c.categoria] ?? c.categoria}</Badge></span>
                  <span className="tabular-nums text-muted-foreground">{c.quantidade_consumida} {c.unidade} · {formatarDataBR(c.data_consumo)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {novoAberto && (
        <ModalPedidoInsumo
          fases={fases}
          salvando={criar.isPending}
          onSalvar={async (v) => {
            await criar.mutateAsync({
              categoria: v.categoria, item: v.item, unidade: v.unidade || "un",
              quantidade_prevista: v.quantidade, data_necessidade: v.dataNecessidade || null,
              fase_id: v.faseId || null, observacao: v.observacao || null,
              origem: "prestador", status_atendimento: "solicitado",
            });
            toast.success("Pedido enviado — vamos responder com a data prometida.");
            setNovoAberto(false);
          }}
          onFechar={() => setNovoAberto(false)}
        />
      )}
      {baixaAberta && (
        <ModalBaixaConsumo
          fases={fases}
          salvando={registrarConsumo.isPending}
          onSalvar={async (v) => {
            await registrarConsumo.mutateAsync({
              categoria: v.categoria, item: v.item, unidade: v.unidade || "un",
              quantidade_consumida: v.quantidade, fase_id: v.faseId || null,
            });
            toast.success("Baixa registrada.");
            setBaixaAberta(false);
          }}
          onFechar={() => setBaixaAberta(false)}
        />
      )}
    </div>
  );
}

type PedidoForm = { categoria: string; item: string; unidade: string; quantidade: number; dataNecessidade: string; faseId: string; observacao: string };

function ModalPedidoInsumo({ fases, salvando, onSalvar, onFechar }: {
  fases: ObraFase[]; salvando: boolean;
  onSalvar: (v: PedidoForm) => Promise<void>; onFechar: () => void;
}) {
  const [v, setV] = useState<PedidoForm>({ categoria: "demais", item: "", unidade: "un", quantidade: 0, dataNecessidade: "", faseId: "", observacao: "" });
  const set = <K extends keyof PedidoForm>(k: K, val: PedidoForm[K]) => setV((p) => ({ ...p, [k]: val }));
  const valido = v.item.trim() !== "" && v.quantidade > 0 && v.dataNecessidade !== "";

  async function salvar() {
    try { await onSalvar(v); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao enviar o pedido."); }
  }

  return (
    <ModalBasePortal titulo="Novo pedido de insumo" onFechar={onFechar}>
      <div className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Item *</span>
          <input value={v.item} onChange={(e) => set("item", e.target.value)} placeholder="Ex.: Cimento CP-II 50kg" className={inputBase} autoFocus /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Categoria</span>
            <select value={v.categoria} onChange={(e) => set("categoria", e.target.value)} className={inputBase}>
              {CATEGORIAS_INSUMO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Quantidade *</span>
            <input type="number" min={0} step="0.01" value={v.quantidade || ""} onChange={(e) => set("quantidade", parseFloat(e.target.value) || 0)} className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Unidade</span>
            <input value={v.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="un · m³ · sc" className={inputBase} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Necessário em obra em *</span>
            <input type="date" value={v.dataNecessidade} onChange={(e) => set("dataNecessidade", e.target.value)} className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Fase</span>
            <select value={v.faseId} onChange={(e) => set("faseId", e.target.value)} className={inputBase}>
              <option value="">— Geral —</option>
              {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select></label>
        </div>
        <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Observação</span>
          <input value={v.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Especificação, marca de referência…" className={inputBase} /></label>
      </div>
      <div className="mt-5 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button size="lg" className="flex-1" onClick={salvar} disabled={!valido || salvando} loading={salvando}>Enviar pedido</Button>
      </div>
    </ModalBasePortal>
  );
}

type BaixaForm = { categoria: string; item: string; unidade: string; quantidade: number; faseId: string };

function ModalBaixaConsumo({ fases, salvando, onSalvar, onFechar }: {
  fases: ObraFase[]; salvando: boolean;
  onSalvar: (v: BaixaForm) => Promise<void>; onFechar: () => void;
}) {
  const [v, setV] = useState<BaixaForm>({ categoria: "demais", item: "", unidade: "un", quantidade: 0, faseId: "" });
  const set = <K extends keyof BaixaForm>(k: K, val: BaixaForm[K]) => setV((p) => ({ ...p, [k]: val }));
  const valido = v.item.trim() !== "" && v.quantidade > 0;

  async function salvar() {
    try { await onSalvar(v); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao registrar."); }
  }

  return (
    <ModalBasePortal titulo="Baixa de uso de material" onFechar={onFechar}>
      <div className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Item *</span>
          <input value={v.item} onChange={(e) => set("item", e.target.value)} className={inputBase} autoFocus /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Categoria</span>
            <select value={v.categoria} onChange={(e) => set("categoria", e.target.value)} className={inputBase}>
              {CATEGORIAS_INSUMO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Quantidade *</span>
            <input type="number" min={0} step="0.01" value={v.quantidade || ""} onChange={(e) => set("quantidade", parseFloat(e.target.value) || 0)} className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Unidade</span>
            <input value={v.unidade} onChange={(e) => set("unidade", e.target.value)} className={inputBase} /></label>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Fase</span>
          <select value={v.faseId} onChange={(e) => set("faseId", e.target.value)} className={inputBase}>
            <option value="">— Geral —</option>
            {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select></label>
      </div>
      <div className="mt-5 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button size="lg" className="flex-1" onClick={salvar} disabled={!valido || salvando} loading={salvando}>Registrar baixa</Button>
      </div>
    </ModalBasePortal>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ABA FOTOS — andamento do canteiro (upload múltiplo + galeria).
// ───────────────────────────────────────────────────────────────────────────

function AbaFotosPrestador({ fases }: { fases: ObraFase[] }) {
  const fotos = useFotosAndamento();
  const enviar = useEnviarFotosAndamento();
  const [faseId, setFaseId] = useState("");
  const [descricao, setDescricao] = useState("");
  const nomeFase = new Map(fases.map((f) => [f.id, f.nome]));

  async function onArquivos(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    try {
      await enviar.mutateAsync({ fotos: files, faseId: faseId || null, descricao });
      toast.success(`${files.length} foto(s) enviada(s) — o Contratante já consegue ver.`);
      setDescricao("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Falha no upload."); }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Camera className="size-5 text-primary" /> Fotos do andamento</h2>
          <p className="text-xs text-muted-foreground">Anexe fotos do canteiro — elas aparecem na hora para o Contratante, com data e autor.</p>
        </div>

        <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_2fr_auto]">
          <select value={faseId} onChange={(e) => setFaseId(e.target.value)} className={cn(inputBase, "h-10")}>
            <option value="">Fase (opcional)</option>
            {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (ex.: Formas do bloco B concluídas)" className={cn(inputBase, "h-10")} />
          <label className={cn("inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-strong", enviar.isPending && "pointer-events-none opacity-60")}>
            <Upload className="size-4" /> {enviar.isPending ? "Enviando…" : "Enviar fotos"}
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={enviar.isPending} onChange={onArquivos} />
          </label>
        </div>

        {(fotos.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma foto ainda — envie a primeira do canteiro." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(fotos.data ?? []).map((f) => (
              <figure key={f.id} className="overflow-hidden rounded-lg border">
                <FotoSegura bucket={BUCKET_OBRA} stored={f.foto_url} alt={f.descricao ?? "Foto do andamento"} className="aspect-square w-full object-cover" />
                <figcaption className="space-y-0.5 bg-muted/30 px-2 py-1.5 text-[11px] leading-tight text-muted-foreground">
                  {f.descricao && <span className="block truncate font-medium text-secondary">{f.descricao}</span>}
                  <span className="block">
                    {formatarDataHoraBR(f.criado_em)}{f.fase_id ? ` · ${nomeFase.get(f.fase_id) ?? ""}` : ""}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ABA SOLICITAÇÕES — pedidos gerais com resposta do Contratante.
// ───────────────────────────────────────────────────────────────────────────

function AbaSolicitacoesPrestador() {
  const solicitacoes = useSolicitacoesObra();
  const criar = useCriarSolicitacaoObra();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"geral" | "insumo" | "medicao">("geral");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataDesejada, setDataDesejada] = useState("");

  async function salvar() {
    try {
      await criar.mutateAsync({ tipo, titulo, descricao, dataDesejada: dataDesejada || null });
      toast.success("Solicitação enviada ao Contratante.");
      setAberto(false); setTitulo(""); setDescricao(""); setDataDesejada(""); setTipo("geral");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao enviar."); }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><MessageSquarePlus className="size-5 text-primary" /> Solicitações ao Contratante</h2>
            <p className="text-xs text-muted-foreground">Medição antecipada, acordos, pedidos avulsos — registre aqui e acompanhe a resposta.</p>
          </div>
          <Button size="sm" onClick={() => setAberto(true)}><MessageSquarePlus className="size-4" /> Nova solicitação</Button>
        </div>

        {(solicitacoes.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma solicitação ainda." />
        ) : (
          <div className="divide-y">
            {(solicitacoes.data ?? []).map((s) => {
              const badge = SOLIC_BADGE[s.status] ?? SOLIC_BADGE.aberta;
              return (
                <div key={s.id} className="space-y-1 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{s.titulo}</span>
                    <Badge variant="muted">{SOLIC_TIPO_LABEL[s.tipo]}</Badge>
                    <Badge variant={badge.variante}>{badge.label}</Badge>
                    {s.data_desejada && <span className="text-xs tabular-nums text-muted-foreground">desejado p/ {formatarDataBR(s.data_desejada)}</span>}
                  </div>
                  {s.descricao && <p className="text-sm text-muted-foreground">{s.descricao}</p>}
                  {s.resposta && (
                    <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-secondary">
                      <span className="font-semibold">Resposta:</span> {s.resposta}
                      {s.respondido_em && <span className="text-xs text-muted-foreground"> · {formatarDataHoraBR(s.respondido_em)}</span>}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{formatarDataHoraBR(s.criado_em)}{s.registrado_por ? ` · ${s.registrado_por}` : ""}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {aberto && (
        <ModalBasePortal titulo="Nova solicitação" onFechar={() => setAberto(false)}>
          <div className="space-y-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Tipo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputBase}>
                <option value="geral">Geral</option>
                <option value="insumo">Insumos</option>
                <option value="medicao">Medição (ex.: antecipada)</option>
              </select></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Título *</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Medição antecipada — fundações 100%" className={inputBase} autoFocus /></label>
            <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Detalhes</span>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={cn(inputBase, "h-auto py-2")} /></label>
            <label className="block space-y-1"><span className="text-sm font-medium text-secondary">Data desejada</span>
              <input type="date" value={dataDesejada} onChange={(e) => setDataDesejada(e.target.value)} className={inputBase} /></label>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setAberto(false)} disabled={criar.isPending}>Cancelar</Button>
            <Button size="lg" className="flex-1" onClick={salvar} disabled={!titulo.trim() || criar.isPending} loading={criar.isPending}>Enviar</Button>
          </div>
        </ModalBasePortal>
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Peças compartilhadas do portal
// ───────────────────────────────────────────────────────────────────────────

function ModalBasePortal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-md animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NotifLinha({ id, titulo, corpo, quando }: { id: string; titulo: string; corpo: string | null; quando: string }) {
  const marcar = useMarcarNotificacaoLida();
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
      <div><p className="text-sm font-semibold text-secondary">{titulo}</p>{corpo && <p className="text-xs text-muted-foreground">{corpo}</p>}<p className="text-[11px] text-muted-foreground">{formatarDataHoraBR(quando)}</p></div>
      <button onClick={() => marcar.mutate(id)} className="text-xs font-semibold text-primary hover:underline">OK</button>
    </div>
  );
}

/**
 * CONTRATO DE PROJETOS — visão da construtora sobre o que é DELA:
 * progresso medido pelo Contratante por atividade, valores por marco
 * (entrada/R00/R01), o que já foi pago (com data) e o que vem a seguir.
 */
function ContratoProjetosPrestador() {
  const disciplinas = useDisciplinas();
  const marcos = useMarcos();
  const hoje = hojeISO();

  if (disciplinas.isLoading || marcos.isLoading) return null;
  const listaDisc = (disciplinas.data ?? [])
    .filter((d) => d.data_base)
    .sort((a, b) => a.data_base!.localeCompare(b.data_base!));
  if (listaDisc.length === 0) return null;

  const listaMarcos = marcos.data ?? [];
  const discPorId = new Map(listaDisc.map((d) => [d.id, d]));
  const marcosPorDisc = new Map<string, ObraDisciplinaMarco[]>();
  for (const m of listaMarcos) {
    const arr = marcosPorDisc.get(m.disciplina_id) ?? [];
    arr.push(m);
    marcosPorDisc.set(m.disciplina_id, arr);
  }
  const fimDe = (d: ObraDisciplina) => somarDiasISO(d.data_base, d.prazo_dias);

  const comValor = listaDisc.filter((d) => d.valor > 0);
  const totalContrato = arred(comValor.reduce((s, d) => s + d.valor, 0));
  const recebido = arred(listaMarcos.filter((m) => m.status === "Pago").reduce((s, m) => s + m.valor, 0));
  const aReceber = arred(listaMarcos.filter((m) => m.status === "Aprovado").reduce((s, m) => s + m.valor, 0));
  const progressoGeral = totalContrato > 0
    ? comValor.reduce((s, d) => s + d.valor * d.progresso_pct, 0) / totalContrato
    : 0;

  const previsaoDe = (m: ObraDisciplinaMarco): string | null => {
    const d = discPorId.get(m.disciplina_id);
    if (!d) return null;
    return m.chave === "inicio" ? d.data_base : fimDe(d);
  };
  const proximos = listaMarcos
    .filter((m) => m.status !== "Pago" && discPorId.get(m.disciplina_id))
    .map((m) => ({ m, d: discPorId.get(m.disciplina_id)!, prev: previsaoDe(m) }))
    .filter((x): x is typeof x & { prev: string } => !!x.prev)
    .sort((a, b) => a.prev.localeCompare(b.prev))
    .slice(0, 6);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <DraftingCompass className="size-5 text-primary" /> Contrato de projetos — andamento e pagamentos
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniKpi icone={<TrendingUp className="size-4" />} rotulo="Progresso geral (medido)" valor={`${progressoGeral.toFixed(1)}%`} />
          <MiniKpi icone={<CircleDollarSign className="size-4" />} rotulo={`Recebido de ${formatarMoeda(totalContrato)}`} valor={formatarMoeda(recebido)} tom="success" />
          <MiniKpi icone={<CircleDollarSign className="size-4" />} rotulo="Aprovado — a receber" valor={formatarMoeda(aReceber)} tom={aReceber > 0 ? "warning" : "secondary"} />
        </div>

        {proximos.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-secondary">Próximos recebimentos (previsão contratual)</p>
            <div className="divide-y">
              {proximos.map(({ m, d, prev }) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-secondary">{d.nome} · {m.rotulo}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {m.status === "Aprovado" ? <Badge variant="default">liberado</Badge>
                      : m.status === "Em análise" ? <Badge variant="warning">em análise</Badge>
                      : <span className={cn("text-xs tabular-nums", prev < hoje ? "font-semibold text-warning" : "text-muted-foreground")}>{formatarDataBR(prev)}</span>}
                    <strong className="tabular-nums text-secondary">{formatarMoeda(m.valor)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-sm font-semibold text-secondary">Suas atividades (progresso medido pelo Contratante)</p>
          <div className="divide-y">
            {listaDisc.map((d) => {
              const ms = (marcosPorDisc.get(d.id) ?? []).sort((a, b) => a.ordem - b.ordem);
              const pagos = ms.filter((m) => m.status === "Pago");
              const fim = fimDe(d);
              const concluida = d.progresso_pct >= 100;
              const atrasada = !concluida && fim != null && fim < hoje;
              return (
                <div key={d.id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-secondary">{d.nome}</span>
                      {concluida && <Badge variant="success">concluída</Badge>}
                      {atrasada && <Badge variant="destructive">prazo vencido</Badge>}
                      {d.valor === 0 && <Badge variant="muted">sem pagamento</Badge>}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {d.valor > 0 ? `${formatarMoeda(arred(pagos.reduce((s, m) => s + m.valor, 0)))} recebidos de ${formatarMoeda(d.valor)}` : ""}
                      {fim ? ` · até ${formatarDataBR(fim)}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">{d.progresso_pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "success" | "warning" }) {
  const cor = tom === "success" ? "text-success" : tom === "warning" ? "text-warning" : "text-secondary";
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div className="min-w-0">
        <p title={valor} className={cn("truncate text-base font-extrabold tabular-nums", cor)}>{valor}</p>
        <p className="truncate text-[11px] text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function DocumentosPrestador({ documentos }: { documentos: { mes: string; tipo: string }[] }) {
  const subir = useSubirDocumentoMensal();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const presentes = new Set(documentos.filter((d) => d.mes === mes).map((d) => d.tipo));

  async function onArquivo(tipo: (typeof DOC_TIPOS)[number], e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await subir.mutateAsync({ mes, tipo, arquivo: file }); toast.success(`${DOC_LABEL[tipo]} enviada.`); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar."); }
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Landmark className="size-5 text-primary" /> Documentos do mês</h2>
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            <Badge variant={presentes.size === 4 ? "success" : "warning"}>{presentes.size}/4</Badge>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOC_TIPOS.map((t) => {
            const ok = presentes.has(t);
            return (
              <div key={t} className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2", ok ? "border-success/40 bg-success/5" : "border-border")}>
                <span className="flex items-center gap-2 text-sm">{ok ? <Check className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}{DOC_LABEL[t]}</span>
                <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">{ok ? "Substituir" : "Enviar"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onArquivo(t, e)} /></label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjetosPrestador() {
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const bim = useBimRodadas();
  const submeter = useSubmeterEntrega();
  const registrarBim = useRegistrarRodadaBim();
  const [bimAberto, setBimAberto] = useState(false);

  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
  // Marcos que aguardam entrega do prestador.
  const aEntregar = (marcos.data ?? []).filter((m) => m.exige_entrega && (m.status === "Pendente" || m.status === "Reprovado"));
  const rodadas = bim.data ?? [];

  async function upload(marcoId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try { await submeter.mutateAsync({ marcoId, arquivo: file }); toast.success("Entrega enviada — em análise."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar."); }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><FileText className="size-5 text-primary" /> Entregas de projeto</h2>
          <Button size="sm" variant="outline" onClick={() => setBimAberto(true)}>Rodada BIM</Button>
        </div>
        {aEntregar.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma entrega pendente.</p> : (
          <div className="divide-y">
            {aEntregar.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-semibold text-secondary">{nomeDisc.get(m.disciplina_id) ?? "Disciplina"}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{m.rotulo}</span>
                  {m.status === "Reprovado" && m.motivo && <p className="text-xs text-destructive">Reprovado: {m.motivo}</p>}
                </div>
                <label className="cursor-pointer text-xs font-semibold text-primary hover:underline"><Upload className="mr-1 inline size-3.5" />Enviar entrega<input type="file" accept="application/pdf,image/*,.dwg,.ifc" className="hidden" onChange={(e) => upload(m.id, e)} /></label>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-2">
          <p className="text-xs text-muted-foreground">BIM: {rodadas.filter((r) => !r.final).length} rodadas · {rodadas.some((r) => r.final && r.ifc_url) ? "final com IFC entregue" : "sem final"}</p>
        </div>
      </CardContent>
      {bimAberto && <ModalBim proximo={rodadas.length + 1} onFechar={() => setBimAberto(false)} registrar={registrarBim} />}
    </Card>
  );
}

function ModalSubmeterBM({ fase, etapasFase, ultimaPorEtapa, onFechar }: {
  fase: ObraFase;
  etapasFase: { id: string; nome: string; peso_pct: number }[];
  ultimaPorEtapa: ReturnType<typeof ultimaVerificacaoPorEtapa>;
  onFechar: () => void;
}) {
  const submeter = useSubmeterBM();
  const medidas = useEtapasMedidas();
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const disponiveis = etapasFase.filter((e) => etapaConcluida(e.id, ultimaPorEtapa) && !(medidas.data ?? new Set()).has(e.id));
  const pct = disponiveis.filter((e) => sel.has(e.id)).reduce((s, e) => s + e.peso_pct, 0);

  function toggle(id: string) { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function enviar() {
    if (sel.size === 0) { toast.error("Selecione ao menos uma etapa concluída."); return; }
    try { await submeter.mutateAsync({ faseId: fase.id, mes, etapaIds: [...sel] }); toast.success("Medição submetida (Pendente)."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao submeter."); }
  }
  return (
    <ModalBasePortal titulo={`Submeter medição — ${fase.nome}`} onFechar={onFechar}>
      <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Mês</span><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={inputBase} /></label>
      <p className="mt-3 mb-1 text-sm font-semibold text-secondary">Etapas concluídas ({pct}% medido)</p>
      {disponiveis.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa concluída pendente de medição.</p> : (
        <div className="space-y-1">
          {disponiveis.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="size-4 accent-primary" />
              <span className="flex-1 text-secondary">{e.nome}</span><Badge variant="muted">{e.peso_pct}%</Badge>
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Os valores são calculados pelo sistema; a medição entra como Pendente para análise da gestão.</p>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={submeter.isPending}>Cancelar</Button>
        <Button size="lg" className="flex-1" onClick={enviar} disabled={sel.size === 0 || submeter.isPending} loading={submeter.isPending}>Submeter</Button>
      </div>
    </ModalBasePortal>
  );
}

function ModalBim({ proximo, onFechar, registrar }: { proximo: number; onFechar: () => void; registrar: ReturnType<typeof useRegistrarRodadaBim> }) {
  const [numero, setNumero] = useState(String(proximo));
  const [ehFinal, setEhFinal] = useState(false);
  const [relatorio, setRelatorio] = useState<File | null>(null);
  const [ifc, setIfc] = useState<File | null>(null);
  const podeSalvar = !!relatorio && (!ehFinal || !!ifc);

  async function salvar() {
    const n = parseInt(numero, 10);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Número inválido."); return; }
    try { await registrar.mutateAsync({ numero: n, ehFinal, relatorio, ifc }); toast.success("Rodada registrada."); onFechar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha."); }
  }
  return (
    <ModalBasePortal titulo="Rodada BIM" onFechar={onFechar}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} className="h-11 w-24 rounded-md border border-input bg-card px-3 text-sm" />
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={ehFinal} onChange={(e) => setEhFinal(e.target.checked)} className="size-4 accent-primary" /> Final</label>
        </div>
        <label className="block space-y-1"><span className="text-sm text-secondary">Relatório de interferências (PDF)</span><input type="file" accept="application/pdf" onChange={(e) => setRelatorio(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></label>
        <label className="block space-y-1"><span className="text-sm text-secondary">IFC {ehFinal ? "(obrigatório)" : "(opcional)"}</span><input type="file" accept=".ifc" onChange={(e) => setIfc(e.target.files?.[0] ?? null)} className="block w-full text-sm" /></label>
      </div>
      <div className="mt-5 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>Cancelar</Button>
        <Button size="lg" className="flex-1" onClick={salvar} disabled={!podeSalvar || registrar.isPending} loading={registrar.isPending}>Registrar</Button>
      </div>
    </ModalBasePortal>
  );
}
