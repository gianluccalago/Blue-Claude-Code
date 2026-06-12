import { History } from "lucide-react";
import { useLogAlteracoes } from "@/hooks/useLogAlteracao";
import { formatarDataHoraBR } from "@/lib/utils";

const CAMPO_LABEL: Record<string, string> = {
  mensalidade_valor: "Mensalidade",
  valor: "Valor",
  tipo_remuneracao: "Tipo de remuneração",
  valor_mensal: "Valor mensal",
  valor_plantao_diurno: "Plantão diurno",
  valor_plantao_noturno: "Plantão noturno",
  valor_final: "Valor final",
  saldo_atual: "Saldo",
  limite: "Limite",
};

/**
 * Histórico SOMENTE-LEITURA da trilha de auditoria (log_alteracao) de um
 * registro: quem mudou, o quê, de→para, quando e por quê.
 */
export function HistoricoAlteracoes({
  tabelaOrigem,
  registroId,
}: {
  tabelaOrigem: string;
  registroId: string | null | undefined;
}) {
  const log = useLogAlteracoes(tabelaOrigem, registroId);
  const itens = log.data ?? [];

  if (log.isLoading) return <p className="text-xs text-muted-foreground">Carregando histórico…</p>;
  if (itens.length === 0)
    return <p className="text-xs text-muted-foreground">Sem alterações registradas.</p>;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" /> Histórico de alterações
      </p>
      <ul className="space-y-1">
        {itens.map((l) => (
          <li key={l.id} className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-secondary">
              {CAMPO_LABEL[l.campo] ?? l.campo}
            </span>{" "}
            <span className="text-muted-foreground">
              {l.valor_anterior ?? "—"} → {l.valor_novo ?? "—"}
            </span>{" "}
            <span className="text-muted-foreground">
              · {l.alterado_por} · {formatarDataHoraBR(l.alterado_em)}
            </span>
            {l.motivo && <span className="block text-muted-foreground">Motivo: {l.motivo}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
