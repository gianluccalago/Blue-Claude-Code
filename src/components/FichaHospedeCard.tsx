import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  Pencil,
  AlertTriangle,
  CalendarDays,
  Phone,
  Users,
  HeartPulse,
  BookOpen,
  Salad,
  Pill,
  Activity,
  Wallet,
  Layers,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeloModalidade } from "@/components/SeloModalidade";
import { FotoUploader } from "@/components/FotoUploader";
import { useDietaAtiva } from "@/hooks/useNutricao";
import { useUltimosPesos } from "@/hooks/usePeso";
import { resumoPeso, CLASSIFICACAO_IMC_LABEL, CLASSIFICACAO_IMC_VARIANTE } from "@/lib/imc";
import { usePrescricoesAtivas, useAvaliacoesIVCF } from "@/hooks/useMedico";
import { usePagamentosDoMes } from "@/hooks/useMensalidades";
import { useDefinirFotoResidente } from "@/hooks/useResidentesGestao";
import { uploadFotoResidente, BUCKET_FOTOS_RESIDENTE } from "@/lib/storage";
import { fichaCompleta, podeVerFinanceiro, podeVerAlergias, podeVerGrauReal } from "@/lib/fichaHospede";
import { GrauContratualReal } from "@/components/GrauContratualReal";
import { formatarQuarto } from "@/lib/quarto";
import {
  calcularIdade,
  tempoDePermanencia,
  ouNaoInformado,
  formatarDataBR,
} from "@/lib/utils";
import { mesAtual, formatarMoeda, OCUPACAO_LABEL } from "@/lib/mensalidade";
import { statusEfetivoCobranca, STATUS_COBRANCA_LABEL, STATUS_COBRANCA_VARIANTE } from "@/lib/cobranca";
import type { PerfilUsuario, Residente } from "@/types/database";

/**
 * Ficha do hóspede — componente único reutilizado por TODOS os perfis (menos
 * Família). A visibilidade segue o perfil logado: gestão/clínica veem a ficha
 * COMPLETA (financeiro, plano de saúde, contatos); perfis assistenciais veem a
 * versão operacional (sem financeiro/plano detalhado/contatos financeiros).
 * Alergias em destaque para perfis assistenciais/clínicos (segurança); some
 * nos administrativos puros. Edição/foto só para quem tem permissão
 * (Master/Coordenação/Administração) via props.
 */
export function FichaHospedeCard({
  residente: r,
  perfil,
  podeEditar,
  onEditar,
}: {
  residente: Residente;
  perfil: PerfilUsuario | undefined;
  podeEditar: boolean;
  onEditar?: () => void;
}) {
  const completa = fichaCompleta(perfil);
  // Cuidadoras/enfermagem cuidam pelo grau de INGRESSO; o grau real (IVCF) fica
  // oculto para esses perfis (inclui a linha "Última avaliação IVCF" do resumo).
  const verGrauReal = podeVerGrauReal(perfil);

  const idade = calcularIdade(r.data_nascimento);
  const permanencia = tempoDePermanencia(r.data_admissao);

  return (
    <div className="space-y-5">
      {/* CABEÇALHO */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <FotoHospede residente={r} podeEditar={podeEditar} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-secondary">{r.nome}</h2>
                <p className="text-sm text-muted-foreground">
                  Quarto {ouNaoInformado(formatarQuarto(r.quarto))} · {permanencia}
                </p>
              </div>
              {podeEditar && onEditar && (
                <Button variant="outline" size="sm" onClick={onEditar}>
                  <Pencil className="size-4" /> Editar ficha
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeloModalidade modalidade={r.modalidade} />
              {idade !== null && <Badge variant="secondary">{idade} anos</Badge>}
              {r.tipo_suite && <Badge variant="muted">{r.tipo_suite}</Badge>}
              {r.ocupacao && <Badge variant="muted">{OCUPACAO_LABEL[r.ocupacao]}</Badge>}
            </div>
            {/* Estadia temporária: previsão de término (curta permanência / day care). */}
            {r.data_fim_prevista && (
              <p className="mt-1 text-xs text-muted-foreground">
                Término previsto: {formatarDataBR(r.data_fim_prevista)}
              </p>
            )}
            {/* Grau de ingresso × real (IVCF) com destaque na divergência. Para
                cuidadoras/enfermagem exibe SÓ o grau de ingresso (oculta o real). */}
            <GrauContratualReal
              className="mt-2"
              contratual={r.grau_contratual}
              real={r.grau_dependencia}
              ocultarReal={!verGrauReal}
            />
          </div>
        </CardContent>
      </Card>

      {/* ALERGIAS — destaque de segurança CLÍNICA: some nos perfis
          administrativos puros (Administração/Direção), onde é só ruído. */}
      {podeVerAlergias(perfil) && <BannerAlergias alergias={r.alergias} />}

      {/* IDENTIFICAÇÃO E CONTATOS */}
      <Secao icon={Phone} titulo="Identificação e contatos">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Linha
            rotulo="Entrada no Blue"
            valor={`${formatarDataBR(r.data_admissao)} · ${permanencia}`}
            icon={CalendarDays}
          />
          <Linha rotulo="Celular do hóspede" valor={ouNaoInformado(r.celular_proprio)} />
          <Linha
            rotulo="Contato de emergência"
            valor={
              r.contato_emergencia_nome || r.contato_emergencia_telefone
                ? `${ouNaoInformado(r.contato_emergencia_nome)} · ${ouNaoInformado(r.contato_emergencia_telefone)}`
                : "Não informado"
            }
          />
          {completa && (
            <>
              <Linha rotulo="Responsável legal" valor={ouNaoInformado(r.responsavel_legal)} icon={Users} />
              <Linha rotulo="Contato do responsável" valor={ouNaoInformado(r.contato)} />
            </>
          )}
        </div>
      </Secao>

      {/* SAÚDE */}
      <Secao icon={HeartPulse} titulo="Saúde">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Linha rotulo="Próteses" valor={ouNaoInformado(r.proteses)} />
          {completa && (
            <>
              <Linha
                rotulo="Plano de saúde"
                valor={
                  r.plano_saude_operadora || r.plano_saude_numero
                    ? `${ouNaoInformado(r.plano_saude_operadora)} · ${ouNaoInformado(r.plano_saude_numero)}`
                    : "Não informado"
                }
              />
              <Linha rotulo="Hospital de referência" valor={ouNaoInformado(r.hospital_referencia)} />
            </>
          )}
        </div>
      </Secao>

      {/* HISTÓRIA DE VIDA */}
      <Secao icon={BookOpen} titulo="História de vida">
        {r.historia_vida ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary/90">{r.historia_vida}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Não informado.</p>
        )}
      </Secao>

      {/* CLÍNICO-ASSISTENCIAL (resumo, leitura) */}
      <ResumoClinico
        residenteId={r.id}
        grauAtual={r.grau_dependencia}
        completa={completa}
        verGrauReal={verGrauReal}
      />

      {/* FINANCEIRO — dado sensível: apenas Administração e Master */}
      {podeVerFinanceiro(perfil) && <ResumoFinanceiro residente={r} />}
    </div>
  );
}

// ─── Foto (com upload/remoção p/ gestão) ───────────────────────────────────────

function FotoHospede({ residente: r, podeEditar }: { residente: Residente; podeEditar: boolean }) {
  const definirFoto = useDefinirFotoResidente();
  return (
    <div className="self-center sm:self-auto">
      <FotoUploader
        fotoUrl={r.foto_url}
        bucket={BUCKET_FOTOS_RESIDENTE}
        nome={r.nome}
        podeEditar={podeEditar}
        onUpload={(file) => uploadFotoResidente(file, r.id)}
        onChange={(url) =>
          definirFoto.mutate(
            { id: r.id, fotoUrl: url },
            {
              onSuccess: () => toast.success(url ? "Foto atualizada." : "Foto removida."),
              onError: () => toast.error("Não foi possível salvar a foto."),
            },
          )
        }
      />
    </div>
  );
}

// ─── Banner de alergias ────────────────────────────────────────────────────────

function BannerAlergias({ alergias }: { alergias: string | null }) {
  if (alergias && alergias.trim() !== "") {
    return (
      <div className="flex items-center gap-3 rounded-lg border-2 border-destructive bg-gradient-to-r from-destructive/15 to-destructive/5 px-4 py-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive text-white">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-destructive">Alérgico a</p>
          <p className="text-lg font-extrabold leading-tight text-destructive">{alergias.toUpperCase()}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
      <HeartPulse className="size-4" /> Nenhuma alergia registrada
    </div>
  );
}

// ─── Resumo clínico-assistencial ───────────────────────────────────────────────

function ResumoClinico({
  residenteId,
  grauAtual,
  completa,
  verGrauReal,
}: {
  residenteId: string;
  grauAtual: string | null;
  completa: boolean;
  verGrauReal: boolean;
}) {
  const dieta = useDietaAtiva(residenteId);
  const restricoes = (dieta.data?.restricoes ?? []).filter(Boolean);

  return (
    <Secao icon={Activity} titulo="Clínico-assistencial (resumo)">
      <div className="space-y-3">
        <ItemResumo icon={Salad} titulo="Dieta ativa">
          {dieta.isLoading ? (
            <span className="text-muted-foreground">carregando…</span>
          ) : dieta.data ? (
            <>
              {ouNaoInformado(dieta.data.consistencia)}
              {restricoes.length > 0 && (
                <span className="text-muted-foreground"> · restrições: {restricoes.join(", ")}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Nenhuma dieta ativa</span>
          )}
        </ItemResumo>

        {/* Peso/IMC e tendência (leitura) — sinal clínico, vem da Nutri (N6). */}
        <ItemPeso residenteId={residenteId} />

        {/* Prescrições e IVCF: só na ficha completa (perfis clínicos/gestão).
            Os hooks ficam neste filho para nem consultar quando oculto. O grau
            real (IVCF) some para enfermeira (verGrauReal=false). */}
        {completa && (
          <ResumoClinicoCompleto
            residenteId={residenteId}
            grauAtual={grauAtual}
            verGrauReal={verGrauReal}
          />
        )}
      </div>
    </Secao>
  );
}

function ItemPeso({ residenteId }: { residenteId: string }) {
  const pesos = useUltimosPesos(residenteId);
  const registros = pesos.data ?? [];
  const resumo = resumoPeso(registros);

  return (
    <ItemResumo icon={Scale} titulo="Peso e IMC">
      {pesos.isLoading ? (
        <span className="text-muted-foreground">carregando…</span>
      ) : !resumo.ultimo ? (
        <span className="text-muted-foreground">Não informado</span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold tabular-nums">{resumo.ultimo.peso_kg} kg</span>
          {resumo.ultimo.imc !== null && (
            <span className="text-muted-foreground">· IMC {resumo.ultimo.imc}</span>
          )}
          {resumo.classificacao && (
            <Badge variant={CLASSIFICACAO_IMC_VARIANTE[resumo.classificacao]}>
              {CLASSIFICACAO_IMC_LABEL[resumo.classificacao]}
            </Badge>
          )}
          {resumo.variacaoKg !== null && resumo.variacaoKg !== 0 && (
            <span
              className={
                resumo.variacaoKg < 0
                  ? "inline-flex items-center gap-0.5 font-semibold text-destructive"
                  : "inline-flex items-center gap-0.5 font-semibold text-success"
              }
            >
              {resumo.variacaoKg < 0 ? (
                <TrendingDown className="size-3.5" />
              ) : (
                <TrendingUp className="size-3.5" />
              )}
              {resumo.variacaoKg > 0 ? "+" : ""}
              {resumo.variacaoKg} kg
              {resumo.variacaoPct !== null && ` (${resumo.variacaoPct > 0 ? "+" : ""}${resumo.variacaoPct}%)`}
            </span>
          )}
          {resumo.emRisco && (
            <Badge variant="destructive">
              {resumo.perdaRelevante
                ? "Perda relevante"
                : resumo.tendenciaQueda
                  ? "Tendência de queda"
                  : "Baixo peso"}
            </Badge>
          )}
        </span>
      )}
    </ItemResumo>
  );
}

function ResumoClinicoCompleto({
  residenteId,
  grauAtual,
  verGrauReal,
}: {
  residenteId: string;
  grauAtual: string | null;
  verGrauReal: boolean;
}) {
  const prescricoes = usePrescricoesAtivas(residenteId);
  const ivcf = useAvaliacoesIVCF(residenteId);

  const grupos = prescricoes.data ?? [];
  const ultimaIvcf = ivcf.data?.[0];

  const meds = grupos.map((g) => g.medicamento);
  const medsResumo =
    meds.length === 0
      ? "Nenhuma prescrição ativa"
      : meds.slice(0, 4).join(", ") + (meds.length > 4 ? ` +${meds.length - 4}` : "");

  return (
    <>
      <ItemResumo icon={Pill} titulo="Prescrições ativas">
        {prescricoes.isLoading ? (
          <span className="text-muted-foreground">carregando…</span>
        ) : (
          <>
            <span className="font-semibold tabular-nums">{grupos.length}</span>{" "}
            <span className="text-muted-foreground">— {medsResumo}</span>
          </>
        )}
      </ItemResumo>

      {/* Última avaliação IVCF = grau REAL: oculto p/ enfermeira (verGrauReal). */}
      {verGrauReal && (
        <ItemResumo icon={Layers} titulo="Última avaliação (IVCF / grau)">
          {ultimaIvcf ? (
            <>
              {ultimaIvcf.classificacao}{" "}
              <span className="text-muted-foreground">· {formatarDataBR(ultimaIvcf.registrado_em)}</span>
            </>
          ) : grauAtual ? (
            <>
              Grau {grauAtual} <span className="text-muted-foreground">· sem avaliação IVCF registrada</span>
            </>
          ) : (
            <span className="text-muted-foreground">Não informado</span>
          )}
        </ItemResumo>
      )}
    </>
  );
}

// ─── Resumo financeiro (ficha completa) ────────────────────────────────────────

function ResumoFinanceiro({ residente: r }: { residente: Residente }) {
  const pagamentos = usePagamentosDoMes(mesAtual());
  const pag = (pagamentos.data ?? []).find((p) => p.residente_id === r.id);
  const statusEfetivo = statusEfetivoCobranca(pag);
  const temRespFin = r.resp_fin_nome || r.resp_fin_cpf || r.resp_fin_email || r.resp_fin_telefone;

  return (
    <Secao icon={Wallet} titulo="Financeiro (resumo)">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Linha rotulo="Mensalidade vigente" valor={formatarMoeda(r.mensalidade_valor)} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status do mês</p>
          {pagamentos.isLoading ? (
            <p className="text-sm text-muted-foreground">carregando…</p>
          ) : (
            <Badge variant={STATUS_COBRANCA_VARIANTE[statusEfetivo]} className="mt-0.5">
              {STATUS_COBRANCA_LABEL[statusEfetivo]}
            </Badge>
          )}
        </div>
      </div>

      {/* Responsável financeiro (quem paga) */}
      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" /> Responsável financeiro
        </p>
        {temRespFin ? (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Linha
              rotulo="Nome"
              valor={`${ouNaoInformado(r.resp_fin_nome)}${r.resp_fin_relacao ? ` · ${r.resp_fin_relacao}` : ""}`}
            />
            <Linha rotulo="CPF" valor={ouNaoInformado(r.resp_fin_cpf)} />
            <Linha rotulo="E-mail" valor={ouNaoInformado(r.resp_fin_email)} />
            <Linha rotulo="Telefone" valor={ouNaoInformado(r.resp_fin_telefone)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Não informado.</p>
        )}
      </div>
    </Secao>
  );
}

// ─── Subcomponentes de apresentação ────────────────────────────────────────────

function Secao({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-secondary" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Linha({ rotulo, valor, icon: Icon }: { rotulo: string; valor: string; icon?: LucideIcon }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {rotulo}
      </p>
      <p className="text-sm text-secondary">{valor}</p>
    </div>
  );
}

function ItemResumo({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-secondary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-secondary">{titulo}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
