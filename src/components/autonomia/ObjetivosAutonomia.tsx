import { useState } from "react";
import { toast } from "sonner";
import { Target, Plus, ClipboardCheck, X } from "lucide-react";
import { useCriarObjetivo, useRevisarObjetivo } from "@/hooks/useAutonomia";
import { DOMINIOS, DOMINIO_POR_ID, REVISAO_OBJETIVO_DIAS, objetivoVencido } from "@/lib/autonomia";
import { somarDias } from "@/lib/rotina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { cn, formatarDataBR, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import type { AutonomiaAvaliacao, AutonomiaObjetivo, AutonomiaRevisao, DominioAutonomia } from "@/types/database";

const inputBase =
  "w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const RESULTADO_LABEL: Record<AutonomiaRevisao["resultado"], string> = {
  mantido: "Mantido",
  ajustado: "Ajustado",
  atingido: "Atingido",
  encerrado: "Encerrado",
};
const PARTICIPANTE_LABEL: Record<AutonomiaRevisao["participantes"][number], string> = {
  residente: "Residente",
  familia: "Família",
  equipe: "Equipe",
};

/**
 * Objetivos funcionais do hóspede: criar (meta observável, prazo de revisão,
 * acordado com residente/família) e revisar (o que foi observado + o que o
 * residente disse + resultado). A revisão é o que "verifica" no indicador.
 */
export function ObjetivosAutonomia({
  residenteId,
  objetivos,
  revisoes,
  avaliacoes,
  dominioPadrao,
  podeEditar,
}: {
  residenteId: string;
  objetivos: AutonomiaObjetivo[];
  revisoes: AutonomiaRevisao[];
  avaliacoes: AutonomiaAvaliacao[];
  dominioPadrao: DominioAutonomia;
  podeEditar: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const hoje = hojeISO();
  const ordem = { ativo: 0, atingido: 1, encerrado: 2 } as const;
  const lista = [...objetivos].sort((a, b) => ordem[a.status] - ordem[b.status] || a.prazo_revisao.localeCompare(b.prazo_revisao));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-primary" /> Objetivos funcionais
        </CardTitle>
        {podeEditar && !criando && (
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus className="size-4" /> Novo objetivo
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {criando && (
          <NovoObjetivo
            residenteId={residenteId}
            avaliacoes={avaliacoes}
            dominioPadrao={dominioPadrao}
            onFechar={() => setCriando(false)}
          />
        )}
        {lista.length === 0 && !criando && <EmptyState label="Nenhum objetivo funcional registrado." />}
        {lista.map((o) => {
          const revs = revisoes.filter((r) => r.objetivo_id === o.id);
          const ultima = revs[0];
          const vencido = objetivoVencido(o, hoje);
          return (
            <div key={o.id} className={cn("space-y-2 rounded-lg border p-3", o.status !== "ativo" && "opacity-70", vencido && "border-destructive/40")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-secondary">{o.descricao}</p>
                  <p className="text-sm text-muted-foreground">Meta: {o.meta}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted">{DOMINIO_POR_ID.get(o.dominio)?.quemAvalia}</Badge>
                  {o.status === "ativo" ? (
                    <Badge variant={vencido ? "destructive" : "default"}>
                      {vencido ? "revisão atrasada" : "revisar até"} {formatarDataBR(o.prazo_revisao)}
                    </Badge>
                  ) : (
                    <Badge variant={o.status === "atingido" ? "success" : "muted"}>{o.status === "atingido" ? "Atingido" : "Encerrado"}</Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {o.responsavel ? `Responsável: ${o.responsavel} · ` : ""}
                Acordado com residente: {o.acordado_residente_em ? formatarDataBR(o.acordado_residente_em) : "não"} · com família:{" "}
                {o.acordado_familia_em ? formatarDataBR(o.acordado_familia_em) : "não"}
              </p>
              {ultima && (
                <div className="rounded-md bg-muted/40 p-2 text-xs">
                  <p className="font-semibold text-secondary">
                    Última revisão · {formatarDataHoraBR(ultima.revisado_em)} · {RESULTADO_LABEL[ultima.resultado]} · {ultima.revisado_por ?? "—"}
                  </p>
                  <p><span className="text-muted-foreground">Observado:</span> {ultima.observado}</p>
                  <p><span className="text-muted-foreground">Residente disse:</span> “{ultima.fala_residente}”</p>
                  <p className="text-muted-foreground">Participaram: {ultima.participantes.map((p) => PARTICIPANTE_LABEL[p]).join(", ")}</p>
                </div>
              )}
              {podeEditar && o.status === "ativo" && revisandoId !== o.id && (
                <Button size="sm" variant="outline" onClick={() => setRevisandoId(o.id)}>
                  <ClipboardCheck className="size-4" /> Revisar
                </Button>
              )}
              {revisandoId === o.id && <RevisarObjetivo objetivoId={o.id} onFechar={() => setRevisandoId(null)} />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NovoObjetivo({
  residenteId,
  avaliacoes,
  dominioPadrao,
  onFechar,
}: {
  residenteId: string;
  avaliacoes: AutonomiaAvaliacao[];
  dominioPadrao: DominioAutonomia;
  onFechar: () => void;
}) {
  const criar = useCriarObjetivo();
  const [dominio, setDominio] = useState<DominioAutonomia>(dominioPadrao);
  const [descricao, setDescricao] = useState("");
  const [meta, setMeta] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState(somarDias(hojeISO(), REVISAO_OBJETIVO_DIAS));
  const [comResidente, setComResidente] = useState(false);
  const [comFamilia, setComFamilia] = useState(false);
  const avaliacaoId =
    avaliacoes
      .filter((a) => a.dominio === dominio && a.assinada)
      .sort((a, b) => (b.assinada_em ?? "").localeCompare(a.assinada_em ?? ""))[0]?.id ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-accent/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-secondary">Objetivo</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Ir sozinha até o refeitório com o andador"
            className={cn(inputBase, "h-10")}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold text-secondary">Meta observável</label>
          <input
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="Ex.: No almoço, pelo menos 5 dias por semana, com supervisão à distância"
            className={cn(inputBase, "h-10")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Domínio</label>
          <select value={dominio} onChange={(e) => setDominio(e.target.value as DominioAutonomia)} className={cn(inputBase, "h-10")}>
            {DOMINIOS.map((d) => (
              <option key={d.id} value={d.id}>{d.quemAvalia} · {d.rotulo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Responsável</label>
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem acompanha" className={cn(inputBase, "h-10")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Revisar até</label>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={cn(inputBase, "h-10")} />
        </div>
        <div className="flex flex-col justify-end gap-1.5 text-sm text-secondary">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={comResidente} onChange={(e) => setComResidente(e.target.checked)} /> Acordado com o residente
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={comFamilia} onChange={(e) => setComFamilia(e.target.checked)} /> Acordado com a família
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={criar.isPending}
          disabled={!descricao.trim() || !meta.trim() || !prazo}
          onClick={() =>
            criar.mutate(
              { residenteId, dominio, avaliacaoId, descricao, meta, responsavel, prazoRevisao: prazo, acordadoResidente: comResidente, acordadoFamilia: comFamilia },
              {
                onSuccess: () => {
                  toast.success("Objetivo registrado.");
                  onFechar();
                },
                onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
              },
            )
          }
        >
          Salvar objetivo
        </Button>
        <Button variant="outline" onClick={onFechar}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

function RevisarObjetivo({ objetivoId, onFechar }: { objetivoId: string; onFechar: () => void }) {
  const revisar = useRevisarObjetivo();
  const [observado, setObservado] = useState("");
  const [fala, setFala] = useState("");
  const [resultado, setResultado] = useState<AutonomiaRevisao["resultado"]>("mantido");
  const [participantes, setParticipantes] = useState<Set<AutonomiaRevisao["participantes"][number]>>(new Set(["equipe"]));
  const [proxima, setProxima] = useState(somarDias(hojeISO(), REVISAO_OBJETIVO_DIAS));
  const encerra = resultado === "atingido" || resultado === "encerrado";

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-accent/40 p-3">
      <div>
        <label className="mb-1 block text-sm font-semibold text-secondary">O que foi observado</label>
        <textarea value={observado} onChange={(e) => setObservado(e.target.value)} rows={2} className={cn(inputBase, "py-2")} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-secondary">O que o residente disse</label>
        <textarea
          value={fala}
          onChange={(e) => setFala(e.target.value)}
          rows={2}
          placeholder="Nas palavras dele(a). Se não se comunica verbalmente, descreva como expressou."
          className={cn(inputBase, "py-2")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Resultado</label>
          <select value={resultado} onChange={(e) => setResultado(e.target.value as AutonomiaRevisao["resultado"])} className={cn(inputBase, "h-10")}>
            {(Object.keys(RESULTADO_LABEL) as AutonomiaRevisao["resultado"][]).map((r) => (
              <option key={r} value={r}>{RESULTADO_LABEL[r]}</option>
            ))}
          </select>
        </div>
        {!encerra && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-secondary">Próxima revisão</label>
            <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className={cn(inputBase, "h-10")} />
          </div>
        )}
        <div className="flex flex-col gap-1 text-sm text-secondary">
          <span className="font-semibold">Participaram</span>
          {(Object.keys(PARTICIPANTE_LABEL) as AutonomiaRevisao["participantes"][number][]).map((p) => (
            <label key={p} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={participantes.has(p)}
                onChange={(e) =>
                  setParticipantes((prev) => {
                    const n = new Set(prev);
                    if (e.target.checked) n.add(p);
                    else n.delete(p);
                    return n;
                  })
                }
              />
              {PARTICIPANTE_LABEL[p]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={revisar.isPending}
          disabled={!observado.trim() || !fala.trim() || participantes.size === 0}
          onClick={() =>
            revisar.mutate(
              { objetivoId, observado, falaResidente: fala, resultado, participantes: [...participantes], proximaRevisao: encerra ? null : proxima },
              {
                onSuccess: () => {
                  toast.success("Revisão registrada.");
                  onFechar();
                },
                onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
              },
            )
          }
        >
          Registrar revisão
        </Button>
        <Button variant="outline" onClick={onFechar}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
