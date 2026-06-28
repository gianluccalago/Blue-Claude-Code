import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Brain, Save, Image as ImageIcon, Info } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useRegistrarTesteCognitivo } from "@/hooks/useTestesCognitivos";
import { HistoricoTestesCognitivos } from "@/components/medico/HistoricoTestesCognitivos";
import {
  itensDoTeste, pontuacaoTotal, calcularMoca, limitar, AVISO_INTERPRETACAO, TOTAL_MAX, type TipoTeste,
} from "@/lib/testesCognitivos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// TESTES COGNITIVOS (MEEM/MoCA) — perfil Médico. AVALIATIVOS (não alteram grau).
// O app NÃO reproduz estímulos protegidos: o médico aplica no MATERIAL OFICIAL
// (papel) e registra aqui só a pontuação por item/seção. Foto opcional.
// ===========================================================================

export function TestesCognitivos() {
  const residentes = useResidentes();
  const [hospedeId, setHospedeId] = useState("");

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  const lista = residentes.data ?? [];
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede ativo." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <Brain className="size-6 text-primary" /> Testes cognitivos
        </h2>
        <p className="text-sm text-muted-foreground">
          MEEM e MoCA — avaliativos (não alteram o grau). Aplique no material oficial; registre a pontuação aqui.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Hóspede</label>
          <select value={hospedeId} onChange={(e) => setHospedeId(e.target.value)} className={inputBase}>
            <option value="">Selecione o hóspede…</option>
            {lista.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </CardContent>
      </Card>

      {hospedeId ? (
        <>
          <NovoTeste residenteId={hospedeId} />
          <HistoricoTestesCognitivos residenteId={hospedeId} />
        </>
      ) : (
        <EmptyState label="Selecione um hóspede para registrar ou ver os testes." />
      )}
    </div>
  );
}

function NovoTeste({ residenteId }: { residenteId: string }) {
  const registrar = useRegistrarTesteCognitivo();
  const [tipo, setTipo] = useState<TipoTeste>("MEEM");
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [escolaridade, setEscolaridade] = useState("");
  const [interpretacao, setInterpretacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const itens = itensDoTeste(tipo);
  const escolaridadeNum = escolaridade.trim() === "" ? null : Number(escolaridade);

  const total = useMemo(
    () => pontuacaoTotal(tipo, respostas, escolaridadeNum),
    [tipo, respostas, escolaridadeNum],
  );
  const moca = tipo === "MoCA" ? calcularMoca(respostas, escolaridadeNum) : null;

  function trocarTipo(t: TipoTeste) {
    setTipo(t);
    setRespostas({});
  }
  function setItem(key: string, max: number, v: string) {
    const n = v === "" ? 0 : Number(v);
    setRespostas((p) => ({ ...p, [key]: limitar(n, max) }));
  }
  function onFoto(e: ChangeEvent<HTMLInputElement>) {
    setFoto(e.target.files?.[0] ?? null);
  }

  async function salvar() {
    try {
      await registrar.mutateAsync({
        residenteId,
        tipo,
        respostas,
        escolaridadeAnos: escolaridadeNum !== null && Number.isFinite(escolaridadeNum) ? Math.max(0, Math.round(escolaridadeNum)) : null,
        interpretacao: interpretacao || null,
        foto,
      });
      toast.success(`${tipo} registrado: ${total}/30.`);
      setRespostas({}); setEscolaridade(""); setInterpretacao(""); setFoto(null);
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Novo teste</CardTitle>
        <div className="flex gap-1.5">
          {(["MEEM", "MoCA"] as const).map((t) => (
            <button key={t} onClick={() => trocarTipo(t)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                tipo === t ? "bg-primary text-primary-foreground shadow-card" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
              {t}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aviso de direitos autorais */}
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-secondary">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Aplique o teste no <span className="font-semibold">material oficial (papel)</span> e registre aqui só a
            pontuação por item/seção. O app não reproduz os estímulos protegidos do instrumento.
          </p>
        </div>

        {/* Itens pontuados */}
        <div className="space-y-1.5">
          {itens.map((it) => (
            <div key={it.key} className={cn("flex items-center justify-between gap-3 rounded-md border px-3 py-1.5", it.semPontuacao && "bg-muted/20")}>
              <span className="text-sm text-secondary">
                {it.label}
                {it.semPontuacao && <span className="ml-1 text-xs text-muted-foreground">(não pontua)</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={it.max}
                  value={respostas[it.key] ?? ""}
                  onChange={(e) => setItem(it.key, it.max, e.target.value)}
                  className="h-8 w-16 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {!it.semPontuacao && <span className="w-8 text-xs text-muted-foreground">/{it.max}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Escolaridade + total */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">
              Escolaridade (anos de estudo){tipo === "MoCA" && <span className="text-xs font-normal text-muted-foreground"> — ajuste MoCA</span>}
            </label>
            <input type="number" min={0} value={escolaridade} onChange={(e) => setEscolaridade(e.target.value)} className={inputBase} placeholder="Ex.: 8" />
          </div>
          <div className="flex flex-col justify-end">
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
              <span className="text-sm font-semibold text-secondary">Pontuação total</span>
              <span className="text-2xl font-extrabold tabular-nums text-primary">{total}<span className="text-base text-muted-foreground">/{TOTAL_MAX}</span></span>
            </div>
            {moca && moca.ajusteEscolaridade > 0 && (
              <p className="mt-1 text-right text-xs text-muted-foreground">soma {moca.bruto} + ajuste de escolaridade +{moca.ajusteEscolaridade}</p>
            )}
          </div>
        </div>

        {/* Foto opcional */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-secondary"><ImageIcon className="size-4" /> Foto dos desenhos (papel) — opcional</label>
          <input type="file" accept="image/*" onChange={onFoto} className="text-sm" />
        </div>

        {/* Interpretação */}
        <div className="space-y-1">
          <label className="text-sm font-semibold text-secondary">Interpretação do médico</label>
          <textarea value={interpretacao} onChange={(e) => setInterpretacao(e.target.value)} rows={2}
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Síntese clínica (sem classificação automática)…" />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> {AVISO_INTERPRETACAO}</p>
        </div>

        <Button onClick={salvar} disabled={registrar.isPending}>
          <Save className="size-4" /> {registrar.isPending ? "Salvando…" : `Registrar ${tipo}`}
        </Button>
      </CardContent>
    </Card>
  );
}
