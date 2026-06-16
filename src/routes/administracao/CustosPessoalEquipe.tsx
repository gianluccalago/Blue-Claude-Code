import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustosPessoal } from "@/routes/administracao/CustosPessoal";
import { RemuneracaoEquipe } from "@/routes/administracao/RemuneracaoEquipe";

// ===========================================================================
// Administração / Direção · Custos de pessoal — em abas. "Pagamentos" = cálculo
// previsto×realizado por profissional/mês (CustosPessoal); "Tabela de
// remuneração" = valores de referência que ALIMENTAM o cálculo
// (RemuneracaoEquipe). A rota antiga remuneracao-equipe segue válida como deep
// link.
// ===========================================================================

export function CustosPessoalEquipe() {
  return (
    <Tabs defaultValue="pagamentos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        <TabsTrigger value="remuneracao">Tabela de remuneração</TabsTrigger>
      </TabsList>
      <TabsContent value="pagamentos">
        <CustosPessoal />
      </TabsContent>
      <TabsContent value="remuneracao">
        <RemuneracaoEquipe />
      </TabsContent>
    </Tabs>
  );
}
