import { useState, useMemo } from "react";
import {
  FileText,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useEvolucoes,
  useCriarEvolucao,
  useAvaliacoesIVCF,
  useCriarAvaliacaoIVCF,
} from "@/hooks/useMedico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { AvaliacaoIVCF, Evolucao, Residente } from "@/types/database";

// ─── Tipos IVCF ──────────────────────────────────────────────────────────────

type TriOpcao = "sim" | "nao" | "indisponivel";
type IdadeGrupo = "60-74" | "75-84" | "85+";

interface IVCFForm {
  idade: IdadeGrupo | null;
  autopercepcao: "boa" | "ruim" | null;
  avdi_compras: boolean | null;
  avdi_financeiro: boolean | null;
  avdi_trabalhos: boolean | null;
  avdb_banho: boolean | null;
  cogn_esquecimento: boolean | null;
  cogn_piora: boolean | null;
  cogn_impacto: boolean | null;
  humor_desanimo: boolean | null;
  humor_interesse: boolean | null;
  mmss_bracos: boolean | null;
  mmss_objetos: boolean | null;
  capac_aero: TriOpcao | null;
  marcha: boolean | null;
  quedas: boolean | null;
  continencia: boolean | null;
  visao: boolean | null;
  audicao: boolean | null;
  morb_doencas: TriOpcao | null;
  morb_polifarmacia: TriOpcao | null;
  morb_internacao: TriOpcao | null;
}

const FORM_VAZIO: IVCFForm = {
  idade: null, autopercepcao: null,
  avdi_compras: null, avdi_financeiro: null, avdi_trabalhos: null,
  avdb_banho: null,
  cogn_esquecimento: null, cogn_piora: null, cogn_impacto: null,
  humor_desanimo: null, humor_interesse: null,
  mmss_bracos: null, mmss_objetos: null,
  capac_aero: null,
  marcha: null, quedas: null, continencia: null, visao: null, audicao: null,
  morb_doencas: null, morb_polifarmacia: null, morb_internacao: null,
};

// ─── Cálculo IVCF ────────────────────────────────────────────────────────────

type ResultadoIVCF = {
  pontuacao: number;
  classificacao: "Grau I" | "Grau II" | "Grau III";
  dominiosAlterados: string[];
  itensIndisponiveis: string[];
};

function calcularIVCF(f: IVCFForm): ResultadoIVCF {
  let total = 0;
  const dominios: string[] = [];
  const indisponiveis: string[] = [];

  // Idade
  const idadeScore = f.idade === "85+" ? 3 : f.idade === "75-84" ? 1 : 0;
  total += idadeScore;
  if (idadeScore > 0) dominios.push("Idade");

  // Autopercepção
  const autoScore = f.autopercepcao === "ruim" ? 1 : 0;
  total += autoScore;
  if (autoScore > 0) dominios.push("Autopercepção de saúde");

  // AVD Instrumentais (teto 4)
  let avdiRaw = 0;
  if (f.avdi_compras) avdiRaw += 4;
  if (f.avdi_financeiro) avdiRaw += 4;
  if (f.avdi_trabalhos) avdiRaw += 4;
  const avdiScore = Math.min(avdiRaw, 4);
  total += avdiScore;
  if (avdiScore > 0) dominios.push("AVD Instrumentais");

  // AVD Básica
  const avdbScore = f.avdb_banho ? 6 : 0;
  total += avdbScore;
  if (avdbScore > 0) dominios.push("AVD Básica");

  // Cognição
  let cognScore = 0;
  if (f.cogn_esquecimento) cognScore += 1;
  if (f.cogn_piora) cognScore += 1;
  if (f.cogn_impacto) cognScore += 2;
  total += cognScore;
  if (cognScore > 0) dominios.push("Cognição");

  // Humor
  let humorScore = 0;
  if (f.humor_desanimo) humorScore += 2;
  if (f.humor_interesse) humorScore += 2;
  total += humorScore;
  if (humorScore > 0) dominios.push("Humor");

  // Mobilidade MMSS
  let mmssScore = 0;
  if (f.mmss_bracos) mmssScore += 1;
  if (f.mmss_objetos) mmssScore += 1;
  total += mmssScore;
  if (mmssScore > 0) dominios.push("Mobilidade (MMSS)");

  // Capacidade aeróbica/muscular (teto 2)
  if (f.capac_aero === "sim") { total += 2; dominios.push("Capacidade aeróbica/muscular"); }
  else if (f.capac_aero === "indisponivel") indisponiveis.push("Capacidade aeróbica/muscular");

  // Marcha
  if (f.marcha) { total += 2; dominios.push("Marcha"); }

  // Quedas
  if (f.quedas) { total += 2; dominios.push("Quedas"); }

  // Continência
  if (f.continencia) { total += 2; dominios.push("Continência"); }

  // Visão
  if (f.visao) { total += 2; dominios.push("Visão"); }

  // Audição
  if (f.audicao) { total += 2; dominios.push("Audição"); }

  // Morbidades múltiplas (teto 4)
  let morbRaw = 0;
  if (f.morb_doencas === "sim") morbRaw += 4;
  else if (f.morb_doencas === "indisponivel") indisponiveis.push("Multimorbidade (5+ doenças)");
  if (f.morb_polifarmacia === "sim") morbRaw += 4;
  else if (f.morb_polifarmacia === "indisponivel") indisponiveis.push("Polifarmácia");
  if (f.morb_internacao === "sim") morbRaw += 4;
  else if (f.morb_internacao === "indisponivel") indisponiveis.push("Internação recente");
  const morbScore = Math.min(morbRaw, 4);
  total += morbScore;
  if (morbScore > 0) dominios.push("Morbidades múltiplas");

  const classificacao: "Grau I" | "Grau II" | "Grau III" =
    total >= 15 ? "Grau III" : total >= 7 ? "Grau II" : "Grau I";

  return { pontuacao: total, classificacao, dominiosAlterados: dominios, itensIndisponiveis: indisponiveis };
}

function formCompleto(f: IVCFForm): boolean {
  return Object.values(f).every((v) => v !== null);
}

function calcularGrupoIdade(dataNasc: string): IdadeGrupo {
  const nasc = new Date(dataNasc);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  if (idade >= 85) return "85+";
  if (idade >= 75) return "75-84";
  return "60-74";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EvolucaoMedico() {
  const { data: residentes, isLoading, isError, error } = useResidentes();
  const [residenteId, setResidenteId] = useState<string | null>(null);
  const [acao, setAcao] = useState<"evolucao" | "ivcf" | null>(null);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const residente = residentes?.find((r) => r.id === residenteId) ?? null;

  function toggleAcao(a: "evolucao" | "ivcf") {
    setAcao((prev) => (prev === a ? null : a));
  }

  return (
    <div className="space-y-6">
      {/* Seletor de hóspede */}
      <Card>
        <CardHeader>
          <CardTitle>Avaliações e evoluções</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
          <select
            value={residenteId ?? ""}
            onChange={(e) => {
              setResidenteId(e.target.value || null);
              setAcao(null);
            }}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Selecione um hóspede…</option>
            {(residentes ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}{r.quarto ? ` · Quarto ${r.quarto}` : ""}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {residenteId && residente && (
        <>
          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={acao === "evolucao" ? "default" : "outline"}
              onClick={() => toggleAcao("evolucao")}
              className="gap-2"
            >
              <FileText className="size-4" />
              Nova evolução
            </Button>
            <Button
              variant={acao === "ivcf" ? "default" : "outline"}
              onClick={() => toggleAcao("ivcf")}
              className="gap-2"
            >
              <ClipboardList className="size-4" />
              Nova avaliação IVCF-20
            </Button>
          </div>

          {acao === "evolucao" && (
            <FormEvolucao
              residenteId={residenteId}
              onClose={() => setAcao(null)}
            />
          )}

          {acao === "ivcf" && (
            <FormIVCF
              residente={residente}
              onClose={() => setAcao(null)}
            />
          )}

          <Historico residenteId={residenteId} />
        </>
      )}
    </div>
  );
}

// ─── Formulário de evolução ───────────────────────────────────────────────────

function FormEvolucao({
  residenteId,
  onClose,
}: {
  residenteId: string;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const criar = useCriarEvolucao();

  async function handleSalvar() {
    if (!texto.trim()) return;
    setErro(null);
    try {
      await criar.mutateAsync({ residenteId, texto: texto.trim() });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Nova evolução
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva a evolução clínica do hóspede…"
          rows={5}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          disabled={criar.isPending}
        />
        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleSalvar}
            disabled={!texto.trim() || criar.isPending}
          >
            {criar.isPending ? "Salvando…" : "Salvar evolução"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={criar.isPending}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Formulário IVCF-20 ───────────────────────────────────────────────────────

function FormIVCF({
  residente,
  onClose,
}: {
  residente: Residente;
  onClose: () => void;
}) {
  const idadeInicial: IdadeGrupo | null = residente.data_nascimento
    ? calcularGrupoIdade(residente.data_nascimento)
    : null;

  const [form, setForm] = useState<IVCFForm>({ ...FORM_VAZIO, idade: idadeInicial });
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoIVCF | null>(null);
  const criar = useCriarAvaliacaoIVCF();

  function set<K extends keyof IVCFForm>(key: K, value: IVCFForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const completo = formCompleto(form);
  const preview = useMemo(() => calcularIVCF(form), [form]);
  const respondidas = Object.values(form).filter((v) => v !== null).length;
  const total = Object.keys(form).length;

  async function handleSalvar() {
    if (!completo) return;
    setErro(null);
    const res = calcularIVCF(form);
    try {
      await criar.mutateAsync({
        residenteId: residente.id,
        respostas: form as unknown as Record<string, unknown>,
        pontuacaoTotal: res.pontuacao,
        classificacao: res.classificacao,
        dominiosAlterados: res.dominiosAlterados,
        itensIndisponiveis: res.itensIndisponiveis,
      });
      setResultado(res);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  if (resultado) {
    return <ResultadoIVCFCard resultado={resultado} onClose={onClose} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            Avaliação IVCF-20
          </CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {respondidas}/{total} respondidas
          </span>
        </div>
        {/* Barra de progresso */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(respondidas / total) * 100}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Seção: Dados gerais ─────────────────────────────── */}
        <SecaoIVCF titulo="Dados gerais">
          {/* Idade */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-secondary">Faixa etária</p>
            {residente.data_nascimento && (
              <p className="text-xs text-muted-foreground">
                Calculado automaticamente a partir da data de nascimento
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(["60-74", "75-84", "85+"] as IdadeGrupo[]).map((g) => (
                <BotaoOpcao
                  key={g}
                  label={`${g} anos`}
                  active={form.idade === g}
                  onClick={() => set("idade", g)}
                  disabled={!!residente.data_nascimento}
                />
              ))}
            </div>
          </div>
          {/* Autopercepção */}
          <QuestaoOpcoes
            label="Como o hóspede avalia sua própria saúde?"
            value={form.autopercepcao}
            options={[
              { value: "boa", label: "Excelente / Muito boa / Boa" },
              { value: "ruim", label: "Regular / Ruim" },
            ]}
            onChange={(v) => set("autopercepcao", v as "boa" | "ruim")}
          />
        </SecaoIVCF>

        {/* ── Seção: AVD Instrumentais (teto 4 pts) ───────────── */}
        <SecaoIVCF titulo="AVD Instrumentais" subtitulo="Teto 4 pontos">
          <QuestaoYN label="Dificuldade para fazer compras?" value={form.avdi_compras} onChange={(v) => set("avdi_compras", v)} />
          <QuestaoYN label="Dificuldade para controlar o próprio dinheiro?" value={form.avdi_financeiro} onChange={(v) => set("avdi_financeiro", v)} />
          <QuestaoYN label="Dificuldade para realizar pequenos trabalhos domésticos?" value={form.avdi_trabalhos} onChange={(v) => set("avdi_trabalhos", v)} />
        </SecaoIVCF>

        {/* ── Seção: AVD Básica ────────────────────────────────── */}
        <SecaoIVCF titulo="AVD Básica">
          <QuestaoYN label="Precisa de ajuda para tomar banho?" value={form.avdb_banho} onChange={(v) => set("avdb_banho", v)} />
        </SecaoIVCF>

        {/* ── Seção: Cognição ──────────────────────────────────── */}
        <SecaoIVCF titulo="Cognição">
          <QuestaoYN label="Queixa de esquecimento?" value={form.cogn_esquecimento} onChange={(v) => set("cogn_esquecimento", v)} />
          <QuestaoYN label="Piora do esquecimento no último ano?" value={form.cogn_piora} onChange={(v) => set("cogn_piora", v)} />
          <QuestaoYN label="O esquecimento interfere nas atividades do dia a dia?" value={form.cogn_impacto} onChange={(v) => set("cogn_impacto", v)} />
        </SecaoIVCF>

        {/* ── Seção: Humor ─────────────────────────────────────── */}
        <SecaoIVCF titulo="Humor">
          <QuestaoYN label="Sentiu-se desanimado ou triste com frequência no último mês?" value={form.humor_desanimo} onChange={(v) => set("humor_desanimo", v)} />
          <QuestaoYN label="Perdeu o interesse nas atividades que antes lhe davam prazer?" value={form.humor_interesse} onChange={(v) => set("humor_interesse", v)} />
        </SecaoIVCF>

        {/* ── Seção: Mobilidade MMSS ───────────────────────────── */}
        <SecaoIVCF titulo="Mobilidade — Membros superiores">
          <QuestaoYN label="Dificuldade para elevar os braços acima dos ombros?" value={form.mmss_bracos} onChange={(v) => set("mmss_bracos", v)} />
          <QuestaoYN label="Dificuldade para manusear objetos pequenos?" value={form.mmss_objetos} onChange={(v) => set("mmss_objetos", v)} />
        </SecaoIVCF>

        {/* ── Seção: Capacidade aeróbica/muscular ──────────────── */}
        <SecaoIVCF titulo="Capacidade aeróbica / muscular" subtitulo="Teto 2 pontos · Avalie: perda de peso, IMC, panturrilha, força de preensão">
          <QuestaoTri
            label="Presente alguma condição de sarcopenia ou baixo peso (perda de peso involuntária, IMC < 22, panturrilha < 31 cm, força reduzida)?"
            value={form.capac_aero}
            onChange={(v) => set("capac_aero", v)}
          />
        </SecaoIVCF>

        {/* ── Seção: Mobilidade funcional ──────────────────────── */}
        <SecaoIVCF titulo="Mobilidade funcional">
          <QuestaoYN label="Dificuldade para caminhar (marcha lenta, auxílio ou incapacidade)?" value={form.marcha} onChange={(v) => set("marcha", v)} />
          <QuestaoYN label="2 ou mais quedas no último ano?" value={form.quedas} onChange={(v) => set("quedas", v)} />
        </SecaoIVCF>

        {/* ── Seção: Comunicação e continência ─────────────────── */}
        <SecaoIVCF titulo="Comunicação e continência">
          <QuestaoYN label="Incontinência urinária ou fecal?" value={form.continencia} onChange={(v) => set("continencia", v)} />
          <QuestaoYN label="Problema de visão mesmo com óculos (se usa)?" value={form.visao} onChange={(v) => set("visao", v)} />
          <QuestaoYN label="Problema de audição mesmo com aparelho (se usa)?" value={form.audicao} onChange={(v) => set("audicao", v)} />
        </SecaoIVCF>

        {/* ── Seção: Morbidades múltiplas (teto 4 pts) ─────────── */}
        <SecaoIVCF titulo="Morbidades múltiplas" subtitulo="Teto 4 pontos">
          <QuestaoTri
            label="5 ou mais doenças / condições clínicas diagnosticadas?"
            value={form.morb_doencas}
            onChange={(v) => set("morb_doencas", v)}
          />
          <QuestaoTri
            label="Polifarmácia: 5 ou mais medicamentos de uso contínuo?"
            value={form.morb_polifarmacia}
            onChange={(v) => set("morb_polifarmacia", v)}
          />
          <QuestaoTri
            label="Internação hospitalar nos últimos 6 meses?"
            value={form.morb_internacao}
            onChange={(v) => set("morb_internacao", v)}
          />
        </SecaoIVCF>

        {/* ── Pontuação parcial + salvar ────────────────────────── */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-secondary">
              Pontuação parcial
            </span>
            <span className="text-lg font-bold tabular-nums text-secondary">
              {preview.pontuacao} pts
              {completo && (
                <Badge
                  variant={
                    preview.classificacao === "Grau III"
                      ? "destructive"
                      : preview.classificacao === "Grau II"
                        ? "warning"
                        : "success"
                  }
                  className="ml-2 text-xs"
                >
                  {preview.classificacao}
                </Badge>
              )}
            </span>
          </div>
          {erro && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {erro}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSalvar} disabled={!completo || criar.isPending}>
              {criar.isPending ? "Salvando…" : completo ? "Salvar avaliação" : `Responda todas as questões (${total - respondidas} restantes)`}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={criar.isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Card de resultado ────────────────────────────────────────────────────────

function ResultadoIVCFCard({
  resultado,
  onClose,
}: {
  resultado: ResultadoIVCF;
  onClose: () => void;
}) {
  const varBadge =
    resultado.classificacao === "Grau III"
      ? "destructive"
      : resultado.classificacao === "Grau II"
        ? "warning"
        : "success";

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" />
          Resultado da avaliação IVCF-20
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold tabular-nums text-secondary">
            {resultado.pontuacao}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">pontos</p>
            <Badge variant={varBadge} className="mt-1 text-sm">
              {resultado.classificacao}
            </Badge>
          </div>
        </div>

        {resultado.dominiosAlterados.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-secondary">Domínios alterados</p>
            <div className="flex flex-wrap gap-1.5">
              {resultado.dominiosAlterados.map((d) => (
                <Badge key={d} variant="warning" className="text-xs">{d}</Badge>
              ))}
            </div>
          </div>
        )}

        {resultado.itensIndisponiveis.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-secondary">Itens indisponíveis (não pontuados)</p>
            <div className="flex flex-wrap gap-1.5">
              {resultado.itensIndisponiveis.map((d) => (
                <Badge key={d} variant="muted" className="text-xs">{d}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-secondary/80">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Resultado deve ser interpretado por profissional de saúde no contexto clínico do hóspede.</span>
        </div>

        <p className="text-xs text-muted-foreground">
          O grau de dependência do hóspede foi atualizado para <strong>{resultado.classificacao}</strong>.
        </p>

        <Button onClick={onClose}>Fechar e ver histórico</Button>
      </CardContent>
    </Card>
  );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function Historico({ residenteId }: { residenteId: string }) {
  const evolucoes = useEvolucoes(residenteId);
  const avaliacoes = useAvaliacoesIVCF(residenteId);

  const isLoading = evolucoes.isLoading || avaliacoes.isLoading;

  type ItemHistorico =
    | { tipo: "evolucao"; data: string; item: Evolucao }
    | { tipo: "avaliacao"; data: string; item: AvaliacaoIVCF };

  const itens: ItemHistorico[] = useMemo(() => {
    const lista: ItemHistorico[] = [
      ...(evolucoes.data ?? []).map((e): ItemHistorico => ({ tipo: "evolucao", data: e.registrado_em, item: e })),
      ...(avaliacoes.data ?? []).map((a): ItemHistorico => ({ tipo: "avaliacao", data: a.registrado_em, item: a })),
    ];
    lista.sort((a, b) => b.data.localeCompare(a.data));
    return lista;
  }, [evolucoes.data, avaliacoes.data]);

  if (isLoading) return <LoadingState label="Carregando histórico…" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          Histórico
          {itens.length > 0 && (
            <Badge variant="muted" className="ml-1">{itens.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <EmptyState label="Nenhum registro ainda para este hóspede." />
        ) : (
          <div className="space-y-3">
            {itens.map((h) =>
              h.tipo === "evolucao" ? (
                <ItemEvolucao key={h.item.id} item={h.item} />
              ) : (
                <ItemAvaliacao key={h.item.id} item={h.item} />
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemEvolucao({ item }: { item: Evolucao }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-secondary">Evolução</span>
            <span className="text-xs text-muted-foreground">
              {ouNaoInformado(item.registrado_por)} · {formatarDataHoraBR(item.registrado_em)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-secondary/80">{item.texto}</p>
        </div>
      </div>
    </div>
  );
}

const IVCF_LABEL: Record<string, string> = {
  idade: "Faixa etária",
  autopercepcao: "Autopercepção de saúde",
  avdi_compras: "Dif. para fazer compras",
  avdi_financeiro: "Dif. para controlar dinheiro",
  avdi_trabalhos: "Dif. para trabalhos domésticos",
  avdb_banho: "Precisa ajuda para banho",
  cogn_esquecimento: "Queixa de esquecimento",
  cogn_piora: "Piora do esquecimento",
  cogn_impacto: "Impacto funcional da memória",
  humor_desanimo: "Desânimo / tristeza",
  humor_interesse: "Perda de interesse",
  mmss_bracos: "Dif. para elevar braços",
  mmss_objetos: "Dif. para manusear objetos",
  capac_aero: "Sarcopenia / baixo peso",
  marcha: "Dif. para caminhar",
  quedas: "2+ quedas no último ano",
  continencia: "Incontinência",
  visao: "Problema de visão",
  audicao: "Problema de audição",
  morb_doencas: "5+ doenças",
  morb_polifarmacia: "Polifarmácia",
  morb_internacao: "Internação recente",
};

function formatarResposta(key: string, value: unknown): string {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  if (value === "indisponivel") return "Indisponível";
  if (value === "sim") return "Sim";
  if (value === "nao") return "Não";
  if (value === "boa") return "Excelente / Muito boa / Boa";
  if (value === "ruim") return "Regular / Ruim";
  if (key === "idade") return `${value} anos`;
  return ouNaoInformado(String(value));
}

function ItemAvaliacao({ item }: { item: AvaliacaoIVCF }) {
  const [expandido, setExpandido] = useState(false);
  const varBadge =
    item.classificacao === "Grau III"
      ? "destructive"
      : item.classificacao === "Grau II"
        ? "warning"
        : "success";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary/10 text-secondary">
          <ClipboardList className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-secondary">IVCF-20</span>
            <Badge variant={varBadge} className="text-xs">
              {item.pontuacao_total} pts · {item.classificacao}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {ouNaoInformado(item.registrado_por)} · {formatarDataHoraBR(item.registrado_em)}
            </span>
          </div>

          {item.dominios_alterados.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.dominios_alterados.map((d) => (
                <Badge key={d} variant="muted" className="text-xs">{d}</Badge>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expandido ? (
              <><ChevronUp className="size-3.5" /> Ocultar respostas</>
            ) : (
              <><ChevronDown className="size-3.5" /> Ver respostas</>
            )}
          </button>

          {expandido && (
            <div className="mt-3 space-y-1 border-t pt-3">
              {Object.entries(item.respostas as Record<string, unknown>).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{IVCF_LABEL[key] ?? key}</span>
                  <span
                    className={cn(
                      "font-medium",
                      val === true || val === "sim"
                        ? "text-destructive"
                        : val === "indisponivel"
                          ? "text-muted-foreground"
                          : "text-success",
                    )}
                  >
                    {formatarResposta(key, val)}
                  </span>
                </div>
              ))}
              {item.itens_indisponiveis.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Indisponíveis: {item.itens_indisponiveis.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Primitivos de formulário ─────────────────────────────────────────────────

function SecaoIVCF({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-secondary">{titulo}</h3>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
        {children}
      </div>
    </div>
  );
}

function QuestaoYN({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-secondary leading-snug">{label}</span>
      <div className="flex shrink-0 gap-1">
        <BotaoOpcao label="Sim" active={value === true} onClick={() => onChange(true)} variant="sim" />
        <BotaoOpcao label="Não" active={value === false} onClick={() => onChange(false)} variant="nao" />
      </div>
    </div>
  );
}

function QuestaoTri({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TriOpcao | null;
  onChange: (v: TriOpcao) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-secondary leading-snug">{label}</span>
      <div className="flex shrink-0 flex-wrap gap-1">
        <BotaoOpcao label="Sim" active={value === "sim"} onClick={() => onChange("sim")} variant="sim" />
        <BotaoOpcao label="Não" active={value === "nao"} onClick={() => onChange("nao")} variant="nao" />
        <BotaoOpcao label="N/D" active={value === "indisponivel"} onClick={() => onChange("indisponivel")} />
      </div>
    </div>
  );
}

function QuestaoOpcoes({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-secondary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <BotaoOpcao
            key={o.value}
            label={o.label}
            active={value === o.value}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

function BotaoOpcao({
  label,
  active,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: "sim" | "nao";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-3 py-1 text-xs font-medium transition-colors",
        active && variant === "sim" && "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
        active && variant === "nao" && "bg-success/15 text-success ring-1 ring-success/30",
        active && !variant && "bg-primary text-primary-foreground",
        !active && "bg-muted text-muted-foreground hover:bg-muted/70",
        disabled && "cursor-default opacity-70",
      )}
    >
      {label}
    </button>
  );
}
