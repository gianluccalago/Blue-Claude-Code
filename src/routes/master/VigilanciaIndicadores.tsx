import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, ChevronLeft, ChevronRight, FileDown, Plus, CalendarClock } from "lucide-react";
import { useDadosIndicadoresRdc } from "@/hooks/useAgravos";
import { RegistrarAgravoModal } from "@/components/vigilancia/RegistrarAgravoModal";
import {
  calcularIndicadoresMes,
  calcularAno,
  formatarTaxa,
  MESES_CURTOS,
} from "@/lib/indicadoresRdc";
import { exportarIndicadoresRdcExcel } from "@/lib/exportIndicadoresRdc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

// ===========================================================================
// VIGILÂNCIA SANITÁRIA · Indicadores obrigatórios da RDC 502/2021 (RT/Master).
// Cálculo automático mensal + consolidado anual + export (Art. 58-60 e Anexo).
// Indicadores REGULATÓRIOS — separados dos indicadores de gestão. Zero é um
// resultado VÁLIDO (taxa 0% é um bom resultado, não um erro).
// ===========================================================================

export function VigilanciaIndicadores() {
  const dados = useDadosIndicadoresRdc();

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1..12
  const [registrar, setRegistrar] = useState(false);

  const agravos = dados.data?.agravos ?? [];
  const residentes = dados.data?.residentes ?? [];

  const doMes = useMemo(
    () => calcularIndicadoresMes(ano, mes, agravos, residentes),
    [ano, mes, agravos, residentes],
  );
  const doAno = useMemo(() => calcularAno(ano, agravos, residentes), [ano, agravos, residentes]);

  // Aviso de obrigação: em janeiro, lembrar do envio do consolidado do ano anterior.
  const ehJaneiro = hoje.getMonth() === 0;

  if (dados.isLoading) return <LoadingState />;
  if (dados.isError) return <ErrorState error={dados.error} />;

  async function exportar(anoExport: number) {
    const ok = await exportarIndicadoresRdcExcel(anoExport, calcularAno(anoExport, agravos, residentes));
    if (ok) toast.success(`Consolidado ${anoExport} exportado (.xlsx).`);
    else toast.error("Não foi possível exportar.");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
            <Activity className="size-6 text-primary" /> Indicadores obrigatórios — RDC 502/2021
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportar(ano)}>
            <FileDown className="size-4" /> Exportar {ano} (Excel)
          </Button>
          <Button size="sm" onClick={() => setRegistrar(true)}>
            <Plus className="size-4" /> Registrar agravo
          </Button>
        </div>
      </div>

      {/* Lembrete legal de janeiro */}
      {ehJaneiro && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-start gap-3 py-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm text-secondary">
              <span className="font-semibold">Obrigação de janeiro (Art. 60):</span> o consolidado anual de{" "}
              {hoje.getFullYear() - 1} deve ser enviado à Vigilância Sanitária.{" "}
              <button className="font-semibold text-primary hover:underline" onClick={() => exportar(hoje.getFullYear() - 1)}>
                Exportar consolidado {hoje.getFullYear() - 1}
              </button>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navegação de mês */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Button variant="outline" size="icon" onClick={() => mudarMes(-1, mes, ano, setMes, setAno)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-bold text-secondary">{MESES_CURTOS[mes - 1]} / {ano}</span>
          <Button variant="outline" size="icon" onClick={() => mudarMes(1, mes, ano, setMes, setAno)}>
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Indicadores do mês */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          População de referência (dia 15): <span className="font-bold text-secondary">{doMes.populacao}</span> residente(s).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {doMes.indicadores.map((ind) => (
            <div key={ind.key} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {ind.numero}. {ind.label}
              </p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-secondary">{formatarTaxa(ind.taxa)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ind.numerador} / {ind.denominador} · {ind.medida}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Consolidado anual */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Consolidado anual · {ano}</CardTitle>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)}><ChevronLeft className="size-4" /></Button>
            <span className="text-sm font-bold text-secondary">{ano}</span>
            <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="planilha-fixa p-0">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Indicador
                </th>
                {MESES_CURTOS.map((m) => (
                  <th key={m} className="bg-card px-2 py-2 text-center text-xs font-bold text-secondary">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky left-0 z-10 border-t bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                  População (dia 15)
                </td>
                {doAno.map((m) => (
                  <td key={m.mes} className="border-t px-2 py-2 text-center tabular-nums text-secondary">{m.populacao}</td>
                ))}
              </tr>
              {(doAno[0]?.indicadores ?? []).map((_, idx) => (
                <tr key={idx}>
                  <td className="sticky left-0 z-10 border-t bg-card px-3 py-2 text-xs font-medium text-secondary">
                    {doAno[0].indicadores[idx].numero}. {doAno[0].indicadores[idx].label}
                  </td>
                  {doAno.map((m) => {
                    const ind = m.indicadores[idx];
                    return (
                      <td
                        key={m.mes}
                        title={`${ind.numerador} / ${ind.denominador}`}
                        className={cn(
                          "border-t px-2 py-2 text-center tabular-nums",
                          ind.taxa && ind.taxa > 0 ? "font-semibold text-secondary" : "text-muted-foreground",
                        )}
                      >
                        {formatarTaxa(ind.taxa)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {registrar && <RegistrarAgravoModal onFechar={() => setRegistrar(false)} />}
    </div>
  );
}

function mudarMes(
  delta: number,
  mes: number,
  ano: number,
  setMes: (n: number) => void,
  setAno: (n: number) => void,
) {
  let m = mes + delta;
  let a = ano;
  if (m < 1) { m = 12; a -= 1; }
  if (m > 12) { m = 1; a += 1; }
  setMes(m);
  setAno(a);
}
