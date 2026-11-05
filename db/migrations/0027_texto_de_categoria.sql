-- Texto de la categoría — F3.11, 2026-11-05.
--
-- Dos o tres renglones opcionales para la página de cada categoría. Arranca
-- vacía, así que no toca las filas que ya existen.
ALTER TABLE "categories" ADD COLUMN "description" text;
