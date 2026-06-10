import { supabase } from "@/lib/supabase";

export const BUCKET_FOTOS_MANUTENCAO = "manutencao-fotos";
export const BUCKET_FOTOS_ATIVIDADE = "atividades-fotos";

/**
 * Faz upload de uma foto de evidência de manutenção e retorna a URL pública.
 * Retorna `null` em caso de falha — o fluxo de resolução do chamado não deve quebrar.
 */
export async function uploadFotoManutencao(
  file: File,
  chamadoId: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${chamadoId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_MANUTENCAO)
      .upload(path, file, { upsert: true });
    if (error) return null;

    const { data } = supabase.storage.from(BUCKET_FOTOS_MANUTENCAO).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Faz upload da foto de registro de uma atividade (registro de que ela
 * aconteceu) e retorna a URL pública. Essa foto poderá futuramente alimentar
 * o portal da família (atividade_execucao.foto_url).
 */
export async function uploadFotoAtividade(
  file: File,
  atividadeId: string,
  data: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${atividadeId}/${data}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_ATIVIDADE)
      .upload(path, file, { upsert: true });
    if (error) return null;

    const { data: pub } = supabase.storage.from(BUCKET_FOTOS_ATIVIDADE).getPublicUrl(path);
    return pub.publicUrl ?? null;
  } catch {
    return null;
  }
}
