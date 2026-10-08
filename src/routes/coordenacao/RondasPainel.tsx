import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Users, UserRound, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { usePainelRondas, useRevisarLeitura } from "@/hooks/useRondas";
import {
  FLAG_LABEL,
  FLAGS_SO_REGISTRO,
  STATUS_LEITURA_LABEL,
  blocosDoTurno,
  contaNoHorario,
  pedeRevisao,
  temSinalizacao,
  resumoChecklist,
  situacaoRonda,
  type BlocoRonda,
} from "@/lib/rondas";
import { plantaoAtualEAnterior, plantaoPadrao, type PlantaoRef } from "@/lib/rotina";
import { dentroDaJanela } from "@/lib/plantao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { cn, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import type { TagTurno } from "@/types/database";

const hora = (iso: string | Date) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ===========================================================================
// PAINEL DE RONDAS — conformidade por hóspede, cuidadora e turno.
// "Presença comprovada" (tag + contador + tablet + horário do servidor) e
// "checklist declarado" aparecem SEMPRE separados: o sistema prova que alguém
// esteve no quarto, não a qualidade do cuidado.
// ===========================================================================
export function RondasPainel() {
  const { atual, anterior } = useMemo(() => plantaoAtualEAnterior(new Date()), []);
  const [sel, setSel] = useState<PlantaoRef>(atual);
  const [data, setData] = useState(atual.dataPlantao);
  const [tag, setTag] = useState<TagTurno>(atual.tag);
  const q = usePainelRondas(sel);
  const revisar = useRevisarLeitura();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const emCurso = sel.dataPlantao === atual.dataPlantao && sel.tag === atual.tag;

  const calc = useMemo(() => {
    if (!q.data) return null;
    const agora = new Date();
    const { residentes, configs, leituras, rondas, quartos } = q.data;
    const inicio = new Date(sel.turno.inicio);
    const fim = new Date(sel.turno.fim);
    const cfgPor = new Map(configs.map((c) => [c.residente_id, c]));
    const leituraPor = new Map(leituras.map((l) => [l.id, l]));
    const doTurno = leituras.filter((l) => dentroDaJanela(l.servidor_em, sel.janela));

    const porHospede = residentes
      .map((r) => {
        const cfg = cfgPor.get(r.id);
        if (!cfg || !cfg.ativa || (cfg.turnos === "noturno" && sel.tag !== "noturno")) return null;
        const minhas = rondas.filter((x) => x.residente_id === r.id && dentroDaJanela(x.servidor_em, { ...sel.janela, fim: new Date(sel.janela.fim.getTime() + cfg.tolerancia_min * 60_000) }));
        const noHorario = minhas.filter((x) => { const l = leituraPor.get(x.leitura_id); return l && contaNoHorario(l); });
        const tardias = minhas.length - noHorario.length;
        const b = blocosDoTurno(cfg, inicio, fim, noHorario.map((x) => new Date(x.servidor_em)), agora);
        const ultima = noHorario.map((x) => new Date(x.servidor_em)).sort((a, c) => c.getTime() - a.getTime())[0] ?? null;
        const agoraSit = emCurso ? situacaoRonda(cfg, ultima, inicio, agora) : null;
        const comChecklist = minhas.filter((x) => x.checklist).length;
        const ultimoChecklist = minhas.filter((x) => x.checklist).sort((a, c) => c.servidor_em.localeCompare(a.servidor_em))[0]?.checklist ?? null;
        return { r, cfg, b, tardias, total: minhas.length, comChecklist, ultimoChecklist, agoraSit, ultima };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const porCuidadora = new Map<string, { nome: string; validas: number; tardias: number; recusadas: number; sinalizadas: number; quartos: Set<string> }>();
    for (const l of doTurno) {
      const k = l.cuidador_nome ?? "Sem usuário";
      const a = porCuidadora.get(k) ?? { nome: k, validas: 0, tardias: 0, recusadas: 0, sinalizadas: 0, quartos: new Set<string>() };
      if (l.status_validacao === "valida") {
        a.validas += 1;
        if (l.sincronizado_tarde) a.tardias += 1;
        if (l.quarto_id) a.quartos.add(quartos.get(l.quarto_id) ?? "?");
        if (temSinalizacao(l.flags)) a.sinalizadas += 1;
      } else a.recusadas += 1;
      porCuidadora.set(k, a);
    }

    const cumpridos = porHospede.reduce((s, h) => s + h.b.cumpridos, 0);
    const encerrados = porHospede.reduce((s, h) => s + h.b.encerrados, 0);
    return {
      porHospede,
      porCuidadora: [...porCuidadora.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      anomalias: doTurno.filter(pedeRevisao),
      conformidade: encerrados ? Math.round((cumpridos / encerrados) * 100) : null,
      atrasadasAgora: porHospede.filter((h) => h.agoraSit?.situacao === "atrasada"),
      quartos,
    };
  }, [q.data, sel, emCurso]);

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Presença comprovada = etiqueta do quarto lida por tablet cadastrado, com horário do servidor. Não comprova a qualidade do cuidado: o checklist é
        declarado pela cuidadora. Rondas enviadas sem rede (sincronizadas tarde) comprovam presença, mas não o horário, e não contam no cumprimento.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 py-4">
          <Button variant={emCurso ? "default" : "outline"} size="sm" onClick={() => { setSel(atual); setData(atual.dataPlantao); setTag(atual.tag); }}>Plantão atual</Button>
          <Button variant={sel.dataPlantao === anterior.dataPlantao && sel.tag === anterior.tag ? "default" : "outline"} size="sm" onClick={() => { setSel(anterior); setData(anterior.dataPlantao); setTag(anterior.tag); }}>Anterior</Button>
          <input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
          <select value={tag} onChange={(e) => setTag(e.target.value as TagTurno)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            <option value="noturno">Noturno</option>
            <option value="diurno">Diurno</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => setSel(plantaoPadrao(tag, data))}>Ver</Button>
          <span className="ml-auto text-sm font-semibold text-secondary">
            Plantão {sel.tag} de {sel.dataPlantao.split("-").reverse().slice(0, 2).join("/")} · {hora(sel.turno.inicio)}–{hora(sel.turno.fim)}
          </span>
        </CardContent>
      </Card>

      {q.isLoading || !calc ? <LoadingState /> : q.isError ? <ErrorState error={q.error} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Numero valor={calc.conformidade === null ? "—" : `${calc.conformidade}%`} rotulo="Blocos cumpridos no horário" />
            <Numero valor={String(calc.porHospede.length)} rotulo="Hóspedes com ronda ativa" />
            <Numero valor={String(calc.atrasadasAgora.length)} rotulo="Atrasadas agora" alerta={calc.atrasadasAgora.length > 0} />
            <Numero valor={String(calc.anomalias.length)} rotulo="Leituras para revisar" alerta={calc.anomalias.length > 0} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4 text-primary" /> Por hóspede</CardTitle></CardHeader>
            <CardContent>
              {calc.porHospede.length === 0 ? (
                <EmptyState label="Nenhum hóspede com ronda ativa neste turno. Ative no plano de cuidados." />
              ) : (
                <div className="divide-y rounded-lg border">
                  {calc.porHospede.map((h) => (
                    <div key={h.r.id} className="space-y-1.5 px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-secondary">{h.r.nome}</span>
                        <span className="text-muted-foreground">{h.r.quarto}</span>
                        <span className="text-xs text-muted-foreground">a cada {h.cfg.intervalo_min} min ± {h.cfg.tolerancia_min}</span>
                        <span className="ml-auto flex flex-wrap items-center gap-1.5">
                          {h.agoraSit && (
                            <Badge variant={h.agoraSit.situacao === "atrasada" ? "destructive" : h.agoraSit.situacao === "vencendo" ? "warning" : "success"}>
                              {h.agoraSit.situacao === "atrasada" ? `atrasada desde ${hora(h.agoraSit.limiteEm)}` : h.agoraSit.situacao === "vencendo" ? `vence ${hora(h.agoraSit.limiteEm)}` : "em dia"}
                            </Badge>
                          )}
                          <Badge variant="muted">{h.b.pct === null ? "—" : `${h.b.pct}%`} presença</Badge>
                          <Badge variant="muted">{h.comChecklist}/{h.total} checklist declarado</Badge>
                          {h.tardias > 0 && <Badge variant="warning">{h.tardias} tardia(s)</Badge>}
                        </span>
                      </div>
                      <Blocos blocos={h.b.blocos} />
                      {h.ultimoChecklist && (
                        <p className="text-xs text-muted-foreground">
                          Último checklist (declarado): {resumoChecklist(h.ultimoChecklist)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-primary" /> Por cuidadora</CardTitle></CardHeader>
            <CardContent>
              {calc.porCuidadora.length === 0 ? <EmptyState label="Nenhuma leitura neste turno." /> : (
                <div className="divide-y rounded-lg border">
                  {calc.porCuidadora.map((c) => (
                    <div key={c.nome} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold text-secondary">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">{c.quartos.size} quarto(s): {[...c.quartos].sort().join(", ")}</span>
                      <span className="ml-auto flex flex-wrap gap-1.5">
                        <Badge variant="success">{c.validas} válida(s)</Badge>
                        {c.tardias > 0 && <Badge variant="warning">{c.tardias} tardia(s)</Badge>}
                        {c.sinalizadas > 0 && <Badge variant="warning">{c.sinalizadas} sinalizada(s)</Badge>}
                        {c.recusadas > 0 && <Badge variant="destructive">{c.recusadas} recusada(s)</Badge>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-warning" /> Para revisar</CardTitle></CardHeader>
            <CardContent>
              {calc.anomalias.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Nada pendente de revisão neste turno.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {calc.anomalias.map((l) => (
                    <div key={l.id} className="space-y-2 px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-secondary">{formatarDataHoraBR(l.servidor_em)}</span>
                        <span>{l.cuidador_nome ?? "—"}</span>
                        <span className="text-muted-foreground">quarto {l.quarto_id ? calc.quartos.get(l.quarto_id) : "?"} · contador {l.contador ?? "—"}</span>
                        <Badge variant={l.status_validacao === "valida" ? "muted" : "destructive"}>{STATUS_LEITURA_LABEL[l.status_validacao]}</Badge>
                        {l.flags.map((f) => <Badge key={f} variant={FLAGS_SO_REGISTRO.includes(f) ? "muted" : "warning"}>{FLAG_LABEL[f] ?? f}</Badge>)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={notas[l.id] ?? ""}
                          onChange={(e) => setNotas((n) => ({ ...n, [l.id]: e.target.value }))}
                          placeholder="Nota da revisão (opcional)"
                          className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-card px-3 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revisar.isPending}
                          onClick={() => revisar.mutate({ id: l.id, nota: notas[l.id] ?? "" }, { onSuccess: () => toast.success("Marcada como revisada.") })}
                        >
                          <ShieldCheck className="size-4" /> Marcar revisada
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Numero({ valor, rotulo, alerta }: { valor: string; rotulo: string; alerta?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", alerta ? "border-destructive/40 bg-destructive/5" : "bg-card")}>
      <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Blocos({ blocos }: { blocos: BlocoRonda[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {blocos.map((b) => (
        <span
          key={b.inicio.toISOString()}
          title={`${hora(b.inicio)}–${hora(b.fim)}`}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            b.estado === "cumprido" && "bg-success/15 text-success",
            b.estado === "descumprido" && "bg-destructive/15 text-destructive",
            b.estado === "em_andamento" && "bg-muted text-muted-foreground",
          )}
        >
          {hora(b.inicio)}
        </span>
      ))}
    </div>
  );
}
