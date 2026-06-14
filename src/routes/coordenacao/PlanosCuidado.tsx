import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Plus, LayoutTemplate, ChevronRight, Salad, Lock } from "lucide-react";
import { useResidentes, usePlanoItens } from "@/hooks/usePlanos";
import {
  useAdicionarPlanoItem,
  useAdicionarPlanoItemEmLote,
  useEditarPlanoItem,
  useRemoverPlanoItem,
  useAplicarModelo,
} from "@/hooks/usePlanos";
import type { Residente } from "@/types/database";
import { useModelos } from "@/hooks/useModelos";
import { useDietaAtiva } from "@/hooks/useNutricao";
import { DietaInfo } from "@/components/nutricao/DietaInfo";
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
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  // Criar/editar/remover o plano é da Coordenação (e Master). A Enfermeira só
  // VISUALIZA. A RLS reforça (escrita em plano_cuidado_item só master/coordenacao).
  const podeEditar = perfil === "coordenacao" || perfil === "master";
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      {!podeEditar && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>Somente leitura. A edição do plano de cuidado é da Coordenação.</span>
        </div>
      )}
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && (
        <PlanoDoHospede
          key={hospedeId}
          residenteId={hospedeId}
          podeEditar={podeEditar}
          outrosHospedes={(residentes.data ?? []).filter((r) => r.id !== hospedeId)}
        />
      )}
    </div>
  );
}

function PlanoDoHospede({
  residenteId,
  podeEditar,
  outrosHospedes,
}: {
  residenteId: string;
  podeEditar: boolean;
  outrosHospedes: Residente[];
}) {
  const itens = usePlanoItens(residenteId);
  const adicionar = useAdicionarPlanoItem(residenteId);
  const adicionarLote = useAdicionarPlanoItemEmLote();
  // Lote (3.4): outros hóspedes que receberão a MESMA tarefa ao salvar.
  const [loteIds, setLoteIds] = useState<Set<string>>(new Set());
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
      <DietaDoHospede residenteId={residenteId} />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Plano de cuidado</CardTitle>
          {podeEditar && (
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
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Painel: aplicar modelo de rotina */}
          {podeEditar && mostrarModelos && (
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

          {/* Formulário: adicionar tarefa (com aplicação em lote opcional) */}
          {podeEditar && mostrarForm && (
            <div className="space-y-3">
              <ItemTarefaForm
                salvando={adicionar.isPending || adicionarLote.isPending}
                onCancelar={() => {
                  setMostrarForm(false);
                  setLoteIds(new Set());
                }}
                onSalvar={(valor) => {
                  // Lote: grava para o hóspede atual + selecionados de uma vez.
                  const ids = [residenteId, ...loteIds];
                  if (ids.length > 1) {
                    adicionarLote.mutate(
                      { residenteIds: ids, valor },
                      {
                        onSuccess: () => {
                          setMostrarForm(false);
                          setLoteIds(new Set());
                        },
                      },
                    );
                  } else {
                    adicionar.mutate(valor, { onSuccess: () => setMostrarForm(false) });
                  }
                }}
              />
              {outrosHospedes.length > 0 && (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-semibold text-secondary">
                    Aplicar também a outros hóspedes{" "}
                    {loteIds.size > 0 && (
                      <Badge variant="secondary" className="ml-1">{loteIds.size} selecionado{loteIds.size > 1 ? "s" : ""}</Badge>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {outrosHospedes.map((h) => {
                      const marcado = loteIds.has(h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() =>
                            setLoteIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(h.id)) next.delete(h.id);
                              else next.add(h.id);
                              return next;
                            })
                          }
                          className={
                            marcado
                              ? "rounded-lg border border-primary bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                              : "rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-secondary hover:border-primary/50"
                          }
                        >
                          {h.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de itens */}
          {lista.length === 0 ? (
            <EmptyState label="Este hóspede ainda não possui plano de cuidado ativo." />
          ) : (
            <div className="space-y-3">
              {lista.map((item) =>
                podeEditar && editandoId === item.id ? (
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
                    onEditar={podeEditar ? () => setEditandoId(item.id) : undefined}
                    onRemover={
                      podeEditar
                        ? () =>
                            setConfirmacao({
                              titulo: "Remover esta tarefa?",
                              descricao: item.tarefa,
                              textoConfirmar: "Sim, remover",
                              variante: "destructive",
                              acao: () => remover.mutate(item.id),
                            })
                        : undefined
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

/** Dieta ativa do hóspede, somente leitura — definida pela Nutricionista. */
function DietaDoHospede({ residenteId }: { residenteId: string }) {
  const { data: dieta, isLoading, isError, error } = useDietaAtiva(residenteId);

  if (isLoading) return null;
  if (isError) return <ErrorState error={error} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Salad className="size-5 text-primary" />
          Dieta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dieta ? <DietaInfo dieta={dieta} compact /> : <EmptyState label="Sem dieta definida." />}
      </CardContent>
    </Card>
  );
}
