import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PERFIS_SISTEMA,
  configPerfil,
  perfilParaSeletor,
  perfilDoBanco,
  type PerfilSeletor,
} from "@/data/perfisSistema";
import type { UsuarioValor } from "@/hooks/useUsuarios";
import type { Residente, Usuario } from "@/types/database";

// ===========================================================================
// MASTER-3 · Formulário de usuário (criar/editar) com campos condicionais por
// perfil. O email é obrigatório porque será o LOGIN quando a autenticação for
// ligada. O perfil real do banco é derivado do seletor + função (grupo
// Cuidadores/Enfermagem) por perfilDoBanco().
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelBase = "mb-1.5 block text-sm font-semibold text-secondary";

interface FormState {
  nome: string;
  email: string;
  seletor: PerfilSeletor;
  funcao: string;
  vinculo: string;
  registro: string;
  isento_ponto_app: boolean;
  tipo_remuneracao: "" | "mensal" | "plantao";
  valor_mensal: string;
  valor_plantao: string;
  residente_vinculado: string;
  ativo: boolean;
}

function estadoInicial(u?: Usuario): FormState {
  const seletor = u ? perfilParaSeletor(u.perfil) : "cuidador";
  const cfg = configPerfil(seletor);
  return {
    nome: u?.nome ?? "",
    email: u?.email ?? "",
    seletor,
    funcao: u?.funcao ?? cfg.funcoes?.[0] ?? cfg.funcaoFixa ?? "",
    vinculo: u?.vinculo ?? "CLT",
    registro: u?.registro_profissional ?? "",
    isento_ponto_app: u?.isento_ponto_app ?? true,
    tipo_remuneracao: u?.tipo_remuneracao ?? "",
    valor_mensal: u?.valor_mensal != null ? String(u.valor_mensal) : "",
    valor_plantao: u?.valor_plantao != null ? String(u.valor_plantao) : "",
    residente_vinculado: u?.residente_vinculado ?? "",
    ativo: u?.ativo ?? true,
  };
}

/** "1.234,50" ou "1234.5" → número; vazio → null. */
function paraNumero(s: string): number | null {
  const limpo = s.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function UsuarioForm({
  inicial,
  modoEdicao,
  residentes,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: Usuario;
  modoEdicao: boolean;
  residentes: Residente[];
  salvando: boolean;
  onSalvar: (valor: UsuarioValor) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState<FormState>(() => estadoInicial(inicial));
  const cfg = configPerfil(f.seletor);

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setF((atual) => ({ ...atual, [campo]: valor }));
  }

  // Ao trocar de perfil, ajusta a função padrão do novo perfil.
  function trocarPerfil(value: PerfilSeletor) {
    const c = configPerfil(value);
    setF((atual) => ({
      ...atual,
      seletor: value,
      funcao: c.funcoes?.[0] ?? c.funcaoFixa ?? "",
    }));
  }

  // No grupo de cuidados, o COREN só vale para enfermagem (não p/ Cuidadora).
  const mostraRegistro =
    !!cfg.registroLabel && (!cfg.registroSomenteEnfermagem || f.funcao !== "Cuidadora");

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const familiaPrecisaResidente = cfg.vinculaResidente && !f.residente_vinculado;
  const valido = f.nome.trim().length > 0 && emailValido && !familiaPrecisaResidente;

  const residentesOrdenados = useMemo(
    () => [...residentes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [residentes],
  );

  function salvar() {
    const funcaoFinal = cfg.funcoes || cfg.funcaoFixa ? f.funcao || null : null;
    const valor: UsuarioValor = {
      nome: f.nome.trim(),
      email: f.email.trim(),
      perfil: perfilDoBanco(f.seletor, funcaoFinal),
      funcao: funcaoFinal,
      vinculo: cfg.mostraVinculo ? f.vinculo || null : null,
      registro_profissional: mostraRegistro ? f.registro.trim() || null : null,
      isento_ponto_app: cfg.mostraIsentoPonto ? f.isento_ponto_app : true,
      tipo_remuneracao: cfg.mostraRemuneracao && f.tipo_remuneracao ? f.tipo_remuneracao : null,
      valor_mensal: cfg.mostraRemuneracao ? paraNumero(f.valor_mensal) : null,
      valor_plantao: cfg.mostraRemuneracao ? paraNumero(f.valor_plantao) : null,
      residente_vinculado: cfg.vinculaResidente ? f.residente_vinculado || null : null,
      ativo: f.ativo,
    };
    onSalvar(valor);
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Nome */}
        <div className="sm:col-span-2">
          <label className={labelBase}>Nome</label>
          <input
            autoFocus
            value={f.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Nome completo"
            className={inputBase}
          />
        </div>

        {/* Email (login futuro) */}
        <div>
          <label className={labelBase}>E-mail (será o login)</label>
          <input
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="email@blueseniorliving.com.br"
            className={inputBase}
          />
          {f.email.trim() !== "" && !emailValido && (
            <p className="mt-1 text-xs text-destructive">E-mail inválido.</p>
          )}
        </div>

        {/* Perfil */}
        <div>
          <label className={labelBase}>Perfil</label>
          <select
            value={f.seletor}
            onChange={(e) => trocarPerfil(e.target.value as PerfilSeletor)}
            className={inputBase}
          >
            {PERFIS_SISTEMA.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Função (seletor) */}
        {cfg.funcoes && (
          <div>
            <label className={labelBase}>Função</label>
            <select
              value={f.funcao}
              onChange={(e) => set("funcao", e.target.value)}
              className={inputBase}
            >
              {cfg.funcoes.map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Vínculo */}
        {cfg.mostraVinculo && (
          <div>
            <label className={labelBase}>Vínculo</label>
            <select
              value={f.vinculo}
              onChange={(e) => set("vinculo", e.target.value)}
              className={inputBase}
            >
              <option value="CLT">CLT</option>
              <option value="PJ">PJ</option>
            </select>
          </div>
        )}

        {/* Registro profissional (CRM/COREN/CREFITO/CRN…) */}
        {mostraRegistro && (
          <div>
            <label className={labelBase}>{cfg.registroLabel}</label>
            <input
              value={f.registro}
              onChange={(e) => set("registro", e.target.value)}
              placeholder="Número do registro"
              className={inputBase}
            />
          </div>
        )}

        {/* Família: vínculo ao residente (obrigatório) */}
        {cfg.vinculaResidente && (
          <div className="sm:col-span-2">
            <label className={labelBase}>Residente acompanhado (obrigatório)</label>
            <select
              value={f.residente_vinculado}
              onChange={(e) => set("residente_vinculado", e.target.value)}
              className={inputBase}
            >
              <option value="">Selecione o hóspede…</option>
              {residentesOrdenados.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                  {r.quarto ? ` · Quarto ${r.quarto}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Vários usuários-família podem acompanhar o mesmo residente (mantenedores).
            </p>
          </div>
        )}
      </div>

      {/* Remuneração (base dos custos de pessoal da Administração) */}
      {cfg.mostraRemuneracao && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold text-secondary">Remuneração</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelBase}>Tipo</label>
              <select
                value={f.tipo_remuneracao}
                onChange={(e) =>
                  set("tipo_remuneracao", e.target.value as FormState["tipo_remuneracao"])
                }
                className={inputBase}
              >
                <option value="">Não informado</option>
                <option value="mensal">Mensal (fixo)</option>
                <option value="plantao">Por plantão</option>
              </select>
            </div>
            {f.tipo_remuneracao !== "plantao" && (
              <div>
                <label className={labelBase}>Valor mensal (R$)</label>
                <input
                  value={f.valor_mensal}
                  onChange={(e) => set("valor_mensal", e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={inputBase}
                />
              </div>
            )}
            {f.tipo_remuneracao !== "mensal" && (
              <div>
                <label className={labelBase}>Valor por plantão (R$)</label>
                <input
                  value={f.valor_plantao}
                  onChange={(e) => set("valor_plantao", e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className={inputBase}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Isento de ponto no app */}
      {cfg.mostraIsentoPonto && (
        <label className="flex items-center gap-2 text-sm font-medium text-secondary">
          <input
            type="checkbox"
            checked={f.isento_ponto_app}
            onChange={(e) => set("isento_ponto_app", e.target.checked)}
            className="size-4 rounded border-input"
          />
          Isento de ponto no app (bate ponto físico)
        </label>
      )}

      {/* Ativo (na edição; criação já entra ativo por padrão) */}
      {modoEdicao && (
        <label className="flex items-center gap-2 text-sm font-medium text-secondary">
          <input
            type="checkbox"
            checked={f.ativo}
            onChange={(e) => set("ativo", e.target.checked)}
            className="size-4 rounded border-input"
          />
          Ativo (inativo não acessa o sistema)
        </label>
      )}

      {familiaPrecisaResidente && (
        <p className="text-xs text-destructive">
          Selecione o residente acompanhado para o perfil Família.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={salvar} disabled={!valido || salvando}>
          <Check className="size-4" /> {modoEdicao ? "Salvar alterações" : "Criar usuário"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
