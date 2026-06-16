import { BedDouble, Cake, AlertCircle, Wrench, User, Phone, BookOpen, ArrowRight } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { DietaResumo } from "@/components/nutricao/DietaResumo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { calcularIdade, ouNaoInformado } from "@/lib/utils";
import type { Residente } from "@/types/database";

export function Hospedes() {
  const { data, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const { perfil } = useParams({ strict: false }) as { perfil?: string };

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!data || data.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {data.map((h) => (
          <HospedeCard key={h.id} hospede={h} perfil={perfil ?? "cuidador"} />
        ))}
      </div>
    </div>
  );
}

function HospedeCard({ hospede: h, perfil }: { hospede: Residente; perfil: string }) {
  const idade = calcularIdade(h.data_nascimento);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{h.nome}</CardTitle>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <BedDouble className="size-4" /> Quarto {ouNaoInformado(h.quarto)}
          </div>
        </div>
        {/* Ponta assistencial (cuidadoras/enfermagem) cuida pelo grau de
            INGRESSO; o grau real (IVCF) não aparece aqui. */}
        <Badge variant="secondary">Grau de ingresso {h.grau_contratual ?? "—"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Linha icon={Cake} rotulo="Idade">
          {idade !== null ? `${idade} anos` : "Não informado"}
        </Linha>
        <Linha icon={AlertCircle} rotulo="Alergias" destaque>
          {ouNaoInformado(h.alergias)}
        </Linha>
        <Linha icon={Wrench} rotulo="Próteses">
          {ouNaoInformado(h.proteses)}
        </Linha>
        <Linha icon={User} rotulo="Responsável legal">
          {ouNaoInformado(h.responsavel_legal)}
        </Linha>
        <Linha icon={Phone} rotulo="Contato">
          {ouNaoInformado(h.contato)}
        </Linha>
        <div className="border-t pt-3">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-secondary">
            <BookOpen className="size-4" /> História de vida
          </div>
          <p className="text-muted-foreground">{ouNaoInformado(h.historia_vida)}</p>
        </div>
        <DietaResumo residenteId={h.id} />
        <Link
          to="/app/$perfil/ficha"
          params={{ perfil }}
          search={{ hospede: h.id }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border/70 bg-card py-2.5 text-sm font-semibold text-secondary transition-colors hover:border-primary/40 hover:bg-accent"
        >
          Abrir ficha do hóspede <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function Linha({
  icon: Icon,
  rotulo,
  children,
  destaque,
}: {
  icon: typeof Cake;
  rotulo: string;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${destaque ? "text-destructive" : "text-primary"}`} />
      <span className="w-32 shrink-0 font-medium text-muted-foreground">{rotulo}</span>
      <span className={`flex-1 ${destaque ? "font-semibold text-destructive" : "text-secondary"}`}>
        {children}
      </span>
    </div>
  );
}
