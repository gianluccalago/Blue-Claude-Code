import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Check, Pencil, ChevronDown } from "lucide-react";
import { useBiblioteca, useModelosMensagem, useSalvarBloco, useSalvarModelo } from "@/hooks/usePosVisita";
import { CrmNav } from "./CrmNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";
import type { CrmBiblioteca as Bloco, CrmModeloMensagem } from "@/types/database";

// Biblioteca do pós-visita: dores, objeções e modelos de mensagem. A gestão
// ajusta os textos aqui; as próximas mensagens já saem com o texto novo.
const inputBase = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VARIAVEIS = "{visitante} quem visitou · {consultor} quem atendeu · {residente} como chamar (Dona Maria) · {tratamento} sua mãe/seu pai · {dia_visita} hoje/ontem · {detalhe_pessoal} · {frase_o_que_ouvimos} · {blocos_dores} · {bloco_objecao} · {simulacao} · {conteudos_dores} · {proximos_passos} · {pergunta_confirmacao} · {opt_out}";

export function CrmBiblioteca() {
  const bib = useBiblioteca();
  const mod = useModelosMensagem();
  if (bib.isLoading || mod.isLoading) return <LoadingState />;
  if (bib.isError) return <ErrorState error={bib.error} />;
  if (mod.isError) return <ErrorState error={mod.error} />;
  const lista = bib.data ?? [];
  return (
    <div className="space-y-5">
      <CrmNav ativa="crm-biblioteca" />
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><BookOpen className="size-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Biblioteca do pós-visita</h1>
          <p className="text-sm text-muted-foreground">Textos de cada dor e objeção e os modelos das mensagens. O que mudar aqui vale para as próximas mensagens.</p>
        </div>
      </div>
      <Tabs defaultValue="dores">
        <TabsList>
          <TabsTrigger value="dores">Dores ({lista.filter((b) => b.tipo === "dor").length})</TabsTrigger>
          <TabsTrigger value="objecoes">Objeções ({lista.filter((b) => b.tipo === "objecao").length})</TabsTrigger>
          <TabsTrigger value="modelos">Mensagens ({(mod.data ?? []).length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dores" className="space-y-2">{lista.filter((b) => b.tipo === "dor").map((b) => <BlocoItem key={b.codigo} b={b} />)}</TabsContent>
        <TabsContent value="objecoes" className="space-y-2">{lista.filter((b) => b.tipo === "objecao").map((b) => <BlocoItem key={b.codigo} b={b} />)}</TabsContent>
        <TabsContent value="modelos" className="space-y-2">
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Preenchidos pelo app: {VARIAVEIS}. Outros campos entre chaves (depoimento, evento…) o consultor completa na hora de enviar.</p>
          {(mod.data ?? []).map((m) => <ModeloItem key={m.codigo} m={m} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlocoItem({ b }: { b: Bloco }) {
  const salvar = useSalvarBloco();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(b.texto_whatsapp);
  const [conteudo, setConteudo] = useState(b.conteudo_titulo ?? "");
  const [link, setLink] = useState(b.conteudo_link ?? "");
  const [ativo, setAtivo] = useState(b.ativo);

  async function gravar() {
    try {
      await salvar.mutateAsync({ codigo: b.codigo, texto_whatsapp: texto, conteudo_titulo: conteudo, conteudo_link: link, ativo });
      setEditando(false);
      toast.success(`${b.titulo}: salvo.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Card className={cn(!b.ativo && "opacity-60")}>
      <CardContent className="p-0">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
          <span className="min-w-0">
            <span className="text-xs font-bold text-muted-foreground">{b.codigo}</span>{" "}
            <span className="font-semibold text-secondary">{b.titulo}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {b.tipo === "dor" && (b.conteudo_link ? <Badge variant="success">conteúdo com link</Badge> : <Badge variant="muted">sem link do conteúdo</Badge>)}
            {!b.ativo && <Badge variant="muted">desligado</Badge>}
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
          </span>
        </button>
        {aberto && (
          <div className="space-y-3 border-t px-4 pb-4 pt-3 text-sm">
            {b.sinais && <Info rotulo="Sinais na conversa" texto={b.sinais} />}
            {b.o_que_ouvimos && <Info rotulo={'"O que ouvimos"'} texto={b.o_que_ouvimos} />}
            {b.como_resolve && <Info rotulo="Como o Blue resolve" texto={b.como_resolve} />}
            {b.prova_social && <Info rotulo="Prova social" texto={b.prova_social} />}
            {b.observacoes && <Info rotulo="Observações" texto={b.observacoes} />}
            {editando ? (
              <div className="space-y-2">
                <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">Texto para o WhatsApp</span>
                  <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} className={inputBase} /></label>
                {b.tipo === "dor" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">Conteúdo específico desta dor</span>
                      <input value={conteudo} onChange={(e) => setConteudo(e.target.value)} className={cn(inputBase, "h-10")} /></label>
                    <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">Link do conteúdo (vai junto com o material)</span>
                      <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="https://…" className={cn(inputBase, "h-10")} /></label>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-primary" /> Em uso</label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={gravar} loading={salvar.isPending}><Check className="size-4" /> Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <Info rotulo="Texto para o WhatsApp" texto={b.texto_whatsapp} destaque />
                {b.tipo === "dor" && <Info rotulo="Conteúdo específico" texto={`${b.conteudo_titulo ?? "—"}${b.conteudo_link ? `\n${b.conteudo_link}` : "\n(sem link ainda: não vai junto com o material)"}`} />}
                <Button size="sm" variant="outline" onClick={() => setEditando(true)}><Pencil className="size-4" /> Editar</Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModeloItem({ m }: { m: CrmModeloMensagem }) {
  const salvar = useSalvarModelo();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(m.texto);
  const [ativo, setAtivo] = useState(m.ativo);

  async function gravar() {
    try {
      await salvar.mutateAsync({ codigo: m.codigo, texto, ativo });
      setEditando(false);
      toast.success(`${m.nome}: salvo.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Card className={cn(!m.ativo && "opacity-60")}>
      <CardContent className="p-0">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
          <span className="min-w-0">
            <span className="text-xs font-bold text-muted-foreground">{m.codigo}</span>{" "}
            <span className="font-semibold text-secondary">{m.nome}</span>
            {m.quando && <span className="block text-xs text-muted-foreground">{m.quando}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {!m.ativo && <Badge variant="muted">desligada</Badge>}
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
          </span>
        </button>
        {aberto && (
          <div className="space-y-2 border-t px-4 pb-4 pt-3">
            {editando ? (
              <>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} className={inputBase} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-primary" /> Ligada</label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={gravar} loading={salvar.isPending}><Check className="size-4" /> Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed text-secondary">{m.texto}</p>
                <Button size="sm" variant="outline" onClick={() => setEditando(true)}><Pencil className="size-4" /> Editar</Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ rotulo, texto, destaque = false }: { rotulo: string; texto: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn("whitespace-pre-wrap text-secondary", destaque && "rounded-md bg-muted/40 px-3 py-2 leading-relaxed")}>{texto}</p>
    </div>
  );
}
