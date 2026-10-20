-- Redes sociales del pie de la tienda — 2026-10-20.
--
-- Dos columnas opcionales: sin valor, la red no se muestra. Arrancan vacías,
-- así que desplegarla no cambia nada de lo que se ve hasta que la vendedora
-- las cargue en /admin/configuracion.
ALTER TABLE "site_settings" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "instagram_url" text;