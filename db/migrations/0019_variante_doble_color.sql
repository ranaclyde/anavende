-- Variantes de dos colores: «Negro/Rojo» (decidido el 2026-10-05).
--
-- El índice único se rehace para que el ORDEN no cuente: «Negro/Rojo» y
-- «Rojo/Negro» son la misma variante. Se puede soltar y volver a crear sin
-- mirar los datos: hasta hoy ninguna variante tiene segundo color, así que
-- el índice nuevo dice exactamente lo mismo que el viejo sobre lo que hay.
DROP INDEX "variant_product_color_key";--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "secondary_color_id" uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_secondary_color_id_colors_id_fk" FOREIGN KEY ("secondary_color_id") REFERENCES "public"."colors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variant_secondary_color_idx" ON "product_variants" USING btree ("secondary_color_id") WHERE "product_variants"."secondary_color_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_product_color_key" ON "product_variants" USING btree ("product_id",LEAST(COALESCE("color_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("secondary_color_id", '00000000-0000-0000-0000-000000000000'::uuid)),GREATEST(COALESCE("color_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("secondary_color_id", '00000000-0000-0000-0000-000000000000'::uuid)));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "secondary_color_valid" CHECK ("product_variants"."secondary_color_id" IS NULL OR ("product_variants"."color_id" IS NOT NULL AND "product_variants"."secondary_color_id" <> "product_variants"."color_id"));--> statement-breakpoint
-- Lo que las pantallas leen en vez de `colors`: por variante con color, el
-- nombre compuesto, la dirección (`?color=negro-rojo`) y los dos códigos.
-- Con esto, cada consulta cambia su JOIN y no tiene que saber armar «A/B».
-- `is_active` es el de los DOS: una variante de dos colores con uno inactivo
-- cae en RN-11b igual que si fuera de uno.
CREATE VIEW "variant_colors" AS
SELECT v.id                                    AS variant_id,
       c1.id                                   AS color_id,
       c2.id                                   AS secondary_color_id,
       c1.name || COALESCE('/' || c2.name, '') AS name,
       c1.slug || COALESCE('-' || c2.slug, '') AS slug,
       c1.hex_code                             AS hex_code,
       c2.hex_code                             AS hex_code_2,
       c1.is_active AND COALESCE(c2.is_active, true) AS is_active
  FROM product_variants v
  JOIN colors c1      ON c1.id = v.color_id
  LEFT JOIN colors c2 ON c2.id = v.secondary_color_id;
