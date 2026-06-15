import { supabase } from "@/lib/supabase";

export const BUCKET_FOTOS_MANUTENCAO = "manutencao-fotos";
export const BUCKET_FOTOS_ATIVIDADE = "atividades-fotos";
export const BUCKET_UPSELLING_COMPROVANTES = "upselling-comprovantes";
export const BUCKET_FOTOS_INTERCORRENCIA = "intercorrencias-fotos";
export const BUCKET_FOTOS_RESIDENTE = "residentes-fotos";
export const BUCKET_FOTOS_USUARIO = "usuarios-fotos";
export const BUCKET_CUSTOS_MATERIAIS = "custos-materiais-comprovantes";

/**
 * Faz upload do comprovante (foto/PDF) de um custo de material e retorna a URL
 * pública. Retorna `null` em caso de falha — o lançamento é salvo sem comprovante.
 */
export async function uploadComprovanteMaterial(
  file: File,
  categoria: string,
  mes: string,
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${categoria}/${mes}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_CUSTOS_MATERIAIS).upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET_CUSTOS_MATERIAIS).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Faz upload da foto de um usuário (equipe) e retorna a URL pública.
 * Retorna `null` em caso de falha — não quebra a interface.
 */
export async function uploadFotoUsuario(
  file: File,
  usuarioId: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${usuarioId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_USUARIO)
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET_FOTOS_USUARIO).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Faz upload da foto de um hóspede (ficha) e retorna a URL pública.
 * Retorna `null` em caso de falha — o cadastro pode ser salvo sem foto.
 */
export async function uploadFotoResidente(
  file: File,
  residenteId: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${residenteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_RESIDENTE)
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET_FOTOS_RESIDENTE).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

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
 * Faz upload da foto de uma não-conformidade de inspeção (problema visto) e
 * retorna a URL pública. Reutiliza o bucket de manutenção (mesmo domínio) com
 * prefixo "inspecao/". Retorna `null` em caso de falha — a inspeção é salva
 * mesmo sem foto (anexo é opcional).
 */
export async function uploadFotoInspecao(
  file: File,
  residenteId: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `inspecao/${residenteId}/${Date.now()}.${ext}`;
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

/**
 * Faz upload da foto de uma intercorrência registrada pelo cuidador.
 * Retorna `null` em caso de falha — a intercorrência é salva mesmo sem foto.
 */
export async function uploadFotoIntercorrencia(
  file: File,
  residenteId: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${residenteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS_INTERCORRENCIA)
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(BUCKET_FOTOS_INTERCORRENCIA).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Faz upload do comprovante (foto ou PDF) de um lançamento de upselling e
 * retorna a URL pública. Retorna `null` em caso de falha — o lançamento pode
 * ser salvo sem comprovante.
 */
export async function uploadComprovanteUpselling(
  file: File,
  residenteId: string,
  mes: string
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${residenteId}/${mes}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_UPSELLING_COMPROVANTES)
      .upload(path, file, { upsert: true });
    if (error) return null;

    const { data } = supabase.storage.from(BUCKET_UPSELLING_COMPROVANTES).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}
