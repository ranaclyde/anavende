-- Modelo del producto — 2026-11-02.
--
-- Referencia opcional para el panel; no se muestra en la tienda. Arranca
-- vacía, así que no toca las filas que ya existen.
ALTER TABLE "products" ADD COLUMN "model" text;
