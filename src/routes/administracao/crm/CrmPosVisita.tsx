import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, Plus, Trash2, ShieldCheck, MessageCircle } from "lucide-react";
import { useOportunidade } from "@/hooks/useCrm";
import { useBiblioteca, useModelosMensagem, useSalvarPosVisita, useVisitaAgendamento } from "@/hooks/usePosVisita";
import { useTabelaPreco } from "@/hooks/useMensalidades";
import { useTabelaDiaria, valorReferencia } from "@/hooks/useCobrancaTemporaria";
import { usuarioAtual } from "@/auth/usuarioAtual";
import {
  MODALIDADES_SIMULACAO, PERFIS_VISITA, OPCOES_PROXIMO_PASSO, UNIDADES_VALOR, AVISO_SIMULACAO, DESCONTO_SIMULACAO_PCT,
  PLANOS_SENIORS_DAY, calcularOpcao, chaveTabelaPreco, validadeSimulacao, gerarSequencia, modalidadeInfo, camposPendentes, rotuloCampo, dataCurta,
  type DadosMensagem,
} from "@/lib/posVisita";
import { RELACOES_VISITANTE } from "@/lib/crm";
import { TIPOS_SUITE, GRAUS, ocupacoesValidas, precoVigenteEm, formatarMoeda, OCUPACAO_LABEL } from "@/lib/mensalidade";
import { cn, hojeISO } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/states";
import type { GrauDependencia, ModalidadeSimulacao, Ocupacao, OpcaoSimulacao, ProximoPasso, TipoSuite, TipoValorDiaria } from "@/types/database";

// ===========================================================================
// PÓS-VISITA (celular, ~2 minutos): quem visitou, dores e objeção marcadas na
// conversa, "o que ouvimos", simulação e próximos passos. Ao salvar, o app
// monta as mensagens de WhatsApp (3 contatos na primeira semana) com os
// textos da biblioteca — envio manual, pelo número de quem atendeu.
// ===========================================================================

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type GrauSimulacao = GrauDependencia | "MC";
interface OpcaoForm {
  modalidade: ModalidadeSimulacao;
  tipo_suite: TipoSuite;
  ocupacao: Ocupacao;
  grau: GrauSimulacao;
  /** Seniors Day: plano de dias. */
  plano: TipoValorDiaria;
  valorTxt: string;
  unidade: string;
}
const OPCAO_PADRAO: OpcaoForm = { modalidade: "longa_permanencia", tipo_suite: "Suíte", ocupacao: "simples", grau: "II", plano: "sd_2a_6a", valorTxt: "", unidade: "/dia" };

/** Graus oferecidos: Memory Care só na longa permanência (é faixa de preço própria). */
const grausDaModalidade = (m: ModalidadeSimulacao): GrauSimulacao[] => (m === "longa_permanencia" ? [...GRAUS, "MC"] : [...GRAUS]);
const rotuloGrauOpcao = (g: GrauSimulacao) => (g === "MC" ? "Memory Care" : `Grau ${g}`);

const lerValor = (s: string) => {
  const t = s.replace(/[^\d,.-]/g, "");
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function CrmPosVisita() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const navigate = useNavigate();
  const { op: opId, visita: visitaId } = useSearch({ strict: false }) as { op?: string; visita?: string };

  const detalhe = useOportunidade(opId);
  const visita = useVisitaAgendamento(visitaId);
  const biblioteca = useBiblioteca();
  const modelos = useModelosMensagem();
  const precos = useTabelaPreco();
  const diarias = useTabelaDiaria();
  const salvar = useSalvarPosVisita();
  const hoje = hojeISO();

  // Visitante e residente
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [relacao, setRelacao] = useState<string>("Filho(a)");
  const [perfilVisita, setPerfilVisita] = useState<"familia" | "proprio_idoso" | "casal">("familia");
  const [nomeIdoso, setNomeIdoso] = useState("");
  const [chamar, setChamar] = useState("");
  const [tratamento, setTratamento] = useState("");
  const [idade, setIdade] = useState("");
  const [dataVisita, setDataVisita] = useState(hoje);
  // Conversa
  const [dores, setDores] = useState<string[]>([]);
  const [objecao, setObjecao] = useState<string>("");
  const [ouvimos, setOuvimos] = useState("");
  const [detalhe_, setDetalhe] = useState("");
  // Simulação
  const [opcoes, setOpcoes] = useState<OpcaoForm[]>([OPCAO_PADRAO]);
  const [positiva, setPositiva] = useState<boolean | null>(null);
  const [passos, setPassos] = useState<ProximoPasso[]>([{ passo: "", data: null }]);
  const [pergunta, setPergunta] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [carregado, setCarregado] = useState(false);

  // Preenche a partir da oportunidade (refazer) ou da visita da agenda.
  useEffect(() => {
    if (carregado) return;
    if (opId && detalhe.data) {
      const { oportunidade: o, contato: c } = detalhe.data;
      setNome(c?.nome ?? ""); setWhatsapp(c?.telefones?.[0] ?? ""); setEmail(c?.emails?.[0] ?? "");
      if (c?.relacao) setRelacao(c.relacao);
      setNomeIdoso(c?.nome_idoso ?? ""); setIdade(c?.idade_idoso != null ? String(c.idade_idoso) : "");
      setChamar(o.residente_chamar ?? ""); setTratamento(o.residente_tratamento ?? "");
      if (o.perfil_visita) setPerfilVisita(o.perfil_visita);
      if (o.visita_em) setDataVisita(o.visita_em.slice(0, 10));
      setDores(o.dores ?? []); setObjecao(o.objecoes?.[0] ?? "");
      setOuvimos(o.o_que_ouvimos ?? ""); setDetalhe(o.detalhe_pessoal ?? "");
      if (o.simulacao?.opcoes?.length) {
        setOpcoes(o.simulacao.opcoes.map((x) => ({
          modalidade: x.modalidade, tipo_suite: (x.tipo_suite as TipoSuite) ?? "Suíte", ocupacao: (x.ocupacao as Ocupacao) ?? "simples",
          grau: (x.grau as GrauSimulacao) ?? c?.grau_estimado ?? "II",
          plano: x.plano ?? "sd_2a_6a",
          // Valor digitado só volta para o campo quando diferia da tabela.
          valorTxt: modalidadeInfo(x.modalidade).usaTabela || x.valor_final == null || x.valor_final === x.valor_tabela ? "" : String(x.valor_final).replace(".", ","),
          unidade: x.unidade,
        })));
      } else if (c?.grau_estimado) {
        setOpcoes([{ ...OPCAO_PADRAO, grau: c.grau_estimado, tipo_suite: (o.tipo_suite_interesse as TipoSuite) ?? "Suíte" }]);
      }
      setPositiva(o.visita_positiva); setPassos(o.proximos_passos?.length ? o.proximos_passos : [{ passo: "", data: null }]);
      setPergunta(o.pergunta_confirmacao ?? ""); setConsentimento(o.consentimento_whatsapp);
      setCarregado(true);
    } else if (!opId && visitaId && visita.data) {
      setNome(visita.data.nome_completo); setWhatsapp(visita.data.whatsapp ?? ""); setEmail(visita.data.email ?? "");
      if (visita.data.data <= hoje) setDataVisita(visita.data.data);
      setCarregado(true);
    } else if (!opId && !visitaId) {
      setCarregado(true);
    }
  }, [opId, visitaId, detalhe.data, visita.data, carregado, hoje]);

  const listaPrecos = useMemo(() => precos.data ?? [], [precos.data]);
  const listaDiarias = useMemo(() => diarias.data ?? [], [diarias.data]);
  const opcoesCalculadas: OpcaoSimulacao[] = useMemo(() => opcoes.map((o) => {
    const info = modalidadeInfo(o.modalidade);
    const comQuarto = o.modalidade !== "day_use";
    const grauDia = o.grau === "MC" ? null : o.grau;
    let valorTabela: number | null;
    let unidade: string;
    if (info.usaTabela) {
      const k = chaveTabelaPreco(o.modalidade, o.tipo_suite, o.grau, o.ocupacao);
      valorTabela = precoVigenteEm(listaPrecos, k.tipoSuite, k.grau, k.ocupacao, hoje);
      unidade = "/mês";
    } else if (o.modalidade === "day_use") {
      valorTabela = valorReferencia(listaDiarias, "day_care", grauDia, o.plano);
      unidade = PLANOS_SENIORS_DAY.find((p) => p.value === o.plano)?.unidade ?? "/dia";
    } else {
      valorTabela = valorReferencia(listaDiarias, "curta_permanencia", grauDia, "diaria");
      unidade = "/dia";
    }
    const digitado = lerValor(o.valorTxt);
    return calcularOpcao({
      modalidade: o.modalidade,
      tipo_suite: comQuarto ? o.tipo_suite : null,
      ocupacao: comQuarto ? o.ocupacao : null,
      grau: o.grau,
      plano: o.modalidade === "day_use" ? o.plano : null,
      valor_tabela: valorTabela,
      unidade: !info.usaTabela && digitado ? o.unidade : unidade,
    }, digitado);
  }), [opcoes, listaPrecos, listaDiarias, hoje]);

  const validade = validadeSimulacao(dataVisita);
  const doresBib = (biblioteca.data ?? []).filter((b) => b.tipo === "dor" && b.ativo);
  const objBib = (biblioteca.data ?? []).filter((b) => b.tipo === "objecao" && b.ativo);

  const dados: DadosMensagem = {
    visitante: nome, consultor: usuarioAtual.nome, residenteChamar: chamar || null, nomeIdoso: nomeIdoso || null,
    tratamento: tratamento || null, detalhePessoal: detalhe_ || null, oQueOuvimos: ouvimos || null,
    dores, objecoes: objecao ? [objecao] : [], proximosPassos: passos, perguntaConfirmacao: pergunta || null,
    simulacao: opcoesCalculadas, simulacaoValidade: validade, visitaEm: dataVisita, hoje,
  };
  const sequencia = useMemo(
    () => gerarSequencia(dados, biblioteca.data ?? [], modelos.data ?? [], positiva === true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dados), biblioteca.data, modelos.data, positiva],
  );

  if ((opId && detalhe.isLoading) || (visitaId && visita.isLoading) || biblioteca.isLoading || modelos.isLoading) return <LoadingState />;
  if (detalhe.isError) return <ErrorState error={detalhe.error} />;
  if (opId && detalhe.data && (detalhe.data.oportunidade.status === "ganha" || detalhe.data.oportunidade.status === "perdida")) {
    return <ErrorState error={new Error("Esta oportunidade já foi encerrada (vendida ou perdida).")} />;
  }

  function alternarDor(codigo: string) {
    setDores((d) => (d.includes(codigo) ? d.filter((x) => x !== codigo) : [...d, codigo]));
  }
  function mudarOpcao(i: number, patch: Partial<OpcaoForm>) {
    setOpcoes((os) => os.map((o, j) => {
      if (j !== i) return o;
      const n = { ...o, ...patch };
      if (patch.modalidade && patch.modalidade !== o.modalidade) {
        if (n.grau === "MC" && patch.modalidade !== "longa_permanencia") n.grau = "III";
        n.valorTxt = "";
        n.unidade = patch.modalidade === "day_use" && n.plano === "fds_pacote" ? "pacote" : "/dia";
      }
      if (patch.plano) n.unidade = patch.plano === "fds_pacote" ? "pacote" : "/dia";
      if (!ocupacoesValidas(n.tipo_suite).includes(n.ocupacao)) n.ocupacao = "simples";
      return n;
    }));
  }

  async function gravar() {
    if (!nome.trim()) { toast.error("Informe quem visitou."); return; }
    if (!whatsapp.trim()) { toast.error("Informe o WhatsApp de quem visitou."); return; }
    if (dores.length === 0) { toast.error("Marque ao menos uma dor que a família contou."); return; }
    const op1 = opcoesCalculadas[0];
    const payload = {
      oportunidade_id: opId ?? null,
      visita_agendamento_id: visitaId ?? detalhe.data?.oportunidade.visita_agendamento_id ?? null,
      contato: {
        nome: nome.trim(), telefone: whatsapp.trim(), email: email.trim(), relacao,
        nome_idoso: nomeIdoso.trim(), idade_idoso: idade.trim() ? Number(idade) : null, grau_estimado: opcoes[0] && opcoes[0].grau !== "MC" ? opcoes[0].grau : null,
      },
      oportunidade: {
        dores, objecoes: objecao ? [objecao] : [], o_que_ouvimos: ouvimos, detalhe_pessoal: detalhe_,
        residente_chamar: chamar, residente_tratamento: tratamento, perfil_visita: perfilVisita,
        visita_em: `${dataVisita}T12:00:00-03:00`, visita_positiva: positiva,
        simulacao: { opcoes: opcoesCalculadas }, simulacao_validade: validade,
        proximos_passos: passos.filter((p) => p.passo.trim()), pergunta_confirmacao: pergunta,
        consentimento_whatsapp: consentimento,
        valor_mensalidade_estimado: op1 && op1.unidade === "/mês" ? op1.valor_final : null,
        tipo_suite_interesse: op1?.tipo_suite ?? null,
      },
      tarefas: consentimento ? sequencia : [],
    };
    try {
      const id = await salvar.mutateAsync(payload);
      toast.success(consentimento
        ? `Pós-visita salvo. ${sequencia.length} mensagens programadas — a primeira já pode ser enviada.`
        : "Pós-visita salvo. Sem autorização para WhatsApp, nenhuma mensagem foi programada.");
      navigate({ to: `${base}/crm-oportunidade` as string, search: { id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <button onClick={() => (opId ? navigate({ to: `${base}/crm-oportunidade` as string, search: { id: opId } as never }) : navigate({ to: `${base}/crm-agenda` as string }))}
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" /> Voltar
      </button>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Pós-visita</h1>
        <p className="text-sm text-muted-foreground">Até 2 horas depois da visita. Ao salvar, as mensagens de WhatsApp ficam prontas para enviar.</p>
      </div>

      <Secao titulo="Quem visitou">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome *"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputBase} placeholder="Ana Souza" /></Campo>
          <Campo rotulo="WhatsApp *"><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className={inputBase} placeholder="(41) 99999-0000" /></Campo>
          <Campo rotulo="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputBase} /></Campo>
          <Campo rotulo="Parentesco"><select value={relacao} onChange={(e) => setRelacao(e.target.value)} className={inputBase}>{RELACOES_VISITANTE.map((r) => <option key={r}>{r}</option>)}</select></Campo>
          <Campo rotulo="Data da visita"><input type="date" value={dataVisita} max={hoje} onChange={(e) => setDataVisita(e.target.value)} className={inputBase} /></Campo>
          <Grupo rotulo="Quem veio">
            <Chips opcoes={PERFIS_VISITA.map((p) => ({ v: p.value, l: p.label }))} valor={[perfilVisita]} onToggle={(v) => setPerfilVisita(v as typeof perfilVisita)} />
          </Grupo>
        </div>
      </Secao>

      <Secao titulo="Futuro residente">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome"><input value={nomeIdoso} onChange={(e) => setNomeIdoso(e.target.value)} className={inputBase} placeholder="Maria Souza" /></Campo>
          <Campo rotulo="Idade"><input value={idade} onChange={(e) => setIdade(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputBase} /></Campo>
          <Campo rotulo="Como chamar nas mensagens"><input value={chamar} onChange={(e) => setChamar(e.target.value)} className={inputBase} placeholder="Dona Maria" /></Campo>
          <Campo rotulo="Tratamento"><input value={tratamento} onChange={(e) => setTratamento(e.target.value)} className={inputBase} placeholder="sua mãe" /></Campo>
        </div>
      </Secao>

      <Secao titulo="Dores que a família contou" dica="Toque em todas que apareceram. As 2 primeiras entram na mensagem de agradecimento; o conteúdo de cada uma vai junto com o material.">
        <Chips opcoes={doresBib.map((b) => ({ v: b.codigo, l: b.titulo }))} valor={dores} onToggle={alternarDor} numerar />
        <Grupo rotulo="Objeção (uma, se houve)">
          <Chips opcoes={objBib.map((b) => ({ v: b.codigo, l: b.titulo }))} valor={objecao ? [objecao] : []} onToggle={(v) => setObjecao((o) => (o === v ? "" : v))} />
        </Grupo>
        <Campo rotulo="O que ouvimos (nas palavras da família)">
          <textarea value={ouvimos} onChange={(e) => setOuvimos(e.target.value)} rows={2} className={cn(inputBase, "h-auto py-2")}
            placeholder="a Dona Maria caiu duas vezes este ano e vocês moram em Campinas" />
          <span className="text-xs text-muted-foreground">Entra depois de "Vocês nos contaram que…".</span>
        </Campo>
        <Campo rotulo="Um detalhe marcante da visita">
          <input value={detalhe_} onChange={(e) => setDetalhe(e.target.value)} className={inputBase} placeholder="e ouvir as histórias da Dona Maria como professora" />
        </Campo>
      </Secao>

      <Secao titulo="Simulação de valor" dica={`${AVISO_SIMULACAO} Válida até ${dataCurta(validade, true)}. Longa permanência e reabilitação: tabela com ${DESCONTO_SIMULACAO_PCT}% de desconto. Curta permanência e Seniors Day: diária da tabela, sem desconto.`}>
        {opcoes.map((o, i) => {
          const calc = opcoesCalculadas[i];
          const info = modalidadeInfo(o.modalidade);
          return (
            <div key={i} className="space-y-2.5 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-secondary">Opção {i + 1}</span>
                {i > 0 && <button onClick={() => setOpcoes((os) => os.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remover opção"><Trash2 className="size-4" /></button>}
              </div>
              <Chips opcoes={MODALIDADES_SIMULACAO.map((m) => ({ v: m.value, l: m.label }))} valor={[o.modalidade]} onToggle={(v) => mudarOpcao(i, { modalidade: v as ModalidadeSimulacao })} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {o.modalidade !== "day_use" && (
                  <>
                    <Campo rotulo="Suíte"><select value={o.tipo_suite} onChange={(e) => mudarOpcao(i, { tipo_suite: e.target.value as TipoSuite })} className={inputBase}>{TIPOS_SUITE.map((t) => <option key={t}>{t}</option>)}</select></Campo>
                    <Campo rotulo="Ocupação"><select value={o.ocupacao} onChange={(e) => mudarOpcao(i, { ocupacao: e.target.value as Ocupacao })} className={inputBase}>{ocupacoesValidas(o.tipo_suite).map((x) => <option key={x} value={x}>{OCUPACAO_LABEL[x]}</option>)}</select></Campo>
                  </>
                )}
                {o.modalidade === "day_use" && (
                  <Campo rotulo="Plano"><select value={o.plano} onChange={(e) => mudarOpcao(i, { plano: e.target.value as TipoValorDiaria })} className={inputBase}>{PLANOS_SENIORS_DAY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Campo>
                )}
                <Campo rotulo="Grau estimado"><select value={o.grau} onChange={(e) => mudarOpcao(i, { grau: e.target.value as GrauSimulacao })} className={inputBase}>{grausDaModalidade(o.modalidade).map((g) => <option key={g} value={g}>{rotuloGrauOpcao(g)}</option>)}</select></Campo>
              </div>
              {!info.usaTabela && (
                <div className="grid grid-cols-2 gap-2">
                  <Campo rotulo="Outro valor (R$)"><input value={o.valorTxt} onChange={(e) => mudarOpcao(i, { valorTxt: e.target.value })} inputMode="decimal" className={inputBase} placeholder={calc.valor_tabela != null ? formatarMoeda(calc.valor_tabela).replace("R$", "").trim() : "350,00"} /></Campo>
                  <Campo rotulo="Por"><select value={o.unidade} onChange={(e) => mudarOpcao(i, { unidade: e.target.value })} className={inputBase}>{UNIDADES_VALOR.map((u) => <option key={u} value={u}>{u === "pacote" ? "pacote" : u.slice(1)}</option>)}</select></Campo>
                </div>
              )}
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                {info.usaTabela ? (
                  calc.valor_tabela == null ? <span className="text-warning">Sem preço na tabela para essa combinação.</span> : (
                    <span className="text-secondary">
                      {o.modalidade === "reabilitacao" && "Reabilitação (valor único, qualquer acomodação) · "}Tabela {formatarMoeda(calc.valor_tabela)} · <strong>com {calc.desconto_pct}%: {formatarMoeda(calc.valor_final)}/mês</strong>
                    </span>
                  )
                ) : calc.valor_final != null ? (
                  <span className="text-secondary">
                    <strong>{formatarMoeda(calc.valor_final)}{calc.unidade === "pacote" ? " (pacote)" : calc.unidade}</strong>
                    {calc.valor_tabela != null && calc.valor_final !== calc.valor_tabela ? ` · tabela ${formatarMoeda(calc.valor_tabela)}` : calc.valor_tabela != null ? " · tabela, sem desconto" : ""}
                  </span>
                ) : <span className="text-muted-foreground">{o.grau === "MC" ? "Sem diária de Memory Care na tabela: digite o valor." : "Sem valor na tabela: digite o valor (sem desconto)."}</span>}
              </div>
            </div>
          );
        })}
        {opcoes.length < 2 && (
          <Button size="sm" variant="outline" onClick={() => setOpcoes((os) => [...os, { ...os[0], modalidade: os[0].modalidade, tipo_suite: os[0].tipo_suite === "Suíte" ? "Suíte Premium" : "Suíte" }])}>
            <Plus className="size-4" /> Comparar com outra opção
          </Button>
        )}
      </Secao>

      <Secao titulo="Próximos passos combinados">
        {passos.map((p, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-[1_1_100%] sm:flex-1"><Campo rotulo={`Passo ${i + 1}`}>
              <input value={p.passo} onChange={(e) => setPassos((ps) => ps.map((x, j) => (j === i ? { ...x, passo: e.target.value } : x)))} list="opcoes-passo" className={inputBase} placeholder="Almoço experiência" />
            </Campo></div>
            <div className="w-44"><Campo rotulo="Data"><input type="date" value={p.data ?? ""} onChange={(e) => setPassos((ps) => ps.map((x, j) => (j === i ? { ...x, data: e.target.value || null } : x)))} className={inputBase} /></Campo></div>
            <button onClick={() => setPassos((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [{ passo: "", data: null }]))} className="mb-3 text-muted-foreground hover:text-destructive" aria-label="Remover passo"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <datalist id="opcoes-passo">{OPCOES_PROXIMO_PASSO.map((o) => <option key={o} value={o} />)}</datalist>
        {passos.length < 3 && <Button size="sm" variant="outline" onClick={() => setPassos((ps) => [...ps, { passo: "", data: null }])}><Plus className="size-4" /> Passo</Button>}
        <Campo rotulo="Pergunta para fechar a mensagem">
          <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} className={inputBase} placeholder="Essa data do almoço fica boa para vocês?" />
        </Campo>
      </Secao>

      <Secao titulo="Para fechar">
        <Grupo rotulo="A visita foi positiva?">
          <Chips opcoes={[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }]} valor={positiva == null ? [] : [positiva ? "sim" : "nao"]} onToggle={(v) => setPositiva(v === "sim")} />
        </Grupo>
        <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", consentimento ? "border-success/50 bg-success/5" : "border-warning/50 bg-warning/5")}>
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 size-5 accent-primary" />
          <span>
            <span className="flex items-center gap-1.5 font-semibold text-secondary"><ShieldCheck className="size-4" /> A família autorizou receber mensagens pelo WhatsApp</span>
            <span className="block text-xs text-muted-foreground">LGPD: sem essa autorização, o app não programa nenhuma mensagem.</span>
          </span>
        </label>
      </Secao>

      {previa && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-base font-bold text-secondary">Mensagens que vão ficar prontas</h2>
            {sequencia.map((t) => (
              <div key={t.modelo} className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.assunto} · {dataCurta(t.data)}</p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed text-secondary">{t.mensagem}</p>
                {camposPendentes(t.mensagem).length > 0 && (
                  <p className="text-xs text-warning">Na hora de enviar, complete: {camposPendentes(t.mensagem).map(rotuloCampo).join(", ")}.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="outline" onClick={() => setPrevia((v) => !v)}><Eye className="size-4" /> {previa ? "Esconder mensagens" : "Ver mensagens"}</Button>
        <Button onClick={gravar} loading={salvar.isPending} className="flex-1 sm:flex-none">
          {consentimento ? <MessageCircle className="size-4" /> : <Save className="size-4" />} Salvar pós-visita
        </Button>
      </div>
    </div>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="text-base font-bold text-secondary">{titulo}</h2>
          {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

/** Grupo de botões (não é <label>: tocar no título não pode acionar a primeira opção). */
function Grupo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} className="space-y-1">
      <span className="block text-xs font-semibold text-muted-foreground">{rotulo}</span>
      {children}
    </div>
  );
}

function Chips({ opcoes, valor, onToggle, numerar = false }: {
  opcoes: { v: string; l: string }[];
  valor: string[];
  onToggle: (v: string) => void;
  numerar?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const idx = valor.indexOf(o.v);
        const ativo = idx >= 0;
        return (
          <button key={o.v} type="button" onClick={() => onToggle(o.v)} aria-pressed={ativo}
            className={cn(
              "min-h-10 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
              ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-secondary hover:border-primary/50",
            )}>
            {numerar && ativo && <span className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-white/25 text-[11px]">{idx + 1}</span>}
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
