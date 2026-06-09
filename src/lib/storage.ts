import { supabase } from "@/lib/supabase";

export const BUCKET_FOTOS_MANUTENCAO = "manutencao-fotos";

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
