import { RELACOES_FINANCEIRO } from "@/lib/cobranca";

// Campos do RESPONSÁVEL FINANCEIRO (quem paga — em geral o filho, não o idoso).
// Reutilizado na Ficha do hóspede (Master/Administração) e na tela de
// Mensalidades. Componente "controlado": recebe valor + onChange.

export type RespFinValor = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  relacao: string;
};

export const RESP_FIN_VAZIO: RespFinValor = { nome: "", cpf: "", email: "", telefone: "", relacao: "" };

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelBase = "mb-1.5 block text-sm font-semibold text-secondary";

export function ResponsavelFinanceiroFields({
  valor,
  onChange,
}: {
  valor: RespFinValor;
  onChange: (campo: keyof RespFinValor, valor: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelBase}>Nome do responsável financeiro</label>
        <input
          value={valor.nome}
          onChange={(e) => onChange("nome", e.target.value)}
          className={inputBase}
          placeholder="Quem paga a mensalidade"
        />
      </div>
      <div>
        <label className={labelBase}>Relação com o hóspede</label>
        <select value={valor.relacao} onChange={(e) => onChange("relacao", e.target.value)} className={inputBase}>
          <option value="">Não informado</option>
          {RELACOES_FINANCEIRO.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelBase}>CPF</label>
        <input
          value={valor.cpf}
          onChange={(e) => onChange("cpf", e.target.value)}
          className={inputBase}
          placeholder="000.000.000-00"
        />
      </div>
      <div>
        <label className={labelBase}>E-mail</label>
        <input
          value={valor.email}
          onChange={(e) => onChange("email", e.target.value)}
          className={inputBase}
          placeholder="email@exemplo.com"
        />
      </div>
      <div>
        <label className={labelBase}>Telefone</label>
        <input
          value={valor.telefone}
          onChange={(e) => onChange("telefone", e.target.value)}
          className={inputBase}
          placeholder="(00) 00000-0000"
        />
      </div>
    </div>
  );
}
