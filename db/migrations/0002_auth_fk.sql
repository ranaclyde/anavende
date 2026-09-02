-- TECHNICAL-SPEC §5.3.
-- user_profiles.id referencia auth.users(id), que administra GoTrue y Drizzle
-- no conoce. La clave foránea se declara acá, a mano y a propósito: sin ella
-- borrar una identidad dejaría un perfil huérfano.
--
-- Requiere que Supabase Auth ya esté instalado en el servidor DATA (F0.3).

ALTER TABLE "user_profiles"
  ADD CONSTRAINT "user_profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
