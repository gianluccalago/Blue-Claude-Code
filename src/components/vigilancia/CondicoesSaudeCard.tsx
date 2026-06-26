import { useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import {
  usePatologiasResidente,
  useAddPatologia,
  useTogglePatologia,
  useExcluirPatologia,
} from "@/hooks/usePatologias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// Condições de saúde / Comorbidades (RDC 502 Art. 37). Coordenação/Médico
// editam; na Visão 360 entra em leitura. Dado clínico — sem família.
// ===========================================================================

export function CondicoesSaudeCard({
  residenteId,
  somenteLeitura = false,
}: {
  residenteId: string;
  somenteLeitura?: boolean;
}) {
  const patologias = usePatologiasResidente(residenteId);
  const add = useAddPatologia();
  const toggle = useTogglePatologia();
  const excluir = useExcluirPatologia();

  const [descricao, setDescricao] = useState("");
  const [cid, setCid] = useState("");

  const lista = patologias.data ?? [];
  const ativas = lista.filter((p) => p.ativa);
  const inativas = lista.filter((p) => !p.ativa);

  async function adicionar() {
    if (!descricao.trim()) return toast.error("Informe a condição.");
    try {
      await add.mutateAsync({ residenteId, descricao, cid: cid || null });
      setDescricao(""); setCid("");
      toast.success("Condição adicionada.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="size-4 text-primary" /> Condições de saúde / Comorbidades
          {ativas.length > 0 && <Badge variant="muted" className="ml-1">{ativas.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ativas.length === 0 && inativas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma condição registrada — Não informado.</p>
        ) : (
          <div className="space-y-1.5">
            {ativas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <span className="min-w-0 text-secondary">
                  <span className="font-medium">{p.descricao}</span>
                  {p.cid_codigo && <span className="text-muted-foreground"> · CID {p.cid_codigo}</span>}
                </span>
                {!somenteLeitura && (
                  <span className="flex shrink-0 gap-1">
                    <button onClick={() => toggle.mutateAsync({ id: p.id, residenteId, ativa: false }).catch((e) => toast.error(erroMsg(e)))}
                      className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted" title="Marcar como inativa" aria-label="Inativar">
                      <EyeOff className="size-3.5" />
                    </button>
                    <button onClick={() => { if (window.confirm("Remover esta condição?")) excluir.mutateAsync({ id: p.id, residenteId }).catch((e) => toast.error(erroMsg(e))); }}
                      className="grid size-7 place-items-center rounded text-muted-foreground hover:text-destructive" aria-label="Remover">
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </div>
            ))}
            {inativas.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer py-1 text-xs font-semibold text-muted-foreground">Inativas ({inativas.length})</summary>
                <div className="space-y-1 pt-1">
                  {inativas.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground line-through">
                      <span>{p.descricao}{p.cid_codigo ? ` · CID ${p.cid_codigo}` : ""}</span>
                      {!somenteLeitura && (
                        <button onClick={() => toggle.mutateAsync({ id: p.id, residenteId, ativa: true }).catch((e) => toast.error(erroMsg(e)))}
                          className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground no-underline hover:bg-muted" title="Reativar" aria-label="Reativar">
                          <Eye className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {!somenteLeitura && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Condição (ex.: Hipertensão arterial)" className={`${inputBase} min-w-[200px] flex-1`} />
            <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="CID (opcional)" className={`${inputBase} w-28`} />
            <Button size="sm" variant="outline" onClick={adicionar} disabled={add.isPending}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
