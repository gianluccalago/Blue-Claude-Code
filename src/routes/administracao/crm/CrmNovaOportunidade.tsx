import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Star, UserPlus, Users } from "lucide-react";
import { useCrmEtapas, useCrmOrigens, useCrmContatos, useCriarOportunidade } from "@/hooks/useCrm";
import { RELACOES } from "@/lib/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { GrauDependencia } from "@/types/database";

const TIPOS_SUITE = ["Suíte", "Suíte Premium", "Long Stay", "Apartamento"] as const;
const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelBase = "mb-1.5 block text-sm font-semibold text-secondary";

export function CrmNovaOportunidade() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const navigate = useNavigate();

  const etapas = useCrmEtapas();
  const origens = useCrmOrigens();
  const contatos = useCrmContatos();
  const criar = useCriarOportunidade();

  const [modoContato, setModoContato] = useState<"novo" | "existente">("novo");
  const [contatoId, setContatoId] = useState("");
  // novo contato
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [relacao, setRelacao] = useState<string>("Filho(a)");
  const [nomeIdoso, setNomeIdoso] = useState("");
  const [idadeIdoso, setIdadeIdoso] = useState("");
  const [grau, setGrau] = useState<GrauDependencia | "">("");
  // oportunidade
  const [nomeOp, setNomeOp] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [qualificacao, setQualificacao] = useState(3);
  const [valor, setValor] = useState("");
  const [tipoSuite, setTipoSuite] = useState("");
  const [etapa, setEtapa] = useState("Sem contato");
  const [erro, setErro] = useState<string | null>(null);

  if (etapas.isLoading || origens.isLoading) return <LoadingState />;
  if (etapas.isError) return <ErrorState error={etapas.error} />;

  async function salvar() {
    setErro(null);
    if (modoContato === "novo" && nome.trim() === "") {
      setErro("Informe o nome do responsável (família).");
      return;
    }
    if (modoContato === "existente" && !contatoId) {
      setErro("Selecione um contato existente.");
      return;
    }
    try {
      const id = await criar.mutateAsync({
        contatoId: modoContato === "existente" ? contatoId : null,
        novoContato:
          modoContato === "novo"
            ? {
                nome,
                telefone: telefone.trim() || null,
                relacao,
                nomeIdoso: nomeIdoso.trim() || null,
                idadeIdoso: idadeIdoso.trim() ? Number(idadeIdoso) : null,
                grauEstimado: grau || null,
              }
            : null,
        nome: nomeOp.trim() || null,
        origemId: origemId || null,
        qualificacao,
        valorMensalidade: valor.trim() ? Number(valor.replace(",", ".")) : null,
        tipoSuiteInteresse: tipoSuite || null,
        etapa,
      });
      toast.success("Oportunidade criada.");
      navigate({ to: `${base}/crm-oportunidade` as string, search: { id } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a oportunidade.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        onClick={() => navigate({ to: `${base}/crm` as string })}
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" /> Voltar ao pipeline
      </button>

      {/* Contato (família) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contato (família que decide)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex rounded-md border bg-card p-0.5">
            <button
              onClick={() => setModoContato("novo")}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-semibold", modoContato === "novo" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <UserPlus className="size-4" /> Novo contato
            </button>
            <button
              onClick={() => setModoContato("existente")}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-semibold", modoContato === "existente" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <Users className="size-4" /> Contato existente
            </button>
          </div>

          {modoContato === "existente" ? (
            <div>
              <label className={labelBase}>Selecione o contato</label>
              <select value={contatoId} onChange={(e) => setContatoId(e.target.value)} className={inputBase}>
                <option value="">—</option>
                {(contatos.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.nome_idoso ? ` — ${c.nome_idoso}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelBase}>Nome do responsável *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputBase} placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className={labelBase}>Telefone</label>
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputBase} placeholder="(41) 99999-0000" />
              </div>
              <div>
                <label className={labelBase}>Relação com o idoso</label>
                <select value={relacao} onChange={(e) => setRelacao(e.target.value)} className={inputBase}>
                  {RELACOES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelBase}>Nome do idoso (futuro hóspede)</label>
                <input value={nomeIdoso} onChange={(e) => setNomeIdoso(e.target.value)} className={inputBase} placeholder="Ex: D. Maria" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelBase}>Idade</label>
                  <input value={idadeIdoso} onChange={(e) => setIdadeIdoso(e.target.value)} inputMode="numeric" className={inputBase} placeholder="—" />
                </div>
                <div>
                  <label className={labelBase}>Grau estimado</label>
                  <select value={grau} onChange={(e) => setGrau(e.target.value as GrauDependencia | "")} className={inputBase}>
                    <option value="">—</option>
                    <option value="I">Grau I</option>
                    <option value="II">Grau II</option>
                    <option value="III">Grau III</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oportunidade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Oportunidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={labelBase}>Nome da oportunidade <span className="font-normal text-muted-foreground">(opcional — gerado automaticamente)</span></label>
            <input value={nomeOp} onChange={(e) => setNomeOp(e.target.value)} className={inputBase} placeholder='Ex: "Família Silva — D. Maria"' />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelBase}>Origem</label>
              <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} className={inputBase}>
                <option value="">—</option>
                {(origens.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelBase}>Etapa inicial</label>
              <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className={inputBase}>
                {(etapas.data ?? []).map((et) => <option key={et.id} value={et.nome}>{et.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={labelBase}>Valor da mensalidade estimado (R$)</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inputBase} placeholder="0,00" />
            </div>
            <div>
              <label className={labelBase}>Tipo de suíte de interesse</label>
              <select value={tipoSuite} onChange={(e) => setTipoSuite(e.target.value)} className={inputBase}>
                <option value="">—</option>
                {TIPOS_SUITE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelBase}>Qualificação</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setQualificacao(n)} aria-label={`Qualificação ${n}`}>
                  <Star className={cn("size-7 transition-colors", n <= qualificacao ? "fill-warning text-warning" : "text-muted-foreground/40 hover:text-warning/60")} />
                </button>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <Button onClick={salvar} disabled={criar.isPending}>
              {criar.isPending ? "Criando…" : "Criar oportunidade"}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: `${base}/crm` as string })} disabled={criar.isPending}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
