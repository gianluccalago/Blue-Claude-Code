import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  HeartHandshake,
  AlertTriangle,
  UserX,
  X,
  Plus,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useCoberturaTurno,
  useDesignarCuidador,
  useRemoverDesignacao,
  type HospedeCobertura,
  type PessoaTurno,
} from "@/hooks/useCobertura";
import {
  TURNOS_COBERTURA,
  TURNO_LABEL,
  turnoCorrente,
  PRESENCA_LABEL,
  PRESENCA_VARIANTE,
} from "@/lib/cobertura";
import { MODALIDADE_SELO } from "@/lib/modalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, dataISO, ouNaoInformado } from "@/lib/utils";
import type { TagTurno } from "@/types/database";

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

function deslocarDia(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

// ===========================================================================
// COBERTURA ASSISTENCIAL — o mapa vivo de quem cuida de cada hóspede no turno.
// Coordenação (dona) e Master editam; demais perfis veem em leitura. Conversa
// com a escala: só designa quem está escalado; designação cai se sai da escala.
// ===========================================================================

export function CoberturaAssistencial() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "coordenacao" || usuarioEfetivo?.perfil === "master";

  const inicial = turnoCorrente();
  const [data, setData] = useState(inicial.data);
  const [tag, setTag] = useState<TagTurno>(inicial.tag);

  const cob = useCoberturaTurno(data, tag);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <ShieldAlert className="size-6 text-primary" /> Cobertura Assistencial
          </h2>
          <p className="text-sm text-muted-foreground">
            Quem cuida de cada hóspede no turno · {podeEditar ? "designe pela escala" : "somente leitura"}.
          </p>
        </div>
      </div>

      {/* Seletor data + turno */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setData((d) => deslocarDia(d, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => setData((d) => deslocarDia(d, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex gap-1.5">
            {TURNOS_COBERTURA.map((t) => (
              <button
                key={t.tag}
                onClick={() => setTag(t.tag)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  tag === t.tag
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {cob.isLoading ? (
        <LoadingState />
      ) : cob.isError ? (
        <ErrorState error={cob.error} />
      ) : (
        <ConteudoCobertura
          data={data}
          tag={tag}
          cobertura={cob.data!}
          podeEditar={podeEditar}
        />
      )}
    </div>
  );
}

function ConteudoCobertura({
  data,
  tag,
  cobertura,
  podeEditar,
}: {
  data: string;
  tag: TagTurno;
  cobertura: NonNullable<ReturnType<typeof useCoberturaTurno>["data"]>;
  podeEditar: boolean;
}) {
  const { enfermeiras, cuidadoresEscalados, hospedes, descobertos, riscos } = cobertura;

  return (
    <div className="space-y-4">
      {/* Enfermeira de plantão (da escala) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Enfermeira de plantão · {TURNO_LABEL[tag]}
            </p>
            {enfermeiras.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                <AlertTriangle className="size-4" /> Sem enfermeira escalada neste turno
              </p>
            ) : (
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {enfermeiras.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1.5 text-sm font-bold text-secondary">
                    {e.nome} <ChipPresenca pessoa={e} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas centrais */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-4",
            descobertos > 0 ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/5",
          )}
        >
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", descobertos > 0 ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
            <UserX className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{descobertos}</p>
            <p className="text-sm text-muted-foreground">Hóspede(s) descoberto(s) — sem cuidadora designada</p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-4",
            riscos > 0 ? "border-warning/50 bg-warning/5" : "border-border bg-muted/20",
          )}
        >
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", riscos > 0 ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground")}>
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-extrabold tabular-nums text-secondary">{riscos}</p>
            <p className="text-sm text-muted-foreground">Risco de cobertura — designada, mas sem check-in</p>
          </div>
        </div>
      </div>

      {/* Cuidadoras escaladas no turno */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="size-4 text-primary" /> Cuidadoras escaladas
            <Badge variant="muted" className="ml-1">{cuidadoresEscalados.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cuidadoresEscalados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cuidadora escalada neste turno (escala vazia).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cuidadoresEscalados.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm font-medium text-secondary">
                  {c.nome} <ChipPresenca pessoa={c} />
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de hóspedes do turno */}
      {hospedes.length === 0 ? (
        <EmptyState label="Nenhum hóspede ativo neste turno." />
      ) : (
        <div className="space-y-3">
          {hospedes.map((h) => (
            <CardHospede
              key={h.residente.id}
              item={h}
              data={data}
              tag={tag}
              escalados={cuidadoresEscalados}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardHospede({
  item,
  data,
  tag,
  escalados,
  podeEditar,
}: {
  item: HospedeCobertura;
  data: string;
  tag: TagTurno;
  escalados: PessoaTurno[];
  podeEditar: boolean;
}) {
  const designar = useDesignarCuidador();
  const remover = useRemoverDesignacao();
  const { residente: r, cuidadores, descoberto, risco } = item;
  const selo = MODALIDADE_SELO[r.modalidade];

  // Cuidadoras escaladas que ainda NÃO estão designadas a este hóspede.
  const designadasIds = new Set(cuidadores.map((c) => c.id));
  const disponiveis = escalados.filter((c) => !designadasIds.has(c.id));

  async function adicionar(cuidadorId: string) {
    if (!cuidadorId) return;
    try {
      await designar.mutateAsync({ residenteId: r.id, cuidadorId, data, turno: tag });
      toast.success("Cuidadora designada.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function tirar(cuidadorId: string) {
    try {
      await remover.mutateAsync({ residenteId: r.id, cuidadorId, data, turno: tag });
      toast.success("Designação removida.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        descoberto && "border-destructive/50 bg-destructive/5",
        !descoberto && risco && "border-warning/50 bg-warning/5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-secondary">{r.nome}</span>
            <span className="text-xs text-muted-foreground">Quarto {ouNaoInformado(r.quarto)}</span>
            {selo && <Badge variant="secondary">{selo}</Badge>}
            {descoberto && (
              <Badge variant="destructive" className="gap-1"><UserX className="size-3" /> Descoberto</Badge>
            )}
            {!descoberto && risco && (
              <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> Risco de cobertura</Badge>
            )}
          </div>

          {/* Cuidadoras designadas (válidas = ainda escaladas) */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cuidadores.length === 0 ? (
              <span className="text-sm font-medium text-destructive">Nenhuma cuidadora designada</span>
            ) : (
              cuidadores.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-sm font-medium text-secondary"
                >
                  {c.nome}
                  <ChipPresenca pessoa={c} />
                  {podeEditar && (
                    <button
                      onClick={() => tirar(c.id)}
                      disabled={remover.isPending}
                      className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remover ${c.nome}`}
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Designar (só Coordenação/Master) */}
        {podeEditar && (
          <div className="flex items-center gap-1.5">
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            <select
              value=""
              onChange={(e) => adicionar(e.target.value)}
              disabled={designar.isPending || disponiveis.length === 0}
              className="h-9 max-w-[200px] rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {disponiveis.length === 0 ? "Sem cuidadora livre" : "Designar cuidadora…"}
              </option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function ChipPresenca({ pessoa }: { pessoa: PessoaTurno }) {
  return (
    <Badge variant={PRESENCA_VARIANTE[pessoa.presenca]} className="text-[10px]">
      {PRESENCA_LABEL[pessoa.presenca]}
    </Badge>
  );
}
