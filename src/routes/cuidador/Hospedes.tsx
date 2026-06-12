import { BedDouble, Cake, AlertCircle, Wrench, User, Phone, BookOpen, ArrowRight, MessageSquare } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useSolicitacoesRespondidasDosHospedes } from "@/hooks/useSolicitacoes";
import { formatarDataBR } from "@/lib/utils";
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
      {/* 5.4: combinados com a família — leitura, seção discreta */}
      <CombinadosComAFamilia hospedes={data} />
    </div>
  );
}

/**
 * Espelho ao cuidador: solicitações da família já RESPONDIDAS sobre os
 * hóspedes designados — quem está com a pessoa sabe o que foi combinado.
 */
function CombinadosComAFamilia({ hospedes }: { hospedes: Residente[] }) {
  const ids = hospedes.map((h) => h.id);
  const respondidas = useSolicitacoesRespondidasDosHospedes(ids);
  const nomePorId = new Map(hospedes.map((h) => [h.id, h.nome]));
  const lista = respondidas.data ?? [];
  if (lista.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-primary" /> Combinados com a família
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lista.map((s) => (
          <div key={s.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
            <p className="font-semibold text-secondary">
              {nomePorId.get(s.residente_id) ?? "Hóspede"} · {s.assunto}
            </p>
            <p className="text-secondary/80">{s.resposta}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.respondida_por ?? "Equipe"} · {s.respondida_em ? formatarDataBR(s.respondida_em) : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
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
