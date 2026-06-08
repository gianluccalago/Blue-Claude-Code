import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PERFIS } from "@/data/profiles";
import { cn } from "@/lib/utils";

export function SelecaoPerfil() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/40 to-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          {/* Placeholder de logo grande */}
          <div className="mb-5 grid size-20 place-items-center rounded-3xl bg-primary text-4xl font-extrabold text-primary-foreground shadow-soft">
            B
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-secondary sm:text-4xl">
            Blue Senior Living
          </h1>
          <p className="mt-2 text-muted-foreground">
            Selecione seu perfil de acesso para entrar
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERFIS.map((perfil) => {
            const Icon = perfil.icon;
            return (
              <button
                key={perfil.id}
                onClick={() => navigate({ to: perfil.rotaInicial })}
                className="group flex flex-col rounded-lg border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div
                  className={cn(
                    "mb-4 grid size-12 place-items-center rounded-xl",
                    perfil.cor,
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="font-bold text-secondary">{perfil.nome}</div>
                <div className="mt-1 flex-1 text-sm text-muted-foreground">
                  {perfil.descricao}
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Entrar <ArrowRight className="size-4" />
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Acesso por seleção de perfil (sem login). A autenticação será adicionada em etapa
          posterior.
        </p>
      </div>
    </div>
  );
}
