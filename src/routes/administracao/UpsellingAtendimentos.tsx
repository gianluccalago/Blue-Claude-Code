import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upselling } from "@/routes/administracao/Upselling";
import { AtendimentosPrecificar } from "@/routes/administracao/AtendimentosPrecificar";

// ===========================================================================
// Administração / Direção · Upselling & atendimentos — em abas. "Lançamentos" =
// extras dos hóspedes (Upselling); "A precificar" = atendimentos individuais
// que GERAM lançamento no Upselling — a entrada natural dele. A rota antiga
// atendimentos-precificar segue válida como deep link.
// ===========================================================================

export function UpsellingAtendimentos() {
  return (
    <Tabs defaultValue="lancamentos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        <TabsTrigger value="precificar">A precificar</TabsTrigger>
      </TabsList>
      <TabsContent value="lancamentos">
        <Upselling />
      </TabsContent>
      <TabsContent value="precificar">
        <AtendimentosPrecificar />
      </TabsContent>
    </Tabs>
  );
}
