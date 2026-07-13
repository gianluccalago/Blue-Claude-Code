import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  FolderCheck,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileWarning,
  Plus,
  Pencil,
  Trash2,
  CalendarOff,
  CalendarClock,
} from "lucide-react";
import {
  useDocumentosInstitucionais,
  useRegistrarDocumento,
  useAtualizarDocumento,
  useExcluirDocumento,
} from "@/hooks/useDocumentosInstitucionais";
import { urlAssinadaStorage, BUCKET_DOCUMENTOS_INSTITUCIONAIS } from "@/lib/storage";
import {
  statusDocumento,
  pesoStatus,
  STATUS_DOC_LABEL,
  STATUS_DOC_VARIANTE,
  type StatusDocumento,
} from "@/lib/documentosInstitucionais";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR } from "@/lib/utils";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// Documentação Institucional — modelo LIVRE. Master/Administração/Direção
// adicionam, editam e excluem qualquer documento (sem checklist fixo). Cada
// documento mostra a validade ao lado: uma DATA ou "Não se aplica".
// ===========================================================================

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function DocumentosInstitucionais() {
  const documentos = useDocumentosInstitucionais();
  const excluir = useExcluirDocumento();
  const [filtro, setFiltro] = useState<StatusDocumento | "todos">("todos");
  const [editando, setEditando] = useState<DocumentoInstitucional | null>(null);
  const [criando, setCriando] = useState(false);
  const [aExcluir, setAExcluir] = useState<DocumentoInstitucional | null>(null);

  const linhas = useMemo(() => {
    return (documentos.data ?? [])
      .map((doc) => ({ doc, status: statusDocumento(doc) }))
      .sort((a, b) => pesoStatus(a.status) - pesoStatus(b.status) || a.doc.nome.localeCompare(b.doc.nome, "pt-BR"));
  }, [documentos.data]);

  if (documentos.isLoading) return <LoadingState />;
  if (documentos.isError) return <ErrorState error={documentos.error} />;

  const total = linhas.length;
  const vencidos = linhas.filter((l) => l.status === "vencido").length;
  const vencendo = linhas.filter((l) => l.status === "vence_em_breve").length;
  const emDia = linhas.filter((l) => l.status === "em_dia").length;

  const filtradas = filtro === "todos" ? linhas : linhas.filter((l) => l.status === filtro);

  async function abrir(path: string) {
    const url = await urlAssinadaStorage(BUCKET_DOCUMENTOS_INSTITUCIONAIS, path, 300);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o arquivo.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <FolderCheck className="size-6 text-primary" /> Documentação Institucional
          </h2>
        </div>
        <Button onClick={() => setCriando(true)}>
          <Plus className="size-4" /> Adicionar documento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi alerta={vencidos > 0} tom="destructive" icone={<FileWarning className="size-5" />} valor={vencidos} rotulo="Vencidos" />
        <Kpi alerta={vencendo > 0} tom="warning" icone={<AlertTriangle className="size-5" />} valor={vencendo} rotulo="Vencem em 30 dias" />
        <Kpi alerta={false} tom="success" icone={<ShieldCheck className="size-5" />} valor={emDia} rotulo="Em dia" />
        <Kpi alerta={false} tom="neutro" icone={<FolderCheck className="size-5" />} valor={total} rotulo="Total de documentos" />
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap gap-1.5">
        {(["todos", "vencido", "vence_em_breve", "em_dia", "sem_validade"] as const).map((f) => (
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

      {/* Lista */}
      {filtradas.length === 0 ? (
        <EmptyState
          label={
            filtro === "todos"
              ? "Nenhum documento ainda. Clique em “Adicionar documento” para começar."
              : "Nenhum documento neste filtro."
          }
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {filtradas.map(({ doc, status }) => (
              <div key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-secondary">{doc.nome}</span>
                    <Badge variant={STATUS_DOC_VARIANTE[status]}>{STATUS_DOC_LABEL[status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {doc.identificador ? `Nº ${doc.identificador} · ` : ""}
                    {doc.orgao_emissor ? `${doc.orgao_emissor} · ` : ""}
                    Anexado em {formatarDataBR(doc.criado_em)}
                    {doc.registrado_por ? ` por ${doc.registrado_por}` : ""}
                    {doc.observacao ? ` · ${doc.observacao}` : ""}
                  </p>
                </div>

                {/* Validade ao lado */}
                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-xs">
                  {doc.data_validade ? (
                    <>
                      <CalendarClock className={cn("size-3.5", status === "vencido" ? "text-destructive" : status === "vence_em_breve" ? "text-warning" : "text-success")} />
                      <span className="text-muted-foreground">Vence</span>
                      <span className={cn("font-semibold tabular-nums", status === "vencido" ? "text-destructive" : "text-secondary")}>
                        {formatarDataBR(doc.data_validade)}
                      </span>
                    </>
                  ) : (
                    <>
                      <CalendarOff className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">Não se aplica</span>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => abrir(doc.arquivo_url)}>
                    <ExternalLink className="size-4" /> Abrir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(doc)} title="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAExcluir(doc)} title="Excluir" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(criando || editando) && (
        <ModalDocumento
          documento={editando}
          onFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
        />
      )}

      <ConfirmDialog
        aberto={!!aExcluir}
        titulo={`Excluir “${aExcluir?.nome ?? ""}”?`}
        descricao="O documento e o arquivo anexado serão removidos definitivamente."
        textoConfirmar="Excluir"
        varianteConfirmar="destructive"
        onConfirmar={async () => {
          const doc = aExcluir;
          setAExcluir(null);
          if (!doc) return;
          try {
            await excluir.mutateAsync({ id: doc.id, arquivoUrl: doc.arquivo_url });
            toast.success("Documento excluído.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
          }
        }}
        onCancelar={() => setAExcluir(null)}
      />
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
  tom: "destructive" | "warning" | "success" | "neutro";
  icone: React.ReactNode;
  valor: number;
  rotulo: string;
}) {
  const cores: Record<string, { borda: string; chip: string }> = {
    destructive: { borda: "border-destructive/40 bg-destructive/5", chip: "bg-destructive/15 text-destructive" },
    warning: { borda: "border-warning/50 bg-warning/5", chip: "bg-warning/20 text-warning" },
    success: { borda: "border-success/40 bg-success/5", chip: "bg-success/15 text-success" },
    neutro: { borda: "border-primary/30 bg-primary/5", chip: "bg-primary/15 text-primary-strong" },
  };
  const c = cores[tom];
  const destaque = alerta || tom === "success" || tom === "neutro";
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-4", destaque ? c.borda : "border-border bg-muted/20")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", destaque ? c.chip : "bg-muted text-muted-foreground")}>
        {icone}
      </span>
      <div>
        <p className="text-2xl font-extrabold tabular-nums text-secondary">{valor}</p>
        <p className="text-sm text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

/** Modal de adicionar (documento = null) ou editar um documento. */
function ModalDocumento({
  documento,
  onFechar,
}: {
  documento: DocumentoInstitucional | null;
  onFechar: () => void;
}) {
  const registrar = useRegistrarDocumento();
  const atualizar = useAtualizarDocumento();
  const editando = !!documento;

  const [nome, setNome] = useState(documento?.nome ?? "");
  const [identificador, setIdentificador] = useState(documento?.identificador ?? "");
  const [orgao, setOrgao] = useState(documento?.orgao_emissor ?? "");
  const [emissao, setEmissao] = useState(documento?.data_emissao ?? "");
  // Validade: "data" (com vencimento) × "na" ("Não se aplica").
  const [temValidade, setTemValidade] = useState<boolean>(!!documento?.data_validade);
  const [validade, setValidade] = useState(documento?.data_validade ?? "");
  const [observacao, setObservacao] = useState(documento?.observacao ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const salvando = registrar.isPending || atualizar.isPending;

  function onArquivo(e: ChangeEvent<HTMLInputElement>) {
    setArquivo(e.target.files?.[0] ?? null);
  }

  async function salvar() {
    if (nome.trim() === "") {
      toast.error("Dê um nome ao documento.");
      return;
    }
    if (temValidade && !validade) {
      toast.error("Informe a data de vencimento ou marque “Não se aplica”.");
      return;
    }
    if (!editando && !arquivo) {
      toast.error("Selecione o arquivo do documento.");
      return;
    }
    const dados = {
      nome,
      identificador,
      orgaoEmissor: orgao,
      dataEmissao: emissao || null,
      dataValidade: temValidade ? validade : null,
      observacao,
    };
    try {
      if (editando && documento) {
        await atualizar.mutateAsync({ ...dados, id: documento.id, arquivoAtual: documento.arquivo_url, novoArquivo: arquivo });
      } else {
        await registrar.mutateAsync({ ...dados, arquivo: arquivo! });
      }
      toast.success(editando ? "Documento atualizado." : "Documento adicionado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o documento.");
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={editando ? "Editar documento" : "Adicionar documento"} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-md animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="text-lg font-bold text-secondary">{editando ? "Editar documento" : "Adicionar documento"}</h2>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">Nome do documento</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Alvará de funcionamento" className={inputBase} autoFocus />
          </div>

          {/* Validade — definida no envio */}
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-secondary">Vencimento</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTemValidade(true)}
                className={cn("flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors", temValidade ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}
              >
                Tem data
              </button>
              <button
                type="button"
                onClick={() => setTemValidade(false)}
                className={cn("flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors", !temValidade ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}
              >
                Não se aplica
              </button>
            </div>
            {temValidade && (
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={inputBase} />
            )}
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Data de emissão</label>
            <input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} className={inputBase} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-secondary">Observação</label>
            <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputBase} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-secondary">
              Arquivo (PDF/foto){editando ? " — deixe vazio para manter o atual" : ""}
            </label>
            <input type="file" accept="application/pdf,image/*" onChange={onArquivo} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary-strong" />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={salvando}>
            {editando ? "Salvar alterações" : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
