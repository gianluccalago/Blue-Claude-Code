import { HardHat } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { useObraAtiva } from "@/hooks/useObra";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState, EmptyState } from "@/components/states";
import { ObraCentral } from "@/routes/obra/ObraCentral";
import { ObraCronograma } from "@/routes/obra/ObraCronograma";
import { DiarioObra } from "@/routes/obra/DiarioObra";
import { ObraProjetos } from "@/routes/obra/ObraProjetos";
import { ObraFinanceiro } from "@/routes/obra/ObraFinanceiro";
import { ObraCustos } from "@/routes/obra/ObraCustos";
import { ObraFisica } from "@/routes/obra/ObraFisica";
import { PortalPrestador } from "@/routes/obra/PortalPrestador";

// ===========================================================================
// MÓDULO OBRA — shell com abas, organizado pela FASE ATUAL do empreendimento
// (desenvolvimento de projetos, TRÍADE 16/07/26 → 18/04/27):
//   Central (controle do dia a dia) · Cronograma (Gantt) · Projetos
//   (atividades + pagamentos) · Financeiro · Indiretos · Obra física
//   (execução/medições/materiais/controles — agrupadas até o canteiro abrir).
// Gate da feature flag (modulo_obra_ativo). Prestador cai no portal próprio.
// ===========================================================================

export function ObraShell() {
  const ativa = useObraAtiva();
  const { usuarioEfetivo } = useAuth();
  const { perfil: perfilRota } = useParams({ strict: false }) as { perfil?: string };

  if (ativa.isLoading) return <LoadingState />;
  if (ativa.data === false)
    return (
      <EmptyState label="O módulo Obra está desativado. Ative-o em obra_config (modulo_obra_ativo = true) para usar." />
    );

  // O prestador (construtora) tem um portal próprio, isolado do restante — sem
  // financeiro, materiais, indiretos nem controles do Contratante. Renderiza-o
  // tanto para o prestador logado/personificado (perfil efetivo) QUANTO quando
  // o Master visita a rota do prestador por URL: assim a "visão da construtora"
  // é sempre idêntica ao que o prestador realmente vê. (A trava real é a RLS.)
  if (usuarioEfetivo?.perfil === "obra_prestador" || perfilRota === "obra_prestador")
    return <PortalPrestador />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <HardHat className="size-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Obra</h1>
      </div>

      <Tabs defaultValue="central" className="space-y-4">
        <TabsList>
          <TabsTrigger value="central">Central</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="indiretos">Indiretos</TabsTrigger>
          <TabsTrigger value="fisica">Obra física</TabsTrigger>
        </TabsList>
        <TabsContent value="central">
          <ObraCentral />
        </TabsContent>
        <TabsContent value="cronograma">
          <ObraCronograma />
        </TabsContent>
        <TabsContent value="diario">
          <DiarioObra />
        </TabsContent>
        <TabsContent value="projetos">
          <ObraProjetos />
        </TabsContent>
        <TabsContent value="financeiro">
          <ObraFinanceiro />
        </TabsContent>
        <TabsContent value="indiretos">
          <ObraCustos />
        </TabsContent>
        <TabsContent value="fisica">
          <ObraFisica />
        </TabsContent>
      </Tabs>
    </div>
  );
}
