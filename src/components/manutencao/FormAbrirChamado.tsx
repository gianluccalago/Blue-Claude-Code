import { useState } from "react";
import { Wrench, AlertCircle, Check, Building2, BedDouble, Camera } from "lucide-react";
import { useCriarChamado } from "@/hooks/useManutencao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PerfilSolicitanteChamado, Residente, UrgenciaChamado } from "@/types/database";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const URGENCIAS: { value: UrgenciaChamado; label: string; cor: string }[] = [
  { value: "baixa", label: "Baixa", cor: "border-muted-foreground/30 hover:bg-muted" },
  { value: "media", label: "Média", cor: "border-blue-400 hover:bg-blue-50 hover:text-blue-700" },
  { value: "alta", label: "Alta", cor: "border-warning/70 hover:bg-warning/10 hover:text-warning-foreground" },
  { value: "emergencia", label: "Emergência", cor: "border-destructive hover:bg-destructive/10 hover:text-destructive" },
];

const URGENCIA_ATIVA: Record<UrgenciaChamado, string> = {
  baixa: "bg-muted-foreground/20 border-muted-foreground/40 text-secondary",
  media: "bg-blue-500 border-blue-500 text-white",
  alta: "bg-warning border-warning text-white",
  emergencia: "bg-destructive border-destructive text-white",
};

function extrairErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

type TipoLocal = "suite" | "comum";

export function FormAbrirChamado({
  residentes,
  perfilSolicitante,
  abertoPorPadrao,
  onConcluido,
}: {
  residentes: Residente[];
  perfilSolicitante: PerfilSolicitanteChamado;
  abertoPorPadrao: string;
  onConcluido?: () => void;
}) {
  const criar = useCriarChamado();

  const suitesComQuarto = residentes.filter((r) => r.quarto);

  const [tipoLocal, setTipoLocal] = useState<TipoLocal>(suitesComQuarto.length > 0 ? "suite" : "comum");
  const [residenteId, setResidenteId] = useState("");
  const [localComum, setLocalComum] = useState("");
  const [problema, setProblema] = useState("");
  const [urgencia, setUrgencia] = useState<UrgenciaChamado>("media");
  const [abertoPor, setAbertoPor] = useState(abertoPorPadrao);
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const residenteSelecionado = suitesComQuarto.find((r) => r.id === residenteId);

  const localValido =
    tipoLocal === "suite" ? !!residenteSelecionado : localComum.trim().length > 0;

  async function handleAbrir() {
    if (!localValido || !problema.trim() || !abertoPor.trim()) return;
    setErro(null);
    try {
      await criar.mutateAsync({
        local:
          tipoLocal === "suite"
            ? `Quarto ${residenteSelecionado!.quarto}`
            : localComum.trim(),
        residenteId: tipoLocal === "suite" ? residenteSelecionado!.id : null,
        problema: problema.trim(),
        urgencia,
        abertoPor: abertoPor.trim(),
        perfilSolicitante,
        foto,
      });
      setProblema("");
      setLocalComum("");
      setResidenteId("");
      setUrgencia("media");
      setFoto(null);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
      onConcluido?.();
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-5 text-primary" />
          Abrir chamado de manutenção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipo de local */}
        {suitesComQuarto.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoLocal("suite")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
                tipoLocal === "suite"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              )}
            >
              <BedDouble className="h-3.5 w-3.5" /> Suíte / hóspede
            </button>
            <button
              type="button"
              onClick={() => setTipoLocal("comum")}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
                tipoLocal === "comum"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              )}
            >
              <Building2 className="h-3.5 w-3.5" /> Área comum
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Local</label>
            {tipoLocal === "suite" && suitesComQuarto.length > 0 ? (
              <select
                value={residenteId}
                onChange={(e) => setResidenteId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione…</option>
                {suitesComQuarto.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} · Quarto {r.quarto}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={localComum}
                onChange={(e) => setLocalComum(e.target.value)}
                placeholder="Ex: Salão de eventos, lavanderia…"
                className={inputClass}
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Aberto por</label>
            <input
              type="text"
              value={abertoPor}
              onChange={(e) => setAbertoPor(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Problema</label>
          <textarea
            rows={3}
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            placeholder="Descreva o problema encontrado…"
            className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Urgência</label>
          <div className="flex flex-wrap gap-2">
            {URGENCIAS.map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setUrgencia(u.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  urgencia === u.value ? URGENCIA_ATIVA[u.value] : cn("bg-background", u.cor)
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-secondary">
            <Camera className="h-4 w-4" /> Foto do problema (opcional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          />
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {erro}
          </div>
        )}

        {sucesso && (
          <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            <Check className="size-4 shrink-0" /> Chamado aberto com sucesso!
          </div>
        )}

        <Button
          className="w-full gap-2"
          disabled={!localValido || !problema.trim() || !abertoPor.trim() || criar.isPending}
          onClick={handleAbrir}
        >
          <Wrench className="h-4 w-4" />
          {criar.isPending ? "Abrindo…" : "Abrir chamado"}
        </Button>
      </CardContent>
    </Card>
  );
}
