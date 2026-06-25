import { useState } from "react";
import { toast } from "sonner";
import { Heart, Send, Pencil, Trash2, X, Check } from "lucide-react";
import {
  useRecadosResidente,
  useCriarRecado,
  useEditarRecado,
  useExcluirRecado,
} from "@/hooks/useRecados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatarDataHoraBR } from "@/lib/utils";
import type { RecadoFamilia } from "@/types/database";

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível salvar.");

// ===========================================================================
// Recado da equipe para a família — autoria pela Coordenação/Master (0084).
// Aparece na ficha do hóspede; a família vê em destaque no portal dela.
// ===========================================================================

export function RecadoFamiliaEditor({ residenteId, nome }: { residenteId: string; nome: string }) {
  const recados = useRecadosResidente(residenteId);
  const criar = useCriarRecado();
  const [texto, setTexto] = useState("");
  const primeiro = nome.split(" ")[0];

  async function enviar() {
    const msg = texto.trim();
    if (msg.length < 3) return toast.error("Escreva um recado um pouco maior.");
    try {
      await criar.mutateAsync({ residenteId, mensagem: msg });
      setTexto("");
      toast.success("Recado enviado à família.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="size-4 text-primary" /> Recado para a família
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Uma atualização carinhosa que a família de {primeiro} verá no portal (sem dados clínicos).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={`Ex.: "${primeiro} está se adaptando muito bem e fez amizade com outra residente."`}
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={enviar} disabled={criar.isPending}>
            <Send className="size-4" /> {criar.isPending ? "Enviando…" : "Enviar recado"}
          </Button>
        </div>

        {(recados.data ?? []).length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recados enviados
            </p>
            {(recados.data ?? []).map((r) => (
              <LinhaRecado key={r.id} recado={r} residenteId={residenteId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinhaRecado({ recado, residenteId }: { recado: RecadoFamilia; residenteId: string }) {
  const editar = useEditarRecado();
  const excluir = useExcluirRecado();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(recado.mensagem);

  async function salvar() {
    const msg = texto.trim();
    if (msg.length < 3) return toast.error("Recado muito curto.");
    try {
      await editar.mutateAsync({ id: recado.id, residenteId, mensagem: msg });
      setEditando(false);
      toast.success("Recado atualizado.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function remover() {
    if (!window.confirm("Remover este recado? A família deixará de vê-lo.")) return;
    try {
      await excluir.mutateAsync({ id: recado.id, residenteId });
      toast.success("Recado removido.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      {editando ? (
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={salvar} disabled={editar.isPending}>
              <Check className="size-4" /> Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditando(false); setTexto(recado.mensagem); }}>
              <X className="size-4" /> Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-secondary">{recado.mensagem}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {recado.autor ? `${recado.autor} · ` : ""}{formatarDataHoraBR(recado.criado_em)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setEditando(true)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-secondary" aria-label="Editar">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={remover} disabled={excluir.isPending} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remover">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
