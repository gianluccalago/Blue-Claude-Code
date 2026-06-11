import { BedDouble, Cake, AlertCircle, Wrench, User, Phone, BookOpen } from "lucide-react";
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

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!data || data.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {data.map((h) => (
        <HospedeCard key={h.id} hospede={h} />
      ))}
    </div>
  );
}

function HospedeCard({ hospede: h }: { hospede: Residente }) {
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
        <Badge variant="secondary">Grau {h.grau_dependencia ?? "—"}</Badge>
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
