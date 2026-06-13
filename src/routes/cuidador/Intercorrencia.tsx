import { useRef, useState } from "react";
import { Phone, Stethoscope, UserCog, Siren, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useRegistrarIntercorrencia } from "@/hooks/useIntercorrencia";
import { HospedeIdentidade } from "@/components/cuidador/HospedeIdentidade";
import { AmbulanciaFields } from "@/components/intercorrencia/AmbulanciaFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { DadosAmbulancia } from "@/lib/ambulancia";

const AMBULANCIA_VAZIA: DadosAmbulancia = {
  medico: "",
  tempoRespostaMin: null,
  desfecho: null,
  hospitalDestino: "",
};

const TIPOS = [
  "Queda",
  "Alteração de consciência",
  "Humor/sono",
  "Lesão de pele",
  "Recusa",
  "Vômito",
] as const;

// Sub-opções por tipo — geram texto automático, dispensam digitação em urgência.
const SUB_TIPOS: Record<string, string[]> = {
  "Queda": ["Sem ferimento", "Hematoma", "Sangramento", "Contusão"],
  "Alteração de consciência": ["Confusão", "Agitação", "Sonolência", "Desmaio"],
  "Humor/sono": ["Insônia", "Agitação", "Choro", "Apatia"],
  "Lesão de pele": ["Escara", "Flebite", "Machucado", "Queimadura"],
  "Recusa": ["Medicação", "Alimentação", "Higiene", "Tratamento"],
  "Vômito": ["1 vez", "2 vezes", "3 ou mais vezes", "Com sangue"],
};

const CONTATOS = [
  { label: "SAMU", numero: "192", icon: Siren, cor: "text-destructive" },
  { label: "Médico Geriatra", numero: "(11) 99999-0002", icon: Stethoscope, cor: "text-primary" },
  { label: "Diretor", numero: "(11) 99999-0001", icon: UserCog, cor: "text-secondary" },
];

export function Intercorrencia() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const registrar = useRegistrarIntercorrencia();

  const [tipo, setTipo] = useState<string | null>(null);
  const [subTipo, setSubTipo] = useState<string | null>(null);
  const [hospedeId, setHospedeId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [ambulanciaAcionada, setAmbulanciaAcionada] = useState(false);
  const [ambulancia, setAmbulancia] = useState<DadosAmbulancia>(AMBULANCIA_VAZIA);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  const hospedeSel = hospedeId || hospedes[0].id;
  const hospedeObj = hospedes.find((h) => h.id === hospedeSel);
  const podeEnviar = !!tipo && !!hospedeSel && !registrar.isPending;

  function selecionarTipo(t: string) {
    setTipo(t);
    setSubTipo(null);
    // Pré-preenche o sub-tipo padrão (primeiro da lista) e gera o texto automático
    const sub = SUB_TIPOS[t]?.[0] ?? null;
    if (sub) setSubTipo(sub);
  }

  function selecionarSubTipo(s: string) {
    setSubTipo(s);
  }

  function capturarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function removerFoto() {
    setFoto(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (fotoRef.current) fotoRef.current.value = "";
  }

  // Texto gerado automaticamente: "Queda — Hematoma" + obs adicional.
  function gerarTexto(): string {
    const partes = [tipo, subTipo].filter(Boolean).join(" — ");
    const obs = observacao.trim();
    return obs ? `${partes}${partes ? ". " : ""}${obs}` : partes;
  }

  async function enviar() {
    if (!tipo) return;
    const textoFinal = gerarTexto();
    await registrar.mutateAsync({
      residenteId: hospedeSel,
      tipo,
      observacao: textoFinal,
      foto,
      ambulancia: ambulanciaAcionada ? ambulancia : null,
    });
    toast.success("Intercorrência registrada e equipe notificada.");
    setTipo(null);
    setSubTipo(null);
    setObservacao("");
    removerFoto();
    setAmbulanciaAcionada(false);
    setAmbulancia(AMBULANCIA_VAZIA);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Registrar intercorrência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo (toque) */}
          <Campo titulo="Tipo de intercorrência">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  onClick={() => selecionarTipo(t)}
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

          {/* Sub-tipo (aparece após selecionar o tipo) */}
          {tipo && SUB_TIPOS[tipo] && (
            <Campo titulo="Detalhe">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SUB_TIPOS[tipo].map((s) => (
                  <button
                    key={s}
                    onClick={() => selecionarSubTipo(s)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-sm font-semibold transition-all",
                      subTipo === s
                        ? "border-secondary bg-secondary text-secondary-foreground shadow-card"
                        : "border-border bg-card text-secondary hover:border-secondary/50",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Campo>
          )}

          {/* Hóspede */}
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
            {/* Poka-yoke: confirmação visual de QUEM é (foto + nome + alergia
                em destaque) antes de registrar — evita registro no hóspede
                errado e decisão sem o dado de segurança. */}
            {hospedeObj && <HospedeIdentidade hospede={hospedeObj} compacto />}
          </Campo>

          {/* Observação adicional */}
          <Campo titulo="Observação adicional (opcional)">
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Detalhe extra se necessário…"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Campo>

          {/* Foto */}
          <Campo titulo="Foto (opcional)">
            <div className="space-y-2">
              {fotoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={fotoPreview}
                    alt="Prévia da foto"
                    className="h-32 w-32 rounded-lg object-cover border"
                  />
                  <button
                    onClick={removerFoto}
                    className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-destructive text-white"
                    aria-label="Remover foto"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-secondary transition-colors"
                >
                  <Camera className="size-4" /> Tirar foto / escolher da galeria
                </button>
              )}
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={capturarFoto}
                className="hidden"
              />
            </div>
          </Campo>

          {/* Chamado de ambulância (opcional) */}
          <Campo titulo="Ambulância (opcional)">
            <AmbulanciaFields
              acionada={ambulanciaAcionada}
              onAcionadaChange={setAmbulanciaAcionada}
              valor={ambulancia}
              onChange={(patch) => setAmbulancia((a) => ({ ...a, ...patch }))}
            />
          </Campo>

          {/* Preview do texto gerado */}
          {tipo && (
            <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-secondary">
              <span className="font-semibold">Registro: </span>
              {gerarTexto() || tipo}
            </div>
          )}

          {/* O nome no botão é a confirmação final de que é a pessoa certa. */}
          <Button size="lg" className="w-full" disabled={!podeEnviar} onClick={enviar}>
            {registrar.isPending
              ? "Registrando…"
              : `Registrar intercorrência de ${hospedeObj?.nome.split(" ")[0] ?? "hóspede"}`}
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
