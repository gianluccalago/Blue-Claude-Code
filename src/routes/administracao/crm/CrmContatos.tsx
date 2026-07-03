import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Contact, Plus, Search, ShieldCheck, X, ArrowRight } from "lucide-react";
import {
  useContatosCrm,
  useSalvarContato,
  type ContatoComOportunidades,
  type SalvarContatoInput,
} from "@/hooks/useCrm";
import { RELACOES, BASE_LEGAL_LABEL } from "@/lib/crm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ouNaoInformado, cn } from "@/lib/utils";
import { CrmNav } from "./CrmNav";
import type { GrauDependencia } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelBase = "mb-1.5 block text-sm font-semibold text-secondary";

type BaseLegal = SalvarContatoInput["baseLegal"];

export function CrmContatos() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const contatos = useContatosCrm();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<ContatoComOportunidades | "novo" | null>(null);

  const lista = contatos.data ?? [];
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.nome_idoso ?? "").toLowerCase().includes(q) ||
        c.telefones.some((t) => t.toLowerCase().includes(q)),
    );
  }, [lista, busca]);

  if (contatos.isLoading) return <LoadingState />;
  if (contatos.isError) return <ErrorState error={contatos.error} />;

  return (
    <div className="space-y-5">
      <CrmNav ativa="crm-contatos" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Contact className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Contatos</h1>
            <p className="text-sm text-muted-foreground">{lista.length} contato(s) — famílias que decidem</p>
          </div>
        </div>
        <Button onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo contato
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, idoso ou telefone…"
          className={cn(inputBase, "pl-9")}
        />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState label="Nenhum contato encontrado." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map((c) => (
              <LinhaContato key={c.id} c={c} base={base} onEditar={() => setEditando(c)} />
            ))}
          </CardContent>
        </Card>
      )}

      {editando && (
        <ContatoModal
          contato={editando === "novo" ? null : editando}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function LinhaContato({
  c,
  base,
  onEditar,
}: {
  c: ContatoComOportunidades;
  base: string;
  onEditar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-secondary">{c.nome}</span>
          {c.relacao && <Badge variant="muted">{c.relacao}</Badge>}
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="size-3" /> {BASE_LEGAL_LABEL[c.base_legal_lgpd]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {ouNaoInformado(c.telefones[0])}
          {" · idoso: "}
          {ouNaoInformado(c.nome_idoso)}
          {c.oportunidades.length > 0 && (
            <>
              {" · "}
              {c.oportunidades.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ", "}
                  <Link
                    to={`${base}/crm-oportunidade` as string}
                    search={{ id: o.id }}
                    className="text-primary hover:underline"
                  >
                    {o.nome} <ArrowRight className="inline size-3" />
                  </Link>
                </span>
              ))}
            </>
          )}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onEditar}>
        Editar
      </Button>
    </div>
  );
}

function ContatoModal({
  contato,
  onClose,
}: {
  contato: ContatoComOportunidades | null;
  onClose: () => void;
}) {
  const salvar = useSalvarContato();
  const [nome, setNome] = useState(contato?.nome ?? "");
  const [telefones, setTelefones] = useState((contato?.telefones ?? []).join(", "));
  const [emails, setEmails] = useState((contato?.emails ?? []).join(", "));
  const [relacao, setRelacao] = useState(contato?.relacao ?? "Filho(a)");
  const [nomeIdoso, setNomeIdoso] = useState(contato?.nome_idoso ?? "");
  const [idadeIdoso, setIdadeIdoso] = useState(contato?.idade_idoso?.toString() ?? "");
  const [grau, setGrau] = useState<GrauDependencia | "">(contato?.grau_estimado ?? "");
  const [baseLegal, setBaseLegal] = useState<BaseLegal>(contato?.base_legal_lgpd ?? "nao_definida");
  const [observacoes, setObservacoes] = useState(contato?.observacoes ?? "");
  const [erro, setErro] = useState<string | null>(null);

  function listaDeTexto(t: string): string[] {
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function onSalvar() {
    setErro(null);
    if (nome.trim() === "") {
      setErro("Informe o nome do contato.");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: contato?.id,
        nome,
        telefones: listaDeTexto(telefones),
        emails: listaDeTexto(emails),
        relacao: relacao || null,
        nomeIdoso: nomeIdoso.trim() || null,
        idadeIdoso: idadeIdoso.trim() ? Number(idadeIdoso) : null,
        grauEstimado: grau || null,
        baseLegal,
        observacoes: observacoes.trim() || null,
      });
      toast.success(contato ? "Contato atualizado." : "Contato criado.");
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o contato.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-secondary/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-2xl animate-modal-in overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardContent className="space-y-4 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-secondary">{contato ? "Editar contato" : "Novo contato"}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-secondary">
              <X className="size-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelBase}>Nome do responsável *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputBase} placeholder="Ex: João Silva" />
            </div>
            <div>
              <label className={labelBase}>Telefones <span className="font-normal text-muted-foreground">(separe por vírgula)</span></label>
              <input value={telefones} onChange={(e) => setTelefones(e.target.value)} className={inputBase} placeholder="(41) 99999-0000" />
            </div>
            <div>
              <label className={labelBase}>E-mails <span className="font-normal text-muted-foreground">(separe por vírgula)</span></label>
              <input value={emails} onChange={(e) => setEmails(e.target.value)} className={inputBase} placeholder="joao@email.com" />
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
            <div>
              <label className={labelBase}>Idade do idoso</label>
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

          {/* Bloco LGPD — base legal do tratamento de dados pessoais. */}
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
              <ShieldCheck className="size-4 text-primary" /> LGPD — base legal do tratamento
            </div>
            <select value={baseLegal} onChange={(e) => setBaseLegal(e.target.value as BaseLegal)} className={inputBase}>
              {Object.entries(BASE_LEGAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Registre a base legal que autoriza o tratamento dos dados desta família/idoso.
            </p>
          </div>

          <div>
            <label className={labelBase}>Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={cn(inputBase, "h-auto resize-y py-2")} placeholder="Anotações gerais sobre o contato…" />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex gap-2">
            <Button onClick={onSalvar} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={salvar.isPending}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
