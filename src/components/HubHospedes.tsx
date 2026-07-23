import { useState } from "react";
import { Search, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { FotoSegura } from "@/components/AnexoSeguro";
import { SeloModalidade } from "@/components/SeloModalidade";
import { GrauContratualReal } from "@/components/GrauContratualReal";
import { BUCKET_FOTOS_RESIDENTE } from "@/lib/storage";
import { podeVerGrauReal } from "@/lib/fichaHospede";
import { calcularIdade } from "@/lib/utils";
import type { Residente } from "@/types/database";

// ===========================================================================
// HUB DE HÓSPEDES — porta de entrada das telas "escolha um hóspede e
// trabalhe" (Ficha, Visão 360, Medicação, Atendimentos, Dispensação…).
// Em vez de cair direto no primeiro da lista (confuso), o usuário vê a casa
// inteira: busca + grade de cards com foto/iniciais, quarto, idade e grau.
// Mobile-first: 1 coluna no celular; alvos de toque ≥ 44px.
// ===========================================================================

/** Iniciais (até 2 letras) para o avatar sem foto. */
function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

export function HubHospedes({
  hospedes,
  onSelect,
  descricao = "Escolha um hóspede para abrir",
}: {
  hospedes: Residente[];
  onSelect: (id: string) => void;
  descricao?: string;
}) {
  const [busca, setBusca] = useState("");
  const { usuarioEfetivo } = useAuth();
  const ocultarGrauReal = !podeVerGrauReal(usuarioEfetivo?.perfil);

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? hospedes.filter(
        (h) => h.nome.toLowerCase().includes(termo) || (h.quarto ?? "").toLowerCase().includes(termo),
      )
    : hospedes;

  return (
    <div className="space-y-4">
      {/* Busca + contagem */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou quarto…"
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <Users className="size-3.5" /> {hospedes.length} hóspede{hospedes.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{descricao}.</p>

      {/* Grade de cards */}
      {filtrados.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum hóspede encontrado para “{busca}”.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((h) => {
            const idade = calcularIdade(h.data_nascimento);
            return (
              <button
                key={h.id}
                onClick={() => onSelect(h.id)}
                className="group flex min-h-[72px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-card active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FotoSegura
                  bucket={BUCKET_FOTOS_RESIDENTE}
                  stored={h.foto_url}
                  alt={h.nome}
                  className="size-12 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                  fallback={
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-glow-primary">
                      {iniciais(h.nome)}
                    </span>
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-secondary">{h.nome}</span>
                    <SeloModalidade modalidade={h.modalidade} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Quarto {h.quarto ?? "—"}
                    {idade != null ? ` · ${idade} anos` : ""}
                  </span>
                  <GrauContratualReal
                    compact
                    className="mt-0.5"
                    contratual={h.grau_contratual}
                    real={h.grau_dependencia}
                    ocultarReal={ocultarGrauReal}
                  />
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Botão "Ver todos" — volta ao hub a partir da visão de um hóspede. */
export function BotaoVerTodos({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-secondary transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Users className="size-3.5" /> Ver todos
    </button>
  );
}
