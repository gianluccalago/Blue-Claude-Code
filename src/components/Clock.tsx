import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";

export function Clock() {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = agora.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-semibold text-secondary">
      <ClockIcon className="size-4 text-primary" />
      <span className="tabular-nums">{hora}</span>
      <span className="hidden text-muted-foreground sm:inline">· {data}</span>
    </div>
  );
}
