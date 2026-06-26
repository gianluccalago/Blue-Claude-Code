import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ShieldAlert,
  AlertTriangle,
  Plus,
  FileDown,
  BellRing,
  Check,
  X,
  Stethoscope,
} from "lucide-react";
import {
  useEventosSentinela,
  useQuedasParaAvaliar,
  useRegistrarNotificacao,
  type EventoSentinelaComNome,
} from "@/hooks/useEventosSentinela";
import { RegistrarEventoSentinelaModal } from "@/components/vigilancia/RegistrarEventoSentinelaModal";
import {
  TIPO_SENTINELA,
  TIPO_SENTINELA_LABEL,
  TIPO_SENTINELA_ARTIGO,
  ORGAO_SUGERIDO,
  quedaSugereLesao,
} from "@/lib/vigilancia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { TipoEventoSentinela } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// VIGILÂNCIA SANITÁRIA · Eventos sentinela e notificação compulsória (RT/Master)
// RDC 502/2021. O RT fiscaliza e DOCUMENTA a notificação à vigilância.
// IMPORTANTE: registrar a notificação aqui é a DOCUMENTAÇÃO do cumprimento —
// NÃO substitui a notificação real à autoridade sanitária.
// ===========================================================================

export function VigilanciaSentinela() {
  const eventos = useEventosSentinela();
  const quedas = useQuedasParaAvaliar();

  const [registrar, setRegistrar] = useState(false);
  const [classificar, setClassificar] = useState<{ residente: { id: string; nome: string }; intercorrenciaId: string; descricao: string } | null>(null);
  const [notificar, setNotificar] = useState<EventoSentinelaComNome | null>(null);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<TipoEventoSentinela | "todos">("todos");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "pendente" | "notificado">("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const lista = eventos.data ?? [];

  const filtrados = useMemo(() => {
    return lista.filter((e) => {
      if (tipoFiltro !== "todos" && e.tipo !== tipoFiltro) return false;
      if (statusFiltro === "pendente" && e.notificado) return false;
      if (statusFiltro === "notificado" && !e.notificado) return false;
      const d = e.data_ocorrencia.slice(0, 10);
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      return true;
    });
  }, [lista, tipoFiltro, statusFiltro, de, ate]);

  const pendentes = lista.filter((e) => !e.notificado).length;

  if (eventos.isLoading) return <LoadingState />;
  if (eventos.isError) return <ErrorState error={eventos.error} />;

  function exportar() {
    const linhas = filtrados.map((e) => ({
      Hóspede: e.residenteNome ?? "Não informado",
      Tipo: TIPO_SENTINELA_LABEL[e.tipo],
      Artigo: TIPO_SENTINELA_ARTIGO[e.tipo],
      Doença: e.descricao_doenca ?? "",
      "Data da ocorrência": formatarDataHoraBR(e.data_ocorrencia),
      Descrição: e.descricao ?? "",
      "Registrado por": e.registrado_por ?? "",
      Gravidade: e.gravidade ?? "",
      Notificado: e.notificado ? "Sim" : "Não",
      "Notificado em": e.notificado_em ? formatarDataHoraBR(e.notificado_em) : "",
      "Órgão notificado": e.orgao_notificado ?? "",
      Protocolo: e.protocolo_notificacao ?? "",
    }));
    baixarCsv("eventos_sentinela.csv", linhas);
    toast.success("Eventos exportados (.csv).");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <ShieldAlert className="size-6 text-primary" /> Eventos sentinela e notificação compulsória
          </h2>
          <p className="text-sm text-muted-foreground">
            RDC 502/2021 · Art. 54 e 55 — controle de notificação à vigilância (Responsável Técnico).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <FileDown className="size-4" /> Exportar (CSV)
          </Button>
          <Button size="sm" onClick={() => setRegistrar(true)}>
            <Plus className="size-4" /> Registrar evento
          </Button>
        </div>
      </div>

      {/* Aviso legal honesto */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-secondary">
            Registrar a notificação aqui <span className="font-semibold">documenta</span> o cumprimento da
            obrigação legal — <span className="font-semibold">não substitui</span> a notificação real à
            autoridade sanitária, que deve ser feita pelos canais oficiais.
          </p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard tom={pendentes > 0 ? "destrutivo" : "ok"} valor={pendentes} rotulo="Pendentes de notificação" icon={BellRing} />
        <KpiCard tom="neutro" valor={lista.length} rotulo="Eventos registrados" icon={ShieldAlert} />
        <KpiCard tom={(quedas.data ?? []).length > 0 ? "alerta" : "neutro"} valor={(quedas.data ?? []).length} rotulo="Quedas a avaliar" icon={AlertTriangle} />
      </div>

      {/* Quedas a avaliar (vindas das intercorrências) */}
      {(quedas.data ?? []).length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" /> Quedas a avaliar para notificação
              <Badge variant="warning" className="ml-1">{(quedas.data ?? []).length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quedas registradas nas intercorrências (últimos 30 dias) ainda não classificadas. Avalie a
              lesão e classifique como evento sentinela quando houver.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(quedas.data ?? []).map(({ intercorrencia: i, residenteNome }) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{ouNaoInformado(residenteNome)}</span>
                    {quedaSugereLesao(i.observacao) && <Badge variant="destructive">possível lesão</Badge>}
                    <span className="text-xs text-muted-foreground">{formatarDataHoraBR(i.registrado_em)}</span>
                  </div>
                  <p className="text-sm text-secondary/80">{ouNaoInformado(i.observacao)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setClassificar({
                      residente: { id: i.residente_id, nome: residenteNome ?? "Hóspede" },
                      intercorrenciaId: i.id,
                      descricao: i.observacao ?? "Queda com lesão",
                    })
                  }
                >
                  <ShieldAlert className="size-4" /> Classificar como sentinela
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as TipoEventoSentinela | "todos")} className={`${inputBase} w-auto`}>
            <option value="todos">Todos os tipos</option>
            {TIPO_SENTINELA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as "todos" | "pendente" | "notificado")} className={`${inputBase} w-auto`}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes de notificação</option>
            <option value="notificado">Notificados</option>
          </select>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inputBase} w-auto`} title="De" />
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inputBase} w-auto`} title="Até" />
        </CardContent>
      </Card>

      {/* Lista de eventos */}
      {filtrados.length === 0 ? (
        <EmptyState label="Nenhum evento sentinela neste filtro." />
      ) : (
        <div className="space-y-3">
          {filtrados.map((e) => (
            <EventoCard key={e.id} evento={e} onNotificar={() => setNotificar(e)} />
          ))}
        </div>
      )}

      {registrar && <RegistrarEventoSentinelaModal onFechar={() => setRegistrar(false)} />}
      {classificar && (
        <RegistrarEventoSentinelaModal
          onFechar={() => setClassificar(null)}
          residenteFixo={classificar.residente}
          intercorrenciaId={classificar.intercorrenciaId}
          tipoInicial="queda_com_lesao"
          descricaoInicial={classificar.descricao}
        />
      )}
      {notificar && <NotificacaoModal evento={notificar} onFechar={() => setNotificar(null)} />}
    </div>
  );
}

function KpiCard({ valor, rotulo, icon: Icon, tom }: { valor: number; rotulo: string; icon: typeof BellRing; tom: "destrutivo" | "alerta" | "ok" | "neutro" }) {
  const cor =
    tom === "destrutivo" && valor > 0 ? "border-destructive/40 bg-destructive/5"
      : tom === "alerta" && valor > 0 ? "border-warning/50 bg-warning/5"
      : tom === "ok" ? "border-success/40 bg-success/5"
      : "border-border bg-muted/20";
  const corIcone =
    tom === "destrutivo" && valor > 0 ? "bg-destructive/15 text-destructive"
      : tom === "alerta" && valor > 0 ? "bg-warning/20 text-warning"
      : tom === "ok" ? "bg-success/15 text-success"
      : "bg-muted text-muted-foreground";
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-4", cor)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", corIcone)}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor}</p>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function EventoCard({ evento: e, onNotificar }: { evento: EventoSentinelaComNome; onNotificar: () => void }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", !e.notificado && "border-destructive/50 bg-destructive/5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-secondary">{ouNaoInformado(e.residenteNome)}</span>
            <Badge variant="secondary">{TIPO_SENTINELA_LABEL[e.tipo]}</Badge>
            <Badge variant="outline" className="text-[10px]">{TIPO_SENTINELA_ARTIGO[e.tipo]}</Badge>
            {e.notificado ? (
              <Badge variant="success" className="gap-1"><Check className="size-3" /> Notificado</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><BellRing className="size-3" /> Pendente de notificação</Badge>
            )}
          </div>
          {e.descricao_doenca && <p className="mt-1 text-sm font-medium text-secondary">Doença: {e.descricao_doenca}</p>}
          <p className="mt-0.5 text-sm text-secondary/80">{ouNaoInformado(e.descricao)}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>Ocorrência: {formatarDataHoraBR(e.data_ocorrencia)}</span>
            {e.registrado_por && <span>· por {e.registrado_por}{e.perfil_registrador ? ` (${e.perfil_registrador})` : ""}</span>}
            {e.gravidade && <span>· gravidade: {e.gravidade}</span>}
          </div>
          {e.notificado && (
            <p className="mt-1.5 rounded-md bg-success/10 px-2 py-1 text-xs text-success">
              Notificado em {e.notificado_em ? formatarDataHoraBR(e.notificado_em) : "—"}
              {e.orgao_notificado ? ` · ${e.orgao_notificado}` : ""}
              {e.protocolo_notificacao ? ` · protocolo ${e.protocolo_notificacao}` : ""}
              {e.notificado_por ? ` · ${e.notificado_por}` : ""}
            </p>
          )}
        </div>
        {!e.notificado && (
          <Button size="sm" onClick={onNotificar}>
            <BellRing className="size-4" /> Registrar notificação
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Modal: registrar notificação (RT) ────────────────────────────────────────
function NotificacaoModal({ evento, onFechar }: { evento: EventoSentinelaComNome; onFechar: () => void }) {
  const registrar = useRegistrarNotificacao();
  const [orgao, setOrgao] = useState(ORGAO_SUGERIDO[evento.tipo]);
  const [data, setData] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [protocolo, setProtocolo] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function salvar() {
    if (!orgao.trim()) return toast.error("Informe o órgão notificado.");
    try {
      await registrar.mutateAsync({
        id: evento.id,
        orgaoNotificado: orgao,
        dataNotificacao: new Date(data).toISOString(),
        protocolo: protocolo || null,
        observacao: obs || null,
      });
      toast.success("Notificação registrada (documentada).");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Registrar notificação" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
            <BellRing className="size-5 text-primary" /> Registrar notificação
          </h2>
          <button onClick={onFechar} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>

        <div className="mb-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-secondary">
            <Stethoscope className="size-4" /> {ouNaoInformado(evento.residenteNome)} · {TIPO_SENTINELA_LABEL[evento.tipo]}
          </p>
          <p className="text-xs text-muted-foreground">Ocorrência: {formatarDataHoraBR(evento.data_ocorrencia)}</p>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Documente a notificação feita à autoridade sanitária (este registro não a substitui).
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Órgão notificado</label>
            <input value={orgao} onChange={(e) => setOrgao(e.target.value)} className={inputBase} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Data/hora da notificação</label>
            <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Protocolo (se houver)</label>
            <input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Nº do protocolo / SINAN…" className={inputBase} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Observação (opcional)</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inputBase} h-auto py-2 resize-none`} />
          </div>
          <Button className="w-full" onClick={salvar} disabled={registrar.isPending}>
            {registrar.isPending ? "Salvando…" : "Confirmar notificação registrada"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// CSV simples (sem dependência), com escape de aspas/; — abre no Excel.
function baixarCsv(nomeArquivo: string, linhas: Record<string, string>[]) {
  if (linhas.length === 0) return;
  const colunas = Object.keys(linhas[0]);
  const escapar = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const conteudo = [
    colunas.map(escapar).join(";"),
    ...linhas.map((l) => colunas.map((c) => escapar(l[c] ?? "")).join(";")),
  ].join("\r\n");
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
