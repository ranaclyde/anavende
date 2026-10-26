-- Foto de perfil — F5.9, 2026-10-26.
--
-- Una columna opcional con la CLAVE en Storage (§9.2). Arranca vacía, así que
-- desplegarla no cambia nada: todos se ven con su blobatar hasta que suban
-- una foto desde «Mi cuenta».
ALTER TABLE "user_profiles" ADD COLUMN "avatar_key" text;
