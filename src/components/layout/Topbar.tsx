import { Clock } from "@/components/Clock";

export function Topbar({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-secondary">{titulo}</h1>
        {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      <Clock />
    </header>
  );
}
