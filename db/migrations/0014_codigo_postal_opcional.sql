-- El código postal de una dirección pasa a ser opcional — F5.3, 2026-09-13.
--
-- Desde hoy la dirección se carga por localidad (RF-09): Viedma, Carmen de
-- Patagones, San Javier, El Cóndor u «Otra localidad cercana». La provincia y
-- el código postal no se preguntan, se deducen de la localidad; y el de
-- «Otra» no se sabe, así que tiene que poder quedar vacío.
--
-- Generada por drizzle-kit: quitar un NOT NULL no falla sobre una tabla con
-- filas, a diferencia de agregarlo (ver `0013`).
ALTER TABLE "addresses" ALTER COLUMN "postal_code" DROP NOT NULL;
