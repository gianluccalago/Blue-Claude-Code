/**
 * Inspeção de Suítes — Hotelaria (BLOCO H1)
 * Fluxo: lista de suítes → formulário de inspeção / histórico.
 */
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useSearch } from "@tanstack/react-router";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  History,
  Check,
  X,
  MinusCircle,
  Camera,
  ImageIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useInspecoesHoje,
  useInspecoesDaSuite,
  useItensDaInspecao,
  useSalvarInspecao,
  type ItemInspecaoInput,
} from "@/hooks/useHotelaria";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";
import { DESTINO_CHAMADO } from "@/lib/manutencao";
import { uploadFotoInspecao } from "@/lib/storage";
import type {
  InspecaoSuite,
  InspecaoItem,
  Residente,
  TipoInspecao,
  StatusItemInspecao,
  DestinoChamado,
} from "@/types/database";

// ─── Itens por tipo de inspeção ───────────────────────────────────────────────

const ITENS_DIARIA = [
  "Arrumação",
  "Limpeza geral",
  "Lixo recolhido",
  "Banheiro higienizado",
  "Roupa de cama trocada",
  "Iluminação funcionando",
  "Climatização funcionando",
  "Botão/chamada de emergência testado",
];

const ITENS_PREVENTIVA = [
  "TV",
  "Ar-condicionado (revisão)",
  "Tomadas e elétrica",
  "Sinais de infiltração",
  "Mobiliário",
  "Fechaduras/portas",
  "Janelas",
  "Vidros",
  "Higienização da sacada",
];

// Itens que aceitam "Não se aplica" (N/A) — ex.: nem todo quarto tem sacada.
const ITENS_COM_NA = new Set<string>(["Higienização da sacada"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extrairErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

type StatusSuite = "conforme" | "nao_conformidade" | "pendente";

function statusDaSuite(
  residenteId: string,
  inspecoesHoje: InspecaoSuite[]
): StatusSuite {
  const diarias = inspecoesHoje.filter(
    (i) => i.residente_id === residenteId && i.tipo === "diaria"
  );
  if (diarias.length === 0) return "pendente";
  if (diarias.some((i) => i.tem_nao_conformidade)) return "nao_conformidade";
  return "conforme";
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tela = "lista" | "form" | "historico";

export function InspecaoSuites() {
  const { data: residentes = [], isLoading: loadRes, error: errRes } = useResidentes();
  const { data: inspecoesHoje = [], isLoading: loadInsp } = useInspecoesHoje();

  const [tela, setTela] = useState<Tela>("lista");
  const [residenteSelecionado, setResidenteSelecionado] = useState<Residente | null>(null);

  // Apenas residentes com quarto definido participam da inspeção
  const suitesComQuarto = useMemo(
    () => residentes.filter((r) => r.quarto),
    [residentes]
  );

  // Vindo do Painel da Hotelaria (?residente=ID): abre direto a inspeção da suíte.
  const search = useSearch({ strict: false }) as { residente?: string };
  const [autoAbriu, setAutoAbriu] = useState(false);
  useEffect(() => {
    if (autoAbriu || !search.residente || suitesComQuarto.length === 0) return;
    const r = suitesComQuarto.find((x) => x.id === search.residente);
    if (r) {
      setResidenteSelecionado(r);
      setTela("form");
    }
    setAutoAbriu(true);
  }, [search.residente, suitesComQuarto, autoAbriu]);

  const contadores = useMemo(() => {
    let pendentes = 0;
    let comNaoConformidade = 0;
    for (const r of suitesComQuarto) {
      const st = statusDaSuite(r.id, inspecoesHoje);
      if (st === "pendente") pendentes++;
      if (st === "nao_conformidade") comNaoConformidade++;
    }
    return { pendentes, comNaoConformidade };
  }, [suitesComQuarto, inspecoesHoje]);

  if (loadRes || loadInsp) return <LoadingState />;
  if (errRes) return <ErrorState error={errRes} />;
  if (suitesComQuarto.length === 0)
    return <EmptyState label="Nenhum hóspede com quarto cadastrado." />;

  function abrirForm(r: Residente) {
    setResidenteSelecionado(r);
    setTela("form");
  }

  function abrirHistorico(r: Residente) {
    setResidenteSelecionado(r);
    setTela("historico");
  }

  function voltarLista() {
    setTela("lista");
    setResidenteSelecionado(null);
  }

  // Próxima suíte na ordem da lista (por quarto) — para o fluxo serial.
  function proximaSuite(atual: Residente): Residente | null {
    const idx = suitesComQuarto.findIndex((r) => r.id === atual.id);
    return idx >= 0 && idx < suitesComQuarto.length - 1 ? suitesComQuarto[idx + 1] : null;
  }

  if (tela === "form" && residenteSelecionado) {
    const prox = proximaSuite(residenteSelecionado);
    const indiceAtual = suitesComQuarto.findIndex((r) => r.id === residenteSelecionado.id);
    return (
      <FormInspecao
        key={residenteSelecionado.id}
        residente={residenteSelecionado}
        onVoltar={voltarLista}
        onSalvo={voltarLista}
        proxima={prox}
        onProxima={
          prox
            ? () => {
                setResidenteSelecionado(prox);
                // permanece na tela "form"
              }
            : undefined
        }
        progresso={`${indiceAtual + 1} / ${suitesComQuarto.length}`}
      />
    );
  }

  if (tela === "historico" && residenteSelecionado) {
    return (
      <HistoricoSuite
        residente={residenteSelecionado}
        onVoltar={voltarLista}
        onNovaInspecao={() => setTela("form")}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Inspeção de suítes</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <Card className={cn("border-l-4", contadores.pendentes > 0 ? "border-l-warning" : "border-l-success")}>
          <CardContent className="flex items-center gap-3 pt-4 pb-3">
            <Clock className={cn("h-5 w-5", contadores.pendentes > 0 ? "text-warning" : "text-success")} />
            <div>
              <p className="text-2xl font-extrabold leading-none tracking-tight tabular-nums">{contadores.pendentes}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pendentes hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", contadores.comNaoConformidade > 0 ? "border-l-destructive" : "border-l-success")}>
          <CardContent className="flex items-center gap-3 pt-4 pb-3">
            <AlertTriangle className={cn("h-5 w-5", contadores.comNaoConformidade > 0 ? "text-destructive" : "text-success")} />
            <div>
              <p className="text-2xl font-extrabold leading-none tracking-tight tabular-nums">{contadores.comNaoConformidade}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Não-conformidades</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de suítes */}
      <div className="space-y-2">
        {suitesComQuarto.map((res) => {
          const st = statusDaSuite(res.id, inspecoesHoje);
          return (
            <Card key={res.id} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                {/* Indicador de status */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    st === "conforme" && "bg-success/10 text-success",
                    st === "nao_conformidade" && "bg-destructive/10 text-destructive",
                    st === "pendente" && "bg-muted text-muted-foreground"
                  )}
                >
                  {st === "conforme" && <CheckCircle2 className="h-5 w-5" />}
                  {st === "nao_conformidade" && <AlertTriangle className="h-5 w-5" />}
                  {st === "pendente" && <Clock className="h-5 w-5" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{res.nome}</p>
                  <p className="text-xs text-muted-foreground">Quarto {res.quarto}</p>
                </div>

                {/* Badge de status */}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs hidden sm:inline-flex",
                    st === "conforme" && "border-success text-success",
                    st === "nao_conformidade" && "border-destructive text-destructive",
                    st === "pendente" && "border-warning text-warning-foreground"
                  )}
                >
                  {st === "conforme" && "Inspecionada"}
                  {st === "nao_conformidade" && "Não-conformidade"}
                  {st === "pendente" && "Pendente"}
                </Badge>

                {/* Ações */}
                <div className="flex gap-1.5 ml-2">
                  <Button
                    size="sm"
                    variant={st === "pendente" ? "default" : "outline"}
                    className="text-xs gap-1 h-8"
                    onClick={() => abrirForm(res)}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Inspecionar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1 h-8"
                    onClick={() => abrirHistorico(res)}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Histórico</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Formulário de inspeção ───────────────────────────────────────────────────

function FormInspecao({
  residente,
  onVoltar,
  onSalvo,
  proxima,
  onProxima,
  progresso,
}: {
  residente: Residente;
  onVoltar: () => void;
  onSalvo: () => void;
  proxima?: Residente | null;
  onProxima?: () => void;
  progresso?: string;
}) {
  const [tipo, setTipo] = useState<TipoInspecao>("diaria");
  const [respostas, setRespostas] = useState<Record<string, StatusItemInspecao | undefined>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  // Destino do chamado gerado por cada item não conforme (default: serviços gerais).
  const [destinos, setDestinos] = useState<Record<string, DestinoChamado>>({});
  // Foto opcional do problema por item não conforme (enviada ao Storage ao salvar).
  const [fotos, setFotos] = useState<Record<string, File | null>>({});
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarInspecao();
  const [enviando, setEnviando] = useState(false);

  const itens = tipo === "diaria" ? ITENS_DIARIA : ITENS_PREVENTIVA;
  const totalRespondidos = itens.filter((it) => respostas[it] !== undefined).length;
  const todosRespondidos = totalRespondidos === itens.length;

  function toggleResposta(item: string, status: StatusItemInspecao) {
    setRespostas((prev) => {
      const novo = prev[item] === status ? undefined : status;
      // Ao deixar de ser "não conforme", limpa observação, destino e foto do item.
      if (novo !== "nao_conforme") {
        setObservacoes((o) => ({ ...o, [item]: "" }));
        setFotos((f) => ({ ...f, [item]: null }));
      }
      return { ...prev, [item]: novo };
    });
  }

  function mudarTipo(t: TipoInspecao) {
    setTipo(t);
    setRespostas({});
    setObservacoes({});
    setDestinos({});
    setFotos({});
    setErro(null);
  }

  async function handleSalvar(avancar: boolean) {
    if (!todosRespondidos) {
      setErro("Responda todos os itens antes de salvar.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      // Sobe as fotos dos itens não conformes (opcional; falha não quebra o fluxo).
      const fotoUrlPorItem: Record<string, string | null> = {};
      let algumaFalhou = false;
      for (const it of itens) {
        const file = fotos[it];
        if (respostas[it] === "nao_conforme" && file) {
          const url = await uploadFotoInspecao(file, residente.id);
          fotoUrlPorItem[it] = url;
          if (!url) algumaFalhou = true;
        }
      }
      if (algumaFalhou) {
        toast.warning("Alguma foto não pôde ser enviada — a inspeção foi salva sem ela.");
      }

      const itensSalvar: ItemInspecaoInput[] = itens.map((it) => ({
        item: it,
        status: respostas[it]!,
        observacao: observacoes[it] || null,
        destino: respostas[it] === "nao_conforme" ? (destinos[it] ?? "servicos_gerais") : undefined,
        fotoUrl: respostas[it] === "nao_conforme" ? (fotoUrlPorItem[it] ?? null) : null,
      }));
      await salvar.mutateAsync({
        residenteId: residente.id,
        quarto: residente.quarto ?? null,
        tipo,
        itens: itensSalvar,
      });
      toast.success(`Inspeção de ${residente.nome} salva.`);
      if (avancar && onProxima) {
        onProxima();
      } else {
        onSalvo();
      }
    } catch (e) {
      setErro(extrairErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const naoConformes = itens.filter((it) => respostas[it] === "nao_conforme").length;

  return (
    <div className="space-y-5 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1 -ml-1">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
        {progresso && (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            Suíte {progresso}
          </span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Nova inspeção</h1>
        <p className="text-sm text-muted-foreground">
          {residente.nome} · Quarto {residente.quarto ?? "Não informado"}
        </p>
      </div>

      {/* Seletor de tipo */}
      <div className="flex gap-2">
        <button
          onClick={() => mudarTipo("diaria")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
            tipo === "diaria"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent"
          )}
        >
          <ClipboardCheck className="h-3.5 w-3.5" /> Diária
        </button>
        <button
          onClick={() => mudarTipo("preventiva")}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
            tipo === "preventiva"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" /> Preventiva
        </button>
      </div>

      {/* Progresso */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalRespondidos} / {itens.length} itens respondidos</span>
        {naoConformes > 0 && (
          <span className="text-destructive font-medium">
            {naoConformes} não conforme{naoConformes > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            naoConformes > 0 ? "bg-destructive" : "bg-success"
          )}
          style={{ width: `${(totalRespondidos / itens.length) * 100}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {itens.map((item) => {
          const resp = respostas[item];
          const isNaoConforme = resp === "nao_conforme";
          const aceitaNA = ITENS_COM_NA.has(item);
          return (
            <Card
              key={item}
              className={cn(
                "transition-colors",
                resp === "conforme" && "border-success/50 bg-success/5",
                resp === "nao_conforme" && "border-destructive/50 bg-destructive/5",
                resp === "nao_se_aplica" && "border-border bg-muted/30"
              )}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex-1 text-sm font-medium">{item}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => toggleResposta(item, "conforme")}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        resp === "conforme"
                          ? "bg-success border-success text-white"
                          : "bg-background hover:bg-success/10 hover:border-success/60 hover:text-success"
                      )}
                    >
                      <Check className="h-3 w-3" /> Conforme
                    </button>
                    <button
                      onClick={() => toggleResposta(item, "nao_conforme")}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        resp === "nao_conforme"
                          ? "bg-destructive border-destructive text-white"
                          : "bg-background hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive"
                      )}
                    >
                      <X className="h-3 w-3" /> Não conforme
                    </button>
                    {aceitaNA && (
                      <button
                        onClick={() => toggleResposta(item, "nao_se_aplica")}
                        title="Não se aplica (ex.: quarto sem sacada) — neutro, não gera chamado"
                        className={cn(
                          "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          resp === "nao_se_aplica"
                            ? "bg-muted-foreground border-muted-foreground text-white"
                            : "bg-background hover:bg-muted hover:border-muted-foreground/60 hover:text-muted-foreground"
                        )}
                      >
                        <MinusCircle className="h-3 w-3" /> Não se aplica
                      </button>
                    )}
                  </div>
                </div>

                {/* Observação + destino + foto do chamado — só ao marcar não conforme */}
                {isNaoConforme && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Descreva o problema (opcional)"
                      value={observacoes[item] ?? ""}
                      onChange={(e) =>
                        setObservacoes((prev) => ({ ...prev, [item]: e.target.value }))
                      }
                      className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />

                    {/* Foto opcional do problema */}
                    <div>
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Camera className="h-3.5 w-3.5" /> Foto do problema (opcional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setFotos((prev) => ({ ...prev, [item]: e.target.files?.[0] ?? null }))
                        }
                        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
                      />
                      {fotos[item] && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-success">
                          <ImageIcon className="h-3 w-3" /> {fotos[item]!.name} — anexada ao chamado
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        Direcionar o chamado para
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {DESTINO_CHAMADO.map((d) => {
                          const ativo = (destinos[item] ?? "servicos_gerais") === d.value;
                          return (
                            <button
                              key={d.value}
                              type="button"
                              title={d.dica}
                              onClick={() => setDestinos((prev) => ({ ...prev, [item]: d.value }))}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                ativo
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "bg-background hover:border-primary/50",
                              )}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Erro */}
      {erro && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erro}
        </p>
      )}

      {/* Salvar */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={!todosRespondidos || enviando || salvar.isPending}
          onClick={() => handleSalvar(false)}
        >
          <ClipboardCheck className="h-4 w-4" />
          {enviando || salvar.isPending ? "Salvando…" : "Salvar e voltar"}
        </Button>
        <Button
          className="w-full gap-2"
          disabled={!todosRespondidos || enviando || salvar.isPending || !proxima}
          onClick={() => handleSalvar(true)}
        >
          <ClipboardCheck className="h-4 w-4" />
          {proxima ? "Salvar e próxima ▸" : "Salvar (última)"}
        </Button>
      </div>
      {proxima && (
        <p className="text-center text-xs text-muted-foreground">
          Próxima: <span className="font-semibold">{proxima.nome}</span> · Quarto {proxima.quarto ?? "—"}
        </p>
      )}

      {naoConformes > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {naoConformes} não conformidade{naoConformes > 1 ? "s" : ""} serão registradas
          {" "}e gerarão chamado{naoConformes > 1 ? "s" : ""} de manutenção automaticamente.
        </p>
      )}
    </div>
  );
}

// ─── Histórico da suíte ───────────────────────────────────────────────────────

function HistoricoSuite({
  residente,
  onVoltar,
  onNovaInspecao,
}: {
  residente: Residente;
  onVoltar: () => void;
  onNovaInspecao: () => void;
}) {
  const { data: inspecoes = [], isLoading, error } = useInspecoesDaSuite(residente.id);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="gap-1 -ml-1">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Histórico de inspeções</h1>
          <p className="text-sm text-muted-foreground">
            {residente.nome} · Quarto {residente.quarto ?? "Não informado"}
          </p>
        </div>
        <Button size="sm" className="gap-1 shrink-0" onClick={onNovaInspecao}>
          <ClipboardCheck className="h-4 w-4" /> Nova inspeção
        </Button>
      </div>

      {inspecoes.length === 0 ? (
        <EmptyState label="Nenhuma inspeção registrada para esta suíte." />
      ) : (
        <div className="space-y-2">
          {inspecoes.map((insp) => (
            <InspecaoCard key={insp.id} inspecao={insp} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de inspeção (expansível) ───────────────────────────────────────────

function InspecaoCard({ inspecao }: { inspecao: InspecaoSuite }) {
  const [expandido, setExpandido] = useState(false);
  const { data: itens = [], isLoading } = useItensDaInspecao(expandido ? inspecao.id : null);

  return (
    <Card className={cn(inspecao.tem_nao_conformidade && "border-destructive/30")}>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center gap-3 p-4 text-left"
          onClick={() => setExpandido((v) => !v)}
        >
          {/* Status ícone */}
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              inspecao.tem_nao_conformidade ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
            )}
          >
            {inspecao.tem_nao_conformidade ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{formatarData(inspecao.data)}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {inspecao.tipo === "diaria" ? "Diária" : "Preventiva"}
              </Badge>
              {inspecao.tem_nao_conformidade && (
                <Badge variant="destructive" className="text-xs">
                  Não-conformidade
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {inspecao.inspecionado_por} · {formatarDataHoraBR(inspecao.inspecionado_em)}
            </p>
          </div>

          {expandido ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Detalhes expandidos */}
        {expandido && (
          <div className="border-t px-4 pb-4 pt-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando itens…</p>
            ) : (
              <div className="space-y-1.5">
                {itens.map((item) => (
                  <ItemInspecaoRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemInspecaoRow({ item }: { item: InspecaoItem }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        {item.status === "conforme" ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : item.status === "nao_se_aplica" ? (
          <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <X className="h-3.5 w-3.5 shrink-0 text-destructive" />
        )}
        <span
          className={cn(
            "text-sm",
            item.status === "nao_conforme" && "font-medium text-destructive",
            item.status === "nao_se_aplica" && "text-muted-foreground"
          )}
        >
          {item.item}
        </span>
        {item.status === "nao_se_aplica" && (
          <Badge variant="muted" className="text-[10px]">Não se aplica</Badge>
        )}
      </div>
      {item.observacao && (
        <p className="ml-5 text-xs text-muted-foreground italic">"{item.observacao}"</p>
      )}
      {item.foto_url && (
        <a
          href={item.foto_url}
          target="_blank"
          rel="noreferrer"
          className="ml-5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ImageIcon className="h-3 w-3" /> Ver foto do problema
        </a>
      )}
    </div>
  );
}
