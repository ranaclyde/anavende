-- Escenas por fecha — F9.5, RF-38 (2026-10-23).
--
-- Dos interruptores, prendidos por defecto: Halloween y Navidad se encienden
-- solas en su período y la vendedora las puede apagar desde
-- /admin/configuracion. Desplegarla no cambia nada fuera de esas fechas.
ALTER TABLE "site_settings" ADD COLUMN "halloween_scene" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "christmas_scene" boolean DEFAULT true NOT NULL;