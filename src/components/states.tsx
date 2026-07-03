import { AlertTriangle, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carregamento padrão: skeleton de lista (3 cards fantasma) — mais elegante
 * que spinner e comunica a estrutura que está chegando. O rótulo permanece
 * para leitores de tela.
 */
export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="stagger-in space-y-3 py-2" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4 shadow-xs"
        >
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-accent text-primary-strong">
        <Inbox className="size-7" />
      </div>
      <p className="max-w-md font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function extrairMensagemErro(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; error_description?: unknown; details?: unknown };
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e.error_description === "string" && e.error_description) return e.error_description;
    if (typeof e.details === "string" && e.details) return e.details;
    try {
      return JSON.stringify(error);
    } catch {
      /* objeto não serializável — cai no fallback abaixo */
    }
  }
  return "Erro ao carregar os dados.";
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = extrairMensagemErro(error);
  const semTabela = /schema cache|does not exist|PGRST205|relation .* does not exist/i.test(msg);
  return (
    <Card className="animate-fade-in border-destructive/25 bg-destructive/5 p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-destructive">Não foi possível carregar do Supabase</p>
          <p className="text-sm text-secondary/80">{msg}</p>
          {semTabela && (
            <p className="text-sm text-secondary/80">
              Parece que as tabelas ainda não foram criadas. Rode o arquivo{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/migrations/0001_init.sql
              </code>{" "}
              no SQL Editor do seu projeto Supabase.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
