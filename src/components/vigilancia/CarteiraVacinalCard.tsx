import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Syringe, Upload, FileText, ExternalLink, Loader2, Plus, Trash2, CalendarDays } from "lucide-react";
import {
  useCarteirasDoResidente,
  useUploadCarteira,
  useVacinasDoResidente,
  useRegistrarVacina,
  useExcluirVacina,
} from "@/hooks/useVacinacao";
import { urlAssinadaCarteira } from "@/lib/storage";
import { carteiraVigente, statusCarteira, STATUS_CARTEIRA_LABEL, STATUS_CARTEIRA_VARIANTE } from "@/lib/vacinacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatarDataBR } from "@/lib/utils";

const inputBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// Carteira vacinal do hóspede (RDC 502/2021 Art. 39) — Coordenação/Médico/
// Master. Anexa/atualiza (bucket privado), histórico de versões e registro
// vacina a vacina (complemento). Dado de saúde — não vai para a família.
// ===========================================================================

export function CarteiraVacinalCard({ residenteId, nome }: { residenteId: string; nome: string }) {
  const carteiras = useCarteirasDoResidente(residenteId);
  const upload = useUploadCarteira();
  const [enviando, setEnviando] = useState(false);
  const primeiro = nome.split(" ")[0];

  const lista = carteiras.data ?? [];
  const vigente = carteiraVigente(lista);
  const status = statusCarteira(vigente);

  async function onArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    try {
      await upload.mutateAsync({ residenteId, arquivo: file });
      toast.success("Carteira vacinal anexada.");
    } catch (err) {
      toast.error(erroMsg(err));
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(path: string) {
    const url = await urlAssinadaCarteira(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o arquivo.");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Syringe className="size-4 text-primary" /> Carteira vacinal
          <Badge variant={STATUS_CARTEIRA_VARIANTE[status]}>{STATUS_CARTEIRA_LABEL[status]}</Badge>
        </CardTitle>
        <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground ${enviando ? "opacity-60" : "hover:bg-primary/90"}`}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {enviando ? "Enviando…" : "Anexar carteira"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onArquivo} disabled={enviando} />
        </label>
      </CardHeader>
      <CardContent className="space-y-4">
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma carteira anexada — pendente. Anexe a foto/PDF da carteira de {primeiro}.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Versões (mais recente primeiro)</p>
            {lista.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-secondary">
                    <FileText className="size-4 text-muted-foreground" />
                    {c.id === vigente?.id ? "Versão vigente" : "Versão anterior"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Anexada em {formatarDataBR(c.data_upload)}
                    {c.atualizada_em ? ` · atualizada em ${formatarDataBR(c.atualizada_em)}` : ""}
                    {c.registrado_por ? ` · ${c.registrado_por}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrir(c.arquivo_url)}>
                  <ExternalLink className="size-4" /> Ver
                </Button>
              </div>
            ))}
          </div>
        )}

        <VacinasResidente residenteId={residenteId} />
      </CardContent>
    </Card>
  );
}

// ─── Registro vacina a vacina (complemento) ───────────────────────────────────
function VacinasResidente({ residenteId }: { residenteId: string }) {
  const vacinas = useVacinasDoResidente(residenteId);
  const registrar = useRegistrarVacina();
  const excluir = useExcluirVacina();
  const [vacina, setVacina] = useState("");
  const [data, setData] = useState("");
  const [dose, setDose] = useState("");

  async function adicionar() {
    if (!vacina.trim()) return toast.error("Informe a vacina.");
    try {
      await registrar.mutateAsync({ residenteId, vacina, dataAplicacao: data || null, dose: dose || null });
      setVacina(""); setData(""); setDose("");
      toast.success("Vacina registrada.");
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }
  async function remover(id: string) {
    try {
      await excluir.mutateAsync({ id, residenteId });
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  const lista = vacinas.data ?? [];

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vacinas registradas (complemento)</p>
      {lista.length > 0 && (
        <div className="space-y-1.5">
          {lista.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-2.5 py-1.5 text-sm">
              <span className="text-secondary">
                <span className="font-medium">{v.vacina}</span>
                {v.dose ? ` · ${v.dose}` : ""}
                {v.data_aplicacao ? ` · ${formatarDataBR(v.data_aplicacao)}` : ""}
              </span>
              <button onClick={() => remover(v.id)} disabled={excluir.isPending} className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive" aria-label="Remover">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={vacina} onChange={(e) => setVacina(e.target.value)} placeholder="Vacina (ex.: Influenza)" className={`${inputBase} min-w-[160px] flex-1`} />
        <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose" className={`${inputBase} w-24`} />
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputBase} />
        </span>
        <Button size="sm" variant="outline" onClick={adicionar} disabled={registrar.isPending}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
