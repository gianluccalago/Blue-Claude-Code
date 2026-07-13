/**
 * Tabela de preços — Administração (BLOCO Adm1)
 *
 * Valores de referência por tipo de suíte × grau de dependência × ocupação (27
 * combinações). Cada combinação tem um HISTÓRICO de preços por VIGÊNCIA: cada
 * preço vale "a partir de tal data". O preço vigente numa data é o de maior data
 * de vigência ≤ data consultada (ver `precoVigenteEm`).
 *
 * Mudar um preço CRIA uma nova vigência (não sobrescreve) — o histórico fica
 * preservado. O reajuste afeta SOMENTE NOVOS CONTRATOS: a mensalidade sugerida de
 * um hóspede usa o preço vigente na data de ENTRADA dele. Residentes atuais NÃO
 * são reajustados automaticamente (cada um mantém `mensalidade_valor` manual).
 *
 * Auditoria: além da vigência (regra de cobrança), cada mudança grava em
 * `log_alteracao` quem alterou / quando / de→para / motivo — as duas coisas
 * COEXISTEM sem duplicar (vigência = o quê/desde quando; log = quem/quando/por quê).
 *
 * Edição é do Master e da Direção (a Administração vê em leitura); a trava real
 * está na RLS.
 */
import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  History,
  Lock,
} from "lucide-react";
import { useDefinirPrecoVigencia, useTabelaPreco } from "@/hooks/useMensalidades";
import {
  GRAUS,
  TIPOS_SUITE,
  OCUPACAO_LABEL,
  ocupacoesValidas,
  chavePreco,
  precoVigenteEm,
  hojeISO,
  formatarMoeda,
} from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { formatarDataBR } from "@/lib/utils";
import type { GrauDependencia, Ocupacao, TabelaPreco, TipoSuite } from "@/types/database";

function extrairErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro desconhecido ao salvar.";
}

export function TabelaPrecos() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const podeEditar = perfil === "master" || perfil === "direcao";
  const { data, isLoading, isError, error } = useTabelaPreco();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;

  const hoje = hojeISO();
  const todas = data ?? [];
  // Agrupa as vigências por combinação (chave tipo × grau × ocupação).
  const porCombinacao = new Map<string, TabelaPreco[]>();
  for (const p of todas) {
    const chave = chavePreco(p.tipo_suite, p.grau, p.ocupacao);
    const arr = porCombinacao.get(chave) ?? [];
    arr.push(p);
    porCombinacao.set(chave, arr);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5 text-primary" />
            Tabela de preços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!podeEditar && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                Somente leitura. A edição da tabela de preços é do <strong>Master</strong> e da{" "}
                <strong>Direção</strong>; a Administração continua usando estes valores nas mensalidades.
              </span>
            </div>
          )}

          {TIPOS_SUITE.map((tipo) => (
            <div key={tipo} className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-bold text-secondary">{tipo}</p>
              {ocupacoesValidas(tipo).map((ocupacao) => (
                <div key={ocupacao} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {OCUPACAO_LABEL[ocupacao]}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {GRAUS.map((grau) => (
                      <PrecoCombo
                        key={grau}
                        tipo={tipo}
                        grau={grau}
                        ocupacao={ocupacao}
                        vigencias={porCombinacao.get(chavePreco(tipo, grau, ocupacao)) ?? []}
                        hoje={hoje}
                        podeEditar={podeEditar}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Uma combinação tipo × grau × ocupação: preço vigente + histórico/edição ──────

function PrecoCombo({
  tipo,
  grau,
  ocupacao,
  vigencias,
  hoje,
  podeEditar,
}: {
  tipo: TipoSuite;
  grau: GrauDependencia;
  ocupacao: Ocupacao;
  vigencias: TabelaPreco[];
  hoje: string;
  podeEditar: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  // Vigências da combinação, mais recente primeiro.
  const ordenadas = [...vigencias].sort((a, b) =>
    b.vigente_a_partir_de.localeCompare(a.vigente_a_partir_de),
  );
  const vigenteValor = precoVigenteEm(vigencias, tipo, grau, ocupacao, hoje);
  // A vigência VIGENTE é a de maior data ≤ hoje (primeira ≤ hoje na lista desc).
  const dataVigente = ordenadas.find((v) => v.vigente_a_partir_de <= hoje)?.vigente_a_partir_de ?? null;
  const temAgendado = ordenadas.some((v) => v.vigente_a_partir_de > hoje);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Grau {grau}</label>
      <div className="rounded-md border border-input bg-card p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tabular-nums text-secondary">
            {vigenteValor !== null ? formatarMoeda(vigenteValor) : "—"}
          </span>
          {temAgendado && (
            <Badge variant="warning" className="gap-1">
              <Clock className="size-3" /> agendado
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
        >
          <History className="size-3.5" /> {aberto ? "Fechar" : podeEditar ? "Histórico / novo preço" : "Histórico"}
        </button>

        {aberto && (
          <div className="mt-2 space-y-3 border-t border-border/60 pt-2">
            <HistoricoVigencias ordenadas={ordenadas} hoje={hoje} dataVigente={dataVigente} />
            {podeEditar && (
              <NovaVigenciaForm
                tipo={tipo}
                grau={grau}
                ocupacao={ocupacao}
                valorAnteriorVigente={vigenteValor}
                hoje={hoje}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricoVigencias({
  ordenadas,
  hoje,
  dataVigente,
}: {
  ordenadas: TabelaPreco[];
  hoje: string;
  dataVigente: string | null;
}) {
  if (ordenadas.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem preço cadastrado para esta combinação.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
      <ul className="space-y-1">
        {ordenadas.map((v) => {
          const futuro = v.vigente_a_partir_de > hoje;
          const vigente = v.vigente_a_partir_de === dataVigente;
          return (
            <li
              key={v.id}
              className="flex items-center justify-between gap-2 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
            >
              <span className="tabular-nums font-medium text-secondary">{formatarMoeda(v.valor)}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                desde {formatarDataBR(v.vigente_a_partir_de)}
                {vigente && <Badge variant="success">vigente</Badge>}
                {futuro && (
                  <Badge variant="warning" className="gap-1">
                    <Clock className="size-3" /> agendado
                  </Badge>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NovaVigenciaForm({
  tipo,
  grau,
  ocupacao,
  valorAnteriorVigente,
  hoje,
}: {
  tipo: TipoSuite;
  grau: GrauDependencia;
  ocupacao: Ocupacao;
  valorAnteriorVigente: number | null;
  hoje: string;
}) {
  const definir = useDefinirPrecoVigencia();
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setErro(null);
    setOk(false);
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    // Vigência não pode ser retroativa (hoje ou futuro) — evita reescrever o passado.
    if (data < hoje) {
      setErro("A vigência deve ser hoje ou uma data futura.");
      return;
    }
    try {
      await definir.mutateAsync({
        tipoSuite: tipo,
        grau,
        ocupacao,
        valor: v,
        vigenteAPartirDe: data,
        valorAnteriorVigente,
        motivo: motivo.trim() || null,
      });
      setOk(true);
      setValor("");
      setMotivo("");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  const inputBase =
    "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Novo preço (vigência)</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setOk(false);
            }}
            placeholder={valorAnteriorVigente !== null ? String(valorAnteriorVigente) : "0,00"}
            className={inputBase}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">A partir de</label>
          <input
            type="date"
            value={data}
            min={hoje}
            onChange={(e) => {
              setData(e.target.value);
              setOk(false);
            }}
            className={inputBase}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Motivo (opcional)</label>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: reajuste anual, IPCA…"
          className={inputBase}
        />
      </div>

      {erro && (
        <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" /> {erro}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-xs text-success">
          <CheckCircle2 className="size-3.5 shrink-0" /> Vigência salva.
        </div>
      )}

      <Button size="sm" className="w-full" onClick={salvar} disabled={definir.isPending}>
        {definir.isPending ? "Salvando…" : "Salvar vigência"}
      </Button>
    </div>
  );
}
