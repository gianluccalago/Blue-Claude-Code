import { useState } from "react";
import { Plus, LayoutTemplate, ChevronRight } from "lucide-react";
import { useResidentes, usePlanoItens } from "@/hooks/usePlanos";
import {
  useAdicionarPlanoItem,
  useEditarPlanoItem,
  useRemoverPlanoItem,
  useAplicarModelo,
} from "@/hooks/usePlanos";
import { useModelos } from "@/hooks/useModelos";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ItemTarefaForm } from "@/components/coordenacao/ItemTarefaForm";
import { EditarItemForm } from "@/components/coordenacao/EditarItemForm";
import { ItemTarefaCard } from "@/components/coordenacao/ItemTarefaCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

interface Confirmacao {
  titulo: string;
  descricao?: string;
  textoConfirmar?: string;
  variante?: "destructive" | "default" | "warning";
  acao: () => void;
}

export function PlanosCuidado() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && <PlanoDoHospede key={hospedeId} residenteId={hospedeId} />}
    </div>
  );
}

function PlanoDoHospede({ residenteId }: { residenteId: string }) {
  const itens = usePlanoItens(residenteId);
  const adicionar = useAdicionarPlanoItem(residenteId);
  const editar = useEditarPlanoItem(residenteId);
  const remover = useRemoverPlanoItem(residenteId);
  const aplicar = useAplicarModelo(residenteId);
  const modelos = useModelos();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarModelos, setMostrarModelos] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  if (itens.isError) return <ErrorState error={itens.error} />;
  if (itens.isLoading) return <LoadingState />;

  const lista = itens.data ?? [];
  const ocupado = adicionar.isPending || editar.isPending || remover.isPending || aplicar.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Plano de cuidado</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMostrarModelos((v) => !v);
                setMostrarForm(false);
              }}
            >
              <LayoutTemplate className="size-4" /> Aplicar modelo de rotina
            </Button>
            <Button
              onClick={() => {
                setMostrarForm((v) => !v);
                setMostrarModelos(false);
              }}
            >
              <Plus className="size-4" /> Adicionar tarefa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Painel: aplicar modelo de rotina */}
          {mostrarModelos && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-accent/40 p-4">
              <p className="text-sm font-semibold text-secondary">
                Escolha um modelo para adicionar ao plano deste hóspede:
              </p>
              {modelos.isLoading ? (
                <LoadingState />
              ) : modelos.isError ? (
                <ErrorState error={modelos.error} />
              ) : (modelos.data ?? []).length === 0 ? (
                <EmptyState label="Nenhum modelo de rotina cadastrado ainda." />
              ) : (
                <div className="space-y-2">
                  {(modelos.data ?? []).map((m) => (
                    <button
                      key={m.id}
                      disabled={ocupado}
                      onClick={() =>
                        setConfirmacao({
                          titulo: `Aplicar "${m.nome}"?`,
                          descricao:
                            "Adiciona as tarefas do modelo ao plano deste hóspede sem apagar as existentes. Continuar?",
                          textoConfirmar: "Sim, aplicar",
                          variante: "default",
                          acao: () => {
                            aplicar.mutate(m.id);
                            setMostrarModelos(false);
                          },
                        })
                      }
                      className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50"
                    >
                      <span className="font-semibold text-secondary">{m.nome}</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {m.total_itens} tarefa{m.total_itens === 1 ? "" : "s"}
                        <ChevronRight className="size-4" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Formulário: adicionar tarefa */}
          {mostrarForm && (
            <ItemTarefaForm
              salvando={adicionar.isPending}
              onCancelar={() => setMostrarForm(false)}
              onSalvar={(valor) => {
                adicionar.mutate(valor, { onSuccess: () => setMostrarForm(false) });
              }}
            />
          )}

          {/* Lista de itens */}
          {lista.length === 0 ? (
            <EmptyState label="Este hóspede ainda não possui plano de cuidado ativo." />
          ) : (
            <div className="space-y-3">
              {lista.map((item) =>
                editandoId === item.id ? (
                  <EditarItemForm
                    key={item.id}
                    horarioInicial={item.horario}
                    toleranciaInicial={item.tolerancia_minutos}
                    salvando={editar.isPending}
                    onCancelar={() => setEditandoId(null)}
                    onSalvar={(args) =>
                      editar.mutate(
                        { id: item.id, ...args },
                        { onSuccess: () => setEditandoId(null) },
                      )
                    }
                  />
                ) : (
                  <ItemTarefaCard
                    key={item.id}
                    tarefa={item.tarefa}
                    horario={item.horario}
                    responsavel={item.responsavel}
                    toleranciaMinutos={item.tolerancia_minutos}
                    disabled={ocupado}
                    onEditar={() => setEditandoId(item.id)}
                    onRemover={() =>
                      setConfirmacao({
                        titulo: "Remover esta tarefa?",
                        descricao: item.tarefa,
                        textoConfirmar: "Sim, remover",
                        variante: "destructive",
                        acao: () => remover.mutate(item.id),
                      })
                    }
                  />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="muted">{lista.length} tarefa(s) ativa(s)</Badge>
      </div>

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar={confirmacao?.textoConfirmar ?? "Confirmar"}
        textoCancelar="Cancelar"
        varianteConfirmar={confirmacao?.variante ?? "destructive"}
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}
