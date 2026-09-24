import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw, Home, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mensagemAmigavel } from "@/lib/erros";

// ===========================================================================
// Telas de erro do roteador. Antes não havia errorComponent: qualquer erro de
// renderização derrubava o app inteiro com "Something went wrong!" em inglês,
// sem sidebar e sem saída. Agora: mensagem em português, "Tentar novamente"
// (remonta a rota) e "Voltar ao início".
// ===========================================================================

export function ErroRota({ error, reset }: ErrorComponentProps) {
  return (
    <div role="alert" className="mx-auto my-12 max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
      <AlertTriangle className="mx-auto mb-3 size-10 text-destructive" />
      <h2 className="text-lg font-bold text-secondary">Esta tela encontrou um problema</h2>
      <p className="mt-1 text-sm text-muted-foreground">{mensagemAmigavel(error, "Algo deu errado ao montar a tela.")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}><RotateCcw className="size-4" /> Tentar novamente</Button>
        <Button variant="outline" onClick={() => { window.location.href = "/"; }}><Home className="size-4" /> Voltar ao início</Button>
      </div>
    </div>
  );
}

export function RotaNaoEncontrada() {
  return (
    <div className="mx-auto my-12 max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
      <Compass className="mx-auto mb-3 size-10 text-muted-foreground" />
      <h2 className="text-lg font-bold text-secondary">Página não encontrada</h2>
      <p className="mt-1 text-sm text-muted-foreground">O endereço não existe ou foi movido.</p>
      <Button asChild className="mt-5"><Link to="/">Voltar ao início</Link></Button>
    </div>
  );
}
