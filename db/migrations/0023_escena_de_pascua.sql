-- Escena de Pascua — F9.5, RF-38 (2026-10-23).
--
-- La tercera fecha: la Semana Santa, que se calcula cada año en
-- lib/escenas.ts. Prendida por defecto, como Halloween y Navidad (0022).
ALTER TABLE "site_settings" ADD COLUMN "easter_scene" boolean DEFAULT true NOT NULL;