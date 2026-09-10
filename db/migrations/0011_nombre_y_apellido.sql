-- Nombre y apellido dejan de ser un campo libre — 2026-09-10.
--
-- El campo único obligaba a adivinar cuál era cuál, y esa adivinanza ya estaba
-- escrita en el alta: partía el nombre por el primer espacio para saludar en
-- los emails. Con «Sanhueza, Matías» el email salía «Hola, Sanhueza,».
--
-- ESCRITA A MANO. Lo que genera drizzle-kit para este cambio no sirve: borra
-- `full_name` antes de leerlo —o sea, tira los datos—, crea la columna
-- generada antes de que existan las columnas de las que depende, y agrega dos
-- NOT NULL sin default sobre una tabla que ya tiene filas. El estado final es
-- el mismo que el del snapshot; el camino para llegar, no.
--
-- El orden de abajo es el único que funciona, y cada paso depende del anterior.

--> 1. Las dos columnas nuevas, nullable por ahora: todavía no hay qué poner.
ALTER TABLE "user_profiles" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_name" text;--> statement-breakpoint

--> 2. Repartir lo que había: la primera palabra al nombre, TODO el resto al
--> apellido —dos apellidos son normales—. Quien tenga una sola palabra queda
--> con el apellido vacío y no con basura inventada: es un dato que no estaba,
--> y la pantalla de perfil es donde esa persona lo completa.
UPDATE "user_profiles"
   SET "first_name" = split_part(btrim("full_name"), ' ', 1),
       "last_name"  = COALESCE(
         NULLIF(btrim(substr(btrim("full_name"),
                             length(split_part(btrim("full_name"), ' ', 1)) + 1)), ''),
         '');--> statement-breakpoint

--> 3. Recién ahora se pueden exigir. Antes del UPDATE, esto falla.
ALTER TABLE "user_profiles" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint

--> 4. `full_name` pasa a ser GENERADA. Postgres no convierte una columna
--> normal en generada, así que hay que soltarla y volver a crearla — y por eso
--> el paso 2 tenía que venir antes: acá los datos viejos ya no existen.
--> El `btrim` de afuera es para el apellido vacío del paso 2: sin él, «Ana»
--> quedaría como «Ana » con un espacio colgando.
ALTER TABLE "user_profiles" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "full_name" text
  GENERATED ALWAYS AS (btrim(first_name || ' ' || last_name)) STORED NOT NULL;
