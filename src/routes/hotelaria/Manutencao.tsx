/**
 * Manutenção — gestão de chamados (Hotelaria, BLOCO H2).
 */
import { useState, useMemo } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Camera,
  UserCog,
  Plus,
  X,
  Check,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useChamadosManutencao,
  useAtribuirResponsavel,
  useResolverChamado,
} from "@/hooks/useManutencao";
import { uploadFotoManutencao } from "@/lib/storage";
import { FormAbrirChamado } from "@/components/manutencao/FormAbrirChamado";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataHoraBR, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { ChamadoManutencao, StatusChamado, UrgenciaChamado } from "@/types/database";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function extrairErro(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return (e as { message: string }).message;
  return String(e);
}

const URGENCIA_LABEL: Record<UrgenciaChamado, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  emergencia: "Emergência",
};

const URGENCIA_BADGE: Record<UrgenciaChamado, "muted" | "secondary" | "warning" | "destructive"> = {
  baixa: "muted",
  media: "secondary",
  alta: "warning",
  emergencia: "destructive",
};

const STATUS_LABEL: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
};

const STATUS_BADGE: Record<StatusChamado, "destructive" | "warning" | "success"> = {
  aberto: "destructive",
  em_andamento: "warning",
  resolvido: "success",
};

function emergenciaAtiva(c: ChamadoManutencao): boolean {
  return c.urgencia === "emergencia" && c.status !== "resolvido";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function Manutencao() {
  const { data: chamados = [], isLoading, error } = useChamadosManutencao();
  const { data: residentes = [] } = useResidentes();

  const [filtroStatus, setFiltroStatus] = useState<StatusChamado | "todos">("todos");
  const [filtroUrgencia, setFiltroUrgencia] = useState<UrgenciaChamado | "todas">("todas");
  const [novoChamado, setNovoChamado] = useState(false);

  const nomeResidente = useMemo(() => {
    const m = new Map(residentes.map((r) => [r.id, r.nome]));
    return (id: string | null) => (id ? m.get(id) ?? "Não informado" : null);
  }, [residentes]);

  const contadores = useMemo(() => {
    return {
      abertos: chamados.filter((c) => c.status === "aberto").length,
      emAndamento: chamados.filter((c) => c.status === "em_andamento").length,
      emergencias: chamados.filter((c) => emergenciaAtiva(c)).length,
    };
  }, [chamados]);

  const ordenados = useMemo(() => {
    const filtrados = chamados.filter(
      (c) =>
        (filtroStatus === "todos" || c.status === filtroStatus) &&
        (filtroUrgencia === "todas" || c.urgencia === filtroUrgencia)
    );
    return [...filtrados].sort((a, b) => {
      const aE = emergenciaAtiva(a);
      const bE = emergenciaAtiva(b);
      if (aE !== bE) return aE ? -1 : 1;
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    });
  }, [chamados, filtroStatus, filtroUrgencia]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Manutenção</h1>
          <p className="text-sm text-muted-foreground">Chamados de manutenção</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setNovoChamado((v) => !v)}>
          {novoChamado ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {novoChamado ? "Cancelar" : "Novo chamado"}
        </Button>
      </div>

      {novoChamado && (
        <FormAbrirChamado
          residentes={residentes}
          perfilSolicitante="hotelaria"
          abertoPorPadrao="Hotelaria"
          onConcluido={() => setNovoChamado(false)}
        />
      )}

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={cn("border-l-4", contadores.abertos > 0 ? "border-l-destructive" : "border-l-green-500")}>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold leading-none">{contadores.abertos}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Abertos</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", contadores.emAndamento > 0 ? "border-l-amber-500" : "border-l-green-500")}>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold leading-none">{contadores.emAndamento}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Em andamento</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", contadores.emergencias > 0 ? "border-l-destructive" : "border-l-green-500")}>
          <CardContent className="pt-4 pb-3">
            <p className={cn("text-2xl font-bold leading-none", contadores.emergencias > 0 && "text-destructive")}>
              {contadores.emergencias}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Emergências ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusChamado | "todos")}
          className={cn(inputClass, "w-auto")}
        >
          <option value="todos">Todos os status</option>
          <option value="aberto">Aberto</option>
          <option value="em_andamento">Em andamento</option>
          <option value="resolvido">Resolvido</option>
        </select>
        <select
          value={filtroUrgencia}
          onChange={(e) => setFiltroUrgencia(e.target.value as UrgenciaChamado | "todas")}
          className={cn(inputClass, "w-auto")}
        >
          <option value="todas">Todas as urgências</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
          <option value="emergencia">Emergência</option>
        </select>
      </div>

      {/* Lista de chamados */}
      {ordenados.length === 0 ? (
        <EmptyState label="Nenhum chamado encontrado." />
      ) : (
        <div className="space-y-2">
          {ordenados.map((c) => (
            <ChamadoCard key={c.id} chamado={c} nomeResidente={nomeResidente(c.residente_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de chamado (expansível) ─────────────────────────────────────────────

function ChamadoCard({
  chamado,
  nomeResidente,
}: {
  chamado: ChamadoManutencao;
  nomeResidente: string | null;
}) {
  const [expandido, setExpandido] = useState(false);
  const destaque = emergenciaAtiva(chamado);

  return (
    <Card className={cn(destaque && "border-destructive bg-red-50/40")}>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center gap-3 p-4 text-left"
          onClick={() => setExpandido((v) => !v)}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              chamado.status === "resolvido"
                ? "bg-green-100 text-green-600"
                : destaque
                  ? "bg-red-100 text-destructive"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {chamado.status === "resolvido" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : destaque ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{chamado.local}</span>
              <Badge variant={URGENCIA_BADGE[chamado.urgencia]} className="text-xs">
                {URGENCIA_LABEL[chamado.urgencia]}
              </Badge>
              <Badge variant={STATUS_BADGE[chamado.status]} className="text-xs">
                {STATUS_LABEL[chamado.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{chamado.problema}</p>
          </div>

          {expandido ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {expandido && (
          <div className="border-t px-4 pb-4 pt-3 space-y-3">
            <div className="grid gap-1.5 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Hóspede: </span>
                {ouNaoInformado(nomeResidente)}
              </p>
              <p>
                <span className="text-muted-foreground">Aberto por: </span>
                {ouNaoInformado(chamado.aberto_por)} ({chamado.perfil_solicitante})
              </p>
              <p>
                <span className="text-muted-foreground">Criado em: </span>
                {formatarDataHoraBR(chamado.criado_em)}
              </p>
              <p>
                <span className="text-muted-foreground">Responsável: </span>
                {ouNaoInformado(chamado.responsavel)}
              </p>
              <p>
                <span className="text-muted-foreground">Prazo: </span>
                {chamado.prazo ? formatarDataBR(chamado.prazo) : "Não informado"}
              </p>
              {chamado.resolvido_em && (
                <p>
                  <span className="text-muted-foreground">Resolvido em: </span>
                  {formatarDataHoraBR(chamado.resolvido_em)}
                </p>
              )}
            </div>

            <p className="text-sm">
              <span className="text-muted-foreground">Problema: </span>
              {chamado.problema}
            </p>

            {chamado.foto_url && (
              <a
                href={chamado.foto_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                <img
                  src={chamado.foto_url}
                  alt="Evidência da resolução"
                  className="h-28 w-28 rounded-md border object-cover"
                />
              </a>
            )}

            {chamado.status !== "resolvido" && (
              <AcoesChamado chamado={chamado} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Ações: atribuir responsável / resolver ───────────────────────────────────

function AcoesChamado({ chamado }: { chamado: ChamadoManutencao }) {
  const atribuir = useAtribuirResponsavel();
  const resolver = useResolverChamado();

  const [modo, setModo] = useState<"nenhum" | "atribuir" | "resolver">("nenhum");
  const [responsavel, setResponsavel] = useState(chamado.responsavel ?? "");
  const [prazo, setPrazo] = useState(chamado.prazo ?? "");
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleAtribuir() {
    if (!responsavel.trim()) return;
    setErro(null);
    try {
      await atribuir.mutateAsync({
        id: chamado.id,
        responsavel: responsavel.trim(),
        prazo: prazo || null,
      });
      setModo("nenhum");
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  async function handleResolver() {
    setErro(null);
    try {
      let fotoUrl: string | null = null;
      if (foto) {
        fotoUrl = await uploadFotoManutencao(foto, chamado.id);
      }
      await resolver.mutateAsync({ id: chamado.id, fotoUrl });
      setModo("nenhum");
      setFoto(null);
    } catch (e) {
      setErro(extrairErro(e));
    }
  }

  if (modo === "nenhum") {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setModo("atribuir")}>
          <UserCog className="h-3.5 w-3.5" />
          {chamado.status === "aberto" ? "Atribuir responsável" : "Editar atribuição"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setModo("resolver")}>
          <Check className="h-3.5 w-3.5" /> Resolver
        </Button>
      </div>
    );
  }

  if (modo === "atribuir") {
    return (
      <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-secondary">Responsável</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-secondary">Prazo</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={!responsavel.trim() || atribuir.isPending} onClick={handleAtribuir}>
            {atribuir.isPending ? "Salvando…" : "Confirmar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setModo("nenhum"); setErro(null); }}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-secondary">
          <Camera className="h-3.5 w-3.5" /> Foto de evidência (opcional)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={resolver.isPending} onClick={handleResolver}>
          {resolver.isPending ? "Salvando…" : "Confirmar resolução"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setModo("nenhum"); setErro(null); setFoto(null); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
