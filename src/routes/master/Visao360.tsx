import { useMemo, useState } from "react";
import {
  User,
  ClipboardList,
  Pill,
  Utensils,
  FileText,
  Stethoscope,
  AlertTriangle,
  Droplet,
  Activity,
  CalendarClock,
  Wallet,
  CircleDot,
} from "lucide-react";
import { useResidentes, usePlanoItens } from "@/hooks/usePlanos";
import { usePrescricoes } from "@/hooks/useMedicacao";
import { useEliminacoes, calcularAlertasEliminacao } from "@/hooks/useEliminacao";
import { useCompromissos } from "@/hooks/useCompromissos";
import { useTratamentos, estadoDaPendencia } from "@/hooks/useCoordenacao";
import {
  useIntercorrenciasResidente,
  useAceitacaoResidenteHoje,
} from "@/hooks/useMaster";
import { HospedeSelector } from "@/components/HospedeSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import {
  calcularIdade,
  formatarDataBR,
  formatarDataHoraBR,
  hojeISO,
  ouNaoInformado,
} from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Residente } from "@/types/database";

// ===========================================================================
// MASTER-2 · Visão do hóspede (360°) — prontuário consolidado, modo LEITURA.
//
// Reúne numa única tela tudo o que cada perfil produz sobre o hóspede, sem o
// Master precisar trocar de perfil. Onde a fonte ainda não existe no schema
// (dieta, evoluções, IVCF, atividades multidisciplinares, financeiro), a
// seção exibe "sem dados" com a origem futura comentada — nunca dado fictício.
// ===========================================================================

const PERIODO_LABEL: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
  tarde: "Tarde",
  noite: "Noite",
};
const VIA_LABEL: Record<string, string> = {
  oral: "Oral",
  injetavel: "Injetável",
  insulina: "Insulina",
  sonda: "Sonda",
};

export function Visao360() {
  const residentes = useResidentes();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();

  const lista = residentes.data ?? [];
  // Seleciona o primeiro hóspede automaticamente quando a lista chega.
  const idAtivo = selecionadoId ?? lista[0]?.id;
  const hospede = lista.find((r) => r.id === idAtivo);

  if (residentes.isLoading) return <LoadingState />;
  if (residentes.error) return <ErrorState error={residentes.error} />;
  if (lista.length === 0) return <EmptyState label="Nenhum hóspede cadastrado." />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-secondary" /> Selecione o hóspede
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HospedeSelector
            hospedes={lista}
            selecionadoId={idAtivo}
            onSelect={setSelecionadoId}
          />
        </CardContent>
      </Card>

      {hospede && <Prontuario key={hospede.id} residenteId={hospede.id} hospede={hospede} />}
    </div>
  );
}

function Prontuario({ residenteId, hospede }: { residenteId: string; hospede: Residente }) {
  const plano = usePlanoItens(residenteId);
  const prescricoes = usePrescricoes(residenteId);
  const intercorrencias = useIntercorrenciasResidente(residenteId);
  const tratamentos = useTratamentos();
  const eliminacoes = useEliminacoes(residenteId);
  const aceitacao = useAceitacaoResidenteHoje(residenteId);
  const compromissos = useCompromissos([residenteId]);

  const carregando =
    plano.isLoading ||
    prescricoes.isLoading ||
    intercorrencias.isLoading ||
    tratamentos.isLoading ||
    eliminacoes.isLoading ||
    aceitacao.isLoading ||
    compromissos.isLoading;

  const erro =
    plano.error ??
    prescricoes.error ??
    intercorrencias.error ??
    tratamentos.error ??
    eliminacoes.error ??
    aceitacao.error ??
    compromissos.error;

  const alertas = useMemo(
    () => calcularAlertasEliminacao(eliminacoes.data ?? []),
    [eliminacoes.data],
  );

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const trat = tratamentos.data ?? [];
  const compromissosProximos = (compromissos.data ?? []).filter(
    (c) => !c.data || c.data >= hojeISO(),
  );
  const idade = calcularIdade(hospede.data_nascimento);

  return (
    <div className="space-y-6">
      {/* IDENTIFICAÇÃO */}
      <Secao icon={User} titulo="Identificação">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Campo rotulo="Nome" valor={hospede.nome} />
          <Campo rotulo="Quarto" valor={ouNaoInformado(hospede.quarto)} />
          <Campo
            rotulo="Grau atual"
            valor={hospede.grau_dependencia ? `Grau ${hospede.grau_dependencia}` : "Não informado"}
          />
          {/* Tipo de suíte e ocupação agora vêm da ficha (MASTER · Residentes). */}
          <Campo
            rotulo="Tipo de suíte"
            valor={
              hospede.tipo_suite
                ? `${hospede.tipo_suite}${hospede.ocupacao ? ` · ${hospede.ocupacao}` : ""}`
                : "Não informado"
            }
          />
          <Campo
            rotulo="Localização"
            valor={`Módulo ${ouNaoInformado(hospede.modulo?.toString() ?? null)} · Andar ${ouNaoInformado(
              hospede.andar?.toString() ?? null,
            )}`}
          />
          <Campo
            rotulo="Idade"
            valor={idade !== null ? `${idade} anos` : "Não informado"}
          />
          <Campo rotulo="Admissão" valor={formatarDataBR(hospede.data_admissao)} />
          <Campo rotulo="Responsável legal" valor={ouNaoInformado(hospede.responsavel_legal)} />
          <Campo rotulo="Contato" valor={ouNaoInformado(hospede.contato)} />
          <Campo rotulo="Alergias" valor={ouNaoInformado(hospede.alergias)} />
          <Campo rotulo="Próteses" valor={ouNaoInformado(hospede.proteses)} />
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold text-muted-foreground">História de vida</div>
          <p className="mt-1 text-sm text-secondary">{ouNaoInformado(hospede.historia_vida)}</p>
        </div>
      </Secao>

      {/* PLANO DE CUIDADO ATIVO */}
      <Secao icon={ClipboardList} titulo="Plano de cuidado ativo">
        {(plano.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma tarefa ativa no plano de cuidado." />
        ) : (
          <ul className="divide-y">
            {(plano.data ?? []).map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-medium text-secondary">{it.tarefa}</span>
                <div className="flex items-center gap-2">
                  {it.horario && <Badge variant="muted">{it.horario}</Badge>}
                  {it.responsavel && (
                    <Badge variant={it.responsavel === "enfermagem" ? "purple" : "default"}>
                      {it.responsavel}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* PRESCRIÇÕES ATIVAS */}
      <Secao
        icon={Pill}
        titulo="Prescrições ativas"
        acessorio={
          (prescricoes.data ?? []).length > 0 ? (
            <Badge variant="secondary">{(prescricoes.data ?? []).length} medicamentos</Badge>
          ) : undefined
        }
      >
        {(prescricoes.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma prescrição ativa." />
        ) : (
          <ul className="divide-y">
            {(prescricoes.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-secondary">
                  {p.medicamento} {p.dose ? <span className="text-muted-foreground">· {p.dose}</span> : null}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{VIA_LABEL[p.via] ?? p.via}</Badge>
                  <Badge variant="muted">{PERIODO_LABEL[p.periodo] ?? p.periodo}</Badge>
                  {p.horario && <Badge variant="muted">{p.horario}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* DIETA ATIVA — sem fonte no schema atual */}
      <Secao icon={Utensils} titulo="Dieta ativa">
        {/* SEM DADOS: não há tabela de dieta (consistência/restrições/observações).
            Origem futura: módulo de Nutrição. */}
        <SemDados nota="consistência, restrições e observações — módulo de Nutrição" />
      </Secao>

      {/* EVOLUÇÕES MÉDICAS E NUTRICIONAIS — sem fonte no schema atual */}
      <Secao icon={FileText} titulo="Últimas evoluções médicas e nutricionais">
        {/* SEM DADOS: não há tabela de evoluções. Origem futura: módulo Médico
            (evolução clínica) e módulo de Nutrição (evolução nutricional). */}
        <SemDados nota="evolução clínica e nutricional — módulos Médico e Nutrição" />
      </Secao>

      {/* IVCF — sem fonte no schema atual */}
      <Secao icon={Stethoscope} titulo="Última avaliação IVCF">
        {/* SEM DADOS: não há tabela de avaliações IVCF. Origem futura: módulo
            clínico/avaliação (pontuação, classificação e data). */}
        <SemDados nota="pontuação, classificação e data — avaliação IVCF (módulo clínico)" />
      </Secao>

      {/* INTERCORRÊNCIAS RECENTES */}
      <Secao icon={AlertTriangle} titulo="Intercorrências recentes">
        {(intercorrencias.data ?? []).length === 0 ? (
          <EmptyState label="Nenhuma intercorrência registrada." />
        ) : (
          <ul className="space-y-2">
            {(intercorrencias.data ?? []).slice(0, 8).map((i) => {
              const resolvido = estadoDaPendencia(trat, "intercorrencia", i.id).resolvido;
              return (
                <li key={i.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-secondary">{i.tipo}</span>
                    <Badge variant={resolvido ? "success" : "warning"}>
                      {resolvido ? "Resolvida" : "Em aberto"}
                    </Badge>
                  </div>
                  {i.observacao && (
                    <p className="mt-1 text-sm text-muted-foreground">{i.observacao}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatarDataHoraBR(i.registrado_em)} · {ouNaoInformado(i.registrado_por)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {/* ELIMINAÇÕES RECENTES E ALERTAS */}
      <Secao icon={Droplet} titulo="Eliminações recentes e alertas">
        <div className="mb-3 flex flex-wrap gap-2">
          {alertas.semUrinaHoje && (
            <Badge variant="warning" className="px-3 py-1.5">
              <Droplet className="size-3.5" /> Sem registro de urina hoje
            </Badge>
          )}
          {alertas.semEvacuacao72h && (
            <Badge variant="destructive" className="px-3 py-1.5">
              <CircleDot className="size-3.5" /> Sem evacuar há 3 dias ou mais
            </Badge>
          )}
          {!alertas.semUrinaHoje && !alertas.semEvacuacao72h && (
            <Badge variant="success" className="px-3 py-1.5">
              Sem alertas de eliminação
            </Badge>
          )}
        </div>
        {(eliminacoes.data ?? []).length === 0 ? (
          <EmptyState label="Sem registros de eliminação nos últimos 3 dias." />
        ) : (
          <ul className="divide-y">
            {(eliminacoes.data ?? []).slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <Badge variant={e.tipo === "evacuacao" ? "default" : "muted"}>
                  {e.tipo === "evacuacao" ? "Evacuação" : "Urina"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatarDataHoraBR(e.registrado_em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* ACEITAÇÃO ALIMENTAR RECENTE (hoje) */}
      <Secao icon={Utensils} titulo="Aceitação alimentar (hoje)">
        {(aceitacao.data ?? []).length === 0 ? (
          <SemDados nota="nenhuma refeição registrada hoje" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(aceitacao.data ?? []).map((a) => (
              <div key={a.refeicao} className="rounded-lg border bg-card p-3">
                <div className="text-xs font-semibold text-muted-foreground">{a.refeicao}</div>
                <div
                  className={
                    /^(Nada|Pouco)$/.test(a.nivel)
                      ? "text-sm font-bold text-destructive"
                      : "text-sm font-bold text-secondary"
                  }
                >
                  {a.nivel}
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* ATIVIDADES MULTIDISCIPLINARES — sem fonte no schema atual */}
      <Secao icon={Activity} titulo="Atividades multidisciplinares recentes">
        {/* SEM DADOS: não há tabela de atendimentos multidisciplinares.
            Origem futura: módulo Equipe Multidisciplinar (fisio/fono/nutri/psico). */}
        <SemDados nota="atendimentos de fisio/fono/nutrição/psicologia — módulo Multidisciplinar" />
      </Secao>

      {/* COMPROMISSOS EXTERNOS PRÓXIMOS */}
      <Secao icon={CalendarClock} titulo="Compromissos externos próximos">
        {compromissosProximos.length === 0 ? (
          <EmptyState label="Nenhum compromisso externo agendado." />
        ) : (
          <ul className="space-y-2">
            {compromissosProximos.map((c) => (
              <li key={c.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-secondary">{c.titulo}</span>
                  <Badge variant="muted">
                    {formatarDataBR(c.data)}
                    {c.horario ? ` · ${c.horario}` : ""}
                  </Badge>
                </div>
                {c.detalhes && (
                  <p className="mt-1 text-sm text-muted-foreground">{c.detalhes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* FINANCEIRO — sem fonte no schema atual */}
      <Secao icon={Wallet} titulo="Financeiro">
        {/* SEM DADOS: não há tabela de mensalidades/contratos nem upselling.
            Origem futura: módulo Administração/Financeiro. */}
        <SemDados nota="mensalidade vigente + upselling do mês — módulo Financeiro" />
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------------

function Secao({
  icon: Icon,
  titulo,
  acessorio,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  acessorio?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-secondary" /> {titulo}
          </span>
          {acessorio}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Campo({
  rotulo,
  valor,
  esmaecido,
}: {
  rotulo: string;
  valor: string;
  esmaecido?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{rotulo}</div>
      <div className={esmaecido ? "text-sm font-medium text-muted-foreground" : "text-sm font-medium text-secondary"}>
        {valor}
      </div>
    </div>
  );
}

function SemDados({ nota }: { nota?: string }) {
  return (
    <div>
      <span className="text-base font-semibold text-muted-foreground">sem dados</span>
      {nota && <p className="text-xs text-muted-foreground/80">{nota}</p>}
    </div>
  );
}
