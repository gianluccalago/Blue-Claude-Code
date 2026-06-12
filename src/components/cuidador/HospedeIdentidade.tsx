import { AlertTriangle, User } from "lucide-react";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { Residente } from "@/types/database";
import type { ReactNode } from "react";

/**
 * Identidade do hóspede nas telas de ação da ponta (poka-yoke + cuidado
 * percebido): FOTO + nome + quarto, com faixa de ALERGIA em destaque.
 * Reusa o padrão visual do banner do Checklist; a foto vem da ficha
 * (residentes.foto_url). `children` permite selos extras (ex.: dieta).
 */
export function HospedeIdentidade({
  hospede,
  compacto = false,
  children,
}: {
  hospede: Residente;
  compacto?: boolean;
  children?: ReactNode;
}) {
  const inicial = hospede.nome.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="overflow-hidden rounded-lg bg-navy-gradient text-white shadow-card">
      <div className={cn("flex items-center gap-3", compacto ? "px-4 py-3" : "px-4 py-4")}>
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/25",
            compacto ? "size-11" : "size-14",
          )}
        >
          {hospede.foto_url ? (
            <img
              src={hospede.foto_url}
              alt={`Foto de ${hospede.nome}`}
              className="size-full object-cover"
            />
          ) : (
            <span className={cn("font-extrabold", compacto ? "text-lg" : "text-xl")}>
              {inicial || <User className="size-5" />}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-extrabold leading-tight", compacto ? "text-base" : "text-lg")}>
            {hospede.nome}
          </p>
          <p className="text-sm text-white/70">Quarto {ouNaoInformado(hospede.quarto)}</p>
        </div>
        {children}
      </div>

      {/* Faixa de alergia — SEMPRE visível quando houver (segurança) */}
      {hospede.alergias && hospede.alergias.trim() !== "" && (
        <div className="flex items-center gap-2 border-t border-white/10 bg-destructive px-4 py-2">
          <AlertTriangle className="size-4 shrink-0" />
          <p className="text-sm font-extrabold uppercase tracking-wide">
            Alérgico a {hospede.alergias}
          </p>
        </div>
      )}
    </div>
  );
}
