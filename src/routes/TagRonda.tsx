import { Link } from "@tanstack/react-router";
import { Nfc } from "lucide-react";

// ===========================================================================
// /r — destino do link gravado nas etiquetas NFC. Se o tablet ler a etiqueta
// FORA da tela de ronda, o Android abre este endereço. Ele NÃO registra
// nada: só a leitura feita pelo botão "Iniciar ronda" vale. Assim ninguém
// registra ronda abrindo ou editando o link no navegador.
// ===========================================================================
export function TagRonda() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-slate-200">
      <div className="max-w-sm space-y-4">
        <Nfc className="mx-auto size-14" />
        <p className="text-xl font-bold">Esta é a etiqueta de ronda do quarto.</p>
        <p className="text-sm text-slate-400">Para registrar, abra o app, toque em “Ronda” e depois em “Iniciar ronda”. Aí encoste o tablet de novo.</p>
        <Link to="/app/$perfil/ronda" params={{ perfil: "cuidador" }} className="inline-block rounded-lg bg-sky-800 px-5 py-3 font-semibold text-sky-50">
          Abrir a Ronda
        </Link>
      </div>
    </div>
  );
}
