import { useState } from "react";
import { Check, X, User, Layers, Users, HeartPulse, Wallet, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FotoUploader } from "@/components/FotoUploader";
import { uploadFotoResidente } from "@/lib/storage";
import type { ResidenteValor } from "@/hooks/useResidentesGestao";
import { calcularIdade, grauNivel, tempoDePermanencia } from "@/lib/utils";
import { montarQuarto, parseQuarto, type LetraQuarto } from "@/lib/quarto";
import {
  ResponsavelFinanceiroFields,
  type RespFinValor,
} from "@/components/financeiro/ResponsavelFinanceiroFields";
import type { GrauDependencia, Ocupacao, Residente, TipoSuite } from "@/types/database";

// Mapeia os campos do componente de responsável financeiro para as chaves de
// ResidenteValor (salvas junto com a ficha).
const CAMPO_RESP_FIN: Record<keyof RespFinValor, keyof ResidenteValor> = {
  nome: "resp_fin_nome",
  cpf: "resp_fin_cpf",
  email: "resp_fin_email",
  telefone: "resp_fin_telefone",
  relacao: "resp_fin_relacao",
};

/** Tipos de suíte (alinhado à tabela de preços da Administração). */
const TIPOS_SUITE: TipoSuite[] = ["Suíte", "Suíte Premium", "Long Stay", "Apartamento"];
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

function estadoInicial(r?: Residente, prefill?: Partial<ResidenteValor>): ResidenteValor {
  const base: ResidenteValor = {
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
    celular_proprio: r?.celular_proprio ?? null,
    foto_url: r?.foto_url ?? null,
    resp_fin_nome: r?.resp_fin_nome ?? null,
    resp_fin_cpf: r?.resp_fin_cpf ?? null,
    resp_fin_email: r?.resp_fin_email ?? null,
    resp_fin_telefone: r?.resp_fin_telefone ?? null,
    resp_fin_relacao: r?.resp_fin_relacao ?? null,
  };
  // Pré-preenchimento (ex.: admissão vinda do CRM) só se aplica na CRIAÇÃO.
  if (!r && prefill) return { ...base, ...prefill };
  return base;
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
  prefill,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: Residente;
  /** Valores iniciais ao CRIAR (ignorado na edição). Usado pela admissão do CRM. */
  prefill?: Partial<ResidenteValor>;
  salvando: boolean;
  onSalvar: (valor: ResidenteValor) => void;
  onCancelar: () => void;
}) {
  const [v, setV] = useState<ResidenteValor>(() => estadoInicial(inicial, prefill));

  function set<K extends keyof ResidenteValor>(campo: K, valor: ResidenteValor[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }));
  }

  // ── Número do quarto (Bloco-Andar-Suíte-Letra) ──────────────────────────────
  // Bloco↔modulo e Andar↔andar reaproveitam as colunas; suíte e letra vivem na
  // string `quarto`. Estado local p/ suíte/letra; bloco/andar saem de v.modulo/
  // v.andar. Qualquer mudança remonta os três campos em sincronia.
  const partesIniciais = parseQuarto(inicial?.quarto);
  const [suite, setSuite] = useState<number | null>(partesIniciais.suite);
  const [letra, setLetra] = useState<LetraQuarto>(partesIniciais.letra ?? "A");

  function setParteQuarto(patch: Partial<{ bloco: number | null; andar: number | null; suite: number | null; letra: LetraQuarto }>) {
    const bloco = patch.bloco !== undefined ? patch.bloco : v.modulo;
    const andar = patch.andar !== undefined ? patch.andar : v.andar;
    const s = patch.suite !== undefined ? patch.suite : suite;
    const l = patch.letra !== undefined ? patch.letra : letra;
    if (patch.suite !== undefined) setSuite(patch.suite);
    if (patch.letra !== undefined) setLetra(patch.letra);
    setV((atual) => ({ ...atual, modulo: bloco, andar, quarto: montarQuarto(bloco, andar, s, l) }));
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

      {/* FOTO (só na edição — o upload precisa do id do hóspede) */}
      {inicial && (
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <FotoUploader
              fotoUrl={v.foto_url}
              nome={v.nome || "hóspede"}
              podeEditar
              onUpload={(file) => uploadFotoResidente(file, inicial.id)}
              onChange={(url) => set("foto_url", url)}
            />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-secondary">Foto do hóspede</p>
              <p>Envie ou troque a foto. Ela é salva ao confirmar as alterações.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IDENTIFICAÇÃO */}
      <Secao icon={User} titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo className="sm:col-span-2 lg:col-span-3" rotulo="Nome">
            <input value={v.nome} onChange={(e) => set("nome", e.target.value)} className={inputBase} placeholder="Nome completo" />
          </Campo>
          <Campo rotulo={`Data de nascimento${idade !== null ? ` · ${idade} anos` : ""}`}>
            <input type="date" value={v.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value || null)} className={inputBase} />
          </Campo>
          <Campo rotulo="Bloco (1–5)">
            <input value={v.modulo ?? ""} onChange={(e) => setParteQuarto({ bloco: paraInt(e.target.value) })} inputMode="numeric" className={inputBase} placeholder="—" />
          </Campo>
          <Campo rotulo="Andar (1–3)">
            <input value={v.andar ?? ""} onChange={(e) => setParteQuarto({ andar: paraInt(e.target.value) })} inputMode="numeric" className={inputBase} placeholder="—" />
          </Campo>
          <Campo rotulo="Suíte (1–99)">
            <input value={suite ?? ""} onChange={(e) => setParteQuarto({ suite: paraInt(e.target.value) })} inputMode="numeric" className={inputBase} placeholder="—" />
          </Campo>
          <Campo rotulo="Letra (A/B/C)">
            <select value={letra} onChange={(e) => setParteQuarto({ letra: e.target.value as LetraQuarto })} className={inputBase}>
              <option value="A">A — simples / 1º leito</option>
              <option value="B">B — 2º leito (duplo)</option>
              <option value="C">C — 3º leito (triplo)</option>
            </select>
          </Campo>
          <Campo rotulo="Número do quarto">
            <div className="flex h-11 items-center rounded-md border border-dashed border-input bg-muted/30 px-3 text-sm font-semibold tabular-nums text-secondary">
              {v.quarto ?? "—"}
            </div>
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
          <Campo rotulo="Celular do hóspede">
            <input value={v.celular_proprio ?? ""} onChange={(e) => set("celular_proprio", e.target.value)} className={inputBase} placeholder="(11) 90000-0000" />
          </Campo>
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
            {/* LEITURA: o status (em dia/inadimplente) é gerido na tela de
                Mensalidades / Painel de Cobrança. */}
            <div className="flex h-11 items-center text-sm font-medium text-muted-foreground">
              Veja em Mensalidades / Cobrança
            </div>
          </Campo>
        </div>
      </Secao>

      {/* RESPONSÁVEL FINANCEIRO (quem paga — em geral o filho, não o idoso) */}
      <Secao icon={Users} titulo="Responsável financeiro (quem paga)">
        <ResponsavelFinanceiroFields
          valor={{
            nome: v.resp_fin_nome ?? "",
            cpf: v.resp_fin_cpf ?? "",
            email: v.resp_fin_email ?? "",
            telefone: v.resp_fin_telefone ?? "",
            relacao: v.resp_fin_relacao ?? "",
          }}
          onChange={(campo, valor) => set(CAMPO_RESP_FIN[campo], valor || null)}
        />
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
