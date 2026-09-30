import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, Siren, Footprints, Nfc, Radio, WifiOff, PlugZap, ShieldAlert, Loader2, FlaskConical, ArrowRight } from "lucide-react";
import { MODULO_5 } from "@/data/mapaModulo5";
import { MapaModulo } from "@/components/chamados/MapaModulo";
import {
  useAtenderComEtiqueta,
  useCentraisChamado,
  useChamadosAbertos,
  useChamadosAoVivo,
  useEncerrarExcepcional,
  useOcupacaoSuites,
  useReconhecerChamado,
  useSimularChamado,
} from "@/hooks/useChamados";
import {
  chamadosPorSuite,
  ordenarChamados,
  semResposta,
  situacaoCentral,
  tempoDesde,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  type ChamadoAberto,
} from "@/lib/chamados";
import { STATUS_LEITURA_CUIDADORA } from "@/lib/rondas";
import { nfcDisponivel } from "@/lib/nfc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

const GESTORES = new Set(["master", "coordenacao"]);

function useAgora(ms = 20_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

/**
 * Painel de chamados do Módulo 5: mapa por andar, lista de alertas e ações.
 * `compacto` = versão para os painéis (Master, Coordenação/Enfermeira), com
 * link para a tela completa.
 */
export function PainelChamados({ compacto = false }: { compacto?: boolean }) {
  useChamadosAoVivo();
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const gestor = GESTORES.has(perfil ?? "");
  const abertos = useChamadosAbertos();
  const ocupacao = useOcupacaoSuites();
  const centrais = useCentraisChamado();
  const agora = useAgora();
  const [andarSel, setAndarSel] = useState<number | null>(null);
  const [suiteSel, setSuiteSel] = useState<string | null>(null);

  const lista = useMemo(() => ordenarChamados(abertos.data ?? []), [abertos.data]);
  const porSuite = useMemo(() => chamadosPorSuite(lista), [lista]);
  const contaAndar = (a: number) => lista.filter((c) => c.quarto.startsWith(`5${a}`));
  // Sem escolha manual, mostra o andar do alerta mais grave.
  const andar = andarSel ?? (lista[0] ? Number(lista[0].quarto[1]) : 1);
  const andarMapa = MODULO_5.andares.find((a) => a.andar === andar) ?? MODULO_5.andares[0];
  const central = situacaoCentral(centrais.data ?? [], agora);

  if (abertos.isLoading) return <Card><CardContent className="py-6"><LoadingState /></CardContent></Card>;
  if (abertos.isError) return <ErrorState error={abertos.error} />;

  const emergencias = lista.filter((c) => c.tipo === "emergencia").length;
  const selecionado = suiteSel ? porSuite.get(suiteSel) ?? null : null;

  return (
    <Card className={cn(emergencias > 0 && "border-destructive/60 shadow-[0_0_0_3px_hsl(var(--destructive)/0.15)]")}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <BellRing className="size-4 text-primary" /> Chamados · Módulo 5
          {emergencias > 0 && <Badge variant="destructive" className="gap-1"><Siren className="size-3" /> {emergencias} emergência(s)</Badge>}
          {lista.length - emergencias > 0 && <Badge variant="warning">{lista.length - emergencias} chamado(s)</Badge>}
          {lista.length === 0 && <Badge variant="success">nenhum aberto</Badge>}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <SeloCentral central={central} />
          {compacto && (
            <Link to="/app/$perfil/chamados" params={{ perfil: perfil ?? "coordenacao" }} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              Abrir <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {MODULO_5.andares.map((a) => {
            const n = contaAndar(a.andar);
            const e = n.some((c) => c.tipo === "emergencia");
            return (
              <Button key={a.andar} size="sm" variant={andar === a.andar ? "default" : "outline"} onClick={() => { setAndarSel(a.andar); setSuiteSel(null); }}>
                {a.andar}º andar
                {n.length > 0 && <span className={cn("ml-1 rounded-full px-1.5 text-xs font-bold", e ? "bg-destructive text-white" : "bg-warning text-warning-foreground")}>{n.length}</span>}
              </Button>
            );
          })}
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning" /> chamado (botão)</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-destructive" /> emergência (corda)</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-primary" /> porta</span>
          </span>
        </div>

        <div className={cn("grid gap-3", !compacto && "lg:grid-cols-[1fr_320px]")}>
          <div className="rounded-xl border bg-gradient-to-br from-background to-accent/30 p-2">
            <MapaModulo
              andar={andarMapa}
              chamados={porSuite}
              ocupacao={ocupacao.data ?? new Map()}
              selecionada={suiteSel}
              onSelecionar={(c) => setSuiteSel((s) => (s === c ? null : c))}
              agora={agora}
            />
          </div>
          <div className="space-y-2">
            {suiteSel && !selecionado && (
              <SuiteSemChamado codigo={suiteSel} hospedes={ocupacao.data?.get(suiteSel) ?? []} gestor={gestor} onFechar={() => setSuiteSel(null)} />
            )}
            {lista.length === 0 ? (
              !suiteSel && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum chamado aberto. Toque numa suíte para ver quem está nela.</p>
            ) : (
              ordenarChamados(selecionado ? [selecionado, ...lista.filter((c) => c.id !== selecionado.id)] : lista)
                .slice(0, compacto ? 4 : 50)
                .map((c) => (
                  <CartaoChamado
                    key={c.id}
                    c={c}
                    hospedes={ocupacao.data?.get(c.quarto) ?? []}
                    agora={agora}
                    gestor={gestor}
                    destacado={c.quarto === suiteSel}
                    onVerNoMapa={() => { setAndarSel(Number(c.quarto[1])); setSuiteSel(c.quarto); }}
                  />
                ))
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O alerta só apaga quando alguém comprova presença no quarto: encostando o tablet na etiqueta NFC da porta da suíte (ou no botão de presença do aparelho, se houver).
        </p>
      </CardContent>
    </Card>
  );
}

function SeloCentral({ central }: { central: ReturnType<typeof situacaoCentral> }) {
  if (central.tipo === "online") return <Badge variant="success" className="gap-1"><Radio className="size-3" /> central conectada</Badge>;
  if (central.tipo === "sem_central") return <Badge variant="muted" className="gap-1"><PlugZap className="size-3" /> aparelho ainda não instalado</Badge>;
  return (
    <Badge variant="destructive" className="gap-1">
      <WifiOff className="size-3" /> sem sinal da central{central.ultimo ? ` desde ${new Date(central.ultimo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
    </Badge>
  );
}

function CartaoChamado({
  c,
  hospedes,
  agora,
  gestor,
  destacado,
  onVerNoMapa,
}: {
  c: ChamadoAberto;
  hospedes: { nome: string; leito: string }[];
  agora: Date;
  gestor: boolean;
  destacado: boolean;
  onVerNoMapa: () => void;
}) {
  const emerg = c.tipo === "emergencia";
  const reconhecer = useReconhecerChamado();
  const atender = useAtenderComEtiqueta();
  const encerrar = useEncerrarExcepcional();
  const abortar = useRef<AbortController | null>(null);
  const [lendo, setLendo] = useState(false);
  const [justificando, setJustificando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const atrasado = semResposta(c, agora);

  async function encostar() {
    const ctrl = new AbortController();
    abortar.current = ctrl;
    setLendo(true);
    try {
      const r = await atender.mutateAsync(ctrl.signal);
      if (!r.ok) toast.error(STATUS_LEITURA_CUIDADORA[r.status as keyof typeof STATUS_LEITURA_CUIDADORA] ?? "Leitura recusada.");
      else if (r.quarto === c.quarto) toast.success(`Presença registrada na ${c.quarto}. Chamado encerrado.`);
      else toast.warning(`Essa é a etiqueta da ${r.quarto} (ronda registrada lá). O chamado da ${c.quarto} continua aberto.`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message || "Não foi possível ler a etiqueta.");
    } finally {
      ctrl.abort();
      setLendo(false);
    }
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border-2 p-3",
        emerg ? "border-destructive bg-destructive/5" : "border-warning bg-warning/10",
        destacado && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={onVerNoMapa} className="text-left">
          <p className={cn("flex items-center gap-1.5 text-lg font-extrabold", emerg ? "text-destructive" : "text-warning-foreground")}>
            {emerg ? <Siren className="size-5" /> : <BellRing className="size-5" />} {c.quarto}
            <span className="text-sm font-bold uppercase">{ROTULO_TIPO[c.tipo]}</span>
          </p>
          <p className="text-sm text-secondary">{hospedes.length ? hospedes.map((h) => h.nome).join(" · ") : "Suíte sem hóspede cadastrado"}</p>
        </button>
        <div className="text-right text-xs text-muted-foreground">
          <p className="text-sm font-bold text-secondary">{tempoDesde(c.aberto_em, agora)}</p>
          <p>{ROTULO_ORIGEM[c.origem]}{c.acionamentos > 1 ? ` · ${c.acionamentos}×` : ""}</p>
          {c.simulado && <Badge variant="muted" className="mt-1 gap-1"><FlaskConical className="size-3" /> simulação</Badge>}
        </div>
      </div>
      {c.reconhecido_por ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-secondary"><Footprints className="size-4" /> {c.reconhecido_por} a caminho · {tempoDesde(c.reconhecido_em!, agora)}</p>
      ) : (
        <p className={cn("text-sm font-semibold", atrasado ? "text-destructive" : "text-muted-foreground")}>
          {atrasado ? "Ninguém a caminho ainda!" : "Ninguém a caminho ainda."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={c.reconhecido_por ? "outline" : emerg ? "destructive" : "warning"} disabled={reconhecer.isPending} onClick={() => reconhecer.mutate(c.id, { onSuccess: () => toast.success("A equipe sabe que você está indo.") })}>
          <Footprints className="size-4" /> Estou indo
        </Button>
        {nfcDisponivel() && (
          lendo ? (
            <Button size="sm" variant="outline" onClick={() => abortar.current?.abort()}><Loader2 className="size-4 animate-spin" /> Encoste na etiqueta da {c.quarto}…</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void encostar()}><Nfc className="size-4" /> Cheguei: ler etiqueta</Button>
          )
        )}
        {gestor && !justificando && (
          <Button size="sm" variant="ghost" onClick={() => setJustificando(true)}><ShieldAlert className="size-4" /> Encerrar sem presença</Button>
        )}
      </div>
      {!nfcDisponivel() && <p className="text-xs text-muted-foreground">Para encerrar, encoste o tablet da ronda na etiqueta da porta da {c.quarto}.</p>}
      {justificando && (
        <div className="space-y-2 rounded-lg border bg-card p-2">
          <p className="text-xs font-semibold text-secondary">Só para defeito de etiqueta ou aparelho. Fica registrado com seu nome.</p>
          <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} placeholder="Motivo (ex.: etiqueta descolada; conferi pessoalmente às 02h15)" className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={justificativa.trim().length < 10 || encerrar.isPending}
              onClick={() => encerrar.mutate({ id: c.id, justificativa }, {
                onSuccess: () => { toast.success("Chamado encerrado (excepcional)."); setJustificando(false); },
                onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
              })}>
              Encerrar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setJustificando(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuiteSemChamado({ codigo, hospedes, gestor, onFechar }: { codigo: string; hospedes: { nome: string; leito: string }[]; gestor: boolean; onFechar: () => void }) {
  const simular = useSimularChamado();
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold text-secondary">Suíte {codigo}</p>
        <button onClick={onFechar} className="text-xs text-muted-foreground hover:underline">fechar</button>
      </div>
      {hospedes.length ? hospedes.map((h) => <p key={h.leito} className="text-sm text-secondary">Leito {h.leito.slice(-1)} · {h.nome}</p>) : <p className="text-sm text-muted-foreground">Sem hóspede cadastrado.</p>}
      <p className="text-xs text-muted-foreground">Sem chamado aberto.</p>
      {gestor && (
        <div className="flex flex-wrap gap-2 border-t pt-2">
          <span className="w-full text-xs font-semibold text-muted-foreground">Treino (enquanto o aparelho não chega):</span>
          <Button size="sm" variant="outline" disabled={simular.isPending} onClick={() => simular.mutate({ quarto: codigo, tipo: "chamado" }, { onSuccess: () => toast.success(`Chamado simulado na ${codigo}.`) })}>
            <FlaskConical className="size-4" /> Simular chamado
          </Button>
          <Button size="sm" variant="outline" disabled={simular.isPending} onClick={() => simular.mutate({ quarto: codigo, tipo: "emergencia" }, { onSuccess: () => toast.success(`Emergência simulada na ${codigo}.`) })}>
            <FlaskConical className="size-4" /> Simular emergência
          </Button>
        </div>
      )}
    </div>
  );
}
