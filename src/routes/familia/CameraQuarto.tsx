import { Camera, HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useResidenteFamilia } from "@/hooks/useFamilia";

/**
 * Câmera do quarto — comunicação HONESTA à família (5.7): o recurso ainda não
 * existe; em vez de um "em desenvolvimento" frio, explicamos o porquê (consen-
 * timento e privacidade) com calor humano e SEM prometer prazo.
 */
export function CameraQuarto() {
  const residente = useResidenteFamilia();
  const nome = residente.data?.nome?.split(" ")[0] ?? "seu familiar";

  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Camera className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-secondary">Estamos preparando com todo o cuidado</h2>
      <p className="max-w-md leading-relaxed text-muted-foreground">
        A câmera do quarto está sendo preparada com o cuidado que {nome} merece — incluindo o
        consentimento formal e a privacidade de cada hóspede. Em breve.
      </p>
      <p className="flex max-w-md items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <HeartHandshake className="size-4 text-primary" />
        Enquanto isso, nossa equipe está com {nome} todos os dias — e você pode falar conosco a
        qualquer momento pelas Solicitações.
      </p>
    </Card>
  );
}
