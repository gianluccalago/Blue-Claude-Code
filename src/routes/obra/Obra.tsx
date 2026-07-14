import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  Play,
  SlidersHorizontal,
  Images,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useFasesObra,
  useEtapasObra,
  useChecklistObra,
  useRegistrarAcompanhamento,
  useFotosAcompanhamento,
  useAtualizarPesos,
  useIniciarFase,
} from "@/hooks/useObra";
import {
  OBRA_FASE_STATUS_LABEL,
  OBRA_FASE_STATUS_VARIANTE,
  ultimaVerificacaoPorEtapa,
  percentualEtapa,
  avancoFisico,
  somaPesos,
  podeIniciarFase,
} from "@/lib/obra";
import { BUCKET_OBRA } from "@/lib/storage";
import { FotoSegura } from "@/components/AnexoSeguro";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import type { ObraEtapa, ObraFase } from "@/types/database";

// ===========================================================================
// MÓDULO OBRA — Execução: mapa da fase com % de conclusão editável por etapa e
// galeria de fotos datadas (evolução). Avanço físico = pesos ponderados pelo %.
// A etapa vira medível no BM ao chegar a 100% (o dinheiro da MO segue objetivo).
// Acesso: master/direção (edita) e obra_prestador (leitura; portal na Fase 6).
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function ObraExecucao() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const podeEditar = perfil === "master" || perfil === "direcao";

  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const fotos = useFotosAcompanhamento();

  const [faseSel, setFaseSel] = useState<number>(1);
  const [acompanhando, setAcompanhando] = useState<ObraEtapa | null>(null);
  const [editandoPesos, setEditandoPesos] = useState(false);
  const [galeriaEtapa, setGaleriaEtapa] = useState<ObraEtapa | null>(null);

  const ultimaPorEtapa = useMemo(
    () => ultimaVerificacaoPorEtapa(checklist.data ?? []),
    [checklist.data],
  );

  if (fases.isLoading || etapas.isLoading || checklist.isLoading) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;
  if (etapas.isError) return <ErrorState error={etapas.error} />;
  if (checklist.isError) return <ErrorState error={checklist.error} />;

  const listaFases = fases.data ?? [];
  if (listaFases.length === 0)
    return <EmptyState label="Fases da obra não encontradas — rode a migration 0099 no Supabase." />;

  const fase = listaFases.find((f) => f.numero === faseSel) ?? listaFases[0];
  const etapasDaFase = (etapas.data ?? [])
    .filter((e) => e.fase_id === fase.id)
    .sort((a, b) => a.ordem - b.ordem);
  const avanco = avancoFisico(etapasDaFase, ultimaPorEtapa);
  // Nº de fotos por etapa (galeria de evolução).
  const fotosPorEtapa = new Map<string, number>();
  for (const f of fotos.data ?? []) fotosPorEtapa.set(f.etapa_id, (fotosPorEtapa.get(f.etapa_id) ?? 0) + 1);

  return (
    <div className="space-y-6 pb-8">
      {podeEditar && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setEditandoPesos(true)}>
            <SlidersHorizontal className="size-4" /> Pesos da fase
          </Button>
        </div>
      )}

      {/* Cards das 4 fases (sequência contratual) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {listaFases.map((f) => {
          const etapasF = (etapas.data ?? []).filter((e) => e.fase_id === f.id);
          const av = avancoFisico(etapasF, ultimaPorEtapa);
          const selecionada = f.numero === fase.numero;
          return (
            <button
              key={f.id}
              onClick={() => setFaseSel(f.numero)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left shadow-xs transition-all",
                selecionada ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-secondary">{f.nome}</span>
                <Badge variant={OBRA_FASE_STATUS_VARIANTE[f.status]}>{OBRA_FASE_STATUS_LABEL[f.status]}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {f.modulos} · {f.area_m2.toLocaleString("pt-BR")} m²
              </p>
              <BarraAvanco valor={av} className="mt-3" />
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{av.toFixed(1)}% físico</p>
            </button>
          );
        })}
      </div>

      {/* Fase selecionada */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-secondary">
                {fase.nome} — {fase.modulos}
              </h2>
              <p className="text-xs text-muted-foreground">
                {fase.area_m2.toLocaleString("pt-BR")} m²
                {fase.data_inicio ? ` · iniciada em ${formatarDataBR(fase.data_inicio)}` : ""}
                {fase.ipca_pct != null ? ` · IPCA aplicado ${fase.ipca_pct}%` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {podeEditar && fase.status === "nao_iniciada" && (
                <BotaoIniciarFase fase={fase} todas={listaFases} />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-secondary">Avanço físico</span>
              <span className="font-bold tabular-nums text-secondary">{avanco.toFixed(1)}%</span>
            </div>
            <BarraAvanco valor={avanco} className="mt-1.5" alta />
          </div>

          {/* Etapas com % de conclusão editável + galeria de fotos por etapa */}
          <div className="divide-y">
            {etapasDaFase.map((e) => {
              const ultima = ultimaPorEtapa.get(e.id);
              const pct = percentualEtapa(e.id, ultimaPorEtapa);
              const concluida = pct >= 100;
              const nFotos = fotosPorEtapa.get(e.id) ?? 0;
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums",
                      concluida ? "bg-success/15 text-success" : pct > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {concluida ? <CheckCircle2 className="size-5" /> : `${pct}%`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-secondary">{e.nome}</span>
                      <Badge variant="muted" className="tabular-nums">peso {e.peso_pct}%</Badge>
                      {ultima && (
                        <span className="text-xs text-muted-foreground">
                          atualizada em {formatarDataHoraBR(ultima.registrado_em)}
                        </span>
                      )}
                    </div>
                    {e.descricao && <p className="text-xs text-muted-foreground">{e.descricao}</p>}
                    {/* Barra de conclusão da etapa */}
                    <BarraAvanco valor={pct} className="mt-1.5" />
                    {ultima?.observacao && <p className="mt-1 text-xs text-muted-foreground">{ultima.observacao}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {nFotos > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setGaleriaEtapa(e)} title="Fotos da evolução">
                        <Images className="size-4" /> {nFotos}
                      </Button>
                    )}
                    {podeEditar && (
                      <Button size="sm" variant="outline" onClick={() => setAcompanhando(e)}>
                        <Camera className="size-4" /> Atualizar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {acompanhando && (
        <ModalAcompanhamento
          etapa={acompanhando}
          faseNumero={fase.numero}
          percentualAtual={percentualEtapa(acompanhando.id, ultimaPorEtapa)}
          onFechar={() => setAcompanhando(null)}
        />
      )}
      {editandoPesos && (
        <ModalPesos fase={fase} etapas={etapasDaFase} onFechar={() => setEditandoPesos(false)} />
      )}
      {galeriaEtapa && (
        <ModalGaleria
          titulo={`${galeriaEtapa.nome} — evolução`}
          fotos={(fotos.data ?? [])
            .filter((f) => f.etapa_id === galeriaEtapa.id)
            .map((f) => ({ id: f.id, path: f.foto_url, quando: f.quando }))}
          onFechar={() => setGaleriaEtapa(null)}
        />
      )}
    </div>
  );
}

function BarraAvanco({ valor, className, alta = false }: { valor: number; className?: string; alta?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", alta ? "h-3" : "h-2", className)}>
      <div
        className="h-full rounded-full bg-brand-gradient transition-transform duration-200 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  );
}

/** Iniciar fase com guarda de sequência — botão bloqueado SEMPRE explica o motivo. */
function BotaoIniciarFase({ fase, todas }: { fase: ObraFase; todas: ObraFase[] }) {
  const iniciar = useIniciarFase();
  const [confirmando, setConfirmando] = useState(false);
  const [ipca, setIpca] = useState("");
  const guarda = podeIniciarFase(fase, todas);

  async function confirmar() {
    const ipcaNum = ipca.trim() === "" ? null : parseFloat(ipca.replace(",", "."));
    if (fase.reajustavel && (ipcaNum == null || !Number.isFinite(ipcaNum) || ipcaNum < 0)) {
      toast.error("Informe o IPCA acumulado (%) para o reajuste desta fase.");
      return;
    }
    try {
      await iniciar.mutateAsync({ fase, todas, ipcaPct: ipcaNum });
      toast.success(`${fase.nome} iniciada.`);
      setConfirmando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a fase.");
    }
  }

  return (
    <>
      <span title={guarda.pode ? undefined : guarda.motivo ?? undefined}>
        <Button size="sm" onClick={() => setConfirmando(true)} disabled={!guarda.pode}>
          <Play className="size-4" /> Iniciar fase
        </Button>
      </span>
      {!guarda.pode && guarda.motivo && (
        <span className="text-xs text-muted-foreground">{guarda.motivo}</span>
      )}
      {confirmando && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-hidden tabIndex={-1} onClick={() => setConfirmando(false)} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
            <h2 className="text-lg font-bold text-secondary">Iniciar {fase.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fase.modulos} · {fase.area_m2.toLocaleString("pt-BR")} m²
              {fase.reajustavel
                ? " · preço/m² reajustado pelo IPCA acumulado até o início"
                : " · preço/m² fixo em contrato"}
            </p>
            {fase.reajustavel && (
              <label className="mt-4 block space-y-1">
                <span className="text-sm font-semibold text-secondary">IPCA acumulado (%)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ipca}
                  onChange={(e) => setIpca(e.target.value)}
                  placeholder="Ex.: 7,35"
                  className={inputBase}
                />
              </label>
            )}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmando(false)} disabled={iniciar.isPending}>
                Cancelar
              </Button>
              <Button size="lg" className="flex-1" onClick={confirmar} loading={iniciar.isPending}>
                Iniciar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Acompanhamento in loco: define o % de conclusão (0–100, editável) e anexa
 * VÁRIAS fotos datadas. Cada registro é um ponto no tempo (a etapa acumula a
 * evolução na galeria). A etapa fica medível no BM ao chegar a 100%.
 */
function ModalAcompanhamento({
  etapa,
  faseNumero,
  percentualAtual,
  onFechar,
}: {
  etapa: ObraEtapa;
  faseNumero: number;
  percentualAtual: number;
  onFechar: () => void;
}) {
  const registrar = useRegistrarAcompanhamento();
  const [percentual, setPercentual] = useState(percentualAtual);
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState("");

  function onArquivos(e: ChangeEvent<HTMLInputElement>) {
    setFotos(e.target.files ? Array.from(e.target.files) : []);
  }

  async function salvar() {
    try {
      await registrar.mutateAsync({ etapaId: etapa.id, faseNumero, percentual, fotos, observacao });
      toast.success(percentual >= 100 ? "Etapa concluída (100%)." : `Progresso atualizado para ${percentual}%.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o acompanhamento.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Atualizar ${etapa.nome}`} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">{etapa.nome}</h2>
        {etapa.descricao && <p className="mt-1 text-sm text-muted-foreground">{etapa.descricao}</p>}

        <div className="mt-5 space-y-4">
          {/* % de conclusão editável */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-secondary">Percentual de conclusão</label>
              <span className="text-lg font-extrabold tabular-nums text-primary">{percentual}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={percentual}
              onChange={(e) => setPercentual(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <BarraAvanco valor={percentual} alta />
          </div>

          {/* Várias fotos datadas */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Fotos de acompanhamento (pode anexar várias)</label>
            <input
              type="file" accept="image/*" capture="environment" multiple
              onChange={onArquivos}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-strong"
            />
            {fotos.length > 0 && <p className="text-xs text-success">{fotos.length} foto(s) selecionada(s) — serão datadas hoje.</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Observação</label>
            <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={registrar.isPending}>
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Edição dos pesos da fase (master/direção, antes da 1ª medição). */
function ModalPesos({ fase, etapas, onFechar }: { fase: ObraFase; etapas: ObraEtapa[]; onFechar: () => void }) {
  const atualizar = useAtualizarPesos();
  const [pesos, setPesos] = useState<Record<string, string>>(
    Object.fromEntries(etapas.map((e) => [e.id, String(e.peso_pct)])),
  );

  const soma = somaPesos(
    etapas.map((e) => ({ peso_pct: parseFloat((pesos[e.id] ?? "0").replace(",", ".")) || 0 })),
  );
  const somaOk = Math.round(soma * 100) / 100 === 100;

  async function salvar() {
    try {
      await atualizar.mutateAsync({
        pesos: etapas.map((e) => ({
          etapaId: e.id,
          pesoPct: parseFloat((pesos[e.id] ?? "0").replace(",", ".")) || 0,
        })),
      });
      toast.success("Pesos da fase atualizados.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar os pesos.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Pesos da fase" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Pesos — {fase.nome}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Peso financeiro (%) de cada etapa. A soma precisa fechar em 100%.
        </p>

        <div className="mt-4 space-y-2">
          {etapas.map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-secondary">{e.nome}</span>
              <input
                type="text"
                inputMode="decimal"
                value={pesos[e.id] ?? ""}
                onChange={(ev) => setPesos((p) => ({ ...p, [e.id]: ev.target.value }))}
                className="h-9 w-20 rounded-md border border-input bg-card px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>

        <p className={cn("mt-3 text-right text-sm font-bold tabular-nums", somaOk ? "text-success" : "text-destructive")}>
          Soma: {soma.toFixed(2)}%
        </p>

        <div className="mt-4 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={atualizar.isPending}>
            Cancelar
          </Button>
          <span className="flex-1" title={somaOk ? undefined : "A soma dos pesos precisa ser exatamente 100%"}>
            <Button size="lg" className="w-full" onClick={salvar} disabled={!somaOk || atualizar.isPending} loading={atualizar.isPending}>
              Salvar
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Galeria de evolução da etapa — fotos ordenadas por data (mais recente 1º). */
function ModalGaleria({
  fotos,
  titulo,
  onFechar,
}: {
  fotos: { id: string; path: string; quando: string }[];
  titulo: string;
  onFechar: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-3xl animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">{titulo}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        {fotos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Sem fotos ainda.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((f) => (
              <figure key={f.id} className="overflow-hidden rounded-lg border">
                <FotoSegura bucket={BUCKET_OBRA} stored={f.path} alt={titulo} className="aspect-square w-full object-cover" />
                <figcaption className="bg-muted/30 px-2 py-1.5 text-[11px] leading-tight text-muted-foreground">
                  {formatarDataHoraBR(f.quando)}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
