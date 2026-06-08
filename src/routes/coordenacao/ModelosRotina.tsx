import { useState } from "react";
import { Plus, Trash2, LayoutTemplate } from "lucide-react";
import {
  useModelos,
  useModeloItens,
  useCriarModelo,
  useRemoverModelo,
  useAdicionarModeloItem,
  useEditarModeloItem,
  useRemoverModeloItem,
} from "@/hooks/useModelos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ItemTarefaForm } from "@/components/coordenacao/ItemTarefaForm";
import { EditarItemForm } from "@/components/coordenacao/EditarItemForm";
import { ItemTarefaCard } from "@/components/coordenacao/ItemTarefaCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

interface Confirmacao {
  titulo: string;
  descricao?: string;
  textoConfirmar?: string;
  acao: () => void;
}

export function ModelosRotina() {
  const modelos = useModelos();
  const criar = useCriarModelo();
  const remover = useRemoverModelo();

  const [nomeNovo, setNomeNovo] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  if (modelos.isLoading) return <LoadingState />;
  if (modelos.isError) return <ErrorState error={modelos.error} />;

  const lista = modelos.data ?? [];

  return (
    <div className="space-y-6">
      {/* Criar modelo */}
      <Card>
        <CardHeader>
          <CardTitle>Novo modelo de rotina</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <input
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Nome do modelo (ex: Rotina padrão grau III)"
              className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              disabled={!nomeNovo.trim() || criar.isPending}
              onClick={() =>
                criar.mutate(nomeNovo.trim(), { onSuccess: () => setNomeNovo("") })
              }
            >
              <Plus className="size-4" /> Criar modelo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de modelos */}
      <Card>
        <CardHeader>
          <CardTitle>Modelos de rotina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.length === 0 ? (
            <EmptyState label="Nenhum modelo de rotina cadastrado ainda." />
          ) : (
            lista.map((m) => {
              const ativo = m.id === selecionadoId;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors",
                    ativo && "border-primary bg-primary/5",
                  )}
                >
                  <button
                    onClick={() => setSelecionadoId(ativo ? null : m.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
                      <LayoutTemplate className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-secondary">{m.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.total_itens} tarefa{m.total_itens === 1 ? "" : "s"}
                      </div>
                    </div>
                  </button>
                  <Badge variant={ativo ? "default" : "muted"}>
                    {ativo ? "Gerenciando" : "Abrir"}
                  </Badge>
                  <button
                    onClick={() =>
                      setConfirmacao({
                        titulo: "Remover este modelo?",
                        descricao: `${m.nome} — o modelo deixa de aparecer na lista. Os planos já aplicados não são afetados.`,
                        textoConfirmar: "Sim, remover",
                        acao: () => {
                          remover.mutate(m.id);
                          if (selecionadoId === m.id) setSelecionadoId(null);
                        },
                      })
                    }
                    disabled={remover.isPending}
                    className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover modelo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Itens do modelo selecionado */}
      {selecionadoId && (
        <ItensDoModelo
          key={selecionadoId}
          modeloId={selecionadoId}
          pedirConfirmacao={setConfirmacao}
        />
      )}

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar={confirmacao?.textoConfirmar ?? "Confirmar"}
        textoCancelar="Cancelar"
        varianteConfirmar="destructive"
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}

function ItensDoModelo({
  modeloId,
  pedirConfirmacao,
}: {
  modeloId: string;
  pedirConfirmacao: (c: Confirmacao) => void;
}) {
  const itens = useModeloItens(modeloId);
  const adicionar = useAdicionarModeloItem(modeloId);
  const editar = useEditarModeloItem(modeloId);
  const remover = useRemoverModeloItem(modeloId);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  if (itens.isError) return <ErrorState error={itens.error} />;

  const lista = itens.data ?? [];
  const ocupado = adicionar.isPending || editar.isPending || remover.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Tarefas do modelo</CardTitle>
        <Button onClick={() => setMostrarForm((v) => !v)}>
          <Plus className="size-4" /> Adicionar tarefa
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {mostrarForm && (
          <ItemTarefaForm
            salvando={adicionar.isPending}
            onCancelar={() => setMostrarForm(false)}
            onSalvar={(valor) =>
              adicionar.mutate(valor, { onSuccess: () => setMostrarForm(false) })
            }
          />
        )}

        {itens.isLoading ? (
          <LoadingState />
        ) : lista.length === 0 ? (
          <EmptyState label="Este modelo ainda não tem tarefas. Adicione a primeira." />
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
                    pedirConfirmacao({
                      titulo: "Remover esta tarefa do modelo?",
                      descricao: item.tarefa,
                      textoConfirmar: "Sim, remover",
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
  );
}
