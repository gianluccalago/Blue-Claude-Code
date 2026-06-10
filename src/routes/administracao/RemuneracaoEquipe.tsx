/**
 * Remuneração da equipe — Administração (BLOCO Adm4)
 *
 * Cadastro dos valores de referência para pagamento de cada profissional:
 * mensal fixo (CLT e PJ mensalistas) ou por plantão (cuidadora PJ de
 * cobertura, com valores diurno/noturno). Esses valores alimentam o cálculo
 * em "Custos de pessoal".
 */
import { useState } from "react";
import { AlertCircle, Pencil } from "lucide-react";
import { useAtualizarRemuneracao, useEquipeRemuneracao } from "@/hooks/usePagamentoPessoal";
import { formatarMoeda } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { TipoRemuneracao, Usuario } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function RemuneracaoEquipe() {
  const equipe = useEquipeRemuneracao();

  if (equipe.isLoading) return <LoadingState />;
  if (equipe.isError) return <ErrorState error={equipe.error} />;
  if (!equipe.data || equipe.data.length === 0) return <EmptyState label="Nenhum profissional cadastrado." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Remuneração da equipe</h1>
        <p className="text-sm text-muted-foreground">
          Valores de referência para pagamento (mensal fixo ou por plantão). Não inclui cálculo de folha CLT
          (impostos/encargos).
        </p>
      </div>

      <div className="space-y-4">
        {equipe.data.map((u) => (
          <ProfissionalRemuneracao key={u.id} profissional={u} />
        ))}
      </div>
    </div>
  );
}

function ProfissionalRemuneracao({ profissional: u }: { profissional: Usuario }) {
  const [editando, setEditando] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{u.nome}</CardTitle>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{u.funcao ?? "Equipe Multidisciplinar"}</Badge>
            {u.vinculo && <Badge variant="muted">{u.vinculo}</Badge>}
          </div>
        </div>
        <Button variant={editando ? "outline" : "ghost"} size="sm" onClick={() => setEditando((v) => !v)}>
          <Pencil className="size-4" /> {editando ? "Cancelar" : "Editar"}
        </Button>
      </CardHeader>
      <CardContent>
        {editando ? (
          <FormRemuneracao profissional={u} onSalvo={() => setEditando(false)} onCancelar={() => setEditando(false)} />
        ) : (
          <ResumoRemuneracao profissional={u} />
        )}
      </CardContent>
    </Card>
  );
}

function ResumoRemuneracao({ profissional: u }: { profissional: Usuario }) {
  if (!u.tipo_remuneracao) {
    return <p className="text-sm text-muted-foreground">Não informado</p>;
  }

  if (u.tipo_remuneracao === "mensal_fixo") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(u.valor_mensal)}</p>
          <p className="text-sm text-muted-foreground">Mensal fixo</p>
        </div>
        <Badge variant="default">Mensal fixo</Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="grid gap-1 sm:grid-cols-2 sm:gap-6">
        <div>
          <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(u.valor_plantao_diurno)}</p>
          <p className="text-sm text-muted-foreground">Por plantão diurno</p>
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums text-secondary">{formatarMoeda(u.valor_plantao_noturno)}</p>
          <p className="text-sm text-muted-foreground">Por plantão noturno</p>
        </div>
      </div>
      <Badge variant="purple">Por plantão</Badge>
    </div>
  );
}

function FormRemuneracao({
  profissional: u,
  onSalvo,
  onCancelar,
}: {
  profissional: Usuario;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoRemuneracao | "">(u.tipo_remuneracao ?? "");
  const [valorMensal, setValorMensal] = useState(String(u.valor_mensal ?? ""));
  const [valorDiurno, setValorDiurno] = useState(String(u.valor_plantao_diurno ?? ""));
  const [valorNoturno, setValorNoturno] = useState(String(u.valor_plantao_noturno ?? ""));
  const [erro, setErro] = useState<string | null>(null);
  const atualizar = useAtualizarRemuneracao();

  function paraNumero(v: string): number | null {
    return v.trim() === "" ? null : Number(v.replace(",", "."));
  }

  async function handleSalvar() {
    setErro(null);
    if (!tipo) {
      setErro("Selecione o tipo de remuneração.");
      return;
    }
    try {
      await atualizar.mutateAsync({
        id: u.id,
        valor: {
          tipoRemuneracao: tipo,
          valorMensal: tipo === "mensal_fixo" ? paraNumero(valorMensal) : null,
          valorPlantaoDiurno: tipo === "por_plantao" ? paraNumero(valorDiurno) : null,
          valorPlantaoNoturno: tipo === "por_plantao" ? paraNumero(valorNoturno) : null,
        },
      });
      onSalvo();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-secondary">Tipo de remuneração</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTipo("mensal_fixo")}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              tipo === "mensal_fixo" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            Mensal fixo
          </button>
          <button
            type="button"
            onClick={() => setTipo("por_plantao")}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              tipo === "por_plantao" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            Por plantão
          </button>
        </div>
      </div>

      {tipo === "mensal_fixo" && (
        <div className="space-y-1.5 sm:max-w-xs">
          <label className="text-sm font-semibold text-secondary">Valor mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valorMensal}
            onChange={(e) => setValorMensal(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {tipo === "por_plantao" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Valor plantão diurno (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valorDiurno}
              onChange={(e) => setValorDiurno(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Valor plantão noturno (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valorNoturno}
              onChange={(e) => setValorNoturno(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {erro}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSalvar} disabled={atualizar.isPending}>
          {atualizar.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={atualizar.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
