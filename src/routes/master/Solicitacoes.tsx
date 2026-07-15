import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, UserPlus, Check, X, Trash2, Mail, Phone, User, HeartHandshake, Briefcase } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useUsuarios, useCriarUsuario, useDefinirSenhaUsuario, type UsuarioValor } from "@/hooks/useUsuarios";
import {
  useSolicitacoesReset,
  useSolicitacoesAcesso,
  useAtenderReset,
  useDescartarReset,
  useAprovarAcesso,
  useRecusarAcesso,
} from "@/hooks/useSolicitacoesAcesso";
import { UsuarioForm, type PrefillUsuario } from "@/components/master/UsuarioForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataHoraBR } from "@/lib/utils";
import type { Residente, SolicitacaoAcesso } from "@/types/database";

// ===========================================================================
// MASTER · Solicitações — filas públicas do login (reset de senha e pedido de
// acesso). Reset → zera a senha para "blue". Acesso → aprova (cria o usuário,
// reusando o UsuarioForm pré-preenchido) ou recusa.
// ===========================================================================

const SENHA_PADRAO = "blue";

export function Solicitacoes() {
  const resets = useSolicitacoesReset();
  const acessos = useSolicitacoesAcesso();
  const usuarios = useUsuarios();
  const residentes = useResidentes();

  if (resets.isLoading || acessos.isLoading || usuarios.isLoading || residentes.isLoading) return <LoadingState />;
  const erro = resets.error ?? acessos.error ?? usuarios.error ?? residentes.error;
  if (erro) return <ErrorState error={erro} />;

  const resetsPend = (resets.data ?? []).filter((r) => r.status === "pendente");
  const acessosPend = (acessos.data ?? []).filter((a) => a.status === "pendente");
  const emailsAtivos = new Set((usuarios.data ?? []).filter((u) => u.ativo && u.email).map((u) => u.email!.toLowerCase()));
  const cargosExistentes = [...new Set((usuarios.data ?? []).map((u) => u.funcao?.trim()).filter((c): c is string => !!c))].sort();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-secondary">Solicitações</h2>
        <p className="text-sm text-muted-foreground">
          Pedidos de reset de senha e de acesso vindos da tela de login.
        </p>
      </div>

      {/* Reset de senha */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <KeyRound className="size-5 text-primary" /> Reset de senha
          {resetsPend.length > 0 && <Badge variant="warning">{resetsPend.length} pendente(s)</Badge>}
        </h3>
        {resetsPend.length === 0 ? (
          <EmptyState label="Nenhum pedido de reset pendente." />
        ) : (
          <div className="space-y-2">
            {resetsPend.map((r) => (
              <ResetLinha key={r.id} id={r.id} email={r.email} quando={r.criado_em} conhecido={emailsAtivos.has(r.email.toLowerCase())} />
            ))}
          </div>
        )}
      </section>

      {/* Solicitações de acesso */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <UserPlus className="size-5 text-primary" /> Pedidos de acesso
          {acessosPend.length > 0 && <Badge variant="warning">{acessosPend.length} pendente(s)</Badge>}
        </h3>
        {acessosPend.length === 0 ? (
          <EmptyState label="Nenhum pedido de acesso pendente." />
        ) : (
          <div className="space-y-3">
            {acessosPend.map((a) => (
              <AcessoCard key={a.id} solicitacao={a} residentes={residentes.data ?? []} cargosExistentes={cargosExistentes} jaExiste={!!a.email && emailsAtivos.has(a.email.toLowerCase())} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResetLinha({ id, email, quando, conhecido }: { id: string; email: string; quando: string; conhecido: boolean }) {
  const definirSenha = useDefinirSenhaUsuario();
  const atender = useAtenderReset();
  const descartar = useDescartarReset();
  const ocupado = definirSenha.isPending || atender.isPending || descartar.isPending;

  async function resetar() {
    try {
      await definirSenha.mutateAsync({ email, senha: SENHA_PADRAO });
      await atender.mutateAsync(id);
      toast.success(`Senha de ${email} redefinida para "${SENHA_PADRAO}".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao redefinir a senha.");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-secondary"><Mail className="size-3.5 text-muted-foreground" /> {email}</span>
            {conhecido ? <Badge variant="muted">usuário ativo</Badge> : <Badge variant="destructive">e-mail sem usuário</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{formatarDataHoraBR(quando)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => descartar.mutate(id)} disabled={ocupado}><Trash2 className="size-4" /> Descartar</Button>
          <Button size="sm" onClick={resetar} loading={definirSenha.isPending || atender.isPending} disabled={ocupado || !conhecido} title={conhecido ? "" : "Nenhum usuário ativo com este e-mail"}>
            <KeyRound className="size-4" /> Resetar p/ “{SENHA_PADRAO}”
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function prefillDe(s: SolicitacaoAcesso): PrefillUsuario {
  if (s.tipo === "colaborador") {
    return { nome: s.nome, email: s.email, seletor: "cuidador", funcao: s.cargo ?? "" };
  }
  return { nome: s.nome, email: s.email, seletor: "familia", funcao: "" };
}

function AcessoCard({
  solicitacao: s,
  residentes,
  cargosExistentes,
  jaExiste,
}: {
  solicitacao: SolicitacaoAcesso;
  residentes: Residente[];
  cargosExistentes: string[];
  jaExiste: boolean;
}) {
  const criar = useCriarUsuario();
  const aprovar = useAprovarAcesso();
  const recusar = useRecusarAcesso();
  const [aprovando, setAprovando] = useState(false);
  const [recusarAberto, setRecusarAberto] = useState(false);
  const [motivo, setMotivo] = useState("");

  const isFamiliar = s.tipo === "familiar";

  function onCriar(valor: UsuarioValor) {
    criar.mutate(valor, {
      onSuccess: async () => {
        try {
          await aprovar.mutateAsync(s.id);
          toast.success(`Acesso de ${s.nome} criado e aprovado.`);
          setAprovando(false);
        } catch {
          toast.error("Usuário criado, mas falha ao marcar a solicitação. Verifique a lista.");
        }
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar o usuário."),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-secondary">{s.nome}</span>
              <Badge variant={isFamiliar ? "secondary" : "default"} className="gap-1">
                {isFamiliar ? <HeartHandshake className="size-3" /> : <Briefcase className="size-3" />}
                {isFamiliar ? "Familiar" : "Colaborador"}
              </Badge>
              {jaExiste && <Badge variant="warning">já existe usuário ativo com este e-mail</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" /> {s.email}</span>
              {s.contato && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {s.contato}</span>}
              {s.cargo && <span className="inline-flex items-center gap-1.5"><Briefcase className="size-3.5" /> {s.cargo}</span>}
              {s.residente_nome && <span className="inline-flex items-center gap-1.5"><User className="size-3.5" /> {s.residente_nome}{s.parentesco ? ` · ${s.parentesco}` : ""}</span>}
            </div>
            {s.observacao && <p className="text-sm text-secondary">{s.observacao}</p>}
            <p className="text-xs text-muted-foreground">{formatarDataHoraBR(s.criado_em)}</p>
          </div>
          {!aprovando && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setRecusarAberto(true)} disabled={criar.isPending}><X className="size-4" /> Recusar</Button>
              <Button size="sm" onClick={() => setAprovando(true)} disabled={criar.isPending}><Check className="size-4" /> Aprovar</Button>
            </div>
          )}
        </div>

        {aprovando && (
          <div className="space-y-2 border-t pt-3">
            {isFamiliar && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-secondary">
                Familiar de <span className="font-semibold">{s.residente_nome ?? "—"}</span>
                {s.parentesco ? ` (${s.parentesco})` : ""}. Selecione o hóspede correspondente abaixo.
              </p>
            )}
            <UsuarioForm
              modoEdicao={false}
              residentes={residentes}
              cargosExistentes={cargosExistentes}
              prefill={prefillDe(s)}
              salvando={criar.isPending || aprovar.isPending}
              onSalvar={onCriar}
              onCancelar={() => setAprovando(false)}
            />
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        aberto={recusarAberto}
        titulo="Recusar solicitação?"
        descricao={`${s.nome} · ${s.email}. Você pode registrar um motivo (opcional).`}
        textoConfirmar="Recusar"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          recusar.mutate(
            { id: s.id, motivo: motivo.trim() || null },
            {
              onSuccess: () => toast.success("Solicitação recusada."),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao recusar."),
            },
          );
          setRecusarAberto(false);
          setMotivo("");
        }}
        onCancelar={() => { setRecusarAberto(false); setMotivo(""); }}
      >
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </ConfirmDialog>
    </Card>
  );
}
