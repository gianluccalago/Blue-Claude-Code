import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Nfc, Moon, Sun, CloudOff, RefreshCw, Check, X, Loader2, BedDouble } from "lucide-react";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import {
  SemRede,
  enviarLeitura,
  guardarNaFila,
  uidDaUrl,
  useFilaRondas,
  useMapaQuartos,
  useRegistrarChecklist,
  useStatusDispositivo,
  useUltimasRondas,
  type RespostaLeitura,
} from "@/hooks/useRondas";
import { lerUmaTag, nfcDisponivel } from "@/lib/nfc";
import {
  CAMPOS_CHECKLIST,
  STATUS_LEITURA_CUIDADORA,
  checklistCompleto,
  checklistInicial,
  situacaoRonda,
  type ChecklistHospede,
} from "@/lib/rondas";
import { plantaoAtualEAnterior } from "@/lib/rotina";
import { plantaoDoInstante } from "@/lib/plantao";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { cn } from "@/lib/utils";

// ===========================================================================
// RONDA — tocar a etiqueta do quarto, marcar o checklist, pronto.
// Sem PIN: a cuidadora é o login do tablet. Sem som. À noite, tela escura.
// Sem rede, a ronda fica guardada no tablet e vai depois ("sincronizada
// tarde"). O horário oficial é sempre o do servidor.
// ===========================================================================

type Etapa =
  | { tipo: "inicio" }
  | { tipo: "lendo" }
  | { tipo: "enviando" }
  | { tipo: "recusada"; mensagem: string }
  | {
      tipo: "checklist";
      quarto: string;
      residentes: { id: string; nome: string; leito: string }[];
      leituraId: string | null;
      offline: { url: string | null; serial: string | null; capturadoEm: string } | null;
    };

export function Ronda() {
  const [noturno, setNoturno] = useState(() => plantaoDoInstante(new Date()).tag === "noturno");
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "inicio" });
  const [checklists, setChecklists] = useState<Record<string, ChecklistHospede>>({});
  const abortar = useRef<AbortController | null>(null);
  const dispositivo = useStatusDispositivo();
  const mapa = useMapaQuartos();
  const fila = useFilaRondas();
  const registrar = useRegistrarChecklist();

  const liberado = !!dispositivo.data?.ativo;

  async function iniciar() {
    abortar.current?.abort();
    const ctrl = new AbortController();
    abortar.current = ctrl;
    setEtapa({ tipo: "lendo" });
    let leitura: { url: string | null; serialNumber: string | null };
    try {
      leitura = await lerUmaTag(ctrl.signal);
    } catch (e) {
      if ((e as Error).name === "AbortError") return setEtapa({ tipo: "inicio" });
      return setEtapa({ tipo: "recusada", mensagem: (e as Error).message });
    } finally {
      ctrl.abort();
    }
    navigator.vibrate?.(60);
    setEtapa({ tipo: "enviando" });
    try {
      const r: RespostaLeitura = await enviarLeitura({ url: leitura.url, serial_number: leitura.serialNumber });
      if (!r.ok) {
        return setEtapa({ tipo: "recusada", mensagem: STATUS_LEITURA_CUIDADORA[r.status as keyof typeof STATUS_LEITURA_CUIDADORA] ?? "Leitura recusada." });
      }
      abrirChecklist(r.quarto ?? "?", r.residentes, r.leitura_id, null);
    } catch (e) {
      if (!(e instanceof SemRede)) return setEtapa({ tipo: "recusada", mensagem: "Não foi possível registrar agora. Tente de novo." });
      // Sem rede: acha o quarto pelo mapa guardado no tablet e segue.
      const uid = uidDaUrl(leitura.url);
      const q = uid ? mapa.data?.[uid] : undefined;
      if (!q) return setEtapa({ tipo: "recusada", mensagem: "Sem internet e etiqueta desconhecida neste tablet. Tente quando a rede voltar." });
      abrirChecklist(q.quarto, q.residentes, null, { url: leitura.url, serial: leitura.serialNumber, capturadoEm: new Date().toISOString() });
    }
  }

  function abrirChecklist(
    quarto: string,
    residentes: { id: string; nome: string; leito: string }[],
    leituraId: string | null,
    offline: { url: string | null; serial: string | null; capturadoEm: string } | null,
  ) {
    setChecklists(Object.fromEntries(residentes.map((r) => [r.id, checklistInicial()])));
    setEtapa({ tipo: "checklist", quarto, residentes, leituraId, offline });
  }

  async function confirmar() {
    if (etapa.tipo !== "checklist") return;
    const payload = checklists as Record<string, Record<string, string | string[]>>;
    try {
      if (etapa.offline) {
        await guardarNaFila({
          url: etapa.offline.url, serial_number: etapa.offline.serial, capturado_em: etapa.offline.capturadoEm,
          checklist: payload, quarto: etapa.quarto,
        });
        await fila.atualizar();
        toast.success("Sem internet: ronda guardada no tablet. Vai sozinha quando a rede voltar.");
      } else if (etapa.leituraId) {
        await registrar.mutateAsync({ leituraId: etapa.leituraId, checklist: payload });
        toast.success(`Ronda do quarto ${etapa.quarto} registrada.`);
      }
      setEtapa({ tipo: "inicio" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const tema = noturno
    ? { fundo: "bg-slate-950 text-slate-200", cartao: "border-slate-800 bg-slate-900", suave: "text-slate-400", chip: "border-slate-700 bg-slate-900 text-slate-300", chipOn: "border-sky-700 bg-sky-900 text-sky-100", botao: "bg-sky-800 text-sky-50 hover:bg-sky-700" }
    : { fundo: "bg-background text-foreground", cartao: "border-border bg-card", suave: "text-muted-foreground", chip: "border-border bg-card text-muted-foreground", chipOn: "border-primary bg-primary text-primary-foreground", botao: "bg-primary text-primary-foreground hover:bg-primary/90" };

  return (
    <div className={cn("min-h-[75vh] space-y-4 rounded-2xl p-4 sm:p-5", tema.fundo)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-sm", tema.suave)}>
          {dispositivo.isLoading ? "Verificando o tablet…" : liberado ? `Tablet: ${dispositivo.data?.nome}` : "Este tablet não está cadastrado para rondas. Avise a Coordenação."}
        </p>
        <div className="flex items-center gap-2">
          {fila.pendentes > 0 && (
            <button onClick={() => void fila.sincronizar()} className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm", tema.chip)}>
              {fila.enviando ? <Loader2 className="size-4 animate-spin" /> : <CloudOff className="size-4" />}
              {fila.pendentes} guardada(s) sem rede <RefreshCw className="size-3.5" />
            </button>
          )}
          <button onClick={() => setNoturno((v) => !v)} className={cn("rounded-md border p-2", tema.chip)} aria-label="Alternar tema">
            {noturno ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>

      {etapa.tipo === "checklist" ? (
        <ChecklistQuarto
          etapa={etapa}
          checklists={checklists}
          setChecklists={setChecklists}
          tema={tema}
          salvando={registrar.isPending}
          onConfirmar={confirmar}
          onCancelar={() => setEtapa({ tipo: "inicio" })}
        />
      ) : (
        <div className={cn("flex flex-col items-center gap-4 rounded-2xl border p-6 text-center", tema.cartao)}>
          {etapa.tipo === "lendo" ? (
            <>
              <Nfc className="size-16 animate-pulse" />
              <p className="text-xl font-bold">Encoste o tablet na etiqueta do quarto</p>
              <button onClick={() => abortar.current?.abort()} className={cn("rounded-md border px-4 py-2 text-sm", tema.chip)}>Cancelar</button>
            </>
          ) : etapa.tipo === "enviando" ? (
            <>
              <Loader2 className="size-12 animate-spin" />
              <p className="text-lg font-semibold">Registrando…</p>
            </>
          ) : (
            <>
              {etapa.tipo === "recusada" && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-600/50 bg-amber-500/10 px-4 py-3 text-base font-semibold">
                  <X className="size-5 shrink-0" /> {etapa.mensagem}
                </p>
              )}
              <button
                onClick={() => void iniciar()}
                disabled={!liberado || !nfcDisponivel()}
                className={cn("flex h-32 w-full max-w-md flex-col items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold transition-colors disabled:opacity-40", tema.botao)}
              >
                <Nfc className="size-10" /> Iniciar ronda
              </button>
              {!nfcDisponivel() && <p className={cn("text-sm", tema.suave)}>Este navegador não lê NFC. Use o Chrome no tablet Android.</p>}
            </>
          )}
        </div>
      )}

      {etapa.tipo !== "checklist" && <MeusQuartos tema={tema} />}
    </div>
  );
}

type Tema = { fundo: string; cartao: string; suave: string; chip: string; chipOn: string; botao: string };

function ChecklistQuarto({
  etapa,
  checklists,
  setChecklists,
  tema,
  salvando,
  onConfirmar,
  onCancelar,
}: {
  etapa: Extract<Etapa, { tipo: "checklist" }>;
  checklists: Record<string, ChecklistHospede>;
  setChecklists: (f: (p: Record<string, ChecklistHospede>) => Record<string, ChecklistHospede>) => void;
  tema: Tema;
  salvando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const completo = etapa.residentes.every((r) => checklistCompleto(checklists[r.id] ?? {}));
  const marcar = (resId: string, chave: string, valor: string, multiplo?: boolean) =>
    setChecklists((prev) => {
      const atual = prev[resId] ?? {};
      if (multiplo) {
        const lista = (atual[chave as keyof ChecklistHospede] as string[] | undefined) ?? [];
        return { ...prev, [resId]: { ...atual, [chave]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] } };
      }
      return { ...prev, [resId]: { ...atual, [chave]: valor } };
    });

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center justify-between rounded-xl border p-4", tema.cartao)}>
        <p className="flex items-center gap-2 text-xl font-extrabold"><BedDouble className="size-6" /> Quarto {etapa.quarto}</p>
        {etapa.offline && <span className="flex items-center gap-1.5 text-sm"><CloudOff className="size-4" /> sem internet</span>}
      </div>
      {etapa.residentes.length === 0 && <p className={cn("rounded-xl border p-4", tema.cartao)}>Nenhum hóspede neste quarto. A presença foi registrada.</p>}
      {etapa.residentes.map((r) => (
        <div key={r.id} className={cn("space-y-3 rounded-xl border p-4", tema.cartao)}>
          <p className="text-lg font-bold">{r.nome} <span className={cn("text-sm font-normal", tema.suave)}>· leito {r.leito}</span></p>
          {CAMPOS_CHECKLIST.map((campo) => {
            const valor = checklists[r.id]?.[campo.chave];
            return (
              <div key={campo.chave}>
                <p className={cn("mb-1 text-xs font-bold uppercase tracking-wide", tema.suave)}>
                  {campo.rotulo}{campo.obrigatorio ? " *" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {campo.opcoes.map((op) => {
                    const on = campo.multiplo ? ((valor as string[] | undefined) ?? []).includes(op.valor) : valor === op.valor;
                    return (
                      <button
                        key={op.valor}
                        onClick={() => marcar(r.id, campo.chave, op.valor, campo.multiplo)}
                        className={cn("min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold", on ? tema.chipOn : tema.chip)}
                      >
                        {op.rotulo}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex gap-3">
        <button
          onClick={onConfirmar}
          disabled={!completo || salvando}
          className={cn("flex h-14 flex-1 items-center justify-center gap-2 rounded-xl text-lg font-extrabold disabled:opacity-40", tema.botao)}
        >
          {salvando ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Confirmar ronda
        </button>
        <button onClick={onCancelar} className={cn("h-14 rounded-xl border px-4 text-sm", tema.chip)}>Voltar</button>
      </div>
      {!completo && <p className={cn("text-center text-sm", tema.suave)}>Marque posição, fralda e estado de cada hóspede.</p>}
    </div>
  );
}

function MeusQuartos({ tema }: { tema: Tema }) {
  const hospedes = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const ids = useMemo(() => (hospedes.data ?? []).map((h) => h.id), [hospedes.data]);
  const dados = useUltimasRondas(ids);
  const agora = new Date();
  const { atual } = plantaoAtualEAnterior(agora);
  const inicio = new Date(atual.turno.inicio);
  const lista = (hospedes.data ?? [])
    .map((h) => {
      const cfg = dados.data?.configs.get(h.id);
      if (!cfg || !cfg.ativa || (cfg.turnos === "noturno" && atual.tag !== "noturno")) return null;
      const s = situacaoRonda(cfg, dados.data?.ultimas.get(h.id) ?? null, inicio, agora);
      return { h, s };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.s.proximaEm.getTime() - b.s.proximaEm.getTime());
  if (lista.length === 0) return null;
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("space-y-2 rounded-xl border p-4", tema.cartao)}>
      <p className="text-sm font-bold uppercase tracking-wide">Minhas rondas</p>
      {lista.map(({ h, s }) => (
        <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
          <span>{h.nome} <span className={tema.suave}>· {h.quarto}</span></span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-bold",
              s.situacao === "atrasada" ? "bg-red-500/20 text-red-300" : s.situacao === "vencendo" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300",
              !tema.fundo.includes("slate") && (s.situacao === "atrasada" ? "text-red-700" : s.situacao === "vencendo" ? "text-amber-700" : "text-emerald-700"),
            )}
          >
            {s.situacao === "atrasada" ? `atrasada desde ${hora(s.limiteEm)}` : s.situacao === "vencendo" ? `até ${hora(s.limiteEm)}` : `próxima ${hora(s.proximaEm)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
