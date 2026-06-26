import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
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
  Building2,
  CalendarCog,
  Users,
  Scale,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import {
  useCoberturaTurno,
  useDesignarCuidador,
  useRemoverDesignacao,
  useDesignarLote,
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
import {
  contarPorGrau,
  minimoCuidadores,
  statusProporcao,
  STATUS_PROPORCAO_LABEL,
  STATUS_PROPORCAO_VARIANTE,
} from "@/lib/proporcaoRh";
import { parseQuarto, formatarQuarto } from "@/lib/quarto";
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

const PERFIS_EDITAM: ReadonlyArray<string | undefined> = ["coordenacao", "master", "enfermagem"];

export function CoberturaAssistencial() {
  const { usuarioEfetivo } = useAuth();
  // Coordenação, Master e Enfermagem (enfermeira de plantão) designam.
  const podeEditar = PERFIS_EDITAM.includes(usuarioEfetivo?.perfil);

  const { perfil: perfilRota } = useParams({ strict: false }) as { perfil?: string };
  const perfil = perfilRota ?? usuarioEfetivo?.perfil ?? "coordenacao";
  const navigate = useNavigate();

  const inicial = turnoCorrente();
  const [data, setData] = useState(inicial.data);
  const [tag, setTag] = useState<TagTurno>(inicial.tag);

  // Atalho para a Escala já posicionada na DATA selecionada (ver/ajustar turno).
  function abrirEscala() {
    navigate({ to: `/app/${perfil}/escalas` as string, search: { data } });
  }

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
          onAbrirEscala={abrirEscala}
        />
      )}
    </div>
  );
}

// ─── Agrupamento por MÓDULO / ANDAR (parsing seguro do número do quarto) ──────
interface GrupoAndar {
  andar: number;
  hospedes: HospedeCobertura[];
}
interface GrupoModulo {
  modulo: number;
  hospedes: HospedeCobertura[]; // todos do módulo (todos os andares)
  andares: GrupoAndar[];
}

function agruparPorLocal(hospedes: HospedeCobertura[]): {
  modulos: GrupoModulo[];
  semLocal: HospedeCobertura[];
} {
  const porModulo = new Map<number, Map<number, HospedeCobertura[]>>();
  const semLocal: HospedeCobertura[] = [];

  for (const h of hospedes) {
    const { bloco, andar } = parseQuarto(h.residente.quarto);
    // Parsing seguro: fora do padrão (módulo/andar nulos) → não agrupa.
    if (bloco == null || andar == null) {
      semLocal.push(h);
      continue;
    }
    if (!porModulo.has(bloco)) porModulo.set(bloco, new Map());
    const andares = porModulo.get(bloco)!;
    if (!andares.has(andar)) andares.set(andar, []);
    andares.get(andar)!.push(h);
  }

  const ordenarHosp = (a: HospedeCobertura, b: HospedeCobertura) => {
    const peso = (h: HospedeCobertura) => (h.descoberto ? 0 : h.risco ? 1 : 2);
    return (
      peso(a) - peso(b) ||
      (a.residente.quarto ?? "").localeCompare(b.residente.quarto ?? "", "pt-BR") ||
      a.residente.nome.localeCompare(b.residente.nome, "pt-BR")
    );
  };

  const modulos: GrupoModulo[] = [...porModulo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([modulo, andaresMap]) => {
      const andares = [...andaresMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([andar, hs]) => ({ andar, hospedes: [...hs].sort(ordenarHosp) }));
      const todos = andares.flatMap((a) => a.hospedes);
      return { modulo, hospedes: todos, andares };
    });

  return { modulos, semLocal: [...semLocal].sort(ordenarHosp) };
}

function ConteudoCobertura({
  data,
  tag,
  cobertura,
  podeEditar,
  onAbrirEscala,
}: {
  data: string;
  tag: TagTurno;
  cobertura: NonNullable<ReturnType<typeof useCoberturaTurno>["data"]>;
  podeEditar: boolean;
  onAbrirEscala: () => void;
}) {
  const { enfermeiras, cuidadoresEscalados, hospedes, descobertos, riscos } = cobertura;
  const { modulos, semLocal } = useMemo(() => agruparPorLocal(hospedes), [hospedes]);

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

      {/* Cuidadoras escaladas no turno + atalho para a Escala */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="size-4 text-primary" /> Cuidadoras escaladas
            <Badge variant="muted" className="ml-1">{cuidadoresEscalados.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAbrirEscala}>
            <CalendarCog className="size-4" /> Ver/ajustar escala
          </Button>
        </CardHeader>
        <CardContent>
          {cuidadoresEscalados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cuidadora escalada neste turno (escala vazia). Use “Ver/ajustar escala”.
            </p>
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

      {/* Indicador-resumo da proporção mínima de cuidadores (RDC 502 Art. 16).
          Detalhe completo fica na aba Vigilância Sanitária. */}
      <ProporcaoResumo hospedes={hospedes} escalado={cuidadoresEscalados.length} />

      {/* Lista de hóspedes do turno, agrupada por módulo/andar */}
      {hospedes.length === 0 ? (
        <EmptyState label="Nenhum hóspede ativo neste turno." />
      ) : (
        <div className="space-y-5">
          {modulos.map((m) => (
            <GrupoModuloView
              key={m.modulo}
              grupo={m}
              data={data}
              tag={tag}
              escalados={cuidadoresEscalados}
              podeEditar={podeEditar}
            />
          ))}

          {semLocal.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b pb-1">
                <Building2 className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-secondary">Sem localização identificada</h3>
                <Badge variant="muted">{semLocal.length}</Badge>
                <span className="text-xs text-muted-foreground">(quarto fora do padrão — designe individualmente)</span>
              </div>
              {semLocal.map((h) => (
                <CardHospede key={h.residente.id} item={h} data={data} tag={tag} escalados={cuidadoresEscalados} podeEditar={podeEditar} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recorte: um módulo (com seus andares) ────────────────────────────────────
function GrupoModuloView({
  grupo,
  data,
  tag,
  escalados,
  podeEditar,
}: {
  grupo: GrupoModulo;
  data: string;
  tag: TagTurno;
  escalados: PessoaTurno[];
  podeEditar: boolean;
}) {
  const descobertosNoModulo = grupo.hospedes.filter((h) => h.descoberto).length;
  return (
    <div className="space-y-3">
      {/* Cabeçalho do MÓDULO (designar todo o módulo) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-secondary" />
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-secondary">Módulo {grupo.modulo}</h3>
          <Badge variant="muted">{grupo.hospedes.length} hóspede(s)</Badge>
          {descobertosNoModulo > 0 && (
            <Badge variant="destructive" className="gap-1">
              <UserX className="size-3" /> {descobertosNoModulo}
            </Badge>
          )}
        </div>
        {podeEditar && (
          <BulkDesignar
            rotulo={`Designar todo o Módulo ${grupo.modulo}`}
            residenteIds={grupo.hospedes.map((h) => h.residente.id)}
            escalados={escalados}
            data={data}
            tag={tag}
          />
        )}
      </div>

      {/* Andares do módulo */}
      {grupo.andares.map((a) => (
        <div key={a.andar} className="space-y-2 pl-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1">
            <div className="flex items-center gap-2">
              <Users className="size-3.5 text-muted-foreground" />
              <h4 className="text-sm font-bold text-secondary">
                Módulo {grupo.modulo} · Andar {a.andar}
              </h4>
              <Badge variant="muted">{a.hospedes.length}</Badge>
            </div>
            {podeEditar && (
              <BulkDesignar
                rotulo={`Designar o Andar ${a.andar}`}
                residenteIds={a.hospedes.map((h) => h.residente.id)}
                escalados={escalados}
                data={data}
                tag={tag}
              />
            )}
          </div>
          {a.hospedes.map((h) => (
            <CardHospede key={h.residente.id} item={h} data={data} tag={tag} escalados={escalados} podeEditar={podeEditar} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Designação em lote (recorte por módulo/andar) ────────────────────────────
function BulkDesignar({
  rotulo,
  residenteIds,
  escalados,
  data,
  tag,
}: {
  rotulo: string;
  residenteIds: string[];
  escalados: PessoaTurno[];
  data: string;
  tag: TagTurno;
}) {
  const lote = useDesignarLote();

  async function aplicar(cuidadorId: string) {
    if (!cuidadorId) return;
    try {
      await lote.mutateAsync({ residenteIds, cuidadorId, data, turno: tag });
      const nome = escalados.find((c) => c.id === cuidadorId)?.nome ?? "Cuidadora";
      toast.success(`${nome} designada a ${residenteIds.length} hóspede(s).`);
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      <select
        value=""
        onChange={(e) => aplicar(e.target.value)}
        disabled={lote.isPending || escalados.length === 0 || residenteIds.length === 0}
        className="h-8 max-w-[220px] rounded-md border border-input bg-card px-2 text-xs disabled:opacity-50"
        title={rotulo}
      >
        <option value="">{escalados.length === 0 ? "Sem cuidadora escalada" : `${rotulo}…`}</option>
        {escalados.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
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
            <span className="text-xs text-muted-foreground">Quarto {ouNaoInformado(formatarQuarto(r.quarto))}</span>
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

// Indicador-resumo da proporção mínima de cuidadores (RDC 502 Art. 16). O
// painel completo fica na aba Vigilância Sanitária; aqui é só o resumo do turno.
function ProporcaoResumo({ hospedes, escalado }: { hospedes: HospedeCobertura[]; escalado: number }) {
  const contagem = contarPorGrau(hospedes.map((h) => h.residente));
  const minimo = minimoCuidadores(contagem);
  const status = statusProporcao(escalado, minimo);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm",
        status === "abaixo" ? "border-destructive/40 bg-destructive/5" : "border-success/30 bg-success/5",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-1.5 text-secondary">
        <Scale className="size-4 text-muted-foreground" />
        Proporção mínima (RDC Art. 16): escalado <strong>{escalado}</strong> / mínimo <strong>{minimo}</strong>
        {contagem.semGrau > 0 && (
          <span className="text-warning-foreground">· {contagem.semGrau} sem grau definido</span>
        )}
      </span>
      <Badge variant={STATUS_PROPORCAO_VARIANTE[status]}>{STATUS_PROPORCAO_LABEL[status]}</Badge>
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
