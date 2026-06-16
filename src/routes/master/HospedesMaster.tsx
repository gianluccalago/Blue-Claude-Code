import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Residentes } from "@/routes/master/Residentes";
import { HospedesInativos } from "@/routes/administracao/HospedesInativos";

// ===========================================================================
// MASTER · Hóspedes — ativos e inativos num só item de menu, em sub-abas.
// "Ativos" reusa a gestão completa de residentes (ficha editável); "Inativos"
// reusa o histórico de saídas (leitura + reativação). A rota antiga
// hospedes-inativos segue válida como deep link.
// ===========================================================================

export function HospedesMaster() {
  return (
    <Tabs defaultValue="ativos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="ativos">Ativos</TabsTrigger>
        <TabsTrigger value="inativos">Inativos</TabsTrigger>
      </TabsList>
      <TabsContent value="ativos">
        <Residentes />
      </TabsContent>
      <TabsContent value="inativos">
        <HospedesInativos />
      </TabsContent>
    </Tabs>
  );
}
