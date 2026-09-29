import { useState } from "react";
import { toast } from "sonner";
import { PenLine, Save, Trash2 } from "lucide-react";
import {
  CONSEGUE_LABEL,
  DOMINIO_POR_ID,
  MOTIVO_LABEL,
  QUER_LABEL,
  type ItemCatalogo,
  type StatusDominio,
} from "@/lib/autonomia";
import { useDescartarRascunho, useSalvarAvaliacao } from "@/hooks/useAutonomia";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import type {
  AutonomiaAvaliacao,
  MotivoAvaliacaoAutonomia,
  NivelConsegue,
  NivelQuer,
  RespostaItemAutonomia,
} from "@/types/database";

const inputBase =
  "w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Formulário da avaliação de autonomia de UM domínio. Salva rascunho à vontade;
 * ao assinar, a avaliação fica imutável (a próxima é reavaliação). Numa
 * reavaliação, começa com as respostas da última assinada, para revisar só o
 * que mudou.
 */
export function AvaliacaoAutonomiaForm({
  residenteId,
  status,
}: {
  residenteId: string;
  status: StatusDominio;
}) {
  const def = DOMINIO_POR_ID.get(status.dominio)!;
  const salvar = useSalvarAvaliacao();
  const descartar = useDescartarRascunho();
  const base = status.rascunho ?? status.ultima;
  const [itens, setItens] = useState<Record<string, RespostaItemAutonomia>>(() => ({ ...(base?.itens ?? {}) }));
  const [sintese, setSintese] = useState(status.rascunho?.sintese ?? "");
  const motivoInicial: MotivoAvaliacaoAutonomia =
    status.rascunho?.motivo ?? (status.ultima ? status.motivo ?? "outro" : "entrada");
  const [motivo, setMotivo] = useState<MotivoAvaliacaoAutonomia>(motivoInicial);
  const [confirmarAssinatura, setConfirmarAssinatura] = useState(false);

  const mudar = (chave: string, patch: Partial<RespostaItemAutonomia>) =>
    setItens((prev) => ({ ...prev, [chave]: { ...prev[chave], ...patch } }));

  function gravar(assinar: boolean) {
    salvar.mutate(
      { rascunhoId: status.rascunho?.id ?? null, residenteId, dominio: status.dominio, motivo, itens, sintese, assinar },
      {
        onSuccess: () => toast.success(assinar ? "Avaliação assinada." : "Rascunho salvo."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PenLine className="size-4 text-primary" /> {def.quemAvalia} · {def.rotulo}
          {status.rascunho && <Badge variant="warning">rascunho</Badge>}
        </CardTitle>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as MotivoAvaliacaoAutonomia)}
          className={cn(inputBase, "h-9 w-auto")}
          aria-label="Motivo da avaliação"
        >
          {(Object.keys(MOTIVO_LABEL) as MotivoAvaliacaoAutonomia[]).map((m) => (
            <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Registre o que a pessoa <strong>quer</strong> e o que <strong>consegue</strong> fazer por si. Marque "a equipe faz por rapidez"
          quando ela consegue, mas a tarefa vem sendo feita pela equipe só para ganhar tempo. Itens em branco não contam.
        </p>
        {def.itens.map((item) => (
          <LinhaItem key={item.chave} item={item} valor={itens[item.chave] ?? {}} onChange={(p) => mudar(item.chave, p)} />
        ))}
        <div>
          <label className="mb-1 block text-sm font-semibold text-secondary">Síntese (opcional)</label>
          <textarea
            value={sintese}
            onChange={(e) => setSintese(e.target.value)}
            rows={2}
            placeholder="O que mais importa para esta pessoa neste domínio"
            className={cn(inputBase, "py-2")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfirmarAssinatura(true)} disabled={salvar.isPending} loading={salvar.isPending}>
            <PenLine className="size-4" /> Assinar avaliação
          </Button>
          <Button variant="outline" onClick={() => gravar(false)} disabled={salvar.isPending}>
            <Save className="size-4" /> Salvar rascunho
          </Button>
          {status.rascunho && (
            <Button
              variant="ghost"
              onClick={() =>
                descartar.mutate(status.rascunho!.id, {
                  onSuccess: () => toast.success("Rascunho descartado."),
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível descartar."),
                })
              }
              disabled={descartar.isPending}
            >
              <Trash2 className="size-4" /> Descartar rascunho
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        aberto={confirmarAssinatura}
        titulo="Assinar esta avaliação?"
        descricao="Depois de assinada, ela não pode ser alterada. Mudanças futuras entram como reavaliação."
        textoConfirmar="Sim, assinar"
        textoCancelar="Voltar"
        varianteConfirmar="default"
        onConfirmar={() => {
          setConfirmarAssinatura(false);
          gravar(true);
        }}
        onCancelar={() => setConfirmarAssinatura(false)}
      />
    </Card>
  );
}

function Opcoes<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Record<T, string>;
  valor: T | null | undefined;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(opcoes) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(valor === k ? null : k)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold transition-colors",
            valor === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50",
          )}
        >
          {opcoes[k]}
        </button>
      ))}
    </div>
  );
}

function LinhaItem({
  item,
  valor,
  onChange,
}: {
  item: ItemCatalogo;
  valor: RespostaItemAutonomia;
  onChange: (p: Partial<RespostaItemAutonomia>) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-sm font-semibold text-secondary">{item.rotulo}</p>
      {item.tipo === "texto" ? (
        <textarea
          value={valor.obs ?? ""}
          onChange={(e) => onChange({ obs: e.target.value })}
          rows={2}
          className={cn(inputBase, "py-2")}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {item.tipo === "completo" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quer?</span>
                <Opcoes<NivelQuer> opcoes={QUER_LABEL} valor={valor.quer} onChange={(v) => onChange({ quer: v })} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Consegue?</span>
              <Opcoes<NivelConsegue> opcoes={CONSEGUE_LABEL} valor={valor.consegue} onChange={(v) => onChange({ consegue: v })} />
            </div>
          </div>
          {item.tipo === "completo" ? (
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={valor.preferencia ?? ""}
                onChange={(e) => onChange({ preferencia: e.target.value })}
                placeholder="Preferência dele(a), em uma linha"
                className={cn(inputBase, "h-9 min-w-[220px] flex-1")}
              />
              <label className="flex items-center gap-1.5 text-xs text-secondary">
                <input
                  type="checkbox"
                  checked={!!valor.equipe_assume}
                  onChange={(e) => onChange({ equipe_assume: e.target.checked })}
                />
                A equipe faz por rapidez
              </label>
            </div>
          ) : (
            <input
              value={valor.obs ?? ""}
              onChange={(e) => onChange({ obs: e.target.value })}
              placeholder="Observação"
              className={cn(inputBase, "h-9")}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Leitura de uma avaliação assinada (os outros domínios, ou a própria). */
export function AvaliacaoAutonomiaLeitura({ avaliacao }: { avaliacao: AutonomiaAvaliacao }) {
  const def = DOMINIO_POR_ID.get(avaliacao.dominio)!;
  const itens = def.itens.filter((i) => avaliacao.itens?.[i.chave]);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {MOTIVO_LABEL[avaliacao.motivo]} · assinada por {avaliacao.assinada_por ?? "—"} em{" "}
        {avaliacao.assinada_em ? formatarDataHoraBR(avaliacao.assinada_em) : formatarDataBR(avaliacao.criado_em.slice(0, 10))}
      </p>
      {avaliacao.sintese && <p className="text-sm text-secondary">{avaliacao.sintese}</p>}
      <div className="divide-y rounded-lg border">
        {itens.map((i) => {
          const r = avaliacao.itens[i.chave];
          return (
            <div key={i.chave} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-[200px] flex-1 font-medium text-secondary">{i.rotulo}</span>
              {r.quer && <Badge variant="muted">{QUER_LABEL[r.quer]}</Badge>}
              {r.consegue && <Badge variant={r.consegue === "sozinho" ? "success" : "muted"}>{CONSEGUE_LABEL[r.consegue]}</Badge>}
              {r.equipe_assume && <Badge variant="warning">equipe faz por rapidez</Badge>}
              {(r.preferencia || r.obs) && <span className="w-full text-xs text-muted-foreground">{r.preferencia ?? r.obs}</span>}
            </div>
          );
        })}
        {itens.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Sem itens preenchidos.</p>}
      </div>
    </div>
  );
}
