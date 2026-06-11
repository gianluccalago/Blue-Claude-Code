import { Camera } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Placeholder — exibirá a câmera do quarto do hóspede.
 * Depende de integração com o sistema de câmeras do estabelecimento e do
 * consentimento formal da família/responsável legal.
 */
export function CameraQuarto() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Camera className="size-7" />
      </div>
      <h2 className="text-xl font-bold text-secondary">Em desenvolvimento</h2>
      <p className="max-w-md text-muted-foreground">
        Esta tela exibirá a câmera do quarto do hóspede. O recurso depende da integração com o
        sistema de câmeras do estabelecimento e do consentimento formal da família/responsável
        legal antes de ser habilitado.
      </p>
    </Card>
  );
}
