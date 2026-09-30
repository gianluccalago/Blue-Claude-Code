import { useEffect, useRef } from "react";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import { BellRing, Siren } from "lucide-react";
import { useChamadosAbertos, useChamadosAoVivo } from "@/hooks/useChamados";
import { ordenarChamados, tempoDesde } from "@/lib/chamados";
import { cn } from "@/lib/utils";

export const PERFIS_CHAMADOS: ReadonlySet<string> = new Set(["master", "coordenacao", "enfermeira", "enfermagem", "cuidador"]);

/**
 * Faixa fixa no topo de QUALQUER tela enquanto houver chamado aberto. Vibra
 * (sem som) quando chega um novo. Some sozinha quando todos forem atendidos
 * com presença no quarto.
 */
export function AlertaChamadosBanner() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ativo = PERFIS_CHAMADOS.has(perfil ?? "");
  if (!ativo) return null;
  return <Faixa perfil={perfil!} naTela={pathname.endsWith("/chamados")} />;
}

function Faixa({ perfil, naTela }: { perfil: string; naTela: boolean }) {
  useChamadosAoVivo();
  const q = useChamadosAbertos();
  const vistos = useRef<Set<string> | null>(null);
  const lista = ordenarChamados(q.data ?? []);

  useEffect(() => {
    const ids = new Set(lista.map((c) => c.id));
    if (vistos.current) {
      const novos = lista.filter((c) => !vistos.current!.has(c.id));
      if (novos.length) navigator.vibrate?.(novos.some((c) => c.tipo === "emergencia") ? [300, 150, 300, 150, 300] : [200]);
    }
    vistos.current = ids;
  }, [lista]);

  if (lista.length === 0 || naTela) return null;
  const emerg = lista.filter((c) => c.tipo === "emergencia");
  const agora = new Date();
  return (
    <Link
      to="/app/$perfil/chamados"
      params={{ perfil }}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-bold sm:px-6 lg:px-8",
        emerg.length ? "bg-destructive text-white" : "bg-warning text-warning-foreground",
      )}
    >
      <span className="relative grid size-6 place-items-center">
        <span className={cn("absolute inset-0 animate-ping rounded-full", emerg.length ? "bg-white/60" : "bg-warning-foreground/40")} />
        {emerg.length ? <Siren className="relative size-5" /> : <BellRing className="relative size-5" />}
      </span>
      {emerg.length > 0 && <span>EMERGÊNCIA: {emerg.map((c) => c.quarto).join(", ")}</span>}
      {lista.length - emerg.length > 0 && (
        <span>Chamado: {lista.filter((c) => c.tipo !== "emergencia").map((c) => `${c.quarto} (${tempoDesde(c.aberto_em, agora)})`).join(", ")}</span>
      )}
      <span className="ml-auto underline">Ver no mapa</span>
    </Link>
  );
}
