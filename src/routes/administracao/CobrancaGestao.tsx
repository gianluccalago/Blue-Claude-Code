import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PainelCobranca } from "@/routes/administracao/PainelCobranca";
import { CobrancaTemporaria } from "@/routes/administracao/CobrancaTemporaria";

// ===========================================================================
// Administração / Direção · Cobrança — mesma função, dois públicos, em abas.
// "Mensalistas" = fatura por responsável financeiro (PainelCobranca);
// "Temporários" = precificação/cobrança de curta permanência. A rota antiga
// cobranca-temporaria segue válida como deep link.
// ===========================================================================

export function CobrancaGestao() {
  return (
    <Tabs defaultValue="mensalistas" className="space-y-4">
      <TabsList>
        <TabsTrigger value="mensalistas">Mensalistas</TabsTrigger>
        <TabsTrigger value="temporarios">Temporários</TabsTrigger>
      </TabsList>
      <TabsContent value="mensalistas">
        <PainelCobranca />
      </TabsContent>
      <TabsContent value="temporarios">
        <CobrancaTemporaria />
      </TabsContent>
    </Tabs>
  );
}
