// ===========================================================================
// Exportação CSV genérica de qualquer grade (Fase 5 do módulo Obra e afins).
// Separador ";" e BOM UTF-8 para abrir certinho no Excel em PT-BR.
// ===========================================================================

function escapar(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baixa `linhas` como CSV. As colunas vêm das chaves da 1ª linha. */
export function exportarCSV(nomeArquivo: string, linhas: Record<string, string | number>[]): boolean {
  try {
    if (linhas.length === 0) return false;
    const colunas = Object.keys(linhas[0]);
    const corpo = linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";"));
    const csv = "﻿" + [colunas.join(";"), ...corpo].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
