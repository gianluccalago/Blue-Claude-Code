import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { MessageSquare, Reply, Forward, CornerDownRight, Clock3 } from "lucide-react";
import { SLA_HORAS, idadeTexto, estourouSLA } from "@/lib/sla";
import { getPerfil } from "@/data/profiles";
import {
  DESTINOS_SOLICITACAO,
  labelDestino,
  useRedirecionarSolicitacao,
  useResponderSolicitacao,
  useSolicitacoesPorDestino,
  type SolicitacaoComResidente,
} from "@/hooks/useSolicitacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR } from "@/lib/utils";
import type { DestinoSolicitacao } from "@/types/database";

const PERFIL_PARA_DESTINO: Record<string, DestinoSolicitacao | undefined> = {
  coordenacao: "coordenacao",
  medico: "medico",
  administracao: "administracao",
};

const textareaBase =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Caixa de "Solicitações da família" — usada pelos perfis Coordenação,
 * Médico e Administração. O destino é determinado pelo perfil da rota
 * atual ($perfil).
 */
export function SolicitacoesFamiliaInbox() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const destino = PERFIL_PARA_DESTINO[perfil ?? ""];
  const respondidoPorPadrao = getPerfil(perfil)?.nome ?? "Equipe";
  const solicitacoes = useSolicitacoesPorDestino(destino);

  if (!destino) return <EmptyState label="Este perfil não possui caixa de solicitações da família." />;
  if (solicitacoes.isLoading) return <LoadingState />;
  if (solicitacoes.isError) return <ErrorState error={solicitacoes.error} />;

  // Fila puxada: abertas primeiro, da MAIS ANTIGA para a mais nova.
  const lista = [...(solicitacoes.data ?? [])].sort((a, b) => {
    const aAberta = a.status === "aberta" ? 0 : 1;
    const bAberta = b.status === "aberta" ? 0 : 1;
    if (aAberta !== bAberta) return aAberta - bAberta;
    return a.criada_em.localeCompare(b.criada_em);
  });
  if (lista.length === 0)
    return <EmptyState label="Nenhuma solicitação da família para este setor." />;

  const abertas = lista.filter((s) => s.status === "aberta").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" /> Solicitações da família
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="muted">{lista.length} no total</Badge>
            <Badge variant={abertas > 0 ? "warning" : "success"}>
              {abertas} aberta{abertas === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {lista.map((s) => (
          <SolicitacaoItem
            key={s.id}
            solicitacao={s}
            destinoAtual={destino}
            respondidoPorPadrao={respondidoPorPadrao}
          />
        ))}
      </div>
    </div>
  );
}

function SolicitacaoItem({
  solicitacao: s,
  destinoAtual,
  respondidoPorPadrao,
}: {
  solicitacao: SolicitacaoComResidente;
  destinoAtual: DestinoSolicitacao;
  respondidoPorPadrao: string;
}) {
  const outrosDestinos = DESTINOS_SOLICITACAO.filter((d) => d.value !== destinoAtual);
  const [resposta, setResposta] = useState("");
  const [novoDestino, setNovoDestino] = useState<DestinoSolicitacao>(outrosDestinos[0]?.value ?? destinoAtual);
  const responder = useResponderSolicitacao();
  const redirecionar = useRedirecionarSolicitacao();

  const aberta = s.status === "aberta";

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold text-secondary">{s.assunto}</p>
            <p className="text-xs text-muted-foreground">
              {s.residente_nome ?? "Não informado"} · {formatarDataHoraBR(s.criada_em)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {s.redirecionada_de && (
              <Badge variant="purple">Reencaminhada de {labelDestino(s.redirecionada_de)}</Badge>
            )}
            {aberta ? (
              <>
                <Badge variant="warning">Aberta {idadeTexto(s.criada_em)}</Badge>
                {estourouSLA(s.criada_em, SLA_HORAS.solicitacaoFamilia) && (
                  <Badge variant="destructive" className="gap-1">
                    <Clock3 className="size-3" /> atrasado
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="success">Respondida</Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-secondary/80">{s.mensagem}</p>

        {aberta ? (
          <div className="space-y-3 border-t pt-3">
            <textarea
              className={textareaBase}
              rows={3}
              placeholder="Escreva a resposta para a família..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                size="sm"
                disabled={!resposta.trim() || responder.isPending}
                onClick={() =>
                  responder.mutate({ id: s.id, resposta: resposta.trim(), respondidoPor: respondidoPorPadrao })
                }
              >
                <Reply className="size-4" /> Responder
              </Button>
              {outrosDestinos.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className={selectBase}
                    value={novoDestino}
                    onChange={(e) => setNovoDestino(e.target.value as DestinoSolicitacao)}
                  >
                    {outrosDestinos.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={redirecionar.isPending}
                    onClick={() => redirecionar.mutate({ id: s.id, destinoAtual, novoDestino })}
                  >
                    <Forward className="size-4" /> Reencaminhar
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-accent/60 px-3 py-2 text-sm text-secondary">
            <CornerDownRight className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p>{s.resposta}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.respondida_por ?? "Equipe"} · {formatarDataHoraBR(s.respondida_em)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
