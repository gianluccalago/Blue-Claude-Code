/**
 * Atendimentos individuais — Equipe Multidisciplinar (registro CLÍNICO).
 *
 * Fisio/TO/EF registram sessões individuais (um hóspede) com evolução. É
 * puramente clínico: NÃO há qualquer menção a valor, cobrança ou status
 * financeiro nesta tela (a Administração precifica depois, à parte). Cada
 * registro sai no nome do profissional logado.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, ClipboardList, Check, History } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useRegistrarAtendimento,
  useAtendimentosDoResidente,
} from "@/hooks/useAtendimentoIndividual";
import {
  TIPOS_ATENDIMENTO,
  TIPO_ATENDIMENTO_LABEL,
  tipoSugeridoPorFuncao,
} from "@/lib/atendimento";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";
import type { TipoAtendimentoIndividual } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AtendimentosIndividuais() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  const lista = residentes.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede cadastrado." />;

  const hospedeId = selecionadoId ?? lista[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <Activity className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Atendimentos individuais</h1>
        </div>
      </div>

      <HospedeSelector hospedes={lista} selecionadoId={hospedeId} onSelect={setSelecionadoId} />

      {hospedeId && (
        <Tabs defaultValue="registrar">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="registrar" className="gap-1.5">
              <ClipboardList className="size-4" /> Registrar
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5">
              <History className="size-4" /> Meus atendimentos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="registrar">
            <FormAtendimento key={hospedeId} residenteId={hospedeId} />
          </TabsContent>
          <TabsContent value="historico">
            <HistoricoAtendimentos residenteId={hospedeId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function FormAtendimento({ residenteId }: { residenteId: string }) {
  const { usuarioEfetivo } = useAuth();
  const registrar = useRegistrarAtendimento();
  const [tipo, setTipo] = useState<TipoAtendimentoIndividual>(
    tipoSugeridoPorFuncao(usuarioEfetivo?.funcao),
  );
  const [data, setData] = useState(hojeISO());
  const [evolucao, setEvolucao] = useState("");

  async function salvar() {
    try {
      await registrar.mutateAsync({ residenteId, tipo, data, evolucao });
      toast.success("Atendimento registrado.");
      setEvolucao("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Registrar sessão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-secondary">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS_ATENDIMENTO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                  tipo === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:max-w-48">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Evolução</label>
          <textarea
            rows={5}
            value={evolucao}
            onChange={(e) => setEvolucao(e.target.value)}
            placeholder="Descreva a sessão, a evolução e as condutas…"
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Button className="gap-2" disabled={registrar.isPending} onClick={salvar}>
          <Check className="size-4" /> {registrar.isPending ? "Salvando…" : "Salvar atendimento"}
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoricoAtendimentos({ residenteId }: { residenteId: string }) {
  const { usuarioEfetivo } = useAuth();
  const atendimentos = useAtendimentosDoResidente(residenteId);

  // O profissional vê os atendimentos QUE REGISTROU (clínico, sem financeiro).
  const meus = useMemo(
    () => (atendimentos.data ?? []).filter((a) => a.realizado_por === usuarioEfetivo?.nome),
    [atendimentos.data, usuarioEfetivo?.nome],
  );

  if (atendimentos.isLoading) return <LoadingState />;
  if (atendimentos.isError) return <ErrorState error={atendimentos.error} />;
  if (meus.length === 0)
    return <EmptyState label="Você ainda não registrou atendimentos para este hóspede." />;

  return (
    <div className="space-y-3">
      {meus.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-1.5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{TIPO_ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}</Badge>
              <span className="text-sm font-semibold text-secondary">{formatarDataBR(a.data)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-secondary/90">{ouNaoInformado(a.evolucao)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
