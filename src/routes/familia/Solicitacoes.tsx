import { useState } from "react";
import { Send, MessageSquare, CornerDownRight } from "lucide-react";
import {
  DESTINOS_SOLICITACAO,
  labelDestino,
  useCriarSolicitacao,
  useSolicitacoesFamilia,
} from "@/hooks/useSolicitacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR } from "@/lib/utils";
import type { DestinoSolicitacao, SolicitacaoFamilia } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaBase =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A família abre solicitações para Coordenação/Médico/Administração e acompanha as respostas. */
export function Solicitacoes() {
  const solicitacoes = useSolicitacoesFamilia();
  const criar = useCriarSolicitacao();

  const [destino, setDestino] = useState<DestinoSolicitacao>("coordenacao");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");

  function enviar() {
    if (!assunto.trim() || !mensagem.trim()) return;
    criar.mutate(
      { destino, assunto: assunto.trim(), mensagem: mensagem.trim() },
      {
        onSuccess: () => {
          setAssunto("");
          setMensagem("");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" /> Nova solicitação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Destino</label>
            <select
              className={inputBase}
              value={destino}
              onChange={(e) => setDestino(e.target.value as DestinoSolicitacao)}
            >
              {DESTINOS_SOLICITACAO.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Assunto</label>
            <input
              className={inputBase}
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: Dúvida sobre medicação"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Mensagem</label>
            <textarea
              className={textareaBase}
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva sua solicitação..."
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={enviar}
              disabled={!assunto.trim() || !mensagem.trim() || criar.isPending}
            >
              <Send className="size-4" /> Enviar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Minhas solicitações
        </h2>
        {solicitacoes.isLoading ? (
          <LoadingState />
        ) : solicitacoes.isError ? (
          <ErrorState error={solicitacoes.error} />
        ) : (solicitacoes.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma solicitação enviada ainda." />
        ) : (
          (solicitacoes.data ?? []).map((s) => <SolicitacaoCard key={s.id} solicitacao={s} />)
        )}
      </div>
    </div>
  );
}

function SolicitacaoCard({ solicitacao: s }: { solicitacao: SolicitacaoFamilia }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <span className="font-bold text-secondary">{s.assunto}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{labelDestino(s.destino)}</Badge>
            {s.status === "respondida" ? (
              <Badge variant="success">Respondida</Badge>
            ) : (
              <Badge variant="warning">Aberta</Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-secondary/80">{s.mensagem}</p>
        <p className="text-xs text-muted-foreground">Enviada em {formatarDataHoraBR(s.criada_em)}</p>

        {s.status === "respondida" && s.resposta && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-accent/60 px-3 py-2 text-sm text-secondary">
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
