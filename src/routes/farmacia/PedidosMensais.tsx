/**
 * Pedidos mensais — Farmácia (Parte 1)
 *
 * A farmácia interna seleciona hóspedes e emite as receitas em lote (PDF → ZIP)
 * para enviar à farmácia externa e comprar a caixinha do mês. Os PDFs usam o
 * MESMO gerador do Médico (layout idêntico), assinados pelo médico geriatra
 * escolhido. Hóspede sem prescrição ativa não entra no lote (sem PDF vazio).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, CheckSquare, Square, Stethoscope, FileText } from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { fetchPrescricoesAtivasAgrupadas } from "@/hooks/useMedico";
import { useResidentesComPrescricao, useMedicosAssinantes } from "@/hooks/useFarmaciaMedicamentos";
import {
  exportarReceitasLoteZip,
  exportarReceitaUnica,
  type ItemReceita,
} from "@/lib/exportReceitasLote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";

export function PedidosMensais() {
  const residentes = useResidentes();
  const comPrescricao = useResidentesComPrescricao();
  const medicos = useMedicosAssinantes();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [medicoIdx, setMedicoIdx] = useState(0);
  const [gerando, setGerando] = useState(false);

  // IDs elegíveis (com prescrição ativa) — base do "selecionar todos".
  const elegiveis = useMemo(() => {
    const set = comPrescricao.data ?? new Set<string>();
    return (residentes.data ?? []).filter((r) => set.has(r.id));
  }, [residentes.data, comPrescricao.data]);

  if (residentes.isLoading || comPrescricao.isLoading || medicos.isLoading) return <LoadingState />;
  if (residentes.isError) return <ErrorState error={residentes.error} />;
  if (comPrescricao.isError) return <ErrorState error={comPrescricao.error} />;
  if (medicos.isError) return <ErrorState error={medicos.error} />;
  if (!residentes.data || residentes.data.length === 0)
    return <EmptyState label="Nenhum residente cadastrado." />;

  const lista = residentes.data;
  const comPresc = comPrescricao.data ?? new Set<string>();
  const assinantes = medicos.data ?? [];
  const semMedico = assinantes.length === 0;

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

  async function gerar() {
    if (semMedico) {
      toast.error("Nenhum médico geriatra cadastrado para assinar as receitas.");
      return;
    }
    if (alvos.length === 0) {
      toast.error("Selecione ao menos um hóspede com prescrição ativa.");
      return;
    }
    const assinante = assinantes[medicoIdx] ?? assinantes[0];
    setGerando(true);
    try {
      // Busca as prescrições de cada hóspede; falha de um não derruba o lote.
      const itens: ItemReceita[] = [];
      const falhasBusca: string[] = [];
      for (const hospede of alvos) {
        try {
          const grupos = await fetchPrescricoesAtivasAgrupadas(hospede.id);
          if (grupos.length === 0) {
            falhasBusca.push(hospede.nome);
            continue;
          }
          itens.push({ hospede, grupos });
        } catch {
          falhasBusca.push(hospede.nome);
        }
      }

      if (itens.length === 0) {
        toast.error("Não foi possível gerar nenhuma receita.");
        return;
      }

      // Uma única receita a gerar → baixa o PDF direto (sem zipar).
      if (itens.length === 1) {
        await exportarReceitaUnica(itens[0], assinante);
        const aviso =
          falhasBusca.length > 0 ? ` (falharam: ${falhasBusca.join(", ")})` : "";
        toast.success(`Receita de ${itens[0].hospede.nome} gerada.${aviso}`);
        return;
      }

      const res = await exportarReceitasLoteZip(itens, assinante);
      const falhas = [...falhasBusca, ...res.falhas];
      if (res.gerados === 0) {
        toast.error("Não foi possível gerar nenhuma receita.");
      } else if (falhas.length > 0) {
        toast.warning(
          `${res.gerados} receita(s) no ZIP. Falharam: ${falhas.join(", ")}.`,
        );
      } else {
        toast.success(`${res.gerados} receitas geradas no arquivo .zip.`);
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
            Selecione os hóspedes e gere as receitas (PDF) para enviar à farmácia externa.
            Os PDFs saem idênticos aos do médico, num único arquivo .zip.
          </p>
        </div>
      </div>

      {/* Médico assinante */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Médico que assina as receitas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {semMedico ? (
            <p className="text-sm font-semibold text-destructive">
              Nenhum médico geriatra ativo cadastrado — não é possível emitir receitas.
            </p>
          ) : assinantes.length === 1 ? (
            <p className="text-sm text-secondary">
              <span className="font-semibold">{ouNaoInformado(assinantes[0].nome)}</span>
              {assinantes[0].crm ? ` — ${assinantes[0].crm}` : ""}
            </p>
          ) : (
            <select
              value={medicoIdx}
              onChange={(e) => setMedicoIdx(Number(e.target.value))}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
            >
              {assinantes.map((m, i) => (
                <option key={`${m.nome}-${i}`} value={i}>
                  {m.nome}
                  {m.crm ? ` — ${m.crm}` : ""}
                </option>
              ))}
            </select>
          )}
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
                  <p className="text-xs text-muted-foreground">Quarto {ouNaoInformado(r.quarto)}</p>
                </div>
                {temPresc ? (
                  <Badge variant="secondary">Com prescrição</Badge>
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
        <Button size="lg" onClick={gerar} disabled={gerando || semMedico || alvos.length === 0}>
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
