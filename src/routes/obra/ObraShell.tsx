import { HardHat } from "lucide-react";
import { useObraAtiva } from "@/hooks/useObra";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState } from "@/components/states";
import { ObraExecucao } from "@/routes/obra/Obra";
import { ObraMedicoes } from "@/routes/obra/ObraMedicoes";
import { ObraProjetos } from "@/routes/obra/ObraProjetos";
import { ObraMateriais } from "@/routes/obra/ObraMateriais";
import { ObraFinanceiro } from "@/routes/obra/ObraFinanceiro";
import { PortalPrestador } from "@/routes/obra/PortalPrestador";
import { ObraPainel } from "@/routes/obra/ObraPainel";
import { ObraControles } from "@/routes/obra/ObraControles";

// ===========================================================================
// MÓDULO OBRA — shell com abas. Gate da feature flag (modulo_obra_ativo):
// desligada, a rota mostra aviso amigável. Execução (Fase 1) e Medições (Fase 2).
// ===========================================================================

export function ObraShell() {
  const ativa = useObraAtiva();
  const { usuarioEfetivo } = useAuth();

  if (ativa.isLoading) return <LoadingState />;
  if (ativa.data === false)
    return (
      <EmptyState label="O módulo Obra está desativado. Ative-o em obra_config (modulo_obra_ativo = true) para usar." />
    );

  // O prestador (construtora) tem um portal próprio, isolado do restante.
  if (usuarioEfetivo?.perfil === "obra_prestador") return <PortalPrestador />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <HardHat className="size-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Obra</h1>
      </div>

      <Tabs defaultValue="painel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="execucao">Execução</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="controles">Controles</TabsTrigger>
        </TabsList>
        <TabsContent value="painel">
          <ObraPainel />
        </TabsContent>
        <TabsContent value="execucao">
          <ObraExecucao />
        </TabsContent>
        <TabsContent value="medicoes">
          <ObraMedicoes />
        </TabsContent>
        <TabsContent value="projetos">
          <ObraProjetos />
        </TabsContent>
        <TabsContent value="materiais">
          <ObraMateriais />
        </TabsContent>
        <TabsContent value="financeiro">
          <ObraFinanceiro />
        </TabsContent>
        <TabsContent value="controles">
          <ObraControles />
        </TabsContent>
      </Tabs>
    </div>
  );
}
