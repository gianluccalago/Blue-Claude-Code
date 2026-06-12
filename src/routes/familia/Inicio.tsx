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
} from "lucide-react";
import { useResidenteFamilia, useFotosResidente } from "@/hooks/useFamilia";
import { useSolicitacoesFamilia } from "@/hooks/useSolicitacoes";
import { useAceitacaoResidenteHoje } from "@/hooks/useMaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { calcularIdade, ouNaoInformado, hojeISO } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Card "O dia de [nome]" — agrega APENAS dados já capturados (aceitação
// alimentar e atividades com foto), em linguagem humana e calorosa.
// REGRA DE SOBRIEDADE: nunca expõe intercorrências, eliminações ou medicação;
// se o dia teve ocorrência grave, este card mostra só o neutro — a
// comunicação sensível é humana, fora do app.
// ---------------------------------------------------------------------------

/** Frase calorosa por nível de aceitação (sem jargão clínico). */
const FRASE_ACEITACAO: Record<string, string> = {
  "Tudo": "comeu muito bem",
  "Quase tudo": "comeu bem",
  "Metade": "comeu metade",
  "Pouco": "aceitou um pouquinho",
  "Nada": "não quis desta vez — a equipe acompanha de perto",
};

function CardDiaDoHospede({ residenteId, nome }: { residenteId: string; nome: string }) {
  const aceitacao = useAceitacaoResidenteHoje(residenteId);
  const fotos = useFotosResidente();

  const primeiroNome = nome.split(" ")[0];
  const refeicoes = aceitacao.data ?? [];

  // Atividade mais recente de hoje (ou de ontem, como fallback caloroso).
  const ontem = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const fotoDoDia =
    (fotos.data ?? []).find((f) => f.data === hojeISO()) ??
    (fotos.data ?? []).find((f) => f.data === ontem) ??
    null;

  const temConteudo = refeicoes.length > 0 || fotoDoDia;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="size-5 text-warning" /> O dia de {primeiroNome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!temConteudo ? (
          // Estado vazio acolhedor — nunca uma tela fria.
          <p className="text-sm leading-relaxed text-muted-foreground">
            O dia de hoje ainda está sendo registrado pela equipe. Volte mais
            tarde para ver como {primeiroNome} está aproveitando o dia. 💙
          </p>
        ) : (
          <>
            {refeicoes.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div className="text-sm leading-relaxed text-secondary">
                  {refeicoes.map(({ refeicao, nivel }) => (
                    <p key={refeicao}>
                      <span className="font-semibold">{refeicao}:</span>{" "}
                      {FRASE_ACEITACAO[nivel] ?? nivel.toLowerCase()}
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
                    {fotoDoDia.data === hojeISO() ? "Hoje" : "Ontem"} {primeiroNome} participou de{" "}
                    <span className="font-semibold">{fotoDoDia.atividadeTitulo}</span>.
                  </p>
                  <img
                    src={fotoDoDia.fotoUrl}
                    alt={fotoDoDia.atividadeTitulo}
                    className="mt-2 max-h-56 w-full rounded-lg border object-cover"
                  />
                  {/* 5.2: a descrição geral da execução vira LEGENDA da foto */}
                  {fotoDoDia.descricaoGeral && (
                    <p className="mt-1.5 text-sm italic text-muted-foreground">
                      "{fotoDoDia.descricaoGeral}"
                    </p>
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

  const r = residente.data;

  return <InicioConteudo r={r} respondidas={respondidas} />;
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
      {/* HERO de boas-vindas — primeira tela da família (celular) */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl"
        />
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

      {/* O DIA DE [NOME] — narrativa do cuidado com dados já capturados */}
      {r && <CardDiaDoHospede residenteId={r.id} nome={r.nome} />}

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
