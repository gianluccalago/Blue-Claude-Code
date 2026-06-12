/**
 * Pedidos mensais — Farmácia
 *
 * A farmácia interna seleciona hóspedes e EXTRAI as receitas em lote (PDF →
 * ZIP) para enviar à farmácia externa e comprar a caixinha do mês.
 *
 * AUTORIA: receita é documento MÉDICO — cada PDF sai assinado pelo MÉDICO
 * PRESCRITOR registrado na prescrição, nunca pela Farmácia. Hóspede com
 * prescrições de médicos diferentes gera um PDF por médico. Prescrição sem
 * médico identificado bloqueia a emissão daquele hóspede.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileDown,
  Loader2,
  CheckSquare,
  Square,
  Stethoscope,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { fetchPrescricoesAtivasAgrupadas } from "@/hooks/useMedico";
import {
  useResidentesComPrescricao,
  usePrescritoresPorResidente,
} from "@/hooks/useFarmaciaMedicamentos";
import { MSG_SEM_MEDICO, PrescricaoSemMedicoError } from "@/lib/exportPrescricao";
import {
  exportarReceitasLoteZip,
  exportarReceitaUnica,
  type ItemReceita,
  type FalhaReceita,
} from "@/lib/exportReceitasLote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";

export function PedidosMensais() {
  const residentes = useResidentes();
  const comPrescricao = useResidentesComPrescricao();
  const prescritores = usePrescritoresPorResidente();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);

  // IDs elegíveis (com prescrição ativa) — base do "selecionar todos".
  const elegiveis = useMemo(() => {
    const set = comPrescricao.data ?? new Set<string>();
    return (residentes.data ?? []).filter((r) => set.has(r.id));
  }, [residentes.data, comPrescricao.data]);

  if (residentes.isLoading || comPrescricao.isLoading || prescritores.isLoading)
    return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (comPrescricao.isError) return <ErrorState error={comPrescricao.error} />;
  if (prescritores.isError) return <ErrorState error={prescritores.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const lista = residentes.data;
  const comPresc = comPrescricao.data ?? new Set<string>();
  const mapaPrescritores = prescritores.data ?? new Map();

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionados(new Set(elegiveis.map((r) => r.id)));
  }
  function limpar() {
    setSelecionados(new Set());
  }

  // Alvos válidos: selecionados E com prescrição ativa.
  const alvos = lista.filter((r) => selecionados.has(r.id) && comPresc.has(r.id));

  function descreverFalhas(falhas: FalhaReceita[]): string {
    return falhas.map((f) => `${f.hospede} (${f.motivo})`).join("; ");
  }

  async function gerar() {
    if (alvos.length === 0) {
      toast.error("Selecione ao menos um hóspede com prescrição ativa.");
      return;
    }
    setGerando(true);
    try {
      // Busca as prescrições de cada hóspede; falha de um não derruba o lote.
      const itens: ItemReceita[] = [];
      const falhasBusca: FalhaReceita[] = [];
      for (const hospede of alvos) {
        try {
          const grupos = await fetchPrescricoesAtivasAgrupadas(hospede.id);
          if (grupos.length === 0) {
            falhasBusca.push({ hospede: hospede.nome, motivo: "sem prescrição ativa" });
            continue;
          }
          itens.push({ hospede, grupos });
        } catch {
          falhasBusca.push({ hospede: hospede.nome, motivo: "erro ao buscar prescrições" });
        }
      }

      if (itens.length === 0) {
        toast.error("Não foi possível gerar nenhuma receita.");
        return;
      }

      // Uma única receita a extrair → baixa o(s) PDF(s) direto (sem zipar).
      if (itens.length === 1) {
        try {
          const n = await exportarReceitaUnica(itens[0]);
          toast.success(
            n > 1
              ? `${n} receitas de ${itens[0].hospede.nome} geradas (uma por médico prescritor).`
              : `Receita de ${itens[0].hospede.nome} gerada.`,
          );
        } catch (e) {
          toast.error(
            e instanceof PrescricaoSemMedicoError ? MSG_SEM_MEDICO : "Não foi possível gerar a receita.",
          );
        }
        return;
      }

      const res = await exportarReceitasLoteZip(itens);
      const falhas = [...falhasBusca, ...res.falhas];
      if (res.gerados === 0) {
        toast.error(
          falhas.length > 0
            ? `Nenhuma receita gerada. ${descreverFalhas(falhas)}`
            : "Não foi possível gerar nenhuma receita.",
        );
      } else if (falhas.length > 0) {
        toast.warning(`${res.gerados} receita(s) no ZIP. Falharam: ${descreverFalhas(falhas)}.`);
      } else {
        toast.success(`${res.gerados} receita(s) geradas no arquivo .zip.`);
      }
    } catch {
      toast.error("Erro ao gerar as receitas. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  const totalElegiveis = elegiveis.length;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <FileText className="size-3.5" /> Emissão em lote
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Pedidos mensais</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">
            Selecione os hóspedes e extraia as receitas (PDF) para enviar à farmácia externa.
            Cada receita sai assinada pelo médico que a prescreveu.
          </p>
        </div>
      </div>

      {/* Autoria das receitas */}
      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <Stethoscope className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-sm text-secondary">
            <span className="font-semibold">Quem assina:</span> a receita é documento médico — cada
            PDF sai assinado pelo <span className="font-semibold">médico prescritor</span> da
            prescrição (indicado em cada hóspede abaixo). A Farmácia apenas extrai o documento.
          </p>
        </CardContent>
      </Card>

      {/* Seleção */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Hóspedes ({lista.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selecionarTodos} disabled={totalElegiveis === 0}>
              <CheckSquare className="size-4" /> Selecionar todos ({totalElegiveis})
            </Button>
            <Button variant="ghost" size="sm" onClick={limpar} disabled={selecionados.size === 0}>
              <Square className="size-4" /> Limpar seleção
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.map((r) => {
            const temPresc = comPresc.has(r.id);
            const marcado = selecionados.has(r.id);
            const presc = mapaPrescritores.get(r.id);
            return (
              <label
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  temPresc
                    ? "cursor-pointer border-border/70 bg-card hover:border-primary/40"
                    : "cursor-not-allowed border-border/50 bg-muted/40",
                  marcado && "border-primary/50 bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={marcado}
                  disabled={!temPresc}
                  onChange={() => toggle(r.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-secondary">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Quarto {ouNaoInformado(r.quarto)}
                    {temPresc && presc && presc.nomes.length > 0 && (
                      <>
                        {" · "}
                        <span className="font-medium text-secondary/80">
                          Assina: Dr(a). {presc.nomes.join(" · Dr(a). ")}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {temPresc ? (
                  presc?.semMedico ? (
                    <span title={MSG_SEM_MEDICO}>
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" /> Sem médico responsável
                      </Badge>
                    </span>
                  ) : presc && presc.nomes.length > 1 ? (
                    <Badge variant="secondary">{presc.nomes.length} médicos · {presc.nomes.length} PDFs</Badge>
                  ) : (
                    <Badge variant="secondary">Com prescrição</Badge>
                  )
                ) : (
                  <Badge variant="muted">Sem prescrição</Badge>
                )}
              </label>
            );
          })}
        </CardContent>
      </Card>

      {/* Ação fixa de gerar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/40 glass p-4 shadow-lifted">
        <p className="text-sm font-semibold text-secondary">
          {alvos.length === 0
            ? "Nenhum hóspede selecionado"
            : `${alvos.length} hóspede(s) selecionado(s) com prescrição`}
        </p>
        <Button size="lg" onClick={gerar} disabled={gerando || alvos.length === 0}>
          {gerando ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
          {gerando
            ? "Gerando…"
            : alvos.length === 1
              ? "Gerar receita (PDF)"
              : "Gerar receitas (ZIP)"}
        </Button>
      </div>
    </div>
  );
}
