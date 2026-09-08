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

export const BUCKET_OBRA = "obra";

/**
 * Upload de foto de vistoria do módulo Obra (verificação de etapa). Bucket
 * PRIVADO, path por entidade: checklist/<faseNumero>/<etapaId>/<ts>.<ext>.
 * O "carimbo" (data/autor) é gravado no registro do checklist e exibido na UI.
 */
export async function uploadFotoObra(file: File, faseNumero: number, etapaId: string): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `checklist/fase-${faseNumero}/${etapaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET_OBRA).upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Upload de arquivos da obra — entregas de projeto, documentos, NFs, fotos.
// ───────────────────────────────────────────────────────────────────────────

/** Teto declarado do app. Precisa ser <= ao limite do bucket e ao do projeto. */
export const LIMITE_UPLOAD_MB = 200;

/**
 * Formatos que a construtora realmente entrega. Pacotes compactados entram
 * porque uma entrega de projeto é uma PASTA (pranchas + DWG + memorial + ART),
 * e é assim que ela chega na prática.
 */
export const ACCEPT_ENTREGA_OBRA =
  ".zip,.rar,.7z,.pdf,.dwg,.dxf,.rvt,.rfa,.ifc,.kmz,.kml,.doc,.docx,.xls,.xlsx,image/*";

const MB = 1024 * 1024;

function formatarMB(bytes: number): string {
  return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Nome seguro para chave de objeto, PRESERVANDO o nome original do arquivo —
 * uma entrega precisa continuar se chamando "TERRAPLENAGEM - R0.zip" quando
 * for baixada, e não "1757000000000.zip".
 */
export function nomeSeguroArquivo(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  const base = (ponto > 0 ? nome.slice(0, ponto) : nome)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "arquivo";
  const ext = (ponto > 0 ? nome.slice(ponto + 1) : "")
    .replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8) || "bin";
  return `${base}.${ext}`;
}

/**
 * Traduz a falha do Storage em algo ACIONÁVEL. Antes o app devolvia sempre
 * "Falha no upload. Tente novamente." — quem estava do outro lado (a
 * construtora) não tinha como saber se era tamanho, formato ou permissão.
 */
function descreverErroUpload(erro: unknown, file: File): string {
  const e = erro as { statusCode?: string | number; message?: string; error?: string } | null;
  const codigo = String(e?.statusCode ?? "");
  const msg = `${e?.error ?? ""} ${e?.message ?? ""}`.toLowerCase();

  if (codigo === "413" || msg.includes("exceeded") || msg.includes("too large")) {
    return `Arquivo grande demais: ${formatarMB(file.size)}. O limite é ${LIMITE_UPLOAD_MB} MB. ` +
      "Se for uma entrega grande, divida em partes (por exemplo, pranchas em um arquivo e DWG em outro).";
  }
  if (codigo === "415" || msg.includes("mime")) {
    return `O tipo deste arquivo não é aceito (${file.type || "desconhecido"}). ` +
      "Aceitamos ZIP, RAR, 7Z, PDF, DWG, DXF, RVT, IFC, KMZ, Word, Excel e imagens.";
  }
  if (codigo === "409" || msg.includes("already exists")) {
    return "Já existe um arquivo com este nome. Renomeie e envie de novo.";
  }
  if (codigo === "403" || codigo === "401" || msg.includes("row-level security") || msg.includes("unauthorized")) {
    return "Seu acesso não permite enviar arquivos nesta pasta. Avise o Contratante.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "A conexão caiu durante o envio. Tente de novo, de preferência em rede estável.";
  }
  return `Não foi possível enviar "${file.name}" (${formatarMB(file.size)}).` +
    (e?.message ? ` Detalhe: ${e.message}` : "");
}

/**
 * Upload de arquivo da obra no bucket privado `obra`. Devolve o CAMINHO.
 * LANÇA erro com mensagem explicativa quando falha — os chamadores já
 * mostram a mensagem do erro em toast, então o motivo real chega a quem
 * está enviando (era o ponto cego: a construtora só via "tente novamente").
 */
export async function uploadArquivoObra(file: File, prefixo: string): Promise<string | null> {
  if (file.size > LIMITE_UPLOAD_MB * MB) {
    throw new Error(
      `Arquivo grande demais: ${formatarMB(file.size)}. O limite é ${LIMITE_UPLOAD_MB} MB. ` +
      "Divida a entrega em partes e envie uma de cada vez.",
    );
  }
  const path = `${prefixo}/${Date.now()}-${nomeSeguroArquivo(file.name)}`;
  try {
    const { error } = await supabase.storage.from(BUCKET_OBRA).upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw new Error(descreverErroUpload(error, file));
    return path;
  } catch (e) {
    // Erro já traduzido acima passa direto; falha de rede vira mensagem clara.
    throw e instanceof Error && e.message ? e : new Error(descreverErroUpload(e, file));
  }
}

export const BUCKET_DOCUMENTOS_INSTITUCIONAIS = "documentos-institucionais";

/**
 * Upload de um documento institucional da ILPI (alvará, AVCB, contrato etc.).
 * Bucket PRIVADO — retorna o CAMINHO do objeto (exibição por URL assinada).
 * Nome único (uuid) — modelo livre, sem pasta por tipo. `null` em caso de falha.
 */
export async function uploadDocumentoInstitucional(file: File): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS_INSTITUCIONAIS)
      .upload(path, file, { upsert: false });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** Remove o objeto de um documento institucional (na exclusão/substituição). */
export async function removerDocumentoInstitucional(path: string | null | undefined): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return; // ignora vazio/URL legada
  try {
    await supabase.storage.from(BUCKET_DOCUMENTOS_INSTITUCIONAIS).remove([path]);
  } catch {
    /* falha ao remover o arquivo não deve travar a exclusão do registro */
  }
}
