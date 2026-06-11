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
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:text-left">
          <div className="grid size-20 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <UserRound className="size-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-secondary">{ouNaoInformado(r?.nome)}</h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
              <span className="flex items-center gap-1.5">
                <BedDouble className="size-4" /> Quarto {ouNaoInformado(r?.quarto)}
              </span>
              <span className="flex items-center gap-1.5">
                <Cake className="size-4" />
                {r?.data_nascimento && calcularIdade(r.data_nascimento) !== null
                  ? `${calcularIdade(r.data_nascimento)} anos`
                  : "Não informado"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

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
                className="flex min-h-[56px] items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
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
