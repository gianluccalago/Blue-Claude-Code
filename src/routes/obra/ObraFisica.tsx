import { HardHat } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObraPainel } from "@/routes/obra/ObraPainel";
import { ObraExecucao } from "@/routes/obra/Obra";
import { ObraMedicoes } from "@/routes/obra/ObraMedicoes";
import { ObraMateriais } from "@/routes/obra/ObraMateriais";
import { ObraControles } from "@/routes/obra/ObraControles";

// ===========================================================================
// MÓDULO OBRA · OBRA FÍSICA — agrupa as ferramentas da fase de CONSTRUÇÃO
// (execução por etapas, medições de MO, materiais e controles de campo).
// A fase atual do empreendimento é o desenvolvimento de projetos — estas
// abas ficam agrupadas aqui, prontas para quando o canteiro abrir.
// ===========================================================================

export function ObraFisica() {
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-secondary">
        <HardHat className="size-4 shrink-0 text-primary" />
        Ferramentas da fase de construção (execução, medições de MO, materiais e controles de campo).
        A obra ainda não começou — o controle do dia a dia está na aba <span className="font-semibold">Central</span>.
      </p>
      <Tabs defaultValue="painel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="execucao">Execução</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="controles">Controles</TabsTrigger>
        </TabsList>
        <TabsContent value="painel"><ObraPainel /></TabsContent>
        <TabsContent value="execucao"><ObraExecucao /></TabsContent>
        <TabsContent value="medicoes"><ObraMedicoes /></TabsContent>
        <TabsContent value="materiais"><ObraMateriais /></TabsContent>
        <TabsContent value="controles"><ObraControles /></TabsContent>
      </Tabs>
    </div>
  );
}
