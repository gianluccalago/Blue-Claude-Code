import { Construction } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { getPerfil } from "@/data/profiles";
import { Card } from "@/components/ui/card";

export function EmConstrucao() {
  const { perfil: perfilId } = useParams({ strict: false }) as { perfil?: string };
  const perfil = getPerfil(perfilId);

  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Construction className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-secondary">Em construção</h2>
      <p className="max-w-md text-muted-foreground">
        O módulo do perfil <span className="font-semibold">{perfil?.nome ?? ""}</span> será
        desenvolvido nas próximas etapas, sobre a mesma base. Por enquanto, os perfis{" "}
        <span className="font-semibold">Cuidadores</span>,{" "}
        <span className="font-semibold">Coordenação</span> e{" "}
        <span className="font-semibold">Master</span> possuem telas completas.
      </p>
    </Card>
  );
}
