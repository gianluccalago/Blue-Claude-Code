import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Turno } from "@/types/database";

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

/** Nível numérico do grau de dependência (I=1, II=2, III=3) ou null. */
export function grauNivel(grau: "I" | "II" | "III" | null | undefined): number | null {
  if (grau === "I") return 1;
  if (grau === "II") return 2;
  if (grau === "III") return 3;
  return null;
}

/** Tempo de permanência (desde a admissão) em texto, ex "2 anos e 3 meses". */
export function tempoDePermanencia(dataAdmissao: string | null): string {
  if (!dataAdmissao) return "Não informado";
  const inicio = new Date(dataAdmissao + (dataAdmissao.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(inicio.getTime())) return "Não informado";
  const hoje = new Date();
  let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (hoje.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) return "Não informado";
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  if (m > 0) partes.push(`${m} ${m === 1 ? "mês" : "meses"}`);
  if (partes.length === 0) return "Menos de 1 mês";
  return partes.join(" e ");
}

/** Exibe "Não informado" para valores vazios/nulos. */
export function ouNaoInformado(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor.trim() === "") {
    return "Não informado";
  }
  return valor;
}

// A casa opera em America/Sao_Paulo (fuso fixo UTC−3; o Brasil não tem mais
// horário de verão desde 2019). Fixamos o "dia civil" nesse fuso para não
// depender da configuração do dispositivo — em tablets já em SP nada muda; num
// device fora de SP/mal-configurado, o dia deixa de escorregar.
const FUSO_SP = "America/Sao_Paulo";

/** YYYY-MM-DD de um Date no fuso da casa (America/Sao_Paulo). */
function ymdEmSP(d: Date): string {
  // en-CA formata como "YYYY-MM-DD".
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_SP,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Data de hoje no formato YYYY-MM-DD (fuso da casa, America/Sao_Paulo). */
export function hojeISO(): string {
  return ymdEmSP(new Date());
}

/** Instante (ISO/UTC) da meia-noite de HOJE no fuso da casa — filtra registros do dia. */
export function inicioDoDiaISO(): string {
  // UTC−3 fixo (sem horário de verão): a meia-noite de SP é 03:00 UTC.
  return new Date(`${hojeISO()}T00:00:00-03:00`).toISOString();
}

/** Data de um Date no formato YYYY-MM-DD (fuso da casa, America/Sao_Paulo). */
export function dataISO(d: Date): string {
  return ymdEmSP(d);
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

/** Minutos locais desde meia-noite de um timestamp ISO. */
function minutosLocaisDeISO(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Verifica se um horário "HH:MM" cai dentro da janela do turno (cobre turnos
 * que cruzam a meia-noite, ex: 19h–7h). Sem horário ou sem turno ativo => sempre true.
 */
export function horarioNoTurno(horario: string | null, turno: Turno | null): boolean {
  if (!turno || !horario) return true;
  const alvo = horarioParaMinutos(horario);
  if (alvo === null) return true;
  const ini = minutosLocaisDeISO(turno.inicio);
  const fim = minutosLocaisDeISO(turno.fim);
  if (ini === fim) return true;
  if (ini < fim) return alvo >= ini && alvo < fim;
  return alvo >= ini || alvo < fim;
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
