import { useMemo, useState } from "react";
import { Plus, Pencil, UserX, BadgeCheck, Clock4, HeartHandshake, Stethoscope } from "lucide-react";
import {
  useProfissionais,
  useAdicionarProfissional,
  useEditarProfissional,
  useInativarProfissional,
  type ProfissionalValor,
} from "@/hooks/useProfissionais";
import { ProfissionalForm } from "@/components/escala/ProfissionalForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { FuncaoProfissional, Usuario, VinculoProfissional } from "@/types/database";

type Categoria = "todas" | "cuidadoras" | "enfermeiras";
const CATEGORIAS: { key: Categoria; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "cuidadoras", label: "Cuidadoras" },
  { key: "enfermeiras", label: "Enfermeiras" },
];

function ehEnfermagem(u: Usuario): boolean {
  return u.funcao === "Técnica de Enfermagem" || u.funcao === "Enfermeira";
}

function paraValor(u: Usuario): ProfissionalValor {
  // funcao/vinculo podem ser texto livre no banco; normalizamos para os tipos.
  const funcao = (u.funcao as FuncaoProfissional) ?? "Cuidadora";
  const vinculo = (u.vinculo as VinculoProfissional) ?? "CLT";
  return {
    nome: u.nome,
    email: u.email ?? "",
    funcao,
    vinculo,
    registro_profissional: u.registro_profissional ?? "",
    isento_ponto_app: u.isento_ponto_app,
    ativo: u.ativo,
  };
}

export function Profissionais() {
  const profissionais = useProfissionais();
  const adicionar = useAdicionarProfissional();
  const editar = useEditarProfissional();
  const inativar = useInativarProfissional();

  const [categoria, setCategoria] = useState<Categoria>("todas");
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ titulo: string; descricao?: string; acao: () => void } | null>(null);

  const lista = profissionais.data ?? [];
  const filtrada = useMemo(() => {
    if (categoria === "cuidadoras") return lista.filter((u) => u.funcao === "Cuidadora");
    if (categoria === "enfermeiras") return lista.filter(ehEnfermagem);
    return lista;
  }, [lista, categoria]);

  if (profissionais.isLoading) return <LoadingState />;
  if (profissionais.isError) return <ErrorState error={profissionais.error} />;

  const ocupado = adicionar.isPending || editar.isPending || inativar.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Profissionais</CardTitle>
          <Button
            onClick={() => {
              setAdicionando((v) => !v);
              setEditandoId(null);
            }}
          >
            <Plus className="size-4" /> Adicionar profissional
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro por categoria */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategoria(c.key)}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                  categoria === c.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Formulário de adição */}
          {adicionando && (
            <ProfissionalForm
              modoEdicao={false}
              salvando={adicionar.isPending}
              onCancelar={() => setAdicionando(false)}
              onSalvar={(valor) =>
                adicionar.mutate(valor, { onSuccess: () => setAdicionando(false) })
              }
            />
          )}

          {/* Lista */}
          {filtrada.length === 0 ? (
            <EmptyState label="Nenhum profissional nesta categoria." />
          ) : (
            <div className="space-y-3">
              {filtrada.map((u) =>
                editandoId === u.id ? (
                  <ProfissionalForm
                    key={u.id}
                    modoEdicao
                    inicial={paraValor(u)}
                    salvando={editar.isPending}
                    onCancelar={() => setEditandoId(null)}
                    onSalvar={(valor) =>
                      editar.mutate(
                        { id: u.id, valor },
                        { onSuccess: () => setEditandoId(null) },
                      )
                    }
                  />
                ) : (
                  <ProfissionalCard
                    key={u.id}
                    usuario={u}
                    ocupado={ocupado}
                    onEditar={() => {
                      setEditandoId(u.id);
                      setAdicionando(false);
                    }}
                    onInativar={() =>
                      setConfirmacao({
                        titulo: "Inativar este profissional?",
                        descricao: `${u.nome} deixará de aparecer como ativo (não é excluído).`,
                        acao: () => inativar.mutate(u.id),
                      })
                    }
                  />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar="Sim, inativar"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}

function ProfissionalCard({
  usuario: u,
  ocupado,
  onEditar,
  onInativar,
}: {
  usuario: Usuario;
  ocupado: boolean;
  onEditar: () => void;
  onInativar: () => void;
}) {
  const enf = ehEnfermagem(u);
  const Icone = enf ? Stethoscope : HeartHandshake;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center",
        !u.ativo && "opacity-60",
      )}
    >
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          enf ? "bg-nursing/12 text-nursing" : "bg-accent text-secondary",
        )}
      >
        <Icone className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-secondary">{u.nome}</span>
          {u.ativo ? (
            <Badge variant="success">Ativo</Badge>
          ) : (
            <Badge variant="muted">Inativo</Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-semibold text-secondary/90">{ouNaoInformado(u.funcao)}</span>
          <span>· {ouNaoInformado(u.vinculo)}</span>
          {enf && (
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5" /> {ouNaoInformado(u.registro_profissional)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock4 className="size-3.5" />
            {u.isento_ponto_app ? "Isento de ponto no app" : "Bate ponto no app"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEditar} disabled={ocupado}>
          <Pencil className="size-4" /> Editar
        </Button>
        {u.ativo && (
          <Button variant="outline" size="sm" onClick={onInativar} disabled={ocupado}>
            <UserX className="size-4" /> Inativar
          </Button>
        )}
      </div>
    </div>
  );
}
