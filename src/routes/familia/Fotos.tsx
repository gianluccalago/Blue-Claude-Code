import { Image as ImageIcon, CalendarDays } from "lucide-react";
import { useFotosResidente } from "@/hooks/useFamilia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR } from "@/lib/utils";

/** Fotos das atividades em que o hóspede participou — somente visualização. */
export function Fotos() {
  const fotos = useFotosResidente();

  if (fotos.isLoading) return <LoadingState />;
  if (fotos.isError) return <ErrorState error={fotos.error} />;

  const lista = fotos.data ?? [];
  if (lista.length === 0)
    return (
      <EmptyState label="As fotos das atividades aparecerão aqui assim que o hóspede participar — momentos para guardar com carinho. 💙" />
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5 text-primary" /> Fotos das atividades
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((f) => (
          <Card key={f.id} className="overflow-hidden">
            <img src={f.fotoUrl} alt={f.atividadeTitulo} loading="lazy" className="h-48 w-full object-cover" />
            <CardContent className="space-y-1 py-3">
              <p className="font-semibold text-secondary">{f.atividadeTitulo}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5" /> {formatarDataBR(f.data)}
              </p>
              {f.descricaoGeral && <p className="text-sm text-secondary/80">{f.descricaoGeral}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
