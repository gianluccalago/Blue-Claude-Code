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
} from "lucide-react";
import { useResidenteFamilia } from "@/hooks/useFamilia";
import { useSolicitacoesFamilia } from "@/hooks/useSolicitacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { calcularIdade, ouNaoInformado } from "@/lib/utils";

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
