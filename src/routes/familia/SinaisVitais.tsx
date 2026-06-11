import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Placeholder — exibirá os sinais vitais do hóspede em tempo real.
 * Depende de integração com wearables/sensores do quarto via API.
 */
export function SinaisVitais() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Activity className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-secondary">Em desenvolvimento</h2>
      <p className="max-w-md text-muted-foreground">
        Esta tela exibirá os sinais vitais do hóspede (frequência cardíaca, oxigenação, sono e
        outros). O recurso depende da integração com wearables/sensores do quarto via API.
      </p>
    </Card>
  );
}
