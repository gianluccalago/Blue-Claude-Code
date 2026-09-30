import { useRef, useState } from "react";
import { toast } from "sonner";
import { Nfc, Tablet, Tag, Trash2, Settings2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  lerTokenDispositivo,
  useCadastrarEsteTablet,
  useCadastrarTag,
  useDefinirTagAtiva,
  useDispositivos,
  useParametrosRonda,
  useQuartos,
  useRevogarDispositivo,
  useSalvarParametrosRonda,
  useStatusDispositivo,
  useTagsNfc,
} from "@/hooks/useRondas";
import { lerUmaTag, lerUrlNtag213, nfcDisponivel, normalizarUid } from "@/lib/nfc";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CentralChamadosAdmin, DispositivosChamadoAdmin } from "@/components/chamados/ChamadosAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { cn, formatarDataHoraBR } from "@/lib/utils";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ===========================================================================
// TAGS E TABLETS (Master e Coordenação): cadastrar este tablet, revogar
// tablets, cadastrar tag encostando-a no aparelho, ativar/desativar tag e o
// parâmetro de plausibilidade.
// ===========================================================================
export function RondasNfcAdmin() {
  return (
    <div className="space-y-6">
      <EsteTablet />
      <CadastrarTag />
      <ListaTags />
      <ListaTablets />
      <Parametros />
      <CentralChamadosAdmin />
      <DispositivosChamadoAdmin />
    </div>
  );
}

function EsteTablet() {
  const status = useStatusDispositivo();
  const cadastrar = useCadastrarEsteTablet();
  const [nome, setNome] = useState("");
  const temToken = !!lerTokenDispositivo();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Tablet className="size-4 text-primary" /> Este aparelho</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.isLoading ? (
          <LoadingState />
        ) : status.data?.ativo ? (
          <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Cadastrado para rondas como <strong>{status.data.nome}</strong>.</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4 text-warning" />
              {temToken && status.data?.cadastrado ? "Este tablet foi revogado. Cadastre de novo para voltar a usar." : "Este aparelho não está cadastrado para rondas."}
            </p>
            <div className="flex flex-wrap gap-2">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do tablet (ex.: Tablet 2º andar)" className={cn(inputBase, "min-w-[240px] flex-1")} />
              <Button
                loading={cadastrar.isPending}
                disabled={!nome.trim()}
                onClick={() =>
                  cadastrar.mutate(nome.trim(), {
                    onSuccess: () => { toast.success("Tablet cadastrado. O código ficou salvo neste aparelho."); setNome(""); },
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar."),
                  })
                }
              >
                Cadastrar este tablet
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Faça isto no próprio tablet das rondas. O código é gerado uma vez e fica guardado só nele.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CadastrarTag() {
  const quartos = useQuartos();
  const cadastrar = useCadastrarTag();
  const abortar = useRef<AbortController | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<{ uid: string; contador: number | null; confirmado: boolean } | null>(null);
  const [quarto, setQuarto] = useState("");
  const [obs, setObs] = useState("");

  async function ler() {
    const ctrl = new AbortController();
    abortar.current = ctrl;
    setLendo(true);
    try {
      const l = await lerUmaTag(ctrl.signal);
      const daUrl = lerUrlNtag213(l.url);
      const serial = normalizarUid(l.serialNumber);
      const uid = daUrl?.uid ?? serial;
      if (!uid) throw new Error("Não achei o UID nesta etiqueta. Ela já foi gravada com a URL das rondas?");
      if (daUrl && serial && daUrl.uid !== serial) throw new Error("O UID gravado na URL não confere com o chip. Regrave a etiqueta.");
      setLido({ uid, contador: daUrl?.counter ?? null, confirmado: !!daUrl && !!serial });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    } finally {
      ctrl.abort();
      setLendo(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Nfc className="size-4 text-primary" /> Cadastrar tag</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!nfcDisponivel() && <p className="text-sm text-muted-foreground">Abra esta tela no Chrome do tablet Android para ler a etiqueta.</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void ler()} disabled={lendo || !nfcDisponivel()}>
            {lendo ? <Loader2 className="size-4 animate-spin" /> : <Nfc className="size-4" />} {lendo ? "Encoste a etiqueta…" : "Ler etiqueta"}
          </Button>
          {lendo && <Button variant="outline" onClick={() => abortar.current?.abort()}>Cancelar</Button>}
        </div>
        {lido && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-accent/40 p-3">
            <p className="text-sm">
              UID <strong className="font-mono">{lido.uid}</strong> · contador {lido.contador ?? "não gravado na URL"}
              {!lido.confirmado && <Badge variant="warning" className="ml-2">UID não confirmado pelo chip</Badge>}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-secondary">Quarto</label>
                <select value={quarto} onChange={(e) => setQuarto(e.target.value)} className={inputBase}>
                  <option value="">Selecione…</option>
                  {(quartos.data ?? []).map((q) => <option key={q.id} value={q.codigo}>{q.codigo}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-secondary">Observação (onde está colada)</label>
                <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: batente da porta, lado de dentro" className={inputBase} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                loading={cadastrar.isPending}
                disabled={!quarto}
                onClick={() =>
                  cadastrar.mutate(
                    { uid: lido.uid, quarto, contador: lido.contador, observacao: obs },
                    {
                      onSuccess: () => { toast.success(`Tag vinculada ao quarto ${quarto}.`); setLido(null); setQuarto(""); setObs(""); },
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar."),
                    },
                  )
                }
              >
                Vincular ao quarto
              </Button>
              <Button variant="outline" onClick={() => setLido(null)}>Descartar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListaTags() {
  const tags = useTagsNfc();
  const ativar = useDefinirTagAtiva();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Tag className="size-4 text-primary" /> Tags cadastradas</CardTitle>
      </CardHeader>
      <CardContent>
        {tags.isLoading ? <LoadingState /> : tags.isError ? <ErrorState error={tags.error} /> : (tags.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma tag cadastrada ainda." />
        ) : (
          <div className="divide-y rounded-lg border">
            {(tags.data ?? []).map((t) => (
              <div key={t.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm", !t.ativa && "opacity-60")}>
                <span className="w-16 font-bold text-secondary">{t.quarto}</span>
                <span className="font-mono text-xs text-muted-foreground">{t.uid}</span>
                <span className="text-xs text-muted-foreground">último contador {t.last_counter ?? "—"}</span>
                {t.observacao && <span className="text-xs text-muted-foreground">· {t.observacao}</span>}
                <span className="ml-auto flex items-center gap-2">
                  <Badge variant={t.ativa ? "success" : "muted"}>{t.ativa ? "ativa" : "desativada"}</Badge>
                  <Button size="sm" variant="outline" disabled={ativar.isPending} onClick={() => ativar.mutate({ id: t.id, ativa: !t.ativa })}>
                    {t.ativa ? "Desativar" : "Reativar"}
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListaTablets() {
  const lista = useDispositivos();
  const revogar = useRevogarDispositivo();
  const [confirmar, setConfirmar] = useState<{ id: string; nome: string } | null>(null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Tablet className="size-4 text-primary" /> Tablets cadastrados</CardTitle>
      </CardHeader>
      <CardContent>
        {lista.isLoading ? <LoadingState /> : lista.isError ? <ErrorState error={lista.error} /> : (lista.data ?? []).length === 0 ? (
          <EmptyState label="Nenhum tablet cadastrado." />
        ) : (
          <div className="divide-y rounded-lg border">
            {(lista.data ?? []).map((d) => (
              <div key={d.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm", !d.ativo && "opacity-60")}>
                <span className="font-semibold text-secondary">{d.nome}</span>
                <span className="text-xs text-muted-foreground">
                  cadastrado por {d.cadastrado_por ?? "—"} em {formatarDataHoraBR(d.criado_em)}
                  {d.ultimo_uso_em ? ` · último uso ${formatarDataHoraBR(d.ultimo_uso_em)}` : ""}
                  {d.revogado_em ? ` · revogado por ${d.revogado_por ?? "—"} em ${formatarDataHoraBR(d.revogado_em)}` : ""}
                </span>
                <span className="ml-auto">
                  {d.ativo ? (
                    <Button size="sm" variant="outline" onClick={() => setConfirmar({ id: d.id, nome: d.nome })}>
                      <Trash2 className="size-4" /> Revogar
                    </Button>
                  ) : <Badge variant="muted">revogado</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        aberto={!!confirmar}
        titulo={`Revogar "${confirmar?.nome}"?`}
        descricao="As rondas feitas por este tablet passam a ser recusadas. Para voltar a usá-lo, cadastre-o de novo."
        textoConfirmar="Sim, revogar"
        onConfirmar={() => {
          if (confirmar) revogar.mutate(confirmar.id, { onSuccess: () => toast.success("Tablet revogado.") });
          setConfirmar(null);
        }}
        onCancelar={() => setConfirmar(null)}
      />
    </Card>
  );
}

function Parametros() {
  const p = useParametrosRonda();
  const salvar = useSalvarParametrosRonda();
  const [seg, setSeg] = useState<number | null>(null);
  const valor = seg ?? p.data?.plausibilidade_segundos ?? 30;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4 text-primary" /> Plausibilidade</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Segundos mínimos entre quartos diferentes</label>
          <input type="number" min={0} max={600} value={valor} onChange={(e) => setSeg(parseInt(e.target.value, 10) || 0)} className={cn(inputBase, "w-32")} />
        </div>
        <Button
          loading={salvar.isPending}
          onClick={() => salvar.mutate(valor, { onSuccess: () => toast.success("Parâmetro salvo."), onError: (e) => toast.error(e instanceof Error ? e.message : "Erro.") })}
        >
          Salvar
        </Button>
        <p className="w-full text-xs text-muted-foreground">Check-ins da mesma pessoa em quartos diferentes com intervalo menor que isso são sinalizados para revisão (não bloqueiam).</p>
      </CardContent>
    </Card>
  );
}
