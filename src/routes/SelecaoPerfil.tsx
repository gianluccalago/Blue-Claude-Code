import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PERFIS } from "@/data/profiles";
import { Logo } from "@/components/Logo";

/** Logo do topo: usa a arte oficial em /logo.png; se não houver, cai no lockup SVG. */
function HeroLogo() {
  const [usarOficial, setUsarOficial] = useState(true);
  if (usarOficial) {
    return (
      <img
        src="/logo.png"
        alt="Blue Senior Living"
        className="h-32 w-auto object-contain sm:h-40"
        onError={() => setUsarOficial(false)}
      />
    );
  }
  return <Logo stacked />;
}

export function SelecaoPerfil() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-accent via-background to-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-12 flex flex-col items-center text-center">
          <HeroLogo />
          <div className="mt-7 h-1 w-16 rounded-full bg-primary" />
          <p className="mt-5 text-muted-foreground">
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
                className="group flex flex-col rounded-lg border border-border bg-card p-6 text-left shadow-card transition-all hover:-translate-y-1 hover:border-primary hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="mb-5 grid size-12 place-items-center rounded-xl bg-accent text-secondary ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
                  <Icon className="size-6" />
                </div>
                <div className="text-lg font-bold text-secondary">{perfil.nome}</div>
                <div className="mt-1.5 flex-1 text-sm text-muted-foreground">
                  {perfil.descricao}
                </div>
                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Entrar <ArrowRight className="size-4" />
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Acesso por seleção de perfil (sem login). A autenticação será adicionada em etapa
          posterior.
        </p>
      </div>
    </div>
  );
}
