import { useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  BookText, Plus, X, Sun, Cloud, CloudRain, Users, CloudLightning, PauseOctagon,
  Trash2, Camera,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useDiarioObra, useFotosDiario, useCriarRegistroDiario, useExcluirRegistroDiario,
  type RegistroDiarioInput,
} from "@/hooks/useObraDiario";
import { FotoSegura } from "@/components/AnexoSeguro";
import { BUCKET_OBRA } from "@/lib/storage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR, hojeISO } from "@/lib/utils";

// ===========================================================================
// DIÁRIO DE OBRA (RDO) — componente COMPARTILHADO: aba "Diário" tanto no
// acesso interno (master/direção) quanto no portal da construtora. Registro
// diário com clima manhã/tarde, CHUVA IMPEDITIVA (cláusula 13.2 — base da
// prorrogação de prazo), PARALISAÇÃO (cláusula 6.4), efetivo em campo,
// atividades, ocorrências e várias fotos. Os dois lados registram e leem;
// só master/direção exclui. Auditoria em tudo.
// ===========================================================================

const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CLIMA_OPCOES = [
  { value: "bom", label: "Bom", icone: Sun },
  { value: "nublado", label: "Nublado", icone: Cloud },
  { value: "chuva", label: "Chuva", icone: CloudRain },
] as const;
const CLIMA_ICONE: Record<string, typeof Sun> = { bom: Sun, nublado: Cloud, chuva: CloudRain };
const CLIMA_LABEL: Record<string, string> = { bom: "bom", nublado: "nublado", chuva: "chuva" };

export function DiarioObra() {
  const { usuarioEfetivo } = useAuth();
  const podeExcluir = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const diario = useDiarioObra();
  const fotos = useFotosDiario();
  const excluir = useExcluirRegistroDiario();

  const [novo, setNovo] = useState(false);
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [aExcluir, setAExcluir] = useState<{ id: string; data: string } | null>(null);

  if (diario.isLoading) return <LoadingState />;

  const todos = diario.data ?? [];
  const doMes = todos.filter((r) => r.data.startsWith(mes));
  const fotosPorRegistro = new Map<string, { id: string; foto_url: string }[]>();
  for (const f of fotos.data ?? []) {
    const arr = fotosPorRegistro.get(f.registro_id) ?? [];
    arr.push(f);
    fotosPorRegistro.set(f.registro_id, arr);
  }

  // KPIs do mês (o que importa contratualmente).
  const diasComRegistro = new Set(doMes.map((r) => r.data)).size;
  const diasChuvaImpeditiva = new Set(doMes.filter((r) => r.chuva_impeditiva).map((r) => r.data)).size;
  const diasParalisacao = new Set(doMes.filter((r) => r.paralisacao).map((r) => r.data)).size;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <BookText className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Diário de Obra</h1>
            <p className="text-xs text-muted-foreground">
              Registro diário oficial (cláusula 10.1.2) — chuva impeditiva e paralisações só valem se registradas aqui.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
          <Button size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Registro do dia</Button>
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiDiario icone={<BookText className="size-4" />} rotulo="Dias com registro no mês" valor={String(diasComRegistro)} />
        <KpiDiario icone={<CloudLightning className="size-4" />} rotulo="Dias de chuva impeditiva (13.2)" valor={String(diasChuvaImpeditiva)} alerta={diasChuvaImpeditiva > 0} />
        <KpiDiario icone={<PauseOctagon className="size-4" />} rotulo="Dias com paralisação (6.4)" valor={String(diasParalisacao)} alerta={diasParalisacao > 0} />
      </div>

      {/* Linha do tempo do mês */}
      {doMes.length === 0 ? (
        <EmptyState label={`Nenhum registro em ${mes.split("-").reverse().join("/")}. Clique em "Registro do dia" para abrir o RDO.`} />
      ) : (
        <div className="space-y-3">
          {doMes.map((r) => {
            const fts = fotosPorRegistro.get(r.id) ?? [];
            const ehPrestador = r.perfil_registrador === "obra_prestador";
            return (
              <Card key={r.id} className={cn(r.paralisacao && "border-destructive/40", r.chuva_impeditiva && !r.paralisacao && "border-warning/50")}>
                <CardContent className="space-y-2.5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-secondary">{formatarDataBR(r.data)}</span>
                    <Badge variant={ehPrestador ? "secondary" : "default"}>{ehPrestador ? "TRÍADE" : "Contratante"}</Badge>
                    {r.clima_manha && <ClimaChip periodo="manhã" clima={r.clima_manha} />}
                    {r.clima_tarde && <ClimaChip periodo="tarde" clima={r.clima_tarde} />}
                    {r.chuva_impeditiva && <Badge variant="warning" className="gap-1"><CloudLightning className="size-3" /> chuva impeditiva</Badge>}
                    {r.paralisacao && <Badge variant="destructive" className="gap-1"><PauseOctagon className="size-3" /> paralisação</Badge>}
                    {r.efetivo != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        <Users className="size-3" /> {r.efetivo} em campo
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                      {r.registrado_por ?? "—"} · {formatarDataHoraBR(r.criado_em)}
                      {podeExcluir && (
                        <button onClick={() => setAExcluir({ id: r.id, data: r.data })} className="text-muted-foreground hover:text-destructive" title="Excluir registro">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </span>
                  </div>

                  {r.atividades && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Atividades executadas</p>
                      <p className="whitespace-pre-line text-sm text-secondary">{r.atividades}</p>
                    </div>
                  )}
                  {r.ocorrencias && r.ocorrencias !== "—" && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ocorrências</p>
                      <p className="whitespace-pre-line text-sm text-secondary">{r.ocorrencias}</p>
                    </div>
                  )}

                  {fts.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {fts.map((f) => (
                        <FotoDiarioThumb key={f.id} path={f.foto_url} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {novo && <ModalRegistroDiario onFechar={() => setNovo(false)} />}

      <ConfirmDialog
        aberto={!!aExcluir}
        titulo="Excluir registro do diário?"
        descricao={aExcluir ? `Registro de ${formatarDataBR(aExcluir.data)} — as fotos dele saem junto. A auditoria preserva o rastro.` : ""}
        textoConfirmar="Excluir"
        onConfirmar={() => {
          const alvo = aExcluir;
          setAExcluir(null);
          if (!alvo) return;
          excluir.mutate(alvo.id, {
            onSuccess: () => toast.success("Registro excluído."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
          });
        }}
        onCancelar={() => setAExcluir(null)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function KpiDiario({ icone, rotulo, valor, alerta = false }: { icone: React.ReactNode; rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2.5", alerta ? "border-warning/50 bg-warning/5" : "border-border bg-muted/20")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-card", alerta ? "text-warning" : "text-primary")}>{icone}</span>
      <div className="min-w-0">
        <p className={cn("text-base font-extrabold tabular-nums", alerta ? "text-warning" : "text-secondary")}>{valor}</p>
        <p className="truncate text-[11px] text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function ClimaChip({ periodo, clima }: { periodo: string; clima: string }) {
  const Icone = CLIMA_ICONE[clima] ?? Sun;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icone className={cn("size-3", clima === "chuva" ? "text-primary-strong" : clima === "bom" ? "text-warning" : "")} />
      {periodo}: {CLIMA_LABEL[clima]}
    </span>
  );
}

/** Miniatura com ampliação em um clique. */
function FotoDiarioThumb({ path }: { path: string }) {
  const [ampliada, setAmpliada] = useState(false);
  return (
    <>
      <button onClick={() => setAmpliada(true)} className="overflow-hidden rounded-lg border transition-transform hover:scale-[1.04]">
        <FotoSegura bucket={BUCKET_OBRA} stored={path} alt="Foto do diário" className="size-20 object-cover sm:size-24" />
      </button>
      {ampliada &&
        createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <button aria-hidden tabIndex={-1} onClick={() => setAmpliada(false)} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/70 backdrop-blur-sm" />
            <div className="relative max-h-[90vh] max-w-3xl animate-modal-in overflow-hidden rounded-lg shadow-lifted">
              <FotoSegura bucket={BUCKET_OBRA} stored={path} alt="Foto do diário" className="max-h-[85vh] w-auto object-contain" />
              <button onClick={() => setAmpliada(false)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-secondary/70 text-white hover:bg-secondary"><X className="size-4" /></button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** RDO do dia — formulário completo. */
function ModalRegistroDiario({ onFechar }: { onFechar: () => void }) {
  const criar = useCriarRegistroDiario();
  const [v, setV] = useState<RegistroDiarioInput>({
    data: hojeISO(),
    climaManha: null,
    climaTarde: null,
    chuvaImpeditiva: false,
    paralisacao: false,
    efetivo: null,
    atividades: "",
    ocorrencias: "",
    fotos: [],
  });
  const set = <K extends keyof RegistroDiarioInput>(k: K, val: RegistroDiarioInput[K]) => setV((p) => ({ ...p, [k]: val }));

  function onFotos(e: ChangeEvent<HTMLInputElement>) {
    set("fotos", e.target.files ? Array.from(e.target.files) : []);
  }

  async function salvar() {
    try {
      await criar.mutateAsync(v);
      toast.success(`Diário de ${formatarDataBR(v.data)} registrado.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar.");
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="fixed inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative my-auto w-full max-w-lg animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Registro do dia (RDO)</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary"><X className="size-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Data</span>
              <input type="date" value={v.data} onChange={(e) => set("data", e.target.value)} className={inputBase} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Efetivo em campo</span>
              <input type="number" min={0} value={v.efetivo ?? ""} onChange={(e) => set("efetivo", e.target.value === "" ? null : parseInt(e.target.value, 10))} placeholder="nº de pessoas" className={inputBase} /></label>
          </div>

          {/* Clima manhã/tarde em chips */}
          <div className="grid grid-cols-2 gap-3">
            <SeletorClima rotulo="Clima — manhã" valor={v.climaManha} onChange={(c) => set("climaManha", c)} />
            <SeletorClima rotulo="Clima — tarde" valor={v.climaTarde} onChange={(c) => set("climaTarde", c)} />
          </div>

          {/* Flags contratuais */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", v.chuvaImpeditiva ? "border-warning bg-warning/5" : "border-border")}>
              <input type="checkbox" checked={v.chuvaImpeditiva} onChange={(e) => set("chuvaImpeditiva", e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span className="min-w-0"><span className="font-semibold text-secondary">Chuva impeditiva</span><br />
                <span className="text-xs text-muted-foreground">Impediu estrutura, impermeabilização, cobertura ou frentes externas (cláusula 13.2 — prorroga o prazo).</span></span>
            </label>
            <label className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", v.paralisacao ? "border-destructive bg-destructive/5" : "border-border")}>
              <input type="checkbox" checked={v.paralisacao} onChange={(e) => set("paralisacao", e.target.checked)} className="mt-0.5 size-4 accent-primary" />
              <span className="min-w-0"><span className="font-semibold text-secondary">Frente paralisada</span><br />
                <span className="text-xs text-muted-foreground">Descreva o motivo em ocorrências (cláusula 6.4 exige o registro diário).</span></span>
            </label>
          </div>

          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Atividades executadas</span>
            <textarea value={v.atividades} onChange={(e) => set("atividades", e.target.value)} rows={3} placeholder="Ex.: Concretagem do bloco B (pilares P12–P18); alvenaria 2º pav.…" className={cn(inputBase, "h-auto py-2")} /></label>

          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Ocorrências</span>
            <textarea value={v.ocorrencias} onChange={(e) => set("ocorrencias", e.target.value)} rows={2} placeholder="Paralisações, visitas, acidentes, entregas, não conformidades…" className={cn(inputBase, "h-auto py-2")} /></label>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Fotos do dia (várias)</label>
            <input
              type="file" accept="image/*" capture="environment" multiple onChange={onFotos}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-strong"
            />
            {v.fotos.length > 0 && <p className="flex items-center gap-1 text-xs text-success"><Camera className="size-3.5" /> {v.fotos.length} foto(s) selecionada(s).</p>}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={criar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={criar.isPending}>Registrar</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SeletorClima({ rotulo, valor, onChange }: {
  rotulo: string;
  valor: "bom" | "nublado" | "chuva" | null;
  onChange: (c: "bom" | "nublado" | "chuva" | null) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold text-secondary">{rotulo}</span>
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {CLIMA_OPCOES.map((o) => {
          const Icone = o.icone;
          const ativo = valor === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(ativo ? null : o.value)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-semibold transition-colors",
                ativo ? "bg-card text-secondary shadow-card" : "text-muted-foreground hover:text-secondary",
              )}
            >
              <Icone className="size-3.5 shrink-0" /> {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
