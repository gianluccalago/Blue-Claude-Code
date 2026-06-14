/**
 * Peso e IMC — Nutricionista (BLOCO N6).
 *
 * Pesagem mensal estruturada, com IMC (classificação GERIÁTRICA) e tendência.
 * Perda de peso em idoso é sinal de risco → destaques de atenção. O peso/IMC e a
 * tendência também aparecem (leitura) na ficha do hóspede, na Visão 360º do
 * Master e para o Médico.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Scale, AlertTriangle, Check, Trash2, CalendarCheck, TrendingDown, Users } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useTodosRegistrosPeso,
  useRegistrosPesoDoResidente,
  useRegistrarPeso,
  useRemoverRegistroPeso,
} from "@/hooks/usePeso";
import {
  calcularIMC,
  classificarIMC,
  resumoPeso,
  CLASSIFICACAO_IMC_LABEL,
  CLASSIFICACAO_IMC_VARIANTE,
} from "@/lib/imc";
import { mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard, Sparkbars } from "@/components/dashboard/primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HospedeSelector } from "@/components/HospedeSelector";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";
import type { RegistroPeso, Residente } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function fmtKg(kg: number | null | undefined): string {
  return kg != null ? `${kg.toLocaleString("pt-BR")} kg` : "Não informado";
}

export function Peso() {
  const residentes = useResidentes();
  const todos = useTodosRegistrosPeso();

  const porResidente = useMemo(() => {
    const m = new Map<string, RegistroPeso[]>();
    for (const r of todos.data ?? []) {
      const arr = m.get(r.residente_id) ?? [];
      arr.push(r);
      m.set(r.residente_id, arr);
    }
    return m;
  }, [todos.data]);

  if (residentes.isLoading || todos.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (todos.isError) return <ErrorState error={todos.error} />;
  const lista = residentes.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Scale className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Peso e IMC</h1>
          <p className="text-sm text-muted-foreground">Pesagem mensal, IMC e tendência (referência geriátrica).</p>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="geral" className="gap-1.5"><Users className="size-4" /> Visão geral</TabsTrigger>
          <TabsTrigger value="registrar" className="gap-1.5"><Check className="size-4" /> Registrar</TabsTrigger>
          <TabsTrigger value="hospede" className="gap-1.5"><TrendingDown className="size-4" /> Por hóspede</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <VisaoGeral residentes={lista} porResidente={porResidente} />
        </TabsContent>
        <TabsContent value="registrar">
          <FormPeso residentes={lista} />
        </TabsContent>
        <TabsContent value="hospede">
          <PorHospede residentes={lista} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Visão geral ──────────────────────────────────────────────────────────────

function VisaoGeral({
  residentes,
  porResidente,
}: {
  residentes: Residente[];
  porResidente: Map<string, RegistroPeso[]>;
}) {
  const mes = mesAtual();
  const linhas = residentes.map((r) => ({ residente: r, resumo: resumoPeso(porResidente.get(r.id) ?? []) }));

  const pesadosNoMes = linhas.filter((l) => l.resumo.ultimo?.data.slice(0, 7) === mes);
  const faltam = linhas.filter((l) => l.resumo.ultimo?.data.slice(0, 7) !== mes);
  const emRisco = linhas.filter((l) => l.resumo.emRisco && l.resumo.ultimo);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} tom={faltam.length > 0 ? "warning" : "success"} rotulo="Pesados no mês" valor={`${pesadosNoMes.length}/${residentes.length}`} />
        <StatCard icon={AlertTriangle} tom={emRisco.length > 0 ? "destructive" : "success"} destaque={emRisco.length > 0} rotulo="Em atenção clínica" valor={emRisco.length} />
        <StatCard icon={Scale} tom="secondary" rotulo="Faltam pesar" valor={faltam.length} />
      </div>

      {/* Faltam pesar */}
      {faltam.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Faltam pesar este mês ({faltam.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {faltam.map((l) => (
                <Badge key={l.residente.id} variant="muted">{l.residente.nome}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Destaques de risco */}
      {emRisco.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="size-4" /> Atenção: perda de peso / baixo peso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emRisco.map((l) => (
              <LinhaPeso key={l.residente.id} nome={l.residente.nome} resumo={l.resumo} destaque />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Todos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Todos os hóspedes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {linhas
            .sort((a, b) => a.residente.nome.localeCompare(b.residente.nome, "pt-BR"))
            .map((l) => (
              <LinhaPeso key={l.residente.id} nome={l.residente.nome} resumo={l.resumo} />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LinhaPeso({
  nome,
  resumo,
  destaque,
}: {
  nome: string;
  resumo: ReturnType<typeof resumoPeso>;
  destaque?: boolean;
}) {
  const u = resumo.ultimo;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm", destaque && "border-destructive/40 bg-destructive/5")}>
      <div className="min-w-0">
        <span className="font-semibold text-secondary">{nome}</span>
        {u ? (
          <span className="ml-2 text-xs text-muted-foreground">última: {formatarDataBR(u.data)}</span>
        ) : (
          <span className="ml-2 text-xs text-muted-foreground">sem pesagem</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {u ? (
          <>
            <span className="font-semibold tabular-nums text-secondary">{fmtKg(u.peso_kg)}</span>
            {u.imc != null && <span className="text-xs text-muted-foreground">IMC {u.imc}</span>}
            {resumo.classificacao && (
              <Badge variant={CLASSIFICACAO_IMC_VARIANTE[resumo.classificacao]}>
                {CLASSIFICACAO_IMC_LABEL[resumo.classificacao]}
              </Badge>
            )}
            {resumo.variacaoKg != null && resumo.variacaoKg !== 0 && (
              <Badge variant={resumo.perdaRelevante ? "destructive" : resumo.variacaoKg < 0 ? "warning" : "success"}>
                {resumo.variacaoKg > 0 ? "+" : ""}{resumo.variacaoKg.toLocaleString("pt-BR")} kg
              </Badge>
            )}
            {resumo.tendenciaQueda && <Badge variant="destructive" className="gap-1"><TrendingDown className="size-3" /> queda 3x</Badge>}
          </>
        ) : (
          <Badge variant="muted">Não informado</Badge>
        )}
      </div>
    </div>
  );
}

// ─── Registrar ────────────────────────────────────────────────────────────────

function FormPeso({ residentes }: { residentes: Residente[] }) {
  const registrar = useRegistrarPeso();
  const [residenteId, setResidenteId] = useState<string | undefined>(residentes[0]?.id);
  const residente = residentes.find((r) => r.id === residenteId);
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState(residente?.altura_m ? String(residente.altura_m) : "");
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");

  function selecionar(id: string) {
    setResidenteId(id);
    const r = residentes.find((x) => x.id === id);
    setAltura(r?.altura_m ? String(r.altura_m) : "");
  }

  const pesoNum = Number(peso.replace(",", "."));
  const alturaNum = Number(altura.replace(",", "."));
  const pesoOk = Number.isFinite(pesoNum) && pesoNum > 0;
  const alturaOk = Number.isFinite(alturaNum) && alturaNum > 0;
  const imc = pesoOk && alturaOk ? calcularIMC(pesoNum, alturaNum) : null;
  const classe = classificarIMC(imc);

  async function salvar() {
    if (!residenteId || !pesoOk) {
      toast.error("Selecione o hóspede e informe um peso válido.");
      return;
    }
    try {
      await registrar.mutateAsync({
        residenteId,
        pesoKg: pesoNum,
        alturaM: alturaOk ? alturaNum : null,
        data,
        observacao: observacao || null,
        atualizarAlturaCadastro: alturaOk,
      });
      toast.success("Pesagem registrada.");
      setPeso("");
      setObservacao("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-4">
      <HospedeSelector hospedes={residentes} selecionadoId={residenteId} onSelect={selecionar} />
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar pesagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-secondary">Peso (kg)</span>
              <input type="number" step="0.1" min={0} value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0,0" className={inputBase} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-secondary">
                Altura (m) {residente?.altura_m ? "" : "· faltando no cadastro"}
              </span>
              <input type="number" step="0.01" min={0} value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="ex: 1,60" className={inputBase} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-secondary">Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
            </label>
          </div>

          {/* IMC ao vivo */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IMC</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-extrabold tabular-nums text-secondary">{imc ?? "—"}</p>
              {classe && <Badge variant={CLASSIFICACAO_IMC_VARIANTE[classe]}>{CLASSIFICACAO_IMC_LABEL[classe]}</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground">Classificação geriátrica: baixo &lt; 22 · adequado 22–27 · excesso &gt; 27.</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: edema, recusa alimentar…" className={inputBase} />
          </label>

          <Button onClick={salvar} disabled={!pesoOk || registrar.isPending}>
            <Check className="size-4" /> {registrar.isPending ? "Salvando…" : "Registrar pesagem"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Por hóspede (evolução) ───────────────────────────────────────────────────

function PorHospede({ residentes }: { residentes: Residente[] }) {
  const [residenteId, setResidenteId] = useState<string | undefined>(residentes[0]?.id);
  const registros = useRegistrosPesoDoResidente(residenteId);
  const remover = useRemoverRegistroPeso();
  const [confirmar, setConfirmar] = useState<RegistroPeso | null>(null);

  const ord = registros.data ?? []; // já vem ascendente (antigo → recente)
  const resumo = resumoPeso(ord);

  return (
    <div className="space-y-4">
      <HospedeSelector hospedes={residentes} selecionadoId={residenteId} onSelect={setResidenteId} />

      {registros.isLoading ? (
        <LoadingState />
      ) : ord.length === 0 ? (
        <EmptyState label="Sem pesagens registradas para este hóspede." />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução do peso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Sparkbars valores={ord.map((r) => r.peso_kg)} tom={resumo.emRisco ? "destructive" : "primary"} />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-secondary">Atual {fmtKg(resumo.ultimo?.peso_kg)}</span>
                {resumo.ultimo?.imc != null && <span className="text-muted-foreground">IMC {resumo.ultimo.imc}</span>}
                {resumo.classificacao && <Badge variant={CLASSIFICACAO_IMC_VARIANTE[resumo.classificacao]}>{CLASSIFICACAO_IMC_LABEL[resumo.classificacao]}</Badge>}
                {resumo.variacaoKg != null && resumo.variacaoKg !== 0 && (
                  <Badge variant={resumo.perdaRelevante ? "destructive" : resumo.variacaoKg < 0 ? "warning" : "success"}>
                    {resumo.variacaoKg > 0 ? "+" : ""}{resumo.variacaoKg.toLocaleString("pt-BR")} kg vs. anterior
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...ord].reverse().map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold text-secondary">{formatarDataBR(r.data)}</span>
                    <span className="ml-2 text-muted-foreground">{fmtKg(r.peso_kg)}{r.imc != null ? ` · IMC ${r.imc}` : ""}</span>
                    {r.observacao && <p className="text-xs text-muted-foreground">{r.observacao}</p>}
                    <p className="text-[11px] text-muted-foreground">Por {ouNaoInformado(r.registrado_por)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmar(r)} aria-label="Remover"><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        aberto={!!confirmar}
        titulo="Remover esta pesagem?"
        descricao={confirmar ? `${formatarDataBR(confirmar.data)} · ${fmtKg(confirmar.peso_kg)}` : undefined}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={() => {
          if (confirmar) remover.mutate(confirmar.id, { onSuccess: () => toast.success("Pesagem removida.") });
          setConfirmar(null);
        }}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
