/**
 * Atendimentos a precificar — Administração.
 *
 * Lista os atendimentos individuais (Fisio/TO/EF) por hóspede e mês. Para cada
 * seleção, a Administração: NÃO COBRA (inclui no pacote), COBRA INDIVIDUAL (1
 * sessão) ou AGRUPA EM PACOTE (várias sessões do mesmo hóspede num único
 * lançamento). A cobrança gera UM lançamento no UPSELLING existente (categoria
 * conforme o tipo), sem duplicar — aparece no demonstrativo da Administração e
 * da Família.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Ban,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useAtendimentosTodos,
  useNaoCobrarAtendimentos,
  useCobrarAtendimentos,
} from "@/hooks/useAtendimentoIndividual";
import {
  TIPO_ATENDIMENTO_LABEL,
  categoriaUpsellingDoTipo,
} from "@/lib/atendimento";
import {
  deslocarMes,
  formatarMesReferencia,
  formatarMoeda,
  mesAtual,
} from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, ouNaoInformado, hojeISO } from "@/lib/utils";
import type { AtendimentoIndividual, CategoriaUpselling } from "@/types/database";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Categoria do lançamento: Fisioterapia avulsa se tudo for fisio; senão Terapia avulsa. */
function categoriaDaSelecao(atends: AtendimentoIndividual[]): CategoriaUpselling {
  return atends.every((a) => a.tipo === "fisioterapia")
    ? "Fisioterapia avulsa"
    : categoriaUpsellingDoTipo(atends[0]?.tipo ?? "terapia_ocupacional");
}

export function AtendimentosPrecificar() {
  const [mes, setMes] = useState(mesAtual());
  const residentes = useResidentes();
  const atendimentos = useAtendimentosTodos();

  const nomePorId = useMemo(
    () => new Map((residentes.data ?? []).map((r) => [r.id, r.nome])),
    [residentes.data],
  );

  const doMes = useMemo(
    () => (atendimentos.data ?? []).filter((a) => a.data.slice(0, 7) === mes),
    [atendimentos.data, mes],
  );

  // Agrupa por hóspede (ordena por nome).
  const grupos = useMemo(() => {
    const m = new Map<string, AtendimentoIndividual[]>();
    for (const a of doMes) {
      const arr = m.get(a.residente_id) ?? [];
      arr.push(a);
      m.set(a.residente_id, arr);
    }
    return [...m.entries()].sort((a, b) =>
      (nomePorId.get(a[0]) ?? "").localeCompare(nomePorId.get(b[0]) ?? "", "pt-BR"),
    );
  }, [doMes, nomePorId]);

  if (residentes.isLoading || atendimentos.isLoading) return <LoadingState />;
  if (atendimentos.isError) return <ErrorState error={atendimentos.error} />;

  const totalMes = doMes.length;
  const pendentes = doMes.filter((a) => a.status_cobranca === "pendente_avaliacao").length;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Stethoscope className="size-3.5" /> Atendimentos individuais
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Atendimentos a precificar</h1>
        </div>
      </div>

      {/* Navegação de mês */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <Button variant="outline" size="icon" onClick={() => setMes((m) => deslocarMes(m, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-bold text-secondary">{formatarMesReferencia(mes)}</span>
          <Button variant="outline" size="icon" onClick={() => setMes((m) => deslocarMes(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Stethoscope} tom="secondary" rotulo="Atendimentos no mês" valor={totalMes} />
        <StatCard
          icon={Receipt}
          tom={pendentes > 0 ? "warning" : "success"}
          destaque={pendentes > 0}
          rotulo="Pendentes de avaliação"
          valor={pendentes}
        />
      </div>

      {grupos.length === 0 ? (
        <EmptyState label="Nenhum atendimento individual neste mês." />
      ) : (
        <div className="space-y-4">
          {grupos.map(([residenteId, atends]) => (
            <GrupoHospede
              key={residenteId}
              residenteId={residenteId}
              nome={nomePorId.get(residenteId) ?? "Não informado"}
              atendimentos={atends}
              mes={mes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GrupoHospede({
  residenteId,
  nome,
  atendimentos,
  mes,
}: {
  residenteId: string;
  nome: string;
  atendimentos: AtendimentoIndividual[];
  mes: string;
}) {
  const naoCobrar = useNaoCobrarAtendimentos();
  const cobrar = useCobrarAtendimentos();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [valor, setValor] = useState("");

  const pendentes = atendimentos.filter((a) => a.status_cobranca === "pendente_avaliacao");
  const resolvidos = atendimentos.length - pendentes.length;
  const selecionadosAtends = pendentes.filter((a) => selecionados.has(a.id));

  const descricaoSugerida = useMemo(() => {
    const n = selecionadosAtends.length;
    if (n === 0) return "";
    const tipoUnico = new Set(selecionadosAtends.map((a) => a.tipo));
    const rotuloTipo =
      tipoUnico.size === 1
        ? TIPO_ATENDIMENTO_LABEL[selecionadosAtends[0].tipo]
        : "terapia";
    return `${n} sessão${n > 1 ? "ões" : ""} de ${rotuloTipo} — ${formatarMesReferencia(mes)}`;
  }, [selecionadosAtends, mes]);

  const [descricao, setDescricao] = useState("");
  const descricaoFinal = descricao.trim() || descricaoSugerida;

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCobrar() {
    const valorNum = Number(valor.replace(",", "."));
    if (selecionadosAtends.length === 0 || !Number.isFinite(valorNum) || valorNum <= 0) {
      toast.error("Selecione atendimentos e informe um valor válido.");
      return;
    }
    try {
      const dataLanc = selecionadosAtends
        .map((a) => a.data)
        .sort()
        .at(-1) ?? hojeISO();
      await cobrar.mutateAsync({
        ids: selecionadosAtends.map((a) => a.id),
        residenteId,
        categoria: categoriaDaSelecao(selecionadosAtends),
        descricao: descricaoFinal,
        valor: valorNum,
        data: dataLanc,
        mesReferencia: mes,
      });
      toast.success("Cobrança gerada no upselling.");
      setSelecionados(new Set());
      setValor("");
      setDescricao("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cobrar.");
    }
  }

  async function handleNaoCobrar() {
    if (selecionadosAtends.length === 0) return;
    try {
      await naoCobrar.mutateAsync({ ids: selecionadosAtends.map((a) => a.id) });
      toast.success("Atendimentos marcados como inclusos (não cobrar).");
      setSelecionados(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>{nome}</span>
          <span className="flex items-center gap-2 text-xs font-normal">
            <Badge variant={pendentes.length > 0 ? "warning" : "muted"}>
              {pendentes.length} pendente(s)
            </Badge>
            {resolvidos > 0 && <Badge variant="muted">{resolvidos} resolvido(s)</Badge>}
            <span className="text-muted-foreground">· {atendimentos.length} no mês</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tudo avaliado neste mês.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {pendentes.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    selecionados.has(a.id) ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{TIPO_ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}</Badge>
                      <span className="text-sm font-semibold text-secondary">{formatarDataBR(a.data)}</span>
                      <span className="text-xs text-muted-foreground">· {ouNaoInformado(a.realizado_por)}</span>
                    </span>
                    {a.evolucao && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{a.evolucao}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {/* Ações para a seleção */}
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {selecionadosAtends.length} selecionado(s)
                {selecionadosAtends.length > 1 ? " · será um pacote (1 lançamento)" : ""}
              </p>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={descricaoSugerida || "Descrição do lançamento"}
                className={cn(inputBase, "w-full")}
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                    className={cn(inputBase, "w-28")}
                  />
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={selecionadosAtends.length === 0 || cobrar.isPending}
                  onClick={handleCobrar}
                >
                  <Receipt className="size-4" />
                  {valor ? `Cobrar ${formatarMoeda(Number(valor.replace(",", ".")))}` : "Cobrar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={selecionadosAtends.length === 0 || naoCobrar.isPending}
                  onClick={handleNaoCobrar}
                >
                  <Ban className="size-4" /> Não cobrar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
