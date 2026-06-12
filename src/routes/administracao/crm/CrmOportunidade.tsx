import { useSearch } from "@tanstack/react-router";
import { EmptyState } from "@/components/states";

// Placeholder — o detalhe completo (timeline, tarefas, anotações, perda,
// admissão) é construído no Bloco 2.
export function CrmOportunidade() {
  const { id } = useSearch({ strict: false }) as { id?: string };
  return <EmptyState label={id ? "Detalhe da oportunidade em breve." : "Oportunidade não informada."} />;
}
