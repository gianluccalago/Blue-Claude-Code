import { useState } from "react";
import { toast } from "sonner";
import { Radio, BellRing, Copy, Trash2 } from "lucide-react";
import {
  useAtivarDispositivoChamado,
  useCadastrarCentral,
  useCadastrarDispositivoChamado,
  useCentraisChamado,
  useDispositivosChamado,
  useRevogarCentral,
} from "@/hooks/useChamados";
import { useQuartos } from "@/hooks/useRondas";
import { situacaoCentral } from "@/lib/chamados";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";

const inputBase = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";
const TIPO_LABEL: Record<string, string> = { botao: "Botão (chamado · amarelo)", corda: "Corda (emergência · vermelho)", presenca: "Botão de presença no quarto" };

/** Central do fabricante: gera o token (uma vez) e mostra o último sinal. */
export function CentralChamadosAdmin() {
  const centrais = useCentraisChamado();
  const cadastrar = useCadastrarCentral();
  const revogar = useRevogarCentral();
  const [nome, setNome] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const sit = situacaoCentral(centrais.data ?? []);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4 text-primary" /> Central de chamados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {sit.tipo === "sem_central" ? "Nenhuma central cadastrada: o aparelho ainda não foi instalado. Os chamados podem ser simulados no mapa para treino." :
            sit.tipo === "online" ? "Central conectada." : "Central cadastrada, mas sem sinal recente: os chamados podem não estar chegando."}
        </p>
        <div className="flex flex-wrap gap-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da central (ex.: Central Módulo 5)" className={cn(inputBase, "min-w-[240px] flex-1")} />
          <Button disabled={!nome.trim() || cadastrar.isPending} onClick={() => cadastrar.mutate(nome.trim(), {
            onSuccess: (t) => { setToken(t); setNome(""); },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
          })}>Cadastrar central</Button>
        </div>
        {token && (
          <div className="space-y-2 rounded-lg border-2 border-warning bg-warning/10 p-3">
            <p className="text-sm font-bold text-warning-foreground">Copie agora: este código aparece uma única vez. Ele vai na configuração da central do fabricante (cabeçalho x-central-token).</p>
            <p className="break-all rounded bg-card p-2 font-mono text-xs">{token}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(token); toast.success("Copiado."); }}><Copy className="size-4" /> Copiar</Button>
              <Button size="sm" variant="ghost" onClick={() => setToken(null)}>Já copiei</Button>
            </div>
          </div>
        )}
        {centrais.isLoading ? <LoadingState /> : (centrais.data ?? []).length > 0 && (
          <div className="divide-y rounded-lg border">
            {(centrais.data ?? []).map((c) => (
              <div key={c.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", !c.ativo && "opacity-60")}>
                <span className="font-semibold text-secondary">{c.nome}</span>
                <span className="text-xs text-muted-foreground">último sinal: {c.ultimo_sinal_em ? formatarDataHoraBR(c.ultimo_sinal_em) : "nunca"}</span>
                <span className="ml-auto">
                  {c.ativo ? <Button size="sm" variant="outline" onClick={() => revogar.mutate(c.id, { onSuccess: () => toast.success("Central revogada.") })}><Trash2 className="size-4" /> Revogar</Button> : <Badge variant="muted">revogada</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Botões, cordas e botão de presença: código do fabricante → suíte. */
export function DispositivosChamadoAdmin() {
  const lista = useDispositivosChamado();
  const quartos = useQuartos();
  const cadastrar = useCadastrarDispositivoChamado();
  const ativar = useAtivarDispositivoChamado();
  const [codigo, setCodigo] = useState("");
  const [quarto, setQuarto] = useState("");
  const [tipo, setTipo] = useState<"botao" | "corda" | "presenca">("botao");
  const [local, setLocal] = useState("");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><BellRing className="size-4 text-primary" /> Botões e cordas das suítes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código do aparelho" className={inputBase} />
          <select value={quarto} onChange={(e) => setQuarto(e.target.value)} className={inputBase}>
            <option value="">Suíte…</option>
            {(quartos.data ?? []).map((q) => <option key={q.id} value={q.codigo}>{q.codigo}</option>)}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputBase}>
            {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local (cabeceira, banheiro…)" className={inputBase} />
        </div>
        <Button disabled={!codigo.trim() || !quarto || cadastrar.isPending} onClick={() => cadastrar.mutate({ codigo: codigo.trim(), quarto, tipo, local }, {
          onSuccess: () => { toast.success(`Aparelho vinculado à ${quarto}.`); setCodigo(""); setLocal(""); },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
        })}>Vincular aparelho</Button>
        {lista.isLoading ? <LoadingState /> : (lista.data ?? []).length === 0 ? <EmptyState label="Nenhum botão ou corda cadastrado ainda." /> : (
          <div className="divide-y rounded-lg border">
            {(lista.data ?? []).map((d) => (
              <div key={d.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", !d.ativo && "opacity-60")}>
                <span className="w-12 font-bold text-secondary">{d.quarto}</span>
                <Badge variant={d.tipo === "corda" ? "destructive" : d.tipo === "botao" ? "warning" : "muted"}>{TIPO_LABEL[d.tipo]}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{d.codigo_externo}</span>
                {d.local && <span className="text-xs text-muted-foreground">· {d.local}</span>}
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => ativar.mutate({ id: d.id, ativo: !d.ativo })}>{d.ativo ? "Desativar" : "Reativar"}</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
