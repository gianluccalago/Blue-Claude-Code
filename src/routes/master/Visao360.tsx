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
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CondicoesSaudeCard } from "@/components/vigilancia/CondicoesSaudeCard";
import { useResidentes, usePlanoItens } from "@/hooks/usePlanos";
import { usePrescricoes } from "@/hooks/useMedicacao";
import { useEliminacoes, calcularAlertasEliminacao } from "@/hooks/useEliminacao";
import { useCompromissos } from "@/hooks/useCompromissos";
import { useTratamentos, estadoDaPendencia } from "@/hooks/useCoordenacao";
import { useAvaliacoesIVCF, useEvolucoes } from "@/hooks/useMedico";
import { useDietaAtiva, useEvolucaoNutricional } from "@/hooks/useNutricao";
import { useUltimosPesos } from "@/hooks/usePeso";
import { resumoPeso, CLASSIFICACAO_IMC_LABEL, CLASSIFICACAO_IMC_VARIANTE } from "@/lib/imc";
import { useHistoricoParticipacao } from "@/hooks/useAtividades";
import { useLancamentosDoMes } from "@/hooks/useUpselling";
import { formatarMoeda, mesAtual } from "@/lib/mensalidade";
import {
  useIntercorrenciasResidente,
  useAceitacaoResidenteHoje,
} from "@/hooks/useMaster";
import { HospedeSelector } from "@/components/HospedeSelector";
import { GrauContratualReal } from "@/components/GrauContratualReal";
import { formatarQuarto } from "@/lib/quarto";
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
  // Dados agora reais (pós-unificação): IVCF, dieta, evoluções, atividades, financeiro.
  const ivcf = useAvaliacoesIVCF(residenteId);
  const dieta = useDietaAtiva(residenteId);
  const evolMedica = useEvolucoes(residenteId);
  const evolNutri = useEvolucaoNutricional(residenteId);
  const atividades = useHistoricoParticipacao(residenteId);
  const pesos = useUltimosPesos(residenteId);
  const mesRef = mesAtual();
  const upselling = useLancamentosDoMes(residenteId, mesRef);

  const carregando =
    plano.isLoading ||
    prescricoes.isLoading ||
    intercorrencias.isLoading ||
    tratamentos.isLoading ||
    eliminacoes.isLoading ||
    aceitacao.isLoading ||
    compromissos.isLoading ||
    ivcf.isLoading ||
    dieta.isLoading ||
    evolMedica.isLoading ||
    evolNutri.isLoading ||
    atividades.isLoading ||
    pesos.isLoading ||
    upselling.isLoading;

  const erro =
    plano.error ??
    prescricoes.error ??
    intercorrencias.error ??
    tratamentos.error ??
    eliminacoes.error ??
    aceitacao.error ??
    compromissos.error ??
    ivcf.error ??
    dieta.error ??
    evolMedica.error ??
    evolNutri.error ??
    atividades.error ??
    pesos.error ??
    upselling.error;

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

  // Derivados dos dados reais.
  const ultimaIvcf = (ivcf.data ?? [])[0] ?? null;
  const ultimaEvolMedica = (evolMedica.data ?? [])[0] ?? null;
  const ultimaEvolNutri = (evolNutri.data ?? [])[0] ?? null;
  const atividadesRecentes = (atividades.data ?? []).filter((a) => a.presente).slice(0, 5);
  const peso = resumoPeso(pesos.data ?? []);
  const upsellingMes = upselling.data ?? [];
  const totalUpselling = upsellingMes.reduce((s, u) => s + (u.valor ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* CONDIÇÕES DE SAÚDE / COMORBIDADES (RDC 502 Art. 37) — leitura. */}
      <CondicoesSaudeCard residenteId={residenteId} somenteLeitura />

      {/* IDENTIFICAÇÃO */}
      <Secao icon={User} titulo="Identificação">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Campo rotulo="Nome" valor={hospede.nome} />
          <Campo rotulo="Quarto" valor={ouNaoInformado(formatarQuarto(hospede.quarto))} />
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
          <Campo rotulo="Entrada no Blue" valor={formatarDataBR(hospede.data_admissao)} />
          <Campo rotulo="Responsável legal" valor={ouNaoInformado(hospede.responsavel_legal)} />
          <Campo rotulo="Contato" valor={ouNaoInformado(hospede.contato)} />
          <Campo rotulo="Alergias" valor={ouNaoInformado(hospede.alergias)} />
          <Campo rotulo="Próteses" valor={ouNaoInformado(hospede.proteses)} />
        </div>
        <GrauContratualReal
          className="mt-4"
          contratual={hospede.grau_contratual}
          real={hospede.grau_dependencia}
        />
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

      {/* DIETA ATIVA (módulo de Nutrição) */}
      <Secao icon={Utensils} titulo="Dieta ativa">
        {!dieta.data ? (
          <EmptyState label="Nenhuma dieta ativa cadastrada." />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{dieta.data.consistencia}</Badge>
              {(dieta.data.restricoes ?? []).map((r) => (
                <Badge key={r} variant="warning">
                  {r}
                </Badge>
              ))}
            </div>
            {dieta.data.observacoes && (
              <p className="text-sm text-muted-foreground">{dieta.data.observacoes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Definida por {ouNaoInformado(dieta.data.definida_por)} ·{" "}
              {formatarDataBR(dieta.data.definida_em)}
            </p>
          </div>
        )}
      </Secao>

      {/* EVOLUÇÕES MÉDICAS E NUTRICIONAIS (módulos Médico e Nutrição) */}
      <Secao icon={FileText} titulo="Últimas evoluções médicas e nutricionais">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Médica</div>
            {!ultimaEvolMedica ? (
              <p className="text-sm text-muted-foreground">Sem evoluções médicas.</p>
            ) : (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-sm text-secondary">{ultimaEvolMedica.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatarDataHoraBR(ultimaEvolMedica.registrado_em)} ·{" "}
                  {ouNaoInformado(ultimaEvolMedica.registrado_por)}
                </p>
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">Nutricional</div>
            {!ultimaEvolNutri ? (
              <p className="text-sm text-muted-foreground">Sem evoluções nutricionais.</p>
            ) : (
              <div className="rounded-lg border bg-card p-3">
                <p className="text-sm text-secondary">{ultimaEvolNutri.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatarDataHoraBR(ultimaEvolNutri.registrado_em)} ·{" "}
                  {ouNaoInformado(ultimaEvolNutri.registrado_por)}
                </p>
              </div>
            )}
          </div>
        </div>
      </Secao>

      {/* ÚLTIMA AVALIAÇÃO IVCF (módulo clínico) */}
      <Secao icon={Stethoscope} titulo="Última avaliação IVCF">
        {!ultimaIvcf ? (
          <SemDados nota="nenhuma avaliação IVCF registrada para este hóspede" />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-extrabold tabular-nums text-secondary">
              {ultimaIvcf.pontuacao_total}
            </span>
            <Badge
              variant={
                ultimaIvcf.classificacao === "Grau III"
                  ? "destructive"
                  : ultimaIvcf.classificacao === "Grau II"
                    ? "warning"
                    : "success"
              }
            >
              {ultimaIvcf.classificacao}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatarDataBR(ultimaIvcf.registrado_em)} ·{" "}
              {ouNaoInformado(ultimaIvcf.registrado_por)}
            </span>
          </div>
        )}
      </Secao>

      {/* PESO E IMC (módulo Nutrição · N6) — sinal clínico com tendência */}
      <Secao
        icon={Scale}
        titulo="Peso e IMC"
        acessorio={
          peso.emRisco ? (
            <Badge variant="destructive">
              {peso.perdaRelevante
                ? "Perda relevante"
                : peso.tendenciaQueda
                  ? "Tendência de queda"
                  : "Baixo peso"}
            </Badge>
          ) : undefined
        }
      >
        {!peso.ultimo ? (
          <SemDados nota="nenhuma pesagem registrada para este hóspede" />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-extrabold tabular-nums text-secondary">
              {peso.ultimo.peso_kg} <span className="text-base font-semibold text-muted-foreground">kg</span>
            </span>
            {peso.ultimo.imc !== null && (
              <span className="text-sm text-muted-foreground">IMC {peso.ultimo.imc}</span>
            )}
            {peso.classificacao && (
              <Badge variant={CLASSIFICACAO_IMC_VARIANTE[peso.classificacao]}>
                {CLASSIFICACAO_IMC_LABEL[peso.classificacao]}
              </Badge>
            )}
            {peso.variacaoKg !== null && peso.variacaoKg !== 0 && (
              <span
                className={
                  peso.variacaoKg < 0
                    ? "inline-flex items-center gap-0.5 text-sm font-semibold text-destructive"
                    : "inline-flex items-center gap-0.5 text-sm font-semibold text-success"
                }
              >
                {peso.variacaoKg < 0 ? (
                  <TrendingDown className="size-4" />
                ) : (
                  <TrendingUp className="size-4" />
                )}
                {peso.variacaoKg > 0 ? "+" : ""}
                {peso.variacaoKg} kg
                {peso.variacaoPct !== null && ` (${peso.variacaoPct > 0 ? "+" : ""}${peso.variacaoPct}%)`}
                {peso.anterior && (
                  <span className="font-normal text-muted-foreground"> vs. {formatarDataBR(peso.anterior.data)}</span>
                )}
              </span>
            )}
            <span className="w-full text-xs text-muted-foreground">
              Última pesagem {formatarDataBR(peso.ultimo.data)} · {ouNaoInformado(peso.ultimo.registrado_por)}
            </span>
          </div>
        )}
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

      {/* ATIVIDADES MULTIDISCIPLINARES (módulo Multidisciplinar) */}
      <Secao icon={Activity} titulo="Atividades multidisciplinares recentes">
        {atividadesRecentes.length === 0 ? (
          <EmptyState label="Nenhuma participação em atividades registrada." />
        ) : (
          <ul className="space-y-2">
            {atividadesRecentes.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <span className="font-medium text-secondary">
                  {a.atividade_titulo ?? "Atividade"}
                </span>
                <Badge variant="muted">{formatarDataBR(a.data)}</Badge>
              </li>
            ))}
          </ul>
        )}
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

      {/* FINANCEIRO (módulo Administração) — mensalidade vigente + upselling do mês */}
      <Secao icon={Wallet} titulo="Financeiro">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Campo rotulo="Mensalidade vigente" valor={formatarMoeda(hospede.mensalidade_valor)} />
          <Campo
            rotulo={`Upselling (${mesRef})`}
            valor={upsellingMes.length === 0 ? "Nenhum no mês" : formatarMoeda(totalUpselling)}
          />
          <Campo
            rotulo="Total previsto"
            valor={
              hospede.mensalidade_valor != null
                ? formatarMoeda((hospede.mensalidade_valor ?? 0) + totalUpselling)
                : "Não informado"
            }
          />
        </div>
        {upsellingMes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {upsellingMes.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
              >
                <span>{u.categoria}</span>
                <span className="tabular-nums">{formatarMoeda(u.valor)}</span>
              </li>
            ))}
          </ul>
        )}
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
