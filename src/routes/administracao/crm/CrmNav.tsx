import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { TrendingUp, ListChecks, BarChart3, Contact, Radio, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Sub-navegação interna do CRM. Substitui os vários itens de menu na sidebar
// por uma única entrada "CRM" + estas abas no topo de cada tela do módulo.
const ABAS: { rota: string; label: string; icon: LucideIcon }[] = [
  { rota: "crm", label: "Pipeline", icon: TrendingUp },
  { rota: "crm-tarefas", label: "Tarefas", icon: ListChecks },
  { rota: "crm-relatorios", label: "Relatórios", icon: BarChart3 },
  { rota: "crm-contatos", label: "Contatos", icon: Contact },
  { rota: "crm-origens", label: "Origens", icon: Radio },
  { rota: "crm-config", label: "Configurações", icon: Settings },
];

export function CrmNav({ ativa }: { ativa: string }) {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Detecta a aba ativa pelo fim do path (fallback para a prop `ativa`).
  const atual =
    ABAS.find((a) => pathname.endsWith(`/${a.rota}`))?.rota ?? ativa;

  return (
    <div className="-mx-1 flex flex-wrap gap-1 overflow-x-auto pb-1">
      {ABAS.map((a) => {
        const ativo = a.rota === atual;
        return (
          <Link
            key={a.rota}
            to={`${base}/${a.rota}` as string}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              ativo
                ? "bg-primary text-primary-foreground shadow-card"
                : "border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-secondary",
            )}
          >
            <a.icon className="size-4" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
