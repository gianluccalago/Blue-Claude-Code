import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ClipboardPlus, Save, FileDown, Plus, X, CheckCircle2, Pill, HeartPulse } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useEvolucaoAdmissao, useSalvarEvolucaoAdmissao } from "@/hooks/useEvolucaoAdmissao";
import { useTestesCognitivos } from "@/hooks/useTestesCognitivos";
import { useAvaliacoesIVCF } from "@/hooks/useMedico";
import { useRegistrosPesoDoResidente } from "@/hooks/usePeso";
import {
  dadosAdmissaoVazios, medVazia, imcDeTexto,
  MOTIVO_ORIGEM, DISPOSITIVOS, VIA_LABEL, PERIODO_LABEL, PERIODOS_ORDEM,
  type DadosAdmissao, type MedAdmissao,
} from "@/lib/evolucaoAdmissao";
import { gerarEvolucaoAdmissaoPdf } from "@/lib/exportEvolucaoAdmissao";
import { baixarBlob } from "@/lib/exportPrescricao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { calcularIdade, formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";
import type { PeriodoMedicacao, Residente, ViaMedicacao } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const areaBase = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

const SEXO_LABEL: Record<string, string> = { masculino: "Masculino", feminino: "Feminino" };

// ===========================================================================
// EVOLUÇÃO DE ADMISSÃO — avaliação geriátrica inicial. É a FONTE: ao salvar,
// popula patologias, gera prescrição contínua, registra alergias e peso.
// ===========================================================================

export function EvolucaoAdmissao() {
  const residentes = useResidentes();
  const [hospedeId, setHospedeId] = useState("");

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  const lista = residentes.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede ativo." />;

  const hospede = lista.find((r) => r.id === hospedeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <ClipboardPlus className="size-6 text-primary" /> Evolução de admissão
          </h2>
          <p className="text-sm text-muted-foreground">
            Avaliação geriátrica inicial. Alimenta o cadastro: comorbidades, prescrição contínua, alergias e peso.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
          <select value={hospedeId} onChange={(e) => setHospedeId(e.target.value)} className={inputBase}>
            <option value="">Selecione o hóspede…</option>
            {lista.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </CardContent>
      </Card>

      {hospede ? <Formulario key={hospede.id} hospede={hospede} /> : (
        <EmptyState label="Selecione um hóspede para iniciar ou ver a evolução de admissão." />
      )}
    </div>
  );
}

function Formulario({ hospede }: { hospede: Residente }) {
  const existenteQ = useEvolucaoAdmissao(hospede.id);
  const salvar = useSalvarEvolucaoAdmissao();
  // Resultados reais já registrados (módulos MEEM/MoCA e IVCF) — para referência.
  const testes = useTestesCognitivos(hospede.id);
  const ivcf = useAvaliacoesIVCF(hospede.id);
  const pesos = useRegistrosPesoDoResidente(hospede.id); // ordem ascendente → o último é o mais recente
  const [d, setD] = useState<DadosAdmissao>(() => dadosAdmissaoVazios(hospede.data_admissao ?? hojeISO()));
  const [exportando, setExportando] = useState(false);

  // Carrega a admissão existente (edição) ou inicia vazia (com alergias do cadastro).
  useEffect(() => {
    if (existenteQ.isLoading) return;
    const ex = existenteQ.data;
    if (ex) {
      setD(ex.dados as unknown as DadosAdmissao);
    } else {
      const base = dadosAdmissaoVazios(hospede.data_admissao ?? hojeISO());
      if (hospede.alergias) base.alergias = hospede.alergias;
      setD(base);
    }
  }, [existenteQ.data, existenteQ.isLoading, hospede]);

  if (existenteQ.isLoading) return <LoadingState />;

  const existente = existenteQ.data ?? null;
  const set = <K extends keyof DadosAdmissao>(k: K, v: DadosAdmissao[K]) => setD((p) => ({ ...p, [k]: v }));
  const imc = imcDeTexto(d.peso, d.altura);

  const idade = calcularIdade(hospede.data_nascimento);
  const idadeTexto = idade !== null ? `${idade} anos` : "Não informado";
  const sexoTexto = hospede.sexo ? SEXO_LABEL[hospede.sexo] : "Não informado";

  // Últimos resultados dos módulos de teste (referência na seção 6).
  const ultimoMeem = (testes.data ?? []).find((t) => t.tipo === "MEEM") ?? null;
  const ultimoMoca = (testes.data ?? []).find((t) => t.tipo === "MoCA") ?? null;
  const ultimoIvcf = (ivcf.data ?? [])[0] ?? null;
  const ultimoPeso = (pesos.data ?? []).at(-1) ?? null;
  const temResultados = !!(ultimoMeem || ultimoMoca || ultimoIvcf);
  function usarPeso() {
    if (!ultimoPeso) return;
    setD((p) => ({
      ...p,
      peso: String(ultimoPeso.peso_kg),
      altura: ultimoPeso.altura_m ? String(ultimoPeso.altura_m) : p.altura,
    }));
  }
  function refTestos(): string {
    const partes: string[] = [];
    if (ultimoMeem) partes.push(`MEEM ${ultimoMeem.pontuacao_total}/30 (${formatarDataBR(ultimoMeem.aplicado_em.slice(0, 10))})`);
    if (ultimoMoca) partes.push(`MoCA ${ultimoMoca.pontuacao_total}/30 (${formatarDataBR(ultimoMoca.aplicado_em.slice(0, 10))})`);
    if (ultimoIvcf) partes.push(`IVCF ${ultimoIvcf.classificacao} (${ultimoIvcf.pontuacao_total} pts)`);
    return partes.join("; ");
  }

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({ residenteId: hospede.id, dados: d, existente });
      toast.success(existente ? "Evolução de admissão atualizada." : "Admissão registrada — comorbidades, prescrição, alergias e peso alimentados.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const { blob, nomeArquivo } = await gerarEvolucaoAdmissaoPdf(d, {
        hospedeNome: hospede.nome,
        idadeTexto,
        sexo: sexoTexto,
        quarto: ouNaoInformado(hospede.quarto),
        medicoNome: existente?.medico_nome ?? "—",
        medicoCrm: existente?.medico_crm ?? null,
        dataAvaliacao: d.dataAdmissao ? new Date(`${d.dataAdmissao}T00:00:00`).toLocaleDateString("pt-BR") : "Não informado",
      });
      baixarBlob(blob, nomeArquivo);
    } catch (e) {
      toast.error(erroMsg(e));
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {existente ? <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Admissão registrada</Badge>
            : <Badge variant="warning">Nova admissão</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {existente && (
            <Button variant="outline" size="sm" onClick={handleExportar} disabled={exportando}>
              <FileDown className="size-4" /> {exportando ? "Gerando…" : "Exportar PDF"}
            </Button>
          )}
          <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
            <Save className="size-4" /> {salvar.isPending ? "Salvando…" : existente ? "Salvar alterações" : "Registrar admissão"}
          </Button>
        </div>
      </div>

      {/* 1 · Identificação e motivo */}
      <Secao numero={1} titulo="Identificação e motivo da admissão">
        <div className="mb-3 grid gap-2 rounded-lg bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <Info rotulo="Nome" valor={hospede.nome} />
          <Info rotulo="Idade" valor={idadeTexto} />
          <Info rotulo="Sexo" valor={sexoTexto} />
          <Info rotulo="Quarto" valor={ouNaoInformado(hospede.quarto)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Data da avaliação de admissão"><input type="date" value={d.dataAdmissao} onChange={(e) => set("dataAdmissao", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Origem / motivo">
            <select value={d.motivoOrigem} onChange={(e) => set("motivoOrigem", e.target.value)} className={inputBase}>
              {MOTIVO_ORIGEM.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Quem encaminhou"><input value={d.encaminhadoPor} onChange={(e) => set("encaminhadoPor", e.target.value)} className={inputBase} placeholder="Família, hospital, médico…" /></Campo>
        <Campo label="Motivo da admissão (detalhe)"><textarea value={d.motivoTexto} onChange={(e) => set("motivoTexto", e.target.value)} rows={2} className={areaBase} /></Campo>
      </Secao>

      {/* 2 · História clínica */}
      <Secao numero={2} titulo="História clínica">
        <Campo label="HMA / condição que motivou"><textarea value={d.hma} onChange={(e) => set("hma", e.target.value)} rows={3} className={areaBase} /></Campo>
        <Campo label="Comorbidades (alimentam as patologias do hóspede)">
          <ListaTags itens={d.comorbidades} onChange={(v) => set("comorbidades", v)} placeholder="Ex.: Hipertensão arterial" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Cirurgias prévias"><textarea value={d.cirurgiasPrevias} onChange={(e) => set("cirurgiasPrevias", e.target.value)} rows={2} className={areaBase} /></Campo>
          <Campo label="Internações recentes"><textarea value={d.internacoesRecentes} onChange={(e) => set("internacoesRecentes", e.target.value)} rows={2} className={areaBase} /></Campo>
        </div>
        <Campo label="Alergias (alimentam o alerta de alergia ao prescrever)">
          <input value={d.alergias} onChange={(e) => set("alergias", e.target.value)} className={inputBase} placeholder="Medicamentosas e outras (ex.: Dipirona, frutos do mar)" />
        </Campo>
      </Secao>

      {/* 3 · Medicações contínuas */}
      <Secao numero={3} titulo="Medicações em uso contínuo (geram prescrição real)">
        <MedicacoesEditor meds={d.medicacoes} onChange={(v) => set("medicacoes", v)} bloqueado={!!existente} />
        {existente && (
          <p className="text-xs text-muted-foreground">
            A prescrição é gerada uma vez na admissão. Para alterar a medicação depois, use a tela de Prescrições.
          </p>
        )}
      </Secao>

      {/* 4 · História funcional prévia */}
      <Secao numero={4} titulo="História funcional prévia">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Deambulação"><input value={d.deambulacao} onChange={(e) => set("deambulacao", e.target.value)} className={inputBase} /></Campo>
          <Campo label="AVDs (atividades de vida diária)"><input value={d.avds} onChange={(e) => set("avds", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Continência"><input value={d.continencia} onChange={(e) => set("continencia", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Comunicação"><input value={d.comunicacao} onChange={(e) => set("comunicacao", e.target.value)} className={inputBase} /></Campo>
        </div>
        <Campo label="Dispositivos em uso">
          <div className="flex flex-wrap gap-1.5">
            {DISPOSITIVOS.map((disp) => {
              const on = d.dispositivos.includes(disp);
              return (
                <button key={disp} type="button"
                  onClick={() => set("dispositivos", on ? d.dispositivos.filter((x) => x !== disp) : [...d.dispositivos, disp])}
                  className={cnChip(on)}>{disp}</button>
              );
            })}
          </div>
        </Campo>
        <Campo label="Outros dispositivos"><input value={d.dispositivosOutros} onChange={(e) => set("dispositivosOutros", e.target.value)} className={inputBase} /></Campo>
      </Secao>

      {/* 5 · Sistemas / exame físico */}
      <Secao numero={5} titulo="Avaliação por sistemas / exame físico">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Cardiovascular"><input value={d.sisCardio} onChange={(e) => set("sisCardio", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Respiratório"><input value={d.sisResp} onChange={(e) => set("sisResp", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Gastrointestinal"><input value={d.sisGi} onChange={(e) => set("sisGi", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Geniturinário"><input value={d.sisGu} onChange={(e) => set("sisGu", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Neurológico"><input value={d.sisNeuro} onChange={(e) => set("sisNeuro", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Musculoesquelético"><input value={d.sisMusculo} onChange={(e) => set("sisMusculo", e.target.value)} className={inputBase} /></Campo>
        </div>
        <Campo label="Pele / feridas"><textarea value={d.sisPele} onChange={(e) => set("sisPele", e.target.value)} rows={2} className={areaBase} /></Campo>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><HeartPulse className="size-3.5" /> Sinais vitais de admissão</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Campo label="PA"><input value={d.pa} onChange={(e) => set("pa", e.target.value)} className={inputBase} placeholder="120x80" /></Campo>
          <Campo label="FC"><input value={d.fc} onChange={(e) => set("fc", e.target.value)} className={inputBase} /></Campo>
          <Campo label="FR"><input value={d.fr} onChange={(e) => set("fr", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Tax"><input value={d.temp} onChange={(e) => set("temp", e.target.value)} className={inputBase} /></Campo>
          <Campo label="SatO2"><input value={d.satO2} onChange={(e) => set("satO2", e.target.value)} className={inputBase} /></Campo>
        </div>
        {/* Último peso/IMC já registrado (acompanhamento de peso). */}
        {ultimoPeso && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="text-secondary">
              Último registro: <span className="font-bold">{ultimoPeso.peso_kg} kg</span>
              {ultimoPeso.altura_m ? ` · ${ultimoPeso.altura_m} m` : ""}
              {ultimoPeso.imc ? ` · IMC ${ultimoPeso.imc}` : ""}
              <span className="text-xs text-muted-foreground"> · {formatarDataBR(ultimoPeso.data)}</span>
            </span>
            <button type="button" onClick={usarPeso} className="text-xs font-semibold text-primary hover:underline">Usar este peso ↓</button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Campo label="Peso (kg)"><input value={d.peso} onChange={(e) => set("peso", e.target.value)} className={inputBase} placeholder="68" /></Campo>
          <Campo label="Altura (m)"><input value={d.altura} onChange={(e) => set("altura", e.target.value)} className={inputBase} placeholder="1.65" /></Campo>
          <Campo label="IMC"><div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm font-semibold tabular-nums text-secondary">{imc ?? "—"}</div></Campo>
        </div>
        {!existente && <p className="text-xs text-muted-foreground">O peso de admissão é registrado no acompanhamento de peso ao salvar.</p>}
      </Secao>

      {/* 6 · Cognitiva e humor */}
      <Secao numero={6} titulo="Avaliação cognitiva e de humor">
        <Campo label="Estado cognitivo (geral)"><textarea value={d.cognitivoGeral} onChange={(e) => set("cognitivoGeral", e.target.value)} rows={2} className={areaBase} /></Campo>

        {/* Resultados reais já registrados (módulos MEEM/MoCA e IVCF). */}
        {temResultados && (
          <div className="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultados registrados</p>
            {ultimoMeem && (
              <p className="text-secondary">MEEM: <span className="font-bold">{ultimoMeem.pontuacao_total}/30</span>{" "}
                <span className="text-xs text-muted-foreground">· {formatarDataBR(ultimoMeem.aplicado_em.slice(0, 10))}</span></p>
            )}
            {ultimoMoca && (
              <p className="text-secondary">MoCA: <span className="font-bold">{ultimoMoca.pontuacao_total}/30</span>{" "}
                <span className="text-xs text-muted-foreground">· {formatarDataBR(ultimoMoca.aplicado_em.slice(0, 10))}</span></p>
            )}
            {ultimoIvcf && (
              <p className="text-secondary">IVCF: <span className="font-bold">{ultimoIvcf.classificacao}</span> ({ultimoIvcf.pontuacao_total} pts)</p>
            )}
            <button type="button" onClick={() => set("testesCognitivos", refTestos())} className="pt-1 text-xs font-semibold text-primary hover:underline">
              Usar nos testes ↓
            </button>
          </div>
        )}

        <Campo label="Testes aplicados (MEEM / MoCA / IVCF) e escores"><input value={d.testesCognitivos} onChange={(e) => set("testesCognitivos", e.target.value)} className={inputBase} placeholder="Ex.: MEEM 22/30; IVCF Grau II" /></Campo>
        <Campo label="Humor / comportamento"><textarea value={d.humorComportamento} onChange={(e) => set("humorComportamento", e.target.value)} rows={2} className={areaBase} /></Campo>
      </Secao>

      {/* 7 · Social e familiar */}
      <Secao numero={7} titulo="Avaliação social e familiar">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Suporte familiar"><input value={d.suporteFamiliar} onChange={(e) => set("suporteFamiliar", e.target.value)} className={inputBase} /></Campo>
          <Campo label="Rede de apoio"><input value={d.redeApoio} onChange={(e) => set("redeApoio", e.target.value)} className={inputBase} /></Campo>
        </div>
        <Campo label="Aspectos relevantes"><textarea value={d.aspectosSociais} onChange={(e) => set("aspectosSociais", e.target.value)} rows={2} className={areaBase} /></Campo>
      </Secao>

      {/* 8 · Impressão e plano */}
      <Secao numero={8} titulo="Impressão diagnóstica e plano inicial">
        <Campo label="Impressão diagnóstica (síntese)"><textarea value={d.impressaoDiagnostica} onChange={(e) => set("impressaoDiagnostica", e.target.value)} rows={2} className={areaBase} /></Campo>
        <Campo label="Hipóteses / diagnósticos"><textarea value={d.hipoteses} onChange={(e) => set("hipoteses", e.target.value)} rows={2} className={areaBase} /></Campo>
        <Campo label="Conduta e plano de cuidado inicial"><textarea value={d.condutaPlano} onChange={(e) => set("condutaPlano", e.target.value)} rows={3} className={areaBase} /></Campo>
        <Campo label="Encaminhamentos"><textarea value={d.encaminhamentos} onChange={(e) => set("encaminhamentos", e.target.value)} rows={2} className={areaBase} /></Campo>
      </Secao>

      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={salvar.isPending}>
          <Save className="size-4" /> {salvar.isPending ? "Salvando…" : existente ? "Salvar alterações" : "Registrar admissão"}
        </Button>
      </div>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function Secao({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-gradient text-xs font-bold text-white">{numero}</span>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><label className="text-sm font-semibold text-secondary">{label}</label>{children}</div>;
}
function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <p><span className="font-semibold text-muted-foreground">{rotulo}:</span> <span className="text-secondary">{ouNaoInformado(valor)}</span></p>;
}
function cnChip(on: boolean): string {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`;
}

function ListaTags({ itens, onChange, placeholder }: { itens: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [texto, setTexto] = useState("");
  function add() {
    const t = texto.trim();
    if (!t) return;
    if (!itens.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...itens, t]);
    setTexto("");
  }
  return (
    <div className="space-y-2">
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((it) => (
            <span key={it} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-sm text-secondary">
              {it}
              <button onClick={() => onChange(itens.filter((x) => x !== it))} className="text-muted-foreground hover:text-destructive" aria-label="Remover"><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} className={inputBase} />
        <Button type="button" variant="outline" onClick={add}><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

function MedicacoesEditor({ meds, onChange, bloqueado }: { meds: MedAdmissao[]; onChange: (v: MedAdmissao[]) => void; bloqueado: boolean }) {
  function up(i: number, patch: Partial<MedAdmissao>) {
    onChange(meds.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  return (
    <div className="space-y-2">
      {meds.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma medicação contínua — Não informado.</p>}
      {meds.map((m, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground"><Pill className="size-3.5" /> Medicação {i + 1}</p>
            {!bloqueado && <button onClick={() => onChange(meds.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remover"><X className="size-4" /></button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={m.medicamento} onChange={(e) => up(i, { medicamento: e.target.value })} placeholder="Medicamento" className={inputBase} disabled={bloqueado} />
            <input value={m.dose} onChange={(e) => up(i, { dose: e.target.value })} placeholder="Dose (ex.: 50mg)" className={inputBase} disabled={bloqueado} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={m.via} onChange={(e) => up(i, { via: e.target.value as ViaMedicacao })} className={inputBase} disabled={bloqueado}>
              {(Object.keys(VIA_LABEL) as ViaMedicacao[]).map((v) => <option key={v} value={v}>{VIA_LABEL[v]}</option>)}
            </select>
            <input value={m.posologia} onChange={(e) => up(i, { posologia: e.target.value })} placeholder="Posologia (ex.: 1x/dia)" className={inputBase} disabled={bloqueado} />
            <input value={m.quantidade} onChange={(e) => up(i, { quantidade: e.target.value })} placeholder="Qtd. por adm." className={inputBase} disabled={bloqueado} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS_ORDEM.map((p) => {
              const on = m.periodos.includes(p);
              return (
                <button key={p} type="button" disabled={bloqueado}
                  onClick={() => up(i, { periodos: on ? m.periodos.filter((x) => x !== p) : [...m.periodos, p] })}
                  className={cnChip(on)}>{PERIODO_LABEL[p as PeriodoMedicacao]}</button>
              );
            })}
          </div>
        </div>
      ))}
      {!bloqueado && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...meds, medVazia()])}>
          <Plus className="size-4" /> Adicionar medicação
        </Button>
      )}
    </div>
  );
}
