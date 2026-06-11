import { useState } from "react";
import { Check, X, User, Layers, Users, HeartPulse, Wallet, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResidenteValor } from "@/hooks/useResidentesGestao";
import { calcularIdade, grauNivel, tempoDePermanencia } from "@/lib/utils";
import type { GrauDependencia, Ocupacao, Residente, TipoSuite } from "@/types/database";

/** Tipos de suíte (alinhado à tabela de preços da Administração). */
const TIPOS_SUITE: TipoSuite[] = ["Suíte Modular", "Suíte", "Long Stay", "Apartamento"];
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// ===========================================================================
// MASTER · Ficha completa do residente (criar/editar). Todos os campos são
// editáveis; o STATUS financeiro do mês é leitura e fica "Não informado" até o
// módulo de mensalidades existir. Destaca a divergência de grau (contratual x
// atual ≥ 1 nível) como gatilho de renegociação.
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelBase = "mb-1.5 block text-sm font-semibold text-secondary";

function estadoInicial(r?: Residente): ResidenteValor {
  return {
    nome: r?.nome ?? "",
    data_nascimento: r?.data_nascimento ?? null,
    grau_dependencia: r?.grau_dependencia ?? null,
    grau_contratual: r?.grau_contratual ?? null,
    modulo: r?.modulo ?? null,
    andar: r?.andar ?? null,
    quarto: r?.quarto ?? null,
    tipo_suite: r?.tipo_suite ?? null,
    ocupacao: r?.ocupacao ?? null,
    data_admissao: r?.data_admissao ?? null,
    responsavel_legal: r?.responsavel_legal ?? null,
    contato: r?.contato ?? null,
    contato_emergencia_nome: r?.contato_emergencia_nome ?? null,
    contato_emergencia_telefone: r?.contato_emergencia_telefone ?? null,
    plano_saude_operadora: r?.plano_saude_operadora ?? null,
    plano_saude_numero: r?.plano_saude_numero ?? null,
    hospital_referencia: r?.hospital_referencia ?? null,
    alergias: r?.alergias ?? null,
    proteses: r?.proteses ?? null,
    mensalidade_valor: r?.mensalidade_valor ?? null,
    historia_vida: r?.historia_vida ?? null,
  };
}

function paraInt(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function paraDecimal(s: string): number | null {
  const limpo = s.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function ResidenteFicha({
  inicial,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: Residente;
  salvando: boolean;
  onSalvar: (valor: ResidenteValor) => void;
  onCancelar: () => void;
}) {
  const [v, setV] = useState<ResidenteValor>(() => estadoInicial(inicial));

  function set<K extends keyof ResidenteValor>(campo: K, valor: ResidenteValor[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }));
  }

  const idade = calcularIdade(v.data_nascimento);
  const permanencia = tempoDePermanencia(v.data_admissao);
  const nivelContratual = grauNivel(v.grau_contratual);
  const nivelAtual = grauNivel(v.grau_dependencia);
  const diverge =
    nivelContratual !== null && nivelAtual !== null && Math.abs(nivelContratual - nivelAtual) >= 1;

  const valido = v.nome.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-secondary">
          {inicial ? "Editar ficha do residente" : "Novo residente"}
        </h2>
        <div className="flex gap-2">
          <Button onClick={() => onSalvar({ ...v, nome: v.nome.trim() })} disabled={!valido || salvando}>
            <Check className="size-4" /> {inicial ? "Salvar alterações" : "Cadastrar"}
          </Button>
          <Button variant="outline" onClick={onCancelar} disabled={salvando}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </div>

      {/* IDENTIFICAÇÃO */}
      <Secao icon={User} titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo className="sm:col-span-2 lg:col-span-3" rotulo="Nome">
            <input value={v.nome} onChange={(e) => set("nome", e.target.value)} className={inputBase} placeholder="Nome completo" />
          </Campo>
          <Campo rotulo={`Data de nascimento${idade !== null ? ` · ${idade} anos` : ""}`}>
            <input type="date" value={v.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value || null)} className={inputBase} />
          </Campo>
          <Campo rotulo="Módulo">
            <input value={v.modulo ?? ""} onChange={(e) => set("modulo", paraInt(e.target.value))} inputMode="numeric" className={inputBase} placeholder="—" />
          </Campo>
          <Campo rotulo="Andar">
            <input value={v.andar ?? ""} onChange={(e) => set("andar", paraInt(e.target.value))} inputMode="numeric" className={inputBase} placeholder="—" />
          </Campo>
          <Campo rotulo="Quarto">
            <input value={v.quarto ?? ""} onChange={(e) => set("quarto", e.target.value)} className={inputBase} placeholder="ex: 1-2-04" />
          </Campo>
          <Campo rotulo="Tipo de suíte">
            <select value={v.tipo_suite ?? ""} onChange={(e) => set("tipo_suite", (e.target.value || null) as TipoSuite | null)} className={inputBase}>
              <option value="">Não informado</option>
              {TIPOS_SUITE.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Ocupação">
            <select value={v.ocupacao ?? ""} onChange={(e) => set("ocupacao", (e.target.value || null) as Ocupacao | null)} className={inputBase}>
              <option value="">Não informado</option>
              <option value="individual">Individual</option>
              <option value="dupla">Dupla</option>
            </select>
          </Campo>
          <Campo rotulo={`Data de admissão · ${permanencia}`}>
            <input type="date" value={v.data_admissao ?? ""} onChange={(e) => set("data_admissao", e.target.value || null)} className={inputBase} />
          </Campo>
        </div>
      </Secao>

      {/* GRAU */}
      <Secao icon={Layers} titulo="Grau de dependência">
        {diverge && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> Divergência de grau (contratual × atual) — gatilho de renegociação.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Grau CONTRATUAL (contrato)">
            <SelectGrau valor={v.grau_contratual} onChange={(g) => set("grau_contratual", g)} />
          </Campo>
          <Campo rotulo="Grau ATUAL (IVCF)">
            <SelectGrau valor={v.grau_dependencia} onChange={(g) => set("grau_dependencia", g)} />
          </Campo>
        </div>
      </Secao>

      {/* FAMILIAR / EMERGÊNCIA */}
      <Secao icon={Users} titulo="Familiar responsável e emergência">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Responsável legal">
            <input value={v.responsavel_legal ?? ""} onChange={(e) => set("responsavel_legal", e.target.value)} className={inputBase} placeholder="Nome (parentesco)" />
          </Campo>
          <Campo rotulo="Contato do responsável">
            <input value={v.contato ?? ""} onChange={(e) => set("contato", e.target.value)} className={inputBase} placeholder="(11) 90000-0000" />
          </Campo>
          <Campo rotulo="Contato de emergência (nome)">
            <input value={v.contato_emergencia_nome ?? ""} onChange={(e) => set("contato_emergencia_nome", e.target.value)} className={inputBase} placeholder="Nome" />
          </Campo>
          <Campo rotulo="Contato de emergência (telefone)">
            <input value={v.contato_emergencia_telefone ?? ""} onChange={(e) => set("contato_emergencia_telefone", e.target.value)} className={inputBase} placeholder="(11) 90000-0000" />
          </Campo>
        </div>
      </Secao>

      {/* SAÚDE */}
      <Secao icon={HeartPulse} titulo="Saúde">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Plano de saúde (operadora)">
            <input value={v.plano_saude_operadora ?? ""} onChange={(e) => set("plano_saude_operadora", e.target.value)} className={inputBase} placeholder="ex: Bradesco Saúde" />
          </Campo>
          <Campo rotulo="Plano de saúde (número)">
            <input value={v.plano_saude_numero ?? ""} onChange={(e) => set("plano_saude_numero", e.target.value)} className={inputBase} placeholder="Número da carteirinha" />
          </Campo>
          <Campo rotulo="Hospital de referência">
            <input value={v.hospital_referencia ?? ""} onChange={(e) => set("hospital_referencia", e.target.value)} className={inputBase} placeholder="ex: Hospital Albert Einstein" />
          </Campo>
          <Campo rotulo="Alergias">
            <input value={v.alergias ?? ""} onChange={(e) => set("alergias", e.target.value)} className={inputBase} placeholder="ex: Dipirona" />
          </Campo>
          <Campo rotulo="Próteses">
            <input value={v.proteses ?? ""} onChange={(e) => set("proteses", e.target.value)} className={inputBase} placeholder="ex: Prótese de quadril" />
          </Campo>
        </div>
      </Secao>

      {/* FINANCEIRO */}
      <Secao icon={Wallet} titulo="Financeiro (resumo)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Mensalidade vigente (R$)">
            <input value={v.mensalidade_valor ?? ""} onChange={(e) => set("mensalidade_valor", paraDecimal(e.target.value))} inputMode="decimal" className={inputBase} placeholder="0,00" />
          </Campo>
          <Campo rotulo="Status do mês">
            {/* LEITURA: o status (em dia/inadimplente) virá do módulo de
                mensalidades quando existir; por ora não há fonte. */}
            <div className="flex h-11 items-center text-sm font-medium text-muted-foreground">
              Não informado — módulo de mensalidades
            </div>
          </Campo>
        </div>
      </Secao>

      {/* HISTÓRIA DE VIDA */}
      <Secao icon={BookOpen} titulo="História de vida">
        <textarea
          value={v.historia_vida ?? ""}
          onChange={(e) => set("historia_vida", e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Trajetória, gostos, hábitos…"
        />
      </Secao>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onSalvar({ ...v, nome: v.nome.trim() })} disabled={!valido || salvando}>
          <Check className="size-4" /> {inicial ? "Salvar alterações" : "Cadastrar"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Secao({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-secondary" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Campo({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label className={labelBase}>{rotulo}</label>
      {children}
    </div>
  );
}

function SelectGrau({
  valor,
  onChange,
}: {
  valor: GrauDependencia | null;
  onChange: (g: GrauDependencia | null) => void;
}) {
  return (
    <select
      value={valor ?? ""}
      onChange={(e) => onChange((e.target.value || null) as GrauDependencia | null)}
      className={inputBase}
    >
      <option value="">Não informado</option>
      <option value="I">Grau I</option>
      <option value="II">Grau II</option>
      <option value="III">Grau III</option>
    </select>
  );
}

/** Selo reutilizável de divergência para a LISTA (exportado). */
export function BadgeDivergencia() {
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="size-3" /> divergência
    </Badge>
  );
}
