import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, FileDown, Pencil, History, ShieldCheck } from "lucide-react";
import { useDadosRelatorio, useRelatoriosExtraidos, useSalvarRelatorioExtraido } from "@/hooks/useRelatorioSanitario";
import {
  calcularValoresRelatorio, rotuloPeriodo, RT_ASSINATURA,
  type PeriodoTipo, type ValoresRelatorio,
} from "@/lib/relatorioSanitario";
import { gerarRelatorioSanitarioPdf } from "@/lib/exportRelatorioSanitario";
import { baixarBlob } from "@/lib/exportPrescricao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR } from "@/lib/utils";

const num = "h-8 w-20 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

function ultimoDiaMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}
function copiar(v: ValoresRelatorio): ValoresRelatorio {
  return JSON.parse(JSON.stringify(v));
}

// ===========================================================================
// EXTRAIR RELATÓRIO SANITÁRIO — PDF consolidado, auditável e assinado pelo RT.
// O RT escolhe o período, AUDITA/EDITA os valores (sem alterar o banco) e extrai
// o PDF. O sistema guarda a trilha interna (original × editado). Só Master/RT.
// ===========================================================================

export function VigilanciaRelatorio() {
  const dados = useDadosRelatorio();
  const historico = useRelatoriosExtraidos();
  const salvar = useSalvarRelatorioExtraido();

  const hoje = new Date();
  const [tipo, setTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [de, setDe] = useState(`${hoje.getFullYear()}-01-01`);
  const [ate, setAte] = useState(hoje.toISOString().slice(0, 10));
  const [extraindo, setExtraindo] = useState(false);

  const { inicio, fim } = useMemo(() => {
    if (tipo === "mensal") {
      const [a, m] = mes.split("-").map(Number);
      return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDiaMes(a, m)).padStart(2, "0")}` };
    }
    if (tipo === "anual") return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
    return { inicio: de, fim: ate };
  }, [tipo, mes, ano, de, ate]);

  const originais = useMemo<ValoresRelatorio | null>(() => {
    if (!dados.data) return null;
    return calcularValoresRelatorio(inicio, fim, dados.data.agravos, dados.data.residentes, dados.data.eventos);
  }, [dados.data, inicio, fim]);

  // Cópia editável dos valores (reseta ao trocar período/dados).
  const [valores, setValores] = useState<ValoresRelatorio | null>(null);
  useEffect(() => { setValores(originais ? copiar(originais) : null); }, [originais]);

  if (dados.isLoading) return <LoadingState />;
  if (dados.isError) return <ErrorState error={dados.error} />;
  if (!valores || !originais) return <LoadingState />;

  const houveEdicao = JSON.stringify(originais) !== JSON.stringify(valores);

  function setObrig(i: number, campo: "numerador" | "denominador" | "taxa", v: number) {
    setValores((prev) => {
      if (!prev) return prev;
      const c = copiar(prev);
      c.obrigatorios[i][campo] = v;
      return c;
    });
  }
  function setOcup(campo: "numerador" | "denominador" | "taxa", v: number) {
    setValores((prev) => (prev ? { ...prev, ocupacao: { ...prev.ocupacao, [campo]: v } } : prev));
  }
  function setCampo(campo: keyof ValoresRelatorio, v: number) {
    setValores((prev) => (prev ? ({ ...prev, [campo]: v } as ValoresRelatorio) : prev));
  }

  async function extrair() {
    if (!valores || !originais) return;
    setExtraindo(true);
    try {
      const meta = { tipo, inicio, fim, extraidoEm: new Date() };
      const { blob, hash, nomeArquivo } = await gerarRelatorioSanitarioPdf(valores, meta);
      baixarBlob(blob, nomeArquivo);
      await salvar.mutateAsync({ tipo, inicio, fim, originais, extraidos: valores, houveEdicao, hash });
      toast.success("Relatório sanitário extraído (PDF).");
    } catch (e) {
      toast.error(erroMsg(e));
    } finally {
      setExtraindo(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <FileText className="size-6 text-primary" /> Extrair Relatório Sanitário
        </h2>
      </div>

      {/* Período */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex gap-1.5">
            {(["mensal", "anual", "personalizado"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)}
                className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors capitalize",
                  tipo === t ? "bg-primary text-primary-foreground shadow-card" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                {t}
              </button>
            ))}
          </div>
          {tipo === "mensal" && <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />}
          {tipo === "anual" && (
            <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 w-24 rounded-md border border-input bg-card px-2 text-sm" />
          )}
          {tipo === "personalizado" && (
            <span className="flex items-center gap-2">
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
              <span className="text-muted-foreground">até</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            </span>
          )}
          <span className="ml-auto text-sm font-semibold text-secondary">{rotuloPeriodo(tipo, inicio, fim)}</span>
        </CardContent>
      </Card>

      {/* Pré-visualização editável */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="size-4 text-primary" /> Pré-visualização (editável)
            {houveEdicao && <Badge variant="warning" className="ml-1">Editado pelo RT</Badge>}
          </CardTitle>
          <Button onClick={extrair} disabled={extraindo}>
            <FileDown className="size-4" /> {extraindo ? "Extraindo…" : "Extrair PDF"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Indicadores obrigatórios */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Indicadores obrigatórios (RDC 502 — Anexo)</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground">
                <span className="flex-1">Indicador</span>
                <span className="w-20 text-right">Num.</span>
                <span className="w-20 text-right">Den.</span>
                <span className="w-20 text-right">Taxa %</span>
              </div>
              {valores.obrigatorios.map((ind, i) => (
                <div key={ind.key} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                  <span className="flex-1 text-sm text-secondary">{ind.label}</span>
                  <input type="number" className={num} value={ind.numerador} onChange={(e) => setObrig(i, "numerador", Number(e.target.value))} />
                  <input type="number" className={num} value={ind.denominador} onChange={(e) => setObrig(i, "denominador", Number(e.target.value))} />
                  <input type="number" step="0.1" className={num} value={Number(ind.taxa.toFixed(2))} onChange={(e) => setObrig(i, "taxa", Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>

          {/* Complementares */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Complementares</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                <span className="flex-1 text-sm text-secondary">Taxa de ocupação <span className="text-xs text-muted-foreground">(confira o total de leitos)</span></span>
                <input type="number" className={num} value={valores.ocupacao.numerador} onChange={(e) => setOcup("numerador", Number(e.target.value))} />
                <input type="number" className={num} value={valores.ocupacao.denominador} onChange={(e) => setOcup("denominador", Number(e.target.value))} />
                <input type="number" step="0.1" className={num} value={Number(valores.ocupacao.taxa.toFixed(2))} onChange={(e) => setOcup("taxa", Number(e.target.value))} />
              </div>
              <LinhaValor label="Nº de residentes (dia 15)" v={valores.residentesDia15} onChange={(n) => setCampo("residentesDia15", n)} />
              <LinhaValor label="Entradas no período" v={valores.entradas} onChange={(n) => setCampo("entradas", n)} />
              <LinhaValor label="Saídas no período" v={valores.saidas} onChange={(n) => setCampo("saidas", n)} />
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                <span className="flex-1 text-sm text-secondary">Grau de dependência (I / II / III / sem grau)</span>
                <input type="number" className={num} value={valores.grauI} onChange={(e) => setCampo("grauI", Number(e.target.value))} />
                <input type="number" className={num} value={valores.grauII} onChange={(e) => setCampo("grauII", Number(e.target.value))} />
                <input type="number" className={num} value={valores.grauIII} onChange={(e) => setCampo("grauIII", Number(e.target.value))} />
                <input type="number" className={num} value={valores.grauSemGrau} onChange={(e) => setCampo("grauSemGrau", Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Eventos sentinela */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Eventos sentinela (total / notificados)</p>
            <div className="space-y-1.5">
              <LinhaDupla label="Quedas com lesão" t={valores.sentinelaQuedaTotal} n={valores.sentinelaQuedaNotif} onT={(x) => setCampo("sentinelaQuedaTotal", x)} onN={(x) => setCampo("sentinelaQuedaNotif", x)} />
              <LinhaDupla label="Tentativas de suicídio" t={valores.sentinelaSuicidioTotal} n={valores.sentinelaSuicidioNotif} onT={(x) => setCampo("sentinelaSuicidioTotal", x)} onN={(x) => setCampo("sentinelaSuicidioNotif", x)} />
              <LinhaDupla label="Doenças de notificação compulsória" t={valores.sentinelaDoencaTotal} n={valores.sentinelaDoencaNotif} onT={(x) => setCampo("sentinelaDoencaTotal", x)} onN={(x) => setCampo("sentinelaDoencaNotif", x)} />
            </div>
          </div>

          {/* Identificação fixa */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-secondary">
              Assinado por <span className="font-semibold">{RT_ASSINATURA.nome}</span> — {RT_ASSINATURA.crm} — CPF {RT_ASSINATURA.cpf}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" /> Relatórios extraídos</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.isLoading ? (
            <LoadingState />
          ) : (historico.data?.length ?? 0) === 0 ? (
            <EmptyState label="Nenhum relatório extraído ainda." />
          ) : (
            <div className="space-y-1.5">
              {historico.data!.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-secondary">{rotuloPeriodo(r.periodo_tipo as PeriodoTipo, r.periodo_inicio, r.periodo_fim)}</span>
                    {r.houve_edicao && <Badge variant="warning" className="ml-2">editado</Badge>}
                    <span className="block text-xs text-muted-foreground">
                      Extraído {formatarDataHoraBR(r.extraido_em)}{r.extraido_por ? ` por ${r.extraido_por}` : ""} · {formatarDataBR(r.periodo_inicio)}–{formatarDataBR(r.periodo_fim)}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reexportar(r)}>
                    <FileDown className="size-4" /> Reexportar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function reexportar(r: { periodo_tipo: string; periodo_inicio: string; periodo_fim: string; valores_extraidos: Record<string, unknown>; extraido_em: string }) {
  try {
    const { blob, nomeArquivo } = await gerarRelatorioSanitarioPdf(
      r.valores_extraidos as unknown as ValoresRelatorio,
      { tipo: r.periodo_tipo as PeriodoTipo, inicio: r.periodo_inicio, fim: r.periodo_fim, extraidoEm: new Date(r.extraido_em) },
    );
    baixarBlob(blob, nomeArquivo);
    toast.success("Relatório reexportado.");
  } catch (e) {
    toast.error(erroMsg(e));
  }
}

function LinhaValor({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
      <span className="flex-1 text-sm text-secondary">{label}</span>
      <input type="number" className={num} value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function LinhaDupla({ label, t, n, onT, onN }: { label: string; t: number; n: number; onT: (x: number) => void; onN: (x: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5">
      <span className="flex-1 text-sm text-secondary">{label}</span>
      <input type="number" className={num} value={t} onChange={(e) => onT(Number(e.target.value))} title="Total" />
      <input type="number" className={num} value={n} onChange={(e) => onN(Number(e.target.value))} title="Notificados" />
    </div>
  );
}
