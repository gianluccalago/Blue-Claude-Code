import { supabase } from "@/lib/supabase";

export const BUCKET_FOTOS_MANUTENCAO = "manutencao-fotos";
export const BUCKET_FOTOS_ATIVIDADE = "atividades-fotos";
export const BUCKET_UPSELLING_COMPROVANTES = "upselling-comprovantes";
export const BUCKET_FOTOS_INTERCORRENCIA = "intercorrencias-fotos";
export const BUCKET_FOTOS_RESIDENTE = "residentes-fotos";
export const BUCKET_FOTOS_USUARIO = "usuarios-fotos";
export const BUCKET_CUSTOS_MATERIAIS = "custos-materiais-comprovantes";
export const BUCKET_CARTEIRAS_VACINAIS = "carteiras-vacinais";

// ===========================================================================
// SEGURANÇA / LGPD (auditoria): TODOS estes buckets são PRIVADOS. As fotos de
// idosos, comprovantes e anexos NÃO podem ser servidos por URL pública (sem
// autenticação). O upload grava e retorna o CAMINHO do objeto (não uma URL
// pública); a exibição usa uma URL ASSINADA temporária (urlAssinadaStorage /
// hook useUrlAssinada / componentes FotoSegura/AnexoSeguro).
// ===========================================================================

/**
 * Resolve um valor guardado (novo = CAMINHO do objeto; legado = URL pública
 * antiga `.../object/public/<bucket>/<path>`) para uma URL ASSINADA temporária.
 * `null` se vazio ou se a assinatura falhar (o chamador mostra placeholder).
 */
export async function urlAssinadaStorage(
  bucket: string,
  stored: string | null | undefined,
  segundos = 3600,
): Promise<string | null> {
  if (!stored) return null;
  let path = stored;
  if (/^https?:\/\//i.test(stored)) {
    // Linha legada: extrai o caminho depois de /object/public/<bucket>/.
    const marcador = `/storage/v1/object/public/${bucket}/`;
    const idx = stored.indexOf(marcador);
    if (idx < 0) return stored; // URL externa desconhecida — deixa como está
    path = decodeURIComponent(stored.slice(idx + marcador.length).split("?")[0]);
  }
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, segundos);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Faz upload da carteira vacinal (foto/PDF) de um residente. Bucket PRIVADO
 * (dado de saúde) — retorna o CAMINHO do objeto (não URL pública); o acesso é
 * por URL assinada (urlAssinadaCarteira). `null` em caso de falha.
 */
export async function uploadCarteiraVacinal(file: File, residenteId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${residenteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_CARTEIRAS_VACINAIS).upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** Gera uma URL ASSINADA (temporária) para visualizar a carteira. `null` se falhar. */
export async function urlAssinadaCarteira(path: string, segundos = 300): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_CARTEIRAS_VACINAIS).createSignedUrl(path, segundos);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export const BUCKET_PLANOS_SAUDE = "planos-saude";
/** Upload do anexo do Plano de Atenção à Saúde (bucket privado). Retorna o caminho. */
export async function uploadPlanoSaude(file: File): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_PLANOS_SAUDE).upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** URL assinada (temporária) do anexo do plano. */
export async function urlAssinadaPlano(path: string, segundos = 300): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_PLANOS_SAUDE).createSignedUrl(path, segundos);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export const BUCKET_TESTES_COGNITIVOS = "testes-cognitivos";

/** Upload da foto (desenho no papel) de um teste cognitivo. Bucket privado. */
export async function uploadTesteCognitivo(file: File, residenteId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${residenteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_TESTES_COGNITIVOS).upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** URL assinada (temporária) da foto do teste cognitivo. */
export async function urlAssinadaTeste(path: string, segundos = 300): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_TESTES_COGNITIVOS).createSignedUrl(path, segundos);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Upload do comprovante (foto/PDF) de um custo de material. Bucket PRIVADO —
 * retorna o CAMINHO do objeto (exibição por URL assinada). `null` em caso de
 * falha — o lançamento é salvo sem comprovante.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload da foto de um usuário (equipe). Bucket PRIVADO — retorna o CAMINHO.
 * `null` em caso de falha — não quebra a interface.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload da foto de um hóspede (ficha). Bucket PRIVADO — retorna o CAMINHO.
 * `null` em caso de falha — o cadastro pode ser salvo sem foto.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload de uma foto de evidência de manutenção. Bucket PRIVADO — retorna o
 * CAMINHO. `null` em caso de falha — o fluxo de resolução do chamado não quebra.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload da foto de uma não-conformidade de inspeção. Reutiliza o bucket de
 * manutenção (privado) com prefixo "inspecao/". Retorna o CAMINHO. `null` em
 * caso de falha — a inspeção é salva mesmo sem foto (anexo é opcional).
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload da foto de registro de uma atividade. Bucket PRIVADO — retorna o
 * CAMINHO. Alimenta o portal da família (atividade_execucao.foto_url) via URL
 * assinada.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload da foto de uma intercorrência registrada pelo cuidador. Bucket
 * PRIVADO — retorna o CAMINHO. `null` em caso de falha — a intercorrência é
 * salva mesmo sem foto.
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
    return path;
  } catch {
    return null;
  }
}

/**
 * Upload do comprovante (foto/PDF) de um lançamento de upselling. Bucket
 * PRIVADO — retorna o CAMINHO. `null` em caso de falha — o lançamento pode ser
 * salvo sem comprovante.
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
    return path;
  } catch {
    return null;
  }
}

export const BUCKET_DOCUMENTOS_INSTITUCIONAIS = "documentos-institucionais";

/**
 * Upload de um documento institucional da ILPI (alvará, AVCB, contrato etc.).
 * Bucket PRIVADO — retorna o CAMINHO do objeto (exibição por URL assinada).
 * `null` em caso de falha.
 */
export async function uploadDocumentoInstitucional(file: File, tipo: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${tipo}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS_INSTITUCIONAIS)
      .upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}
