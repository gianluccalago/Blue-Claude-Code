import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfissionalValor } from "@/hooks/useProfissionais";
import type { FuncaoProfissional, VinculoProfissional } from "@/types/database";

// As três funções de escala. Hoje os perfis Master, Coordenação e
// Administrativo oferecem as mesmas opções; a criação de OUTROS tipos de
// usuário (médico, farmácia etc.) não acontece aqui — virá no módulo de
// autenticação/Master. A restrição "Coordenação só cuidadora/enfermeira" é
// aplicada na interface; a trava real virá com a autenticação.
const FUNCOES: FuncaoProfissional[] = ["Cuidadora", "Técnica de Enfermagem", "Enfermeira"];
const VINCULOS: VinculoProfissional[] = ["CLT", "PJ"];

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VALOR_PADRAO: ProfissionalValor = {
  nome: "",
  email: "",
  funcao: "Cuidadora",
  vinculo: "CLT",
  registro_profissional: "",
  isento_ponto_app: true, // maioria é CLT que bate ponto físico
  ativo: true,
};

export function ProfissionalForm({
  inicial,
  modoEdicao,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: ProfissionalValor;
  modoEdicao: boolean;
  salvando: boolean;
  onSalvar: (valor: ProfissionalValor) => void;
  onCancelar: () => void;
}) {
  const [v, setV] = useState<ProfissionalValor>(inicial ?? VALOR_PADRAO);

  const ehEnfermagem = v.funcao !== "Cuidadora";
  const valido = v.nome.trim().length > 0;

  function set<K extends keyof ProfissionalValor>(campo: K, valor: ProfissionalValor[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Nome</label>
          <input
            autoFocus
            value={v.nome}
            onChange={(e) => set("nome", e.target.value)}
            placeholder="Nome completo"
            className={inputBase}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">
            E-mail (opcional)
          </label>
          <input
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="email@exemplo.com"
            className={inputBase}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Função</label>
          <select
            value={v.funcao}
            onChange={(e) => set("funcao", e.target.value as FuncaoProfissional)}
            className={inputBase}
          >
            {FUNCOES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Vínculo</label>
          <select
            value={v.vinculo}
            onChange={(e) => set("vinculo", e.target.value as VinculoProfissional)}
            className={inputBase}
          >
            {VINCULOS.map((vi) => (
              <option key={vi} value={vi}>
                {vi}
              </option>
            ))}
          </select>
        </div>

        {/* Registro profissional só para enfermagem (COREN). */}
        {ehEnfermagem && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">
              Registro profissional (COREN)
            </label>
            <input
              value={v.registro_profissional ?? ""}
              onChange={(e) => set("registro_profissional", e.target.value)}
              placeholder="COREN-SP 000000"
              className={inputBase}
            />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-secondary">
        <input
          type="checkbox"
          checked={v.isento_ponto_app}
          onChange={(e) => set("isento_ponto_app", e.target.checked)}
          className="size-4 rounded border-input"
        />
        Isento de ponto no app (bate ponto físico)
      </label>

      {modoEdicao && (
        <label className="flex items-center gap-2 text-sm font-medium text-secondary">
          <input
            type="checkbox"
            checked={v.ativo}
            onChange={(e) => set("ativo", e.target.checked)}
            className="size-4 rounded border-input"
          />
          Ativo
        </label>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => onSalvar({ ...v, nome: v.nome.trim() })}
          disabled={!valido || salvando}
        >
          <Check className="size-4" /> {modoEdicao ? "Salvar alterações" : "Salvar profissional"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
