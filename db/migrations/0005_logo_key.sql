-- La columna guarda la CLAVE del archivo en Storage, no su URL
-- (TECHNICAL-SPEC §9.4). El nombre venía de antes de esa decisión y le pedía
-- a quien la implementara justo lo contrario: guardar la URL completa ata la
-- fila al servidor del día que se escribió, y un logo cargado en local
-- seguiría apuntando a `127.0.0.1` una vez en producción.
--
-- Se renombra AHORA porque las dos columnas están vacías: no hay ni un logo
-- cargado, así que no hay nada que convertir. Con veinte logos adentro esto
-- ya no sería un ALTER de una línea.
ALTER TABLE "brands" RENAME COLUMN "logo_url" TO "logo_key";--> statement-breakpoint
ALTER TABLE "payment_methods" RENAME COLUMN "logo_url" TO "logo_key";
