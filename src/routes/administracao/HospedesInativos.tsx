/**
 * Hóspedes inativos / Histórico — Master, Administração e Direção (leitura).
 * Lista os hóspedes que saíram (data, motivo, tempo de permanência) com acesso
 * à ficha completa em modo leitura. Reativação só Master/Direção (engano).
 * Os demais perfis NÃO veem esta tela nem os inativos.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Archive, ChevronDown, ChevronUp, RotateCcw, CalendarX, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentesInativos, useReativarHospede } from "@/hooks/useCicloVida";
import { tempoPermanencia } from "@/lib/cicloVida";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FichaHospedeCard } from "@/components/FichaHospedeCard";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, ouNaoInformado } from "@/lib/utils";
import { formatarQuarto } from "@/lib/quarto";
import type { Residente } from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);

export function HospedesInativos() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeReativar = perfil === "master" || perfil === "direcao";
  const inativos = useResidentesInativos();

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (inativos.isLoading) return <LoadingState />;
  if (inativos.isError) return <ErrorState error={inativos.error} />;

  const lista = inativos.data ?? [];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <Archive className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Hóspedes inativos</h1>
          <p className="text-sm text-muted-foreground">
            {lista.length} hóspede{lista.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState label="Nenhum hóspede inativo." />
      ) : (
        <div className="space-y-2">
          {lista.map((r) => (
            <CardInativo key={r.id} residente={r} perfil={perfil} podeReativar={podeReativar} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardInativo({
  residente: r,
  perfil,
  podeReativar,
}: {
  residente: Residente;
  perfil: string | undefined;
  podeReativar: boolean;
}) {
  const reativar = useReativarHospede();
  const [aberto, setAberto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  async function handleReativar() {
    setConfirmar(false);
    try {
      await reativar.mutateAsync(r.id);
      toast.success(`${r.nome} reativado. Voltou às telas operacionais.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reativar.");
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <CalendarX className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-secondary">
              {r.nome}
              {r.numero_hospede ? <span className="ml-2 text-xs text-muted-foreground">{r.numero_hospede}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              Suíte {ouNaoInformado(formatarQuarto(r.quarto))} · entrada {r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <LogOut className="size-3" /> {r.data_saida ? formatarDataBR(r.data_saida) : "Não informado"}
            </Badge>
            <Badge variant="muted">{ouNaoInformado(r.motivo_saida)}</Badge>
            <Badge variant="secondary">{tempoPermanencia(r.data_admissao, r.data_saida)}</Badge>
            {podeReativar && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setConfirmar(true)} disabled={reativar.isPending}>
                <RotateCcw className="size-3.5" /> Reativar
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAberto((v) => !v)}>
              {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              Ficha
            </Button>
          </div>
        </div>

        {aberto && (
          <div className="border-t bg-muted/20 p-4">
            <FichaHospedeCard residente={r} perfil={usuarioPerfil(perfil)} podeEditar={false} />
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        aberto={confirmar}
        titulo="Reativar hóspede?"
        descricao={`${r.nome} volta a aparecer em todas as telas operacionais (use só em caso de inativação por engano).`}
        textoConfirmar="Reativar"
        varianteConfirmar="default"
        onConfirmar={handleReativar}
        onCancelar={() => setConfirmar(false)}
      />
    </Card>
  );
}

// Repassa o perfil ao FichaHospedeCard (mesma tipagem do componente).
function usuarioPerfil(perfil: string | undefined) {
  return perfil as Parameters<typeof FichaHospedeCard>[0]["perfil"];
}
