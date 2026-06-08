import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
      <Inbox className="size-8 text-muted-foreground/60" />
      <p className="max-w-md font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Erro ao carregar os dados.";
  const semTabela = /schema cache|does not exist|PGRST205/i.test(msg);
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
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
