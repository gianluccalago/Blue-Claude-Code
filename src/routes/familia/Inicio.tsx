import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  Cake,
  UserRound,
  Image as ImageIcon,
  CalendarClock,
  Wallet,
  MessageSquare,
  ArrowRight,
  Sun,
  UtensilsCrossed,
  Sparkles,
  Phone,
  Heart,
  Activity,
  CalendarCheck,
} from "lucide-react";
import {
  useResidenteFamilia,
  useFotosResidente,
  useParticipacoesResidente,
  useCompromissosResidente,
} from "@/hooks/useFamilia";
import { useRecadosResidente } from "@/hooks/useRecados";
import { useTelefonePlantao } from "@/hooks/useConfiguracao";
import { useSolicitacoesFamilia } from "@/hooks/useSolicitacoes";
import { useAceitacaoResidenteHoje } from "@/hooks/useMaster";
import { FAMILIA_ATUAL } from "@/data/profiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { calcularIdade, ouNaoInformado, hojeISO, dataISO, somarDias, formatarDataBR, formatarDataHoraBR } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Portal da Família — régua de conteúdo: BEM-ESTAR, VIDA e PRESENÇA. Nunca
// dados clínicos crus (eliminações, medicação, peso, sinais). Tom acolhedor.
// ---------------------------------------------------------------------------

/** Frases POSITIVAS de refeição (sem jargão clínico). Aceitação baixa é OMITIDA
 *  — jamais "recusou"/alarme; o sensível é comunicado pela equipe, com contexto. */
const FRASE_ACEITACAO_POSITIVA: Record<string, string> = {
  Tudo: "comeu muito bem",
  "Quase tudo": "comeu bem",
  Metade: "aceitou bem a refeição",
};

/** "a", "a e b", "a, b e c". */
function juntarE(itens: string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

// ─── Recado da equipe (alto valor emocional) ──────────────────────────────────
function CardRecadoEquipe() {
  const recados = useRecadosResidente(FAMILIA_ATUAL.residenteId);
  const [verTodos, setVerTodos] = useState(false);
  const lista = recados.data ?? [];
  if (lista.length === 0) return null; // toque opcional: sem recado, portal segue normal

  const ultimo = lista[0];
  const anteriores = lista.slice(1);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-secondary">
          <Heart className="size-5 text-primary" /> Da nossa equipe para você
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[15px] leading-relaxed text-secondary">{ultimo.mensagem}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {ultimo.autor ? `${ultimo.autor} · ` : ""}{formatarDataHoraBR(ultimo.criado_em)}
          </p>
        </div>

        {anteriores.length > 0 && (
          <div className="border-t border-primary/15 pt-2">
            <button
              onClick={() => setVerTodos((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {verTodos ? "Ocultar recados anteriores" : `Ver recados anteriores (${anteriores.length})`}
            </button>
            {verTodos && (
              <div className="mt-2 space-y-2.5">
                {anteriores.map((r) => (
                  <div key={r.id} className="rounded-lg bg-card/60 p-2.5">
                    <p className="text-sm leading-relaxed text-secondary/90">{r.mensagem}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.autor ? `${r.autor} · ` : ""}{formatarDataHoraBR(r.criado_em)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Contato direto com o plantão (número fixo da casa). */
function CardPlantao({ primeiroNome }: { primeiroNome: string }) {
  const telefone = useTelefonePlantao();
  const numero = telefone.data ?? null;
  const numeroLimpo = numero ? numero.replace(/\D/g, "") : "";
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Phone className="size-4" /> Contato direto com o plantão
        </div>
        {numero ? (
          <a href={`tel:${numeroLimpo}`} className="block text-2xl font-extrabold tracking-tight text-secondary hover:underline">
            {numero}
          </a>
        ) : (
          <p className="text-2xl font-extrabold text-muted-foreground">Não informado</p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Use este número apenas para <strong>emergências</strong> ou para falar diretamente com{" "}
          <strong>{primeiroNome}</strong>. Para solicitações e dúvidas do dia a dia, utilize o
          aplicativo — assim garantimos o melhor atendimento.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── "O dia de [nome]" — atividades + refeições positivas + foto ──────────────
function CardDiaDoHospede({ residenteId, nome }: { residenteId: string; nome: string }) {
  const aceitacao = useAceitacaoResidenteHoje(residenteId);
  const fotos = useFotosResidente();
  const participacoes = useParticipacoesResidente();

  const primeiroNome = nome.split(" ")[0];
  const hoje = hojeISO();

  // Refeições — só as positivas (baixa aceitação é omitida).
  const refeicoesPositivas = (aceitacao.data ?? []).filter((r) => FRASE_ACEITACAO_POSITIVA[r.nivel]);

  // Atividades de hoje (títulos distintos).
  const titulosHoje = [...new Set((participacoes.data ?? []).filter((p) => p.data === hoje).map((p) => p.atividadeTitulo))];

  // Foto do dia (hoje ou, como carinho, de ontem). Dia civil no fuso da casa.
  const ontem = dataISO(somarDias(new Date(), -1));
  const fotoDoDia =
    (fotos.data ?? []).find((f) => f.data === hoje) ??
    (fotos.data ?? []).find((f) => f.data === ontem) ??
    null;

  const temConteudo = titulosHoje.length > 0 || refeicoesPositivas.length > 0 || !!fotoDoDia;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="size-5 text-warning" /> O dia de {primeiroNome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!temConteudo ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            O dia de hoje ainda está sendo registrado pela equipe. Volte mais tarde para ver como{" "}
            {primeiroNome} está aproveitando o dia. 💙
          </p>
        ) : (
          <>
            {titulosHoje.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                  <Activity className="size-4" />
                </div>
                <p className="text-sm leading-relaxed text-secondary">
                  Hoje {primeiroNome} participou de <span className="font-semibold">{juntarE(titulosHoje)}</span>.
                </p>
              </div>
            )}

            {refeicoesPositivas.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div className="text-sm leading-relaxed text-secondary">
                  {refeicoesPositivas.map(({ refeicao, nivel }) => (
                    <p key={refeicao}>
                      <span className="font-semibold">{refeicao}:</span> {FRASE_ACEITACAO_POSITIVA[nivel]}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {fotoDoDia && (
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-secondary">
                    {fotoDoDia.data === hoje ? "Um momento de hoje" : "Um momento de ontem"} —{" "}
                    <span className="font-semibold">{fotoDoDia.atividadeTitulo}</span>.
                  </p>
                  <img
                    src={fotoDoDia.fotoUrl}
                    alt={fotoDoDia.atividadeTitulo}
                    loading="lazy"
                    className="mt-2 max-h-56 w-full rounded-lg border object-cover"
                  />
                  {fotoDoDia.descricaoGeral && (
                    <p className="mt-1.5 text-sm italic text-muted-foreground">"{fotoDoDia.descricaoGeral}"</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Vida ativa do mês (resumo leve, sem clínica) ─────────────────────────────
function CardVidaAtiva({ nome }: { nome: string }) {
  const participacoes = useParticipacoesResidente();
  const primeiroNome = nome.split(" ")[0];
  const mes = hojeISO().slice(0, 7);
  const doMes = (participacoes.data ?? []).filter((p) => p.data.slice(0, 7) === mes);
  if (doMes.length === 0) return null;

  const tipos = [...new Set(doMes.map((p) => p.atividadeTitulo))];
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Activity className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-secondary">
            Este mês, {primeiroNome} já participou de{" "}
            <span className="font-bold text-primary">{doMes.length}</span>{" "}
            {doMes.length === 1 ? "atividade" : "atividades"} — vida ativa e bem acompanhada. 💙
          </p>
          {tipos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tipos.slice(0, 6).map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Próximos compromissos ────────────────────────────────────────────────────
function CardProximosCompromissos({ nome }: { nome: string }) {
  const compromissos = useCompromissosResidente();
  const primeiroNome = nome.split(" ")[0];
  const hoje = hojeISO();
  const proximos = (compromissos.data ?? []).filter((c) => c.data && c.data >= hoje).slice(0, 4);
  if (proximos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-5 text-primary" /> Próximos compromissos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {proximos.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <div className="min-w-0">
              <p className="font-semibold text-secondary">{c.titulo}</p>
              {c.detalhes && <p className="truncate text-xs text-muted-foreground">{c.detalhes}</p>}
            </div>
            <div className="shrink-0 text-right text-sm">
              <p className="font-semibold text-secondary">{c.data ? formatarDataBR(c.data) : "A definir"}</p>
              {c.horario && <p className="text-xs text-muted-foreground">{c.horario.slice(0, 5)}</p>}
            </div>
          </div>
        ))}
        <Link to="/app/familia/compromissos-familia" className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary hover:underline">
          Ver todos os compromissos de {primeiroNome} <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

const ATALHOS = [
  { to: "/app/familia/fotos", label: "Fotos", descricao: "Fotos das atividades do hóspede", icon: ImageIcon },
  { to: "/app/familia/compromissos-familia", label: "Compromissos", descricao: "Agenda externa e detalhes", icon: CalendarClock },
  { to: "/app/familia/mensalidade-familia", label: "Mensalidade e extras", descricao: "Demonstrativo do mês", icon: Wallet },
  { to: "/app/familia/solicitacoes", label: "Solicitações", descricao: "Fale com a Coordenação, Médico ou Administração", icon: MessageSquare },
] as const;

export function Inicio() {
  const residente = useResidenteFamilia();
  const solicitacoes = useSolicitacoesFamilia();

  const respondidas = (solicitacoes.data ?? []).filter((s) => s.status === "respondida").length;

  if (residente.isLoading) return <LoadingState />;
  if (residente.isError) return <ErrorState error={residente.error} />;

  return <InicioConteudo r={residente.data} respondidas={respondidas} />;
}

function InicioConteudo({
  r,
  respondidas,
}: {
  r: ReturnType<typeof useResidenteFamilia>["data"];
  respondidas: number;
}) {
  return (
    <div className="space-y-6">
      {/* HERO de boas-vindas */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="grid size-20 shrink-0 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 backdrop-blur-sm">
            <UserRound className="size-10 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Acompanhamento de</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{ouNaoInformado(r?.nome)}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-white/85 backdrop-blur-sm">
                <BedDouble className="size-4" /> Quarto {ouNaoInformado(r?.quarto)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-white/85 backdrop-blur-sm">
                <Cake className="size-4" />
                {r?.data_nascimento && calcularIdade(r.data_nascimento) !== null
                  ? `${calcularIdade(r.data_nascimento)} anos`
                  : "Não informado"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recado da equipe — destaque emocional (some quando não há). Só com
          hóspede ATIVO: inativado some do portal (não vaza recado antigo). */}
      {r && <CardRecadoEquipe />}

      {/* O DIA DE [NOME] */}
      {r && <CardDiaDoHospede residenteId={r.id} nome={r.nome} />}

      {/* Vida ativa do mês */}
      {r && <CardVidaAtiva nome={r.nome} />}

      {/* Próximos compromissos */}
      {r && <CardProximosCompromissos nome={r.nome} />}

      {/* Contato direto com o plantão */}
      {r && <CardPlantao primeiroNome={r.nome.split(" ")[0]} />}

      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ATALHOS.map((a) => {
            const isSolicitacoes = a.to === "/app/familia/solicitacoes";
            return (
              <Link
                key={a.to}
                to={a.to}
                className="group flex min-h-[56px] items-center gap-3 rounded-lg border border-border/70 bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
                  <a.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-secondary">{a.label}</p>
                  <p className="text-sm text-muted-foreground">{a.descricao}</p>
                </div>
                {isSolicitacoes && respondidas > 0 ? (
                  <Badge variant="success" className="shrink-0">
                    {respondidas} resposta{respondidas > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
