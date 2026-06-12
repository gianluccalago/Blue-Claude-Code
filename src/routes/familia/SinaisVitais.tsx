import { Activity, HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useResidenteFamilia } from "@/hooks/useFamilia";

/**
 * Sinais vitais — comunicação HONESTA à família (5.7): o recurso depende de
 * sensores/wearables; comunicamos com calor humano e SEM prometer prazo.
 */
export function SinaisVitais() {
  const residente = useResidenteFamilia();
  const nome = residente.data?.nome?.split(" ")[0] ?? "seu familiar";

  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Activity className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-secondary">Estamos preparando com todo o cuidado</h2>
      <p className="max-w-md leading-relaxed text-muted-foreground">
        O acompanhamento de sinais vitais em tempo real está sendo preparado com o cuidado e a
        segurança que {nome} merece. Em breve.
      </p>
      <p className="flex max-w-md items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <HeartHandshake className="size-4 text-primary" />
        Enquanto isso, nossa equipe acompanha {nome} de perto todos os dias — qualquer dúvida de
        saúde, fale com o Médico pelas Solicitações.
      </p>
    </Card>
  );
}
