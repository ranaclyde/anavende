-- La descripción del producto pasa a guardarse en Markdown acotado (RF-15),
-- y eso la vuelve no buscable tal cual: `%cable hdmi%` no encuentra
-- `Cable **HDMI** 2.1`, porque los asteriscos parten la subcadena.
--
-- `description_text` es la proyección en texto plano que busca §10.1. Es una
-- columna GENERADA, igual que `final_price`: se calcula en la base y nunca en
-- JavaScript, así es imposible que el contenido y lo que se busca discrepen.
-- Se quitan solo `* _ # \``; el guion NO, porque «USB-C» tiene que seguir
-- siendo «USB-C».
--
-- El índice trigrama SE MUDA a la columna nueva. Sobre `description` indexaba
-- justo el texto que §10.1 ya no consulta: un índice que nadie iba a usar,
-- pagando su costo en cada escritura.

DROP INDEX "products_description_trgm_idx";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_text" text GENERATED ALWAYS AS (regexp_replace(description, '[*_#`]', '', 'g')) STORED;--> statement-breakpoint
CREATE INDEX "products_description_trgm_idx" ON "products" USING gin (immutable_unaccent(lower("description_text")) gin_trgm_ops);