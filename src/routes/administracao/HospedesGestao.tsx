import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FichaHospedeScreen } from "@/routes/FichaHospedeScreen";
import { HospedesInativos } from "@/routes/administracao/HospedesInativos";

// ===========================================================================
// Administração / Direção · Hóspedes — ativos e inativos num só item, em abas.
// "Ativos" reusa a ficha/busca de hóspedes (FichaHospedeScreen, que lê ?hospede
// de forma não-estrita, então funciona embutida); "Inativos" reusa o histórico
// de saídas. A rota antiga hospedes-inativos segue válida como deep link.
// ===========================================================================

export function HospedesGestao() {
  return (
    <Tabs defaultValue="ativos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="ativos">Ativos</TabsTrigger>
        <TabsTrigger value="inativos">Inativos</TabsTrigger>
      </TabsList>
      <TabsContent value="ativos">
        <FichaHospedeScreen />
      </TabsContent>
      <TabsContent value="inativos">
        <HospedesInativos />
      </TabsContent>
    </Tabs>
  );
}
