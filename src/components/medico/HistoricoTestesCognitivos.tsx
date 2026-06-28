import { useState } from "react";
import { toast } from "sonner";
import { Brain, ChevronDown, ExternalLink, TrendingDown } from "lucide-react";
import { useTestesCognitivos } from "@/hooks/useTestesCognitivos";
import { itensDoTeste, calcularMoca, type TipoTeste } from "@/lib/testesCognitivos";
import { urlAssinadaTeste } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatarDataHoraBR } from "@/lib/utils";
import type { TesteCognitivo } from "@/types/database";

// ===========================================================================
// Histórico de testes cognitivos (MEEM/MoCA) — somente leitura. Usado na tela
// do Médico e na Visão 360º do Master. Queda entre avaliações do MESMO tipo é
// sinalizada (sinal de alerta — interpretado no contexto clínico).
// ===========================================================================

export function HistoricoTestesCognitivos({ residenteId }: { residenteId: string }) {
  const testes = useTestesCognitivos(residenteId);
  const lista = testes.data ?? [];

  // Delta vs. a avaliação ANTERIOR do mesmo tipo (lista vem do mais recente).
  function deltaAnterior(t: TesteCognitivo, i: number): number | null {
    for (let j = i + 1; j < lista.length; j++) {
      if (lista[j].tipo === t.tipo) return t.pontuacao_total - lista[j].pontuacao_total;
    }
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="size-4 text-primary" /> Testes cognitivos (MEEM / MoCA)
        </CardTitle>
        <p className="text-xs text-muted-foreground">Avaliativos — não alteram o grau de dependência.</p>
      </CardHeader>
      <CardContent>
        {testes.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum teste cognitivo registrado.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((t, i) => <LinhaTeste key={t.id} teste={t} delta={deltaAnterior(t, i)} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinhaTeste({ teste: t, delta }: { teste: TesteCognitivo; delta: number | null }) {
  const [aberto, setAberto] = useState(false);
  const itens = itensDoTeste(t.tipo as TipoTeste).filter((it) => !it.semPontuacao);
  const moca = t.tipo === "MoCA" ? calcularMoca(t.respostas, t.escolaridade_anos) : null;

  async function verFoto() {
    if (!t.foto_url) return;
    const url = await urlAssinadaTeste(t.foto_url);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir a foto.");
  }

  return (
    <div className="rounded-lg border bg-card">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="flex items-center gap-2">
          <Badge variant="secondary">{t.tipo}</Badge>
          <span className="text-lg font-extrabold tabular-nums text-secondary">{t.pontuacao_total}<span className="text-sm font-semibold text-muted-foreground">/30</span></span>
          {delta !== null && delta < 0 && (
            <Badge variant="destructive" className="gap-1"><TrendingDown className="size-3" /> {delta} pts</Badge>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {formatarDataHoraBR(t.aplicado_em)}
          <ChevronDown className={cn("size-4 transition-transform", aberto && "rotate-180")} />
        </span>
      </button>
      {aberto && (
        <div className="space-y-2 border-t px-3 py-2.5 text-sm">
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {itens.map((it) => (
              <div key={it.key} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{it.label}</span>
                <span className="font-semibold tabular-nums text-secondary">{t.respostas[it.key] ?? 0}<span className="text-xs text-muted-foreground">/{it.max}</span></span>
              </div>
            ))}
          </div>
          {moca && (
            <p className="text-xs text-muted-foreground">
              Soma das seções: <span className="font-semibold text-secondary">{moca.bruto}</span>
              {moca.ajusteEscolaridade > 0 && <> · ajuste de escolaridade +{moca.ajusteEscolaridade}</>}
              {t.escolaridade_anos !== null && <> · {t.escolaridade_anos} anos de estudo</>}
            </p>
          )}
          {t.tipo === "MEEM" && t.escolaridade_anos !== null && (
            <p className="text-xs text-muted-foreground">{t.escolaridade_anos} anos de estudo</p>
          )}
          {t.interpretacao && <p className="rounded-md bg-muted/30 p-2 text-secondary">{t.interpretacao}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {t.aplicado_por && <span>Aplicado por {t.aplicado_por}</span>}
            {t.foto_url && (
              <button onClick={verFoto} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                <ExternalLink className="size-3.5" /> Ver foto (papel)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
