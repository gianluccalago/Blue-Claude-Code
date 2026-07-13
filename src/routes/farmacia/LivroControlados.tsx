import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookLock,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Undo2,
  FileSearch,
} from "lucide-react";
import { usuarioAtual } from "@/auth/usuarioAtual";
import {
  useAssentosControlados,
  useRegistrarAssento,
  useVerificarIntegridade,
  type IntegridadeLivro,
} from "@/hooks/useLivroControlados";
import { useResidentes } from "@/hooks/usePlanos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, ouNaoInformado } from "@/lib/utils";
import type { AssentoControlado, TipoAssentoControlado } from "@/types/database";

// ===========================================================================
// LIVRO DE REGISTRO DE MEDICAMENTOS SUJEITOS A CONTROLE ESPECIAL (Port. 344/98)
// APPEND-ONLY: assento lançado NÃO pode ser editado nem excluído (trigger +
// RLS + hash encadeado no banco). Correção = ESTORNO como novo assento.
// Escrita: farmácia, master (RT), coordenação, enfermeira. Leitura: + médico,
// direção (a RPC nega escrita aos demais mesmo que a UI seja contornada).
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const PERFIS_ESCRITA = ["farmacia", "master", "coordenacao", "enfermeira"];

const TIPO_LABEL: Record<TipoAssentoControlado, string> = {
  entrada: "Entrada",
  dispensacao: "Dispensação",
  administracao: "Administração",
  perda: "Perda",
  vencimento: "Vencimento",
  estorno: "Estorno",
};

const TIPO_VARIANTE: Record<TipoAssentoControlado, "success" | "default" | "purple" | "warning" | "destructive" | "muted"> = {
  entrada: "success",
  dispensacao: "default",
  administracao: "purple",
  perda: "destructive",
  vencimento: "warning",
  estorno: "muted",
};

export function LivroControlados() {
  const assentos = useAssentosControlados();
  const residentes = useResidentes();
  const verificar = useVerificarIntegridade();
  const [integridade, setIntegridade] = useState<IntegridadeLivro | null>(null);
  const [novo, setNovo] = useState(false);
  const [estornoDe, setEstornoDe] = useState<AssentoControlado | null>(null);
  const [filtroMed, setFiltroMed] = useState("");

  const podeEscrever = PERFIS_ESCRITA.includes(usuarioAtual.perfil);

  const nomeResidente = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of residentes.data ?? []) mapa.set(r.id, r.nome);
    return mapa;
  }, [residentes.data]);

  const lista = useMemo(() => {
    const todos = assentos.data ?? [];
    const filtro = filtroMed.trim().toUpperCase();
    return filtro ? todos.filter((a) => a.medicamento.includes(filtro)) : todos;
  }, [assentos.data, filtroMed]);

  if (assentos.isLoading || residentes.isLoading) return <LoadingState />;
  if (assentos.isError) return <ErrorState error={assentos.error} />;

  // Assentos já estornados (para esconder o botão de estorno duplicado).
  const estornados = new Set((assentos.data ?? []).filter((a) => a.tipo_assento === "estorno").map((a) => a.referencia_numero));

  async function rodarVerificacao() {
    try {
      const r = await verificar.mutateAsync();
      setIntegridade(r);
      if (r.integro) toast.success(`Cadeia íntegra — ${r.total_assentos} assentos verificados.`);
      else toast.error(`ADULTERAÇÃO DETECTADA no assento nº ${r.primeiro_numero_violado}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível verificar a integridade.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <BookLock className="size-6 text-primary" /> Livro de controlados
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={rodarVerificacao} loading={verificar.isPending}>
            <FileSearch className="size-4" /> Verificar integridade
          </Button>
          {podeEscrever && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="size-4" /> Novo assento
            </Button>
          )}
        </div>
      </div>

      {/* Resultado da verificação */}
      {integridade && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3",
            integridade.integro ? "border-success/40 bg-success/5" : "border-destructive/60 bg-destructive/10",
          )}
        >
          {integridade.integro ? (
            <>
              <ShieldCheck className="size-5 shrink-0 text-success" />
              <p className="text-sm font-semibold text-secondary">
                Cadeia de integridade verificada — {integridade.total_assentos} assentos, nenhuma adulteração.
              </p>
            </>
          ) : (
            <>
              <ShieldAlert className="size-5 shrink-0 text-destructive" />
              <p className="text-sm font-bold text-destructive">
                ADULTERAÇÃO DETECTADA a partir do assento nº {integridade.primeiro_numero_violado}. Comunique o RT imediatamente.
              </p>
            </>
          )}
        </div>
      )}

      {/* Filtro por medicamento */}
      <input
        type="search"
        value={filtroMed}
        onChange={(e) => setFiltroMed(e.target.value)}
        placeholder="Filtrar por medicamento…"
        className={cn(inputBase, "max-w-xs")}
      />

      {/* O livro */}
      {lista.length === 0 ? (
        <EmptyState label={filtroMed ? "Nenhum assento para este medicamento." : "Livro sem assentos — registre a primeira entrada."} />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {lista.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-bold tabular-nums text-secondary">
                  {a.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{a.medicamento}</span>
                    <Badge variant={TIPO_VARIANTE[a.tipo_assento]}>{TIPO_LABEL[a.tipo_assento]}</Badge>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {a.quantidade} {a.unidade}
                    </span>
                    {a.tipo_assento === "estorno" && a.referencia_numero != null && (
                      <span className="text-xs text-muted-foreground">estorna o nº {a.referencia_numero}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.residente_id ? `${ouNaoInformado(nomeResidente.get(a.residente_id))} · ` : ""}
                    {formatarDataHoraBR(a.registrado_em)} · {a.registrado_por} ({a.perfil_registrador})
                    {a.justificativa ? ` · ${a.justificativa}` : ""}
                  </p>
                </div>
                {podeEscrever && a.tipo_assento !== "estorno" && !estornados.has(a.numero) && (
                  <Button size="sm" variant="ghost" onClick={() => setEstornoDe(a)} title="Estornar este assento">
                    <Undo2 className="size-4" /> Estornar
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {novo && <ModalAssento onFechar={() => setNovo(false)} />}
      {estornoDe && <ModalEstorno assento={estornoDe} onFechar={() => setEstornoDe(null)} />}
    </div>
  );
}

/** Novo assento (entrada, dispensação, administração, perda, vencimento). */
function ModalAssento({ onFechar }: { onFechar: () => void }) {
  const registrar = useRegistrarAssento();
  const residentes = useResidentes();
  const [tipo, setTipo] = useState<TipoAssentoControlado>("entrada");
  const [medicamento, setMedicamento] = useState("");
  const [residenteId, setResidenteId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("unidade");
  const [justificativa, setJustificativa] = useState("");

  const precisaJustificativa = tipo === "perda" || tipo === "vencimento";
  const qtd = parseFloat(quantidade.replace(",", "."));
  const podeSalvar =
    medicamento.trim() !== "" && Number.isFinite(qtd) && qtd > 0 && (!precisaJustificativa || justificativa.trim() !== "");

  async function salvar() {
    try {
      const numero = await registrar.mutateAsync({
        residenteId: residenteId || null,
        medicamento,
        tipo,
        quantidade: qtd,
        unidade: unidade.trim() || "unidade",
        justificativa: justificativa.trim() || null,
      });
      toast.success(`Assento nº ${numero} lançado no livro.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar o assento.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Novo assento" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Novo assento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O lançamento é definitivo — confira antes de salvar.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAssentoControlado)} className={inputBase}>
              <option value="entrada">Entrada (compra/recebimento)</option>
              <option value="dispensacao">Dispensação</option>
              <option value="administracao">Administração</option>
              <option value="perda">Perda</option>
              <option value="vencimento">Vencimento</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Medicamento</label>
            <input
              type="text"
              value={medicamento}
              onChange={(e) => setMedicamento(e.target.value)}
              placeholder="Nome como na prescrição"
              className={cn(inputBase, "uppercase")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Hóspede (vazio = estoque da casa)</label>
            <select value={residenteId} onChange={(e) => setResidenteId(e.target.value)} className={inputBase}>
              <option value="">— Estoque da casa —</option>
              {(residentes.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-secondary">Quantidade</label>
              <input type="text" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex.: 30" className={inputBase} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary">Unidade</label>
              <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputBase} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">
              Justificativa{precisaJustificativa ? " (obrigatória)" : ""}
            </label>
            <input type="text" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} className={inputBase} />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} disabled={!podeSalvar || registrar.isPending} loading={registrar.isPending}>
            Lançar no livro
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Estorno de um assento (novo assento espelhando o original). */
function ModalEstorno({ assento, onFechar }: { assento: AssentoControlado; onFechar: () => void }) {
  const registrar = useRegistrarAssento();
  const [justificativa, setJustificativa] = useState("");

  async function salvar() {
    try {
      const numero = await registrar.mutateAsync({
        residenteId: assento.residente_id,
        medicamento: assento.medicamento,
        tipo: "estorno",
        quantidade: assento.quantidade,
        unidade: assento.unidade,
        justificativa,
        referencia: assento.numero,
      });
      toast.success(`Estorno lançado como assento nº ${numero}.`);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o estorno.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Estornar assento" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">Estornar assento nº {assento.numero}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {assento.medicamento} · {assento.quantidade} {assento.unidade} · {TIPO_LABEL[assento.tipo_assento]}.
          O estorno vira um NOVO assento; o original permanece no livro.
        </p>
        <div className="mt-4 space-y-1.5">
          <label className="text-sm font-semibold text-secondary">Justificativa (obrigatória)</label>
          <input
            type="text"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: lançamento em duplicidade"
            className={inputBase}
            autoFocus
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="warning"
            size="lg"
            className="flex-1"
            onClick={salvar}
            disabled={justificativa.trim() === "" || registrar.isPending}
            loading={registrar.isPending}
          >
            Estornar
          </Button>
        </div>
      </div>
    </div>
  );
}
