import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { useDefinirSenhaUsuario } from "@/hooks/useUsuarios";
import {
  PERFIS_SISTEMA,
  configPerfil,
  perfilParaSeletor,
  perfilDoBanco,
  type PerfilSeletor,
} from "@/data/perfisSistema";
import type { UsuarioValor } from "@/hooks/useUsuarios";
import type { Residente, TipoRemuneracao, Usuario } from "@/types/database";

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
  residente_vinculado: string;
  ativo: boolean;
  // Registro de pessoal SEM ACESSO (não loga; só equipe + custo).
  semAcesso: boolean;
  contato: string;
  tipoRemuneracao: TipoRemuneracao;
  valorMensal: string;
  valorPlantaoDiurno: string;
  valorPlantaoNoturno: string;
  horario: string;
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
    residente_vinculado: u?.residente_vinculado ?? "",
    ativo: u?.ativo ?? true,
    semAcesso: u?.sem_acesso ?? false,
    contato: u?.contato ?? "",
    tipoRemuneracao: (u?.tipo_remuneracao ?? "mensal_fixo") as TipoRemuneracao,
    valorMensal: u?.valor_mensal != null ? String(u.valor_mensal) : "",
    valorPlantaoDiurno: u?.valor_plantao_diurno != null ? String(u.valor_plantao_diurno) : "",
    valorPlantaoNoturno: u?.valor_plantao_noturno != null ? String(u.valor_plantao_noturno) : "",
    horario: u?.horario_trabalho ?? "",
  };
}

export function UsuarioForm({
  inicial,
  modoEdicao,
  residentes,
  cargosExistentes = [],
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: Usuario;
  modoEdicao: boolean;
  residentes: Residente[];
  /** Cargos (funcao) já usados no sistema — alimentam as sugestões do combobox. */
  cargosExistentes?: string[];
  salvando: boolean;
  onSalvar: (valor: UsuarioValor) => void;
  onCancelar: () => void;
}) {
  const [f, setF] = useState<FormState>(() => estadoInicial(inicial));
  const cfg = configPerfil(f.seletor);
  const listaCargosId = useId();
  const { ehMaster } = useAuth();
  const definirSenha = useDefinirSenhaUsuario();
  const [senhaNova, setSenhaNova] = useState("");

  // Bloco de senha: só o Master, só em edição de usuário COM login (e-mail
  // salvo). A senha é definida pela RPC admin_definir_senha (independente do
  // "Salvar alterações" — é uma operação de Auth, não da linha `usuarios`).
  const podeDefinirSenha = ehMaster && modoEdicao && !!inicial && !inicial.sem_acesso && !!inicial.email;

  async function salvarSenha() {
    if (!inicial?.email) return;
    if (senhaNova.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    try {
      await definirSenha.mutateAsync({ email: inicial.email, senha: senhaNova });
      toast.success(`Senha definida para ${inicial.email}.`);
      setSenhaNova("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao definir a senha.");
    }
  }

  function gerarSenha() {
    // Senha temporária legível (sem caracteres ambíguos) para entregar ao usuário.
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    setSenhaNova(Array.from(bytes, (n) => alfabeto[n % alfabeto.length]).join(""));
  }

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

  // Cargo (função) existe para todo perfil que não seja Família (portal).
  const usaCargo = f.seletor !== "familia";

  // Sugestões do combobox: base do perfil ∪ cargos já usados no sistema.
  // Não restringem — o Master pode escolher uma destas OU digitar um cargo novo.
  const sugestoesCargo = useMemo(() => {
    const base = [
      ...(cfg.funcoes ?? []),
      ...(cfg.funcaoFixa ? [cfg.funcaoFixa] : []),
      ...(cfg.cargosSugeridos ?? []),
      ...cargosExistentes,
    ];
    return [...new Set(base.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [cfg, cargosExistentes]);

  // No grupo de cuidados, o COREN só vale para quem entra como Enfermagem
  // (deriva do cargo digitado, suportando cargos personalizados).
  const mostraRegistro =
    !!cfg.registroLabel &&
    (!cfg.registroSomenteEnfermagem || perfilDoBanco(f.seletor, f.funcao) === "enfermagem");

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  // Pessoal sem acesso não loga → e-mail não é exigido; família não se aplica.
  const familiaPrecisaResidente = !f.semAcesso && cfg.vinculaResidente && !f.residente_vinculado;
  const valido =
    f.nome.trim().length > 0 && (f.semAcesso || emailValido) && !familiaPrecisaResidente;

  const residentesOrdenados = useMemo(
    () => [...residentes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [residentes],
  );

  function salvar() {
    const funcaoFinal = usaCargo ? f.funcao.trim() || null : null;
    const num = (s: string): number | null => {
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    const mensal = f.semAcesso && f.tipoRemuneracao === "mensal_fixo";
    const plantao = f.semAcesso && f.tipoRemuneracao === "por_plantao";
    const valor: UsuarioValor = {
      nome: f.nome.trim(),
      email: f.semAcesso ? "" : f.email.trim(), // sem acesso → sem login
      perfil: perfilDoBanco(f.seletor, funcaoFinal),
      funcao: funcaoFinal,
      vinculo: cfg.mostraVinculo ? f.vinculo || null : null,
      registro_profissional: mostraRegistro ? f.registro.trim() || null : null,
      isento_ponto_app: cfg.mostraIsentoPonto ? f.isento_ponto_app : true,
      residente_vinculado: !f.semAcesso && cfg.vinculaResidente ? f.residente_vinculado || null : null,
      ativo: f.ativo,
      semAcesso: f.semAcesso,
      contato: f.semAcesso ? f.contato.trim() || null : null,
      tipoRemuneracao: f.semAcesso ? f.tipoRemuneracao : null,
      valorMensal: mensal ? num(f.valorMensal) : null,
      valorPlantaoDiurno: plantao ? num(f.valorPlantaoDiurno) : null,
      valorPlantaoNoturno: plantao ? num(f.valorPlantaoNoturno) : null,
      horarioTrabalho: f.semAcesso ? f.horario.trim() || null : null,
    };
    onSalvar(valor);
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
      {/* Tipo de cadastro: usuário COM acesso (login) vs registro SEM acesso. */}
      <div>
        <label className={labelBase}>Tipo de cadastro</label>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {[
            { v: false, label: "Usuário com acesso (cria login)" },
            { v: true, label: "Registro de pessoal (sem acesso)" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => set("semAcesso", o.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                f.semAcesso === o.v ? "bg-card text-secondary shadow-card" : "text-muted-foreground hover:text-secondary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {f.semAcesso
            ? "Pessoal só para registro de equipe e custo — NÃO loga no app e não aparece na seleção de perfil."
            : "Cria um login: o e-mail será o acesso ao sistema."}
        </p>
      </div>

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

        {/* Email (login) — só para usuário COM acesso */}
        {!f.semAcesso && (
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
            {!modoEdicao && (
              <p className="mt-1 text-xs text-muted-foreground">
                Após criar, clique em <span className="font-semibold">Editar</span> no usuário para
                definir a senha de acesso.
              </p>
            )}
          </div>
        )}

        {/* Contato — só para registro SEM acesso */}
        {f.semAcesso && (
          <div>
            <label className={labelBase}>Contato (opcional)</label>
            <input
              value={f.contato}
              onChange={(e) => set("contato", e.target.value)}
              placeholder="Telefone / e-mail de contato"
              className={inputBase}
            />
          </div>
        )}

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

        {/* Cargo (combobox: escolher um existente OU criar um novo) */}
        {usaCargo && (
          <div>
            <label className={labelBase}>Cargo</label>
            <input
              list={listaCargosId}
              value={f.funcao}
              onChange={(e) => set("funcao", e.target.value)}
              placeholder="Escolha um cargo ou digite um novo"
              className={inputBase}
            />
            <datalist id={listaCargosId}>
              {sugestoesCargo.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {f.seletor === "cuidador" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cargos de enfermagem (enfermeira, técnica…) entram no perfil Enfermagem; os demais,
                como Cuidador(a).
              </p>
            )}
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

        {/* Família: vínculo ao residente (obrigatório) — não se aplica a sem acesso */}
        {cfg.vinculaResidente && !f.semAcesso && (
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

      {/* Remuneração — só no registro SEM ACESSO (entra no custo de pessoal).
          Para usuários COM acesso, a remuneração fica na Administração. */}
      {f.semAcesso && (
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
          <p className="text-sm font-semibold text-secondary">Remuneração (custo de pessoal)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Tipo</label>
              <select
                value={f.tipoRemuneracao}
                onChange={(e) => set("tipoRemuneracao", e.target.value as TipoRemuneracao)}
                className={inputBase}
              >
                <option value="mensal_fixo">Mensal fixo</option>
                <option value="por_plantao">Por plantão</option>
              </select>
            </div>
            <div>
              <label className={labelBase}>Horário / observação</label>
              <input
                value={f.horario}
                onChange={(e) => set("horario", e.target.value)}
                placeholder="Ex.: Seg–Sex 7h–16h"
                className={inputBase}
              />
            </div>
            {f.tipoRemuneracao === "mensal_fixo" ? (
              <div>
                <label className={labelBase}>Valor mensal (R$)</label>
                <input type="number" min={0} step="0.01" value={f.valorMensal} onChange={(e) => set("valorMensal", e.target.value)} className={inputBase} />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelBase}>Valor plantão diurno (R$)</label>
                  <input type="number" min={0} step="0.01" value={f.valorPlantaoDiurno} onChange={(e) => set("valorPlantaoDiurno", e.target.value)} className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Valor plantão noturno (R$)</label>
                  <input type="number" min={0} step="0.01" value={f.valorPlantaoNoturno} onChange={(e) => set("valorPlantaoNoturno", e.target.value)} className={inputBase} />
                </div>
              </>
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

      {/* Senha de acesso — Master define a 1ª senha ou reseta (RPC de Auth). */}
      {podeDefinirSenha && (
        <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-secondary">
            <KeyRound className="size-4 text-primary" /> Senha de acesso
          </p>
          <p className="text-xs text-muted-foreground">
            Define a 1ª senha (novo login) ou reseta a senha de{" "}
            <span className="font-semibold">{inicial?.email}</span>. Informe ao usuário — ele pode
            trocá-la depois em “Editar meu perfil”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              autoComplete="off"
              className={`${inputBase} flex-1`}
            />
            <Button type="button" variant="outline" onClick={gerarSenha} disabled={definirSenha.isPending}>
              <RefreshCw className="size-4" /> Gerar
            </Button>
            <Button
              type="button"
              onClick={salvarSenha}
              disabled={senhaNova.length < 6 || definirSenha.isPending}
            >
              <KeyRound className="size-4" /> Definir senha
            </Button>
          </div>
        </div>
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
