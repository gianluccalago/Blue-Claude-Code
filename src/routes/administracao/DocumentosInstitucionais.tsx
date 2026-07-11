import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  FolderCheck,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Upload,
  History,
  X,
} from "lucide-react";
import { useDocumentosInstitucionais, useRegistrarDocumento } from "@/hooks/useDocumentosInstitucionais";
import { urlAssinadaStorage, BUCKET_DOCUMENTOS_INSTITUCIONAIS } from "@/lib/storage";
import {
  TIPOS_DOCUMENTO,
  statusDocumento,
  documentoVigente,
  STATUS_DOC_LABEL,
  STATUS_DOC_VARIANTE,
  type StatusDocumento,
  type TipoDocumento,
} from "@/lib/documentosInstitucionais";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR } from "@/lib/utils";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// "Documentos da casa" — compilação dos documentos indispensáveis da ILPI
// (Lei 13.725/04, RDC 283/05 → 502/21, Port. 344/98). Master, Administração e
// Direção anexam e renovam; o checklist cobra pendências e vencimentos.
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

interface LinhaChecklist {
  tipo: TipoDocumento;
  status: StatusDocumento;
  vigente: DocumentoInstitucional | null;
  historico: DocumentoInstitucional[];
}

export function DocumentosInstitucionais() {
  const documentos = useDocumentosInstitucionais();
  const [filtro, setFiltro] = useState<StatusDocumento | "todos">("todos");
  const [registrar, setRegistrar] = useState<TipoDocumento | null>(null);
  const [historicoDe, setHistoricoDe] = useState<LinhaChecklist | null>(null);

  const linhas: LinhaChecklist[] = useMemo(() => {
    const porTipo = new Map<string, DocumentoInstitucional[]>();
    for (const d of documentos.data ?? []) {
      const arr = porTipo.get(d.tipo) ?? [];
      arr.push(d); // já vem ordenado por criado_em desc
      porTipo.set(d.tipo, arr);
    }
    const pesoStatus = (s: StatusDocumento) =>
      s === "vencido" ? 0 : s === "pendente" ? 1 : s === "vence_em_breve" ? 2 : 3;
    return TIPOS_DOCUMENTO.map((tipo) => {
      const historico = porTipo.get(tipo.slug) ?? [];
      const vigente = documentoVigente(historico);
      return { tipo, status: statusDocumento(tipo, vigente), vigente, historico };
    }).sort((a, b) => pesoStatus(a.status) - pesoStatus(b.status));
  }, [documentos.data]);

  if (documentos.isLoading) return <LoadingState />;
  if (documentos.isError) return <ErrorState error={documentos.error} />;

  const pendentes = linhas.filter((l) => l.status === "pendente").length;
  const vencidos = linhas.filter((l) => l.status === "vencido").length;
  const vencendo = linhas.filter((l) => l.status === "vence_em_breve").length;
  const emDia = linhas.length - pendentes - vencidos - vencendo;

  const filtradas = filtro === "todos" ? linhas : linhas.filter((l) => l.status === filtro);

  async function abrir(path: string) {
    const url = await urlAssinadaStorage(BUCKET_DOCUMENTOS_INSTITUCIONAIS, path, 300);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o arquivo.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <FolderCheck className="size-6 text-primary" /> Documentos da casa
        </h2>
        <p className="text-sm text-muted-foreground">
          Documentos indispensáveis da ILPI (Lei 13.725/04 · RDC 283/05→502/21 · Port. 344/98).
          Anexe a versão vigente e acompanhe validades.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi
          alerta={vencidos > 0}
          tom="destructive"
          icone={<FileWarning className="size-5" />}
          valor={vencidos}
          rotulo="Vencidos"
        />
        <Kpi
          alerta={pendentes > 0}
          tom="destructive"
          icone={<AlertTriangle className="size-5" />}
          valor={pendentes}
          rotulo="Pendentes (sem anexo)"
        />
        <Kpi
          alerta={vencendo > 0}
          tom="warning"
          icone={<AlertTriangle className="size-5" />}
          valor={vencendo}
          rotulo="Vencem em 30 dias"
        />
        <Kpi
          alerta={false}
          tom="success"
          icone={<ShieldCheck className="size-5" />}
          valor={emDia}
          rotulo="Em dia / arquivados"
        />
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap gap-1.5">
        {(["todos", "vencido", "pendente", "vence_em_breve", "em_dia", "sem_validade"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filtro === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f === "todos" ? "Todos" : STATUS_DOC_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Checklist */}
      {filtradas.length === 0 ? (
        <EmptyState label="Nenhum documento neste filtro." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map((l) => (
              <div key={l.tipo.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{l.tipo.label}</span>
                    <Badge variant={STATUS_DOC_VARIANTE[l.status]}>{STATUS_DOC_LABEL[l.status]}</Badge>
                  </div>
                  {l.vigente ? (
                    <p className="text-xs text-muted-foreground">
                      {l.vigente.identificador ? `Nº ${l.vigente.identificador} · ` : ""}
                      {l.vigente.orgao_emissor ? `${l.vigente.orgao_emissor} · ` : ""}
                      {l.vigente.data_validade
                        ? `Válido até ${formatarDataBR(l.vigente.data_validade)}`
                        : `Anexado em ${formatarDataBR(l.vigente.criado_em)}`}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">
                      Nenhum arquivo anexado{l.tipo.dica ? ` — ${l.tipo.dica}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {l.historico.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setHistoricoDe(l)} title="Histórico de versões">
                      <History className="size-4" /> {l.historico.length}
                    </Button>
                  )}
                  {l.vigente && (
                    <Button size="sm" variant="outline" onClick={() => abrir(l.vigente!.arquivo_url)}>
                      <ExternalLink className="size-4" /> Abrir
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setRegistrar(l.tipo)}>
                    <Upload className="size-4" /> {l.vigente ? "Renovar" : "Anexar"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {registrar && <ModalRegistrar tipo={registrar} onFechar={() => setRegistrar(null)} />}
      {historicoDe && (
        <ModalHistorico linha={historicoDe} onAbrir={abrir} onFechar={() => setHistoricoDe(null)} />
      )}
    </div>
  );
}

function Kpi({
  alerta,
  tom,
  icone,
  valor,
  rotulo,
}: {
  alerta: boolean;
  tom: "destructive" | "warning" | "success";
  icone: React.ReactNode;
  valor: number;
  rotulo: string;
}) {
  const cores = {
    destructive: { borda: "border-destructive/40 bg-destructive/5", chip: "bg-destructive/15 text-destructive" },
    warning: { borda: "border-warning/50 bg-warning/5", chip: "bg-warning/20 text-warning" },
    success: { borda: "border-success/40 bg-success/5", chip: "bg-success/15 text-success" },
  }[tom];
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-4", alerta || tom === "success" ? cores.borda : "border-border bg-muted/20")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", alerta || tom === "success" ? cores.chip : "bg-muted text-muted-foreground")}>
        {icone}
      </span>
      <div>
        <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor}</p>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

/** Modal de anexo/renovação de um documento do checklist. */
function ModalRegistrar({ tipo, onFechar }: { tipo: TipoDocumento; onFechar: () => void }) {
  const registrar = useRegistrarDocumento();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [identificador, setIdentificador] = useState("");
  const [orgao, setOrgao] = useState("");
  const [emissao, setEmissao] = useState("");
  const [validade, setValidade] = useState("");
  const [observacao, setObservacao] = useState("");

  function onArquivo(e: ChangeEvent<HTMLInputElement>) {
    setArquivo(e.target.files?.[0] ?? null);
  }

  async function salvar() {
    if (!arquivo) {
      toast.error("Selecione o arquivo do documento.");
      return;
    }
    if (tipo.temValidade && !validade) {
      toast.error("Este documento tem vencimento — informe a validade.");
      return;
    }
    try {
      await registrar.mutateAsync({
        tipo: tipo.slug,
        nome: tipo.label,
        arquivo,
        identificador,
        orgaoEmissor: orgao,
        dataEmissao: emissao || null,
        dataValidade: validade || null,
        observacao,
      });
      toast.success("Documento registrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o documento.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Anexar ${tipo.label}`} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">{tipo.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Anexe a versão vigente{tipo.temValidade ? " e informe a validade" : ""}.
          {tipo.dica ? ` ${tipo.dica}.` : ""}
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Arquivo (PDF/foto)</label>
            <input type="file" accept="application/pdf,image/*" onChange={onArquivo} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-strong" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary">Nº / protocolo</label>
              <input type="text" value={identificador} onChange={(e) => setIdentificador(e.target.value)} className={inputBase} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary">Órgão emissor</label>
              <input type="text" value={orgao} onChange={(e) => setOrgao(e.target.value)} className={inputBase} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary">Emissão</label>
              <input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} className={inputBase} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary">
                Validade{tipo.temValidade ? "" : " (se houver)"}
              </label>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={inputBase} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Observação</label>
            <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={registrar.isPending}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Histórico de versões de um tipo de documento. */
function ModalHistorico({
  linha,
  onAbrir,
  onFechar,
}: {
  linha: LinhaChecklist;
  onAbrir: (path: string) => void;
  onFechar: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={`Histórico de ${linha.tipo.label}`} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[85vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-secondary">Histórico — {linha.tipo.label}</h2>
            <p className="text-sm text-muted-foreground">{linha.historico.length} versões (mais recente primeiro).</p>
          </div>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-4 divide-y">
          {linha.historico.map((d, i) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-secondary">
                  {formatarDataBR(d.criado_em)} {i === 0 && <Badge variant="default" className="ml-1">Vigente</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.identificador ? `Nº ${d.identificador} · ` : ""}
                  {d.data_validade ? `válido até ${formatarDataBR(d.data_validade)}` : "sem validade"}
                  {d.registrado_por ? ` · por ${d.registrado_por}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAbrir(d.arquivo_url)}>
                <ExternalLink className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
