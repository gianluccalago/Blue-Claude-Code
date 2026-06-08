import { useState } from "react";
import { Phone, Stethoscope, UserCog, Siren, Check } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useRegistrarIntercorrencia } from "@/hooks/useIntercorrencia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

const TIPOS = [
  "Queda",
  "Alteração de consciência",
  "Humor/sono",
  "Lesão de pele",
  "Recusa",
  "Vômito",
] as const;

const CONTATOS = [
  { label: "SAMU", numero: "192", icon: Siren, cor: "text-destructive" },
  { label: "Médico Geriatra", numero: "(11) 99999-0002", icon: Stethoscope, cor: "text-primary" },
  { label: "Diretor", numero: "(11) 99999-0001", icon: UserCog, cor: "text-secondary" },
];

export function Intercorrencia() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const registrar = useRegistrarIntercorrencia();

  const [tipo, setTipo] = useState<string | null>(null);
  const [hospedeId, setHospedeId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [sucesso, setSucesso] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  const hospedeSel = hospedeId || hospedes[0].id;
  const podeEnviar = !!tipo && !!hospedeSel && !registrar.isPending;

  async function enviar() {
    if (!tipo) return;
    await registrar.mutateAsync({ residenteId: hospedeSel, tipo, observacao });
    setSucesso(true);
    setTipo(null);
    setObservacao("");
    setTimeout(() => setSucesso(false), 4000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Registrar intercorrência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Campo titulo="Tipo de intercorrência">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "rounded-lg border px-3 py-4 text-sm font-semibold transition-all",
                    tipo === t
                      ? "border-primary bg-primary text-primary-foreground shadow-card"
                      : "border-border bg-card text-secondary hover:border-primary/50",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Campo>

          <Campo titulo="Hóspede">
            <select
              value={hospedeSel}
              onChange={(e) => setHospedeId(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {hospedes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nome} — Quarto {h.quarto ?? "—"}
                </option>
              ))}
            </select>
          </Campo>

          <Campo titulo="Observação (opcional)">
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={4}
              placeholder="Descreva o que aconteceu…"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          {sucesso && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm font-medium text-success">
              <Check className="size-4" /> Intercorrência registrada e equipe notificada.
            </div>
          )}

          <Button size="lg" className="w-full" disabled={!podeEnviar} onClick={enviar}>
            Registrar intercorrência
          </Button>
        </CardContent>
      </Card>

      <Card className="h-fit border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Phone className="size-5" /> Contatos de emergência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONTATOS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.label}
                href={`tel:${c.numero.replace(/\D/g, "")}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
              >
                <Icon className={cn("size-5", c.cor)} />
                <div>
                  <div className="text-sm font-bold text-secondary">{c.label}</div>
                  <div className="text-sm tabular-nums text-muted-foreground">{c.numero}</div>
                </div>
              </a>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-secondary">{titulo}</label>
      {children}
    </div>
  );
}
