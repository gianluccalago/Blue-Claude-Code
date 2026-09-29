import { useState } from "react";
import { Hand, ShieldAlert, Sparkles, Target, UserCheck, Eye, ChevronDown } from "lucide-react";
import { resumoAutonomia, objetivoVencido } from "@/lib/autonomia";
import { useAutonomiaHospede } from "@/hooks/useAutonomia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { Residente } from "@/types/database";

/**
 * Resumo de LEITURA da autonomia do hóspede (ficha, checklist da cuidadora,
 * tela do módulo): restrições clínicas, o que a equipe NÃO deve fazer por ele
 * (consegue, mas vinha sendo feito por rapidez), o que faz sozinho ou com
 * supervisão, preferências e objetivos ativos. Nenhum campo para preencher.
 */
export function ResumoAutonomiaCard({
  residente,
  compacto = false,
  recolhivel = false,
}: {
  residente: Pick<Residente, "id" | "data_admissao">;
  compacto?: boolean;
  /** Começa fechado (checklist da cuidadora). */
  recolhivel?: boolean;
}) {
  const q = useAutonomiaHospede(residente);
  const [aberto, setAberto] = useState(!recolhivel);
  const hoje = hojeISO();

  const corpo = () => {
    if (q.isLoading) return <LoadingState />;
    if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">Não foi possível carregar a autonomia.</p>;
    const r = resumoAutonomia(q.data.avaliacoes);
    const objetivos = q.data.objetivos.filter((o) => o.status === "ativo");
    if (!r.temAvaliacao && objetivos.length === 0)
      return <p className="text-sm text-muted-foreground">Avaliação de autonomia ainda não assinada.</p>;
    return (
      <div className="space-y-3">
        {r.restricoesClinicas && (
          <Bloco icone={ShieldAlert} titulo="Restrição clínica (médico)" tom="vermelho">
            <p className="text-sm">{r.restricoesClinicas}</p>
          </Bloco>
        )}
        {r.deixeFazer.length > 0 && (
          <Bloco icone={Hand} titulo="Deixe fazer — consegue, não faça por ele(a)" tom="amarelo">
            <Lista itens={r.deixeFazer} />
          </Bloco>
        )}
        {r.sozinho.length > 0 && (
          <Bloco icone={UserCheck} titulo="Faz sozinho(a)">
            <Lista itens={r.sozinho} />
          </Bloco>
        )}
        {r.supervisao.length > 0 && (
          <Bloco icone={Eye} titulo="Faz com supervisão">
            <Lista itens={r.supervisao} />
          </Bloco>
        )}
        {r.preferencias.length > 0 && (
          <Bloco icone={Sparkles} titulo="Preferências">
            <ul className="space-y-1 text-sm">
              {(compacto ? r.preferencias.slice(0, 5) : r.preferencias).map((p) => (
                <li key={p.item}>
                  <span className="text-muted-foreground">{p.item}:</span> <span className="text-secondary">{p.texto}</span>
                </li>
              ))}
            </ul>
          </Bloco>
        )}
        {objetivos.length > 0 && (
          <Bloco icone={Target} titulo="Objetivos em andamento">
            <ul className="space-y-1.5 text-sm">
              {objetivos.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-secondary">{o.descricao}</span>
                  <span className="text-muted-foreground">· {o.meta}</span>
                  {!compacto && (
                    <Badge variant={objetivoVencido(o, hoje) ? "destructive" : "muted"}>
                      revisão {formatarDataBR(o.prazo_revisao)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Bloco>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className={cn("pb-2", recolhivel && "cursor-pointer")} onClick={recolhivel ? () => setAberto((v) => !v) : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> Autonomia
          {recolhivel && <ChevronDown className={cn("ml-auto size-4 transition-transform", aberto && "rotate-180")} />}
        </CardTitle>
      </CardHeader>
      {aberto && <CardContent>{corpo()}</CardContent>}
    </Card>
  );
}

function Bloco({
  icone: Icone,
  titulo,
  tom,
  children,
}: {
  icone: typeof Hand;
  titulo: string;
  tom?: "vermelho" | "amarelo";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tom === "vermelho" && "border-destructive/40 bg-destructive/5 text-destructive",
        tom === "amarelo" && "border-warning/50 bg-warning/5",
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icone className="size-3.5" /> {titulo}
      </p>
      {children}
    </div>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.map((i) => (
        <Badge key={i} variant="muted" className="text-xs font-medium">{i}</Badge>
      ))}
    </div>
  );
}
