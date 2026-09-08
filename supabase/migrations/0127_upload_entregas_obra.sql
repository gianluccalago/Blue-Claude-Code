-- ===========================================================================
-- 0127 — UPLOAD DE ENTREGAS DA OBRA: limite e formatos.
-- ---------------------------------------------------------------------------
-- Contexto: o engenheiro da TRÍADE não conseguiu subir a entrega R00 do
-- Projeto de Terraplanagem — um .zip de 23 MB com 5 pranchas, a ART, o
-- memorial e 3 DWGs. Uma entrega de projeto é uma PASTA; é assim que ela
-- chega na prática.
--
-- O bloqueio principal era no front (o seletor de arquivos não oferecia
-- .zip) e já foi corrigido. Aqui deixamos o bucket EXPLÍCITO, para não
-- depender de padrão de plataforma:
--   · file_size_limit = 200 MB (uma entrega completa cabe com folga);
--   · allowed_mime_types = null → nenhum formato bloqueado no servidor
--     (a curadoria de formatos é feita no front, onde dá para explicar).
--
-- ATENÇÃO — limite do PROJETO: o Supabase também tem um teto global que
-- prevalece sobre o do bucket. Confira em
--   Dashboard → Storage → Settings → "Upload file size limit"
-- e deixe-o em pelo menos 200 MB. Se o global estiver menor, o app agora
-- mostra a mensagem certa ("Arquivo grande demais: X MB") em vez do antigo
-- "Falha no upload. Tente novamente."
--
-- Idempotente. Rode após a 0126.
-- ===========================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
  ) then
    update storage.buckets
       set file_size_limit  = 209715200,   -- 200 MB
           allowed_mime_types = null       -- sem bloqueio de formato no servidor
     where id = 'obra';
    raise notice 'Bucket obra: limite 200 MB, todos os formatos liberados.';
  else
    raise notice 'storage.buckets sem file_size_limit (banco local) — nada a fazer.';
  end if;
end $$;

-- Fim.
