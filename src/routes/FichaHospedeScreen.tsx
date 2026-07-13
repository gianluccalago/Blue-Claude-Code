import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RegistrarSaidaModal } from "@/components/RegistrarSaidaModal";
import { useAuth } from "@/auth/AuthProvider";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { useResidentes } from "@/hooks/usePlanos";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useEditarResidente, type ResidenteValor } from "@/hooks/useResidentesGestao";
import { HospedeSelector } from "@/components/HospedeSelector";
import { FichaHospedeCard } from "@/components/FichaHospedeCard";
import { ResidenteFicha } from "@/components/master/ResidenteFicha";
import { RecadoFamiliaEditor } from "@/components/coordenacao/RecadoFamiliaEditor";
import { CarteiraVacinalCard } from "@/components/vigilancia/CarteiraVacinalCard";
import { CondicoesSaudeCard } from "@/components/vigilancia/CondicoesSaudeCard";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { podeEditarFicha } from "@/lib/fichaHospede";

/**
 * Tela "Hóspedes" — ficha do hóspede, disponível em todos os perfis exceto
 * Família. Rota plana compartilhada (/app/$perfil/ficha): o componente lê o
 * perfil logado para decidir a lista (cuidador/enfermagem veem só os SEUS
 * designados; demais veem todos) e a visibilidade/edição da ficha.
 */
export function FichaHospedeScreen() {
  const { usuarioEfetivo, carregando } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const restrito = perfil === "cuidador" || perfil === "enfermagem";

  // Ambos os hooks são chamados sempre (regras de hooks); a designação só é
  // CONSULTADA para os perfis de ponta — Nutricionista/demais veem todos.
  const designados = useHospedesDesignados(usuarioAtual.id, restrito);
  const todos = useResidentes();
  const fonte = restrito ? designados : todos;

  const search = useSearch({ strict: false }) as { hospede?: string };
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>(search.hospede);
  const [editando, setEditando] = useState(false);
  const [registrandoSaida, setRegistrandoSaida] = useState(false);
  // Registrar saída/óbito: mesma permissão do Mapa das Suítes (Master/Direção).
  const podeRegistrarSaida = perfil === "master" || perfil === "direcao";

  const editar = useEditarResidente();

  if (carregando) return <LoadingState />;
  if (fonte.isLoading) return <LoadingState />;
  if (fonte.isError) return <ErrorState error={fonte.error} />;

  const lista = fonte.data ?? [];
  if (lista.length === 0) {
    return (
      <EmptyState
        label={
          restrito
            ? "Você não possui hóspedes designados."
            : "Nenhum hóspede cadastrado."
        }
      />
    );
  }

  const hospedeId = selecionadoId && lista.some((h) => h.id === selecionadoId) ? selecionadoId : lista[0]?.id;
  const hospede = lista.find((h) => h.id === hospedeId);
  const editavel = podeEditarFicha(perfil);

  async function salvarEdicao(valor: ResidenteValor) {
    if (!hospede) return;
    try {
      await editar.mutateAsync({ id: hospede.id, valor });
      toast.success("Ficha atualizada.");
      setEditando(false);
    } catch {
      toast.error("Não foi possível salvar a ficha.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Users className="size-5" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Hóspedes</h1>
        </div>
        {podeRegistrarSaida && hospede && (
          <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setRegistrandoSaida(true)}>
            <LogOut className="size-4" /> Registrar saída
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="py-4">
          <HospedeSelector
            hospedes={lista}
            selecionadoId={hospedeId}
            onSelect={(id) => {
              setSelecionadoId(id);
              setEditando(false);
            }}
          />
        </CardContent>
      </Card>

      {hospede &&
        (editando && editavel ? (
          <ResidenteFicha
            key={hospede.id}
            inicial={hospede}
            salvando={editar.isPending}
            onSalvar={salvarEdicao}
            onCancelar={() => setEditando(false)}
          />
        ) : (
          <FichaHospedeCard
            key={hospede.id}
            residente={hospede}
            perfil={perfil}
            podeEditar={editavel}
            onEditar={() => setEditando(true)}
          />
        ))}

      {/* Condições de saúde / Comorbidades (RDC 502 Art. 37) — Coord/Médico/Master. */}
      {hospede && (perfil === "coordenacao" || perfil === "medico" || perfil === "master") && (
        <CondicoesSaudeCard residenteId={hospede.id} />
      )}

      {/* Carteira vacinal (RDC 502 Art. 39) — Coordenação/Médico/Master. */}
      {hospede && (perfil === "coordenacao" || perfil === "medico" || perfil === "master") && (
        <CarteiraVacinalCard residenteId={hospede.id} nome={hospede.nome} />
      )}

      {/* Recado da equipe para a família — só Coordenação/Master. */}
      {hospede && (perfil === "coordenacao" || perfil === "master") && (
        <RecadoFamiliaEditor residenteId={hospede.id} nome={hospede.nome} />
      )}

      {registrandoSaida && hospede && (
        <RegistrarSaidaModal residente={hospede} onFechar={() => setRegistrandoSaida(false)} />
      )}
    </div>
  );
}
