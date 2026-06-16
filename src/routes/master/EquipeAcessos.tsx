import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UsuariosAcessos } from "@/routes/master/UsuariosAcessos";
import { Profissionais } from "@/routes/equipe/Profissionais";
import { Equipe } from "@/routes/master/Equipe";

// ===========================================================================
// MASTER · Equipe e acessos — fusão das três telas de gestão de pessoas num
// só item de menu, em abas. Cada aba reusa a tela existente sem alteração de
// lógica: Acessos (usuários/perfis), Profissionais (cuidadoras/enfermeiras) e
// Escala & horários (turnos e horário fixo). As rotas antigas (usuarios,
// profissionais, equipe) seguem válidas como deep links.
// ===========================================================================

export function EquipeAcessos() {
  return (
    <Tabs defaultValue="acessos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="acessos">Acessos</TabsTrigger>
        <TabsTrigger value="profissionais">Profissionais</TabsTrigger>
        <TabsTrigger value="escala">Escala &amp; horários</TabsTrigger>
      </TabsList>
      <TabsContent value="acessos">
        <UsuariosAcessos />
      </TabsContent>
      <TabsContent value="profissionais">
        <Profissionais />
      </TabsContent>
      <TabsContent value="escala">
        <Equipe />
      </TabsContent>
    </Tabs>
  );
}
