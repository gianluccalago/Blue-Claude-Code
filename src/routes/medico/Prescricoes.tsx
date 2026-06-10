import { useState, useEffect } from "react";
import { Plus, Pencil, PauseCircle, Pill, X, Check, FileDown, Copy, CheckCheck } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { useResidentes } from "@/hooks/usePlanos";
import {
  usePrescricoesAtivas,
  useCriarPrescricao,
  useEditarPrescricao,
  useSuspenderPrescricao,
  type GrupoPrescricao,
} from "@/hooks/useMedico";
import { exportarPrescricaoPDF, copiarPrescricao } from "@/lib/exportPrescricao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { PeriodoMedicacao, Residente, ViaMedicacao } from "@/types/database";

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERIODOS: { key: PeriodoMedicacao; label: string; horario: string }[] = [
  { key: "jejum", label: "Jejum", horario: "06:00" },
  { key: "manha", label: "Manhã", horario: "08:00" },
  { key: "almoco", label: "Almoço", horario: "12:00" },
  { key: "apos_almoco", label: "Após almoço", horario: "13:00" },
  { key: "tarde", label: "Tarde", horario: "16:00" },
  { key: "noite", label: "Noite", horario: "20:00" },
];

const PERIODO_LABEL: Record<PeriodoMedicacao, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
  tarde: "Tarde",
  noite: "Noite",
};

const PERIODO_ORDER: Record<PeriodoMedicacao, number> = {
  jejum: 0,
  manha: 1,
  almoco: 2,
  apos_almoco: 3,
  tarde: 4,
  noite: 5,
};

const VIA_LABEL: Record<ViaMedicacao, string> = {
  oral: "Oral",
  injetavel: "Injetável",
  insulina: "Insulina",
  sonda: "Sonda",
};

const POSOLOGIA_OPCOES: { value: string; label: string; periodos: PeriodoMedicacao[] }[] = [
  { value: "1x/dia", label: "1x/dia", periodos: ["manha"] },
  { value: "12/12h", label: "12/12h", periodos: ["manha", "noite"] },
  { value: "8/8h", label: "8/8h", periodos: ["manha", "almoco", "noite"] },
  { value: "6/6h", label: "6/6h", periodos: ["manha", "almoco", "tarde", "noite"] },
  { value: "1x/dia em jejum", label: "1x/dia em jejum", periodos: ["jejum"] },
  { value: "1x/dia à noite", label: "1x/dia à noite", periodos: ["noite"] },
  { value: "Personalizado", label: "Personalizado", periodos: [] },
];

// ─── Tipos do formulário ──────────────────────────────────────────────────────

type PeriodoForm = {
  key: PeriodoMedicacao;
  label: string;
  horario: string;
  marcado: boolean;
  quantidade: string;
};

type FormValues = {
  medicamento: string;
  via: ViaMedicacao;
  dose: string;
  posologia: string;
  quantidadeDefault: string;
  periodos: PeriodoForm[];
};

function formInicial(): FormValues {
  return {
    medicamento: "",
    via: "oral",
    dose: "",
    posologia: "1x/dia",
    quantidadeDefault: "",
    periodos: PERIODOS.map((p) => ({
      ...p,
      marcado: p.key === "manha",
      quantidade: "",
    })),
  };
}

function formDeGrupo(g: GrupoPrescricao): FormValues {
  const marcados = new Set(g.linhas.map((l) => l.periodo));
  const qtdPorPeriodo = new Map(g.linhas.map((l) => [l.periodo, l.quantidade ?? ""]));
  return {
    medicamento: g.medicamento,
    via: g.via,
    dose: g.dose ?? "",
    posologia: g.posologia ?? "Personalizado",
    quantidadeDefault: "",
    periodos: PERIODOS.map((p) => ({
      ...p,
      marcado: marcados.has(p.key),
      quantidade: qtdPorPeriodo.get(p.key) ?? "",
    })),
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Modo = { tipo: "lista" } | { tipo: "nova" } | { tipo: "editar"; grupo: GrupoPrescricao };

export function Prescricoes() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();
  const hospedeId = selecionadoId ?? residentes.data?.[0]?.id;
  const hospedeSelecionado = residentes.data?.find((r) => r.id === hospedeId);
  const [modo, setModo] = useState<Modo>({ tipo: "lista" });

  function abrirNova() {
    setModo({ tipo: "nova" });
  }
  function abrirEditar(grupo: GrupoPrescricao) {
    setModo({ tipo: "editar", grupo });
  }
  function voltar() {
    setModo({ tipo: "lista" });
  }

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  return (
    <div className="space-y-6">
      <HospedeSelector
        hospedes={residentes.data}
        selecionadoId={hospedeId}
        onSelect={(id) => {
          setSelecionadoId(id);
          setModo({ tipo: "lista" });
        }}
      />

      {hospedeId && modo.tipo === "lista" && (
        <ListaPrescricoes
          residenteId={hospedeId}
          hospede={hospedeSelecionado}
          onNova={abrirNova}
          onEditar={abrirEditar}
        />
      )}

      {hospedeId && modo.tipo === "nova" && (
        <FormPrescricao
          residenteId={hospedeId}
          inicial={formInicial()}
          onCancelar={voltar}
          onSalvar={voltar}
        />
      )}

      {hospedeId && modo.tipo === "editar" && (
        <FormPrescricao
          residenteId={hospedeId}
          inicial={formDeGrupo(modo.grupo)}
          grupoPrescricao={modo.grupo.grupoPrescricao}
          onCancelar={voltar}
          onSalvar={voltar}
        />
      )}
    </div>
  );
}

// ─── Lista de prescrições ─────────────────────────────────────────────────────

function ListaPrescricoes({
  residenteId,
  hospede,
  onNova,
  onEditar,
}: {
  residenteId: string;
  hospede: Residente | undefined;
  onNova: () => void;
  onEditar: (g: GrupoPrescricao) => void;
}) {
  const { data, isLoading, isError, error } = usePrescricoesAtivas(residenteId);
  const suspender = useSuspenderPrescricao();
  const [confirmarSuspensao, setConfirmarSuspensao] = useState<GrupoPrescricao | null>(null);
  const [copiado, setCopiado] = useState(false);

  // TODO: substituir por verificação de autenticação real quando houver login
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const podeExportar = perfil === "medico" || perfil === "master";

  // Restaura o botão "Copiar" após o feedback de copiado.
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const grupos = data ?? [];

  function handleExportPDF() {
    if (!hospede) return;
    exportarPrescricaoPDF(hospede, grupos);
  }

  async function handleCopiar() {
    const ok = await copiarPrescricao(grupos);
    if (ok) setCopiado(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {grupos.length === 0
            ? "Nenhuma prescrição ativa."
            : `${grupos.length} prescrição${grupos.length !== 1 ? "ões" : ""} ativa${grupos.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Exportação — visível apenas para médico e master */}
          {podeExportar && hospede && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="size-4" />
                Baixar PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopiar}
                disabled={grupos.length === 0}
              >
                {copiado ? (
                  <>
                    <CheckCheck className="size-4 text-success" />
                    Prescrição copiada
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Copiar prescrição (texto)
                  </>
                )}
              </Button>
            </>
          )}
          <Button onClick={onNova}>
            <Plus className="size-4" /> Nova prescrição
          </Button>
        </div>
      </div>

      {grupos.length === 0 && (
        <EmptyState label="Nenhuma prescrição ativa para este hóspede." />
      )}

      {grupos.map((g) => (
        <GrupoCard
          key={g.grupoPrescricao}
          grupo={g}
          onEditar={() => onEditar(g)}
          onSuspender={() => setConfirmarSuspensao(g)}
        />
      ))}

      <ConfirmDialog
        aberto={!!confirmarSuspensao}
        titulo="Suspender esta prescrição?"
        descricao={
          confirmarSuspensao
            ? `${confirmarSuspensao.medicamento} deixará de aparecer nas telas de medicação.`
            : undefined
        }
        textoConfirmar="Sim, suspender"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          if (!confirmarSuspensao) return;
          suspender.mutate(
            { residenteId, grupoPrescricao: confirmarSuspensao.grupoPrescricao },
            { onSettled: () => setConfirmarSuspensao(null) },
          );
        }}
        onCancelar={() => setConfirmarSuspensao(null)}
      />
    </div>
  );
}

function GrupoCard({
  grupo: g,
  onEditar,
  onSuspender,
}: {
  grupo: GrupoPrescricao;
  onEditar: () => void;
  onSuspender: () => void;
}) {
  const linhasOrdenadas = [...g.linhas].sort(
    (a, b) => PERIODO_ORDER[a.periodo] - PERIODO_ORDER[b.periodo],
  );

  const periodosTexto = linhasOrdenadas
    .map((l) => {
      const label = PERIODO_LABEL[l.periodo];
      const qtd = l.quantidade ? ` ${l.quantidade}` : "";
      return `${label}:${qtd}`;
    })
    .join("  ·  ");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Pill className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-secondary">
                {g.medicamento}
                {g.dose && (
                  <span className="ml-1.5 font-normal text-muted-foreground">{g.dose}</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{VIA_LABEL[g.via]}</Badge>
                {g.posologia && <span className="font-medium text-secondary/70">{g.posologia}</span>}
              </div>
              <div className="mt-2 text-sm text-secondary/80">{periodosTexto || "—"}</div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={onEditar}>
              <Pencil className="size-3.5" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={onSuspender}>
              <PauseCircle className="size-3.5" /> Suspender
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Formulário ───────────────────────────────────────────────────────────────

function FormPrescricao({
  residenteId,
  inicial,
  grupoPrescricao,
  onCancelar,
  onSalvar,
}: {
  residenteId: string;
  inicial: FormValues;
  grupoPrescricao?: string;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  const criar = useCriarPrescricao();
  const editar = useEditarPrescricao();
  const salvando = criar.isPending || editar.isPending;

  const [form, setForm] = useState<FormValues>(inicial);

  // Atualiza quantidade de todos os períodos marcados ao mudar o default.
  function setQuantidadeDefault(val: string) {
    setForm((prev) => ({
      ...prev,
      quantidadeDefault: val,
      periodos: prev.periodos.map((p) =>
        p.marcado ? { ...p, quantidade: val } : p,
      ),
    }));
  }

  // Ao trocar posologia: re-marca os períodos conforme o mapeamento.
  function setPosologia(val: string) {
    const opcao = POSOLOGIA_OPCOES.find((o) => o.value === val);
    const novosMarcados = new Set<PeriodoMedicacao>(opcao?.periodos ?? []);
    setForm((prev) => ({
      ...prev,
      posologia: val,
      periodos: prev.periodos.map((p) => ({
        ...p,
        marcado: novosMarcados.has(p.key),
        quantidade: novosMarcados.has(p.key) ? prev.quantidadeDefault : p.quantidade,
      })),
    }));
  }

  // Alterna um período manualmente.
  function togglePeriodo(key: PeriodoMedicacao) {
    setForm((prev) => ({
      ...prev,
      periodos: prev.periodos.map((p) =>
        p.key === key
          ? {
              ...p,
              marcado: !p.marcado,
              quantidade: !p.marcado ? prev.quantidadeDefault : p.quantidade,
            }
          : p,
      ),
    }));
  }

  function setQuantidadePeriodo(key: PeriodoMedicacao, val: string) {
    setForm((prev) => ({
      ...prev,
      periodos: prev.periodos.map((p) => (p.key === key ? { ...p, quantidade: val } : p)),
    }));
  }

  const periodosMarcados = form.periodos.filter((p) => p.marcado);
  const podeSalvar =
    form.medicamento.trim() !== "" && periodosMarcados.length > 0 && !salvando;

  async function handleSalvar() {
    if (!podeSalvar) return;
    const periodos = periodosMarcados.map((p) => ({
      periodo: p.key,
      quantidade: p.quantidade.trim(),
    }));
    const base = {
      residenteId,
      medicamento: form.medicamento.trim(),
      dose: form.dose.trim() || null,
      via: form.via,
      posologia: form.posologia,
      periodos,
    };
    if (grupoPrescricao) {
      await editar.mutateAsync({ ...base, grupoPrescricao });
    } else {
      await criar.mutateAsync(base);
    }
    onSalvar();
  }

  const titulo = grupoPrescricao ? "Editar prescrição" : "Nova prescrição";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>{titulo}</CardTitle>
        <button
          onClick={onCancelar}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Medicamento */}
        <Campo label="Medicamento *">
          <input
            type="text"
            value={form.medicamento}
            onChange={(e) => setForm((f) => ({ ...f, medicamento: e.target.value }))}
            placeholder="Ex: Losartana"
            className={inputClass}
          />
        </Campo>

        {/* Linha: Via + Dose */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Via">
            <select
              value={form.via}
              onChange={(e) => setForm((f) => ({ ...f, via: e.target.value as ViaMedicacao }))}
              className={inputClass}
            >
              <option value="oral">Oral</option>
              <option value="injetavel">Injetável</option>
              <option value="insulina">Insulina</option>
              <option value="sonda">Sonda</option>
            </select>
          </Campo>
          <Campo label="Dose (concentração)">
            <input
              type="text"
              value={form.dose}
              onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
              placeholder="Ex: 50mg"
              className={inputClass}
            />
          </Campo>
        </div>

        {/* Posologia */}
        <Campo label="Posologia (frequência)">
          <select
            value={form.posologia}
            onChange={(e) => setPosologia(e.target.value)}
            className={inputClass}
          >
            {POSOLOGIA_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Campo>

        {/* Quantidade padrão */}
        <Campo label="Quantidade padrão (replica para períodos marcados)">
          <input
            type="text"
            value={form.quantidadeDefault}
            onChange={(e) => setQuantidadeDefault(e.target.value)}
            placeholder="Ex: 1 comprimido, 10 ml, 20 UI"
            className={inputClass}
          />
        </Campo>

        {/* Períodos */}
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">
            Períodos <span className="font-normal text-muted-foreground">(selecione ao menos um)</span>
          </p>
          <div className="space-y-2">
            {form.periodos.map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                {/* Toggle do período */}
                <button
                  type="button"
                  onClick={() => togglePeriodo(p.key)}
                  className={cn(
                    "flex min-w-[140px] items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all",
                    p.marcado
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      p.marcado
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {p.marcado && <Check className="size-3" />}
                  </span>
                  <span className="font-medium">{p.label}</span>
                  <span className="font-normal opacity-60">· {p.horario}</span>
                </button>

                {/* Campo de quantidade individual (visível só quando marcado) */}
                {p.marcado && (
                  <input
                    type="text"
                    value={p.quantidade}
                    onChange={(e) => setQuantidadePeriodo(p.key, e.target.value)}
                    placeholder="Quantidade"
                    className={cn(inputClass, "flex-1")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar}>
            {salvando ? "Salvando…" : grupoPrescricao ? "Salvar alterações" : "Criar prescrição"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-secondary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-secondary">{label}</label>
      {children}
    </div>
  );
}
