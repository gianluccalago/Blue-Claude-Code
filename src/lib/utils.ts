import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Idade em anos a partir de uma data ISO (YYYY-MM-DD). */
export function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

/** Exibe "Não informado" para valores vazios/nulos. */
export function ouNaoInformado(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor.trim() === "") {
    return "Não informado";
  }
  return valor;
}

/** Data de hoje no formato YYYY-MM-DD (timezone local). */
export function hojeISO(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Instante (ISO/UTC) da meia-noite local de hoje — para filtrar registros do dia. */
export function inicioDoDiaISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Data (timezone local) de um Date no formato YYYY-MM-DD. */
export function dataISO(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Domingo (00:00) da semana que contém `d`. */
export function inicioDaSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

/** Novo Date somando `n` dias (não muta o original). */
export function somarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Combina data (YYYY-MM-DD) + hora (HH:MM) [+ dias] num ISO local→UTC. */
export function combinarDataHoraISO(data: string, hora: string, addDias = 0): string {
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d + addDias, hh, mm, 0, 0).toISOString();
}

/** "HH:MM" -> minutos desde meia-noite. */
export function horarioParaMinutos(horario: string | null): number | null {
  if (!horario) return null;
  const m = horario.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function formatarDataBR(dataISO: string | null): string {
  if (!dataISO) return "Não informado";
  const d = new Date(dataISO + (dataISO.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "Não informado";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Apenas a hora local "HH:MM" a partir de um timestamp. */
export function formatarHoraBR(ts: string | null): string {
  if (!ts) return "--:--";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatarDataHoraBR(ts: string | null): string {
  if (!ts) return "Não informado";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Não informado";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
