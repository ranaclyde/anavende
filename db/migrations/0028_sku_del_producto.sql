-- SKU del producto — 2026-11-05.
--
-- La columna `model` de la 0026 era en realidad el SKU. No se renombra: el
-- contenedor viejo sigue leyendo `model` mientras el nuevo migra, y un
-- renombre lo rompería (TS §18.2, agregar antes de borrar). Se agrega `sku`,
-- se copia lo cargado, y `model` queda sin uso hasta borrarla en otro cambio.
--
-- Es único dentro de cada marca —dos marcas pueden usar el mismo código— y
-- sin distinguir mayúsculas («abc-1» y «ABC-1» son el mismo); los NULL no
-- chocan. Si dos productos de la misma marca ya comparten el valor, el índice
-- no se crea y la migración falla entera: hay que corregir uno antes.
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
UPDATE "products" SET "sku" = "model" WHERE "model" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("brand_id",lower("sku"));
