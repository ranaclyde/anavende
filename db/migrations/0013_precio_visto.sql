-- El carrito recuerda el precio que se vio — F5.6, 2026-09-12.
--
-- RN-09 pide avisar los cambios de precio «respecto de la última vista», y
-- RF-08 que el aviso diga «pasó de $A a $B». Sin guardar $A no hay con qué
-- comparar. `last_seen_price` es eso y nada más: NUNCA entra en un subtotal,
-- un total ni una orden, que siguen saliendo de `products.final_price`
-- (TECHNICAL-SPEC §5.5).
--
-- ESCRITA A MANO. drizzle-kit genera un `ADD COLUMN … NOT NULL` sin default,
-- que falla sobre una tabla con filas, y producción ya tiene renglones de
-- carrito desde que F5.5 se probó ahí. El estado final es el del snapshot.

--> 1. La columna, nullable por ahora: todavía no hay qué poner.
ALTER TABLE "cart_items" ADD COLUMN "last_seen_price" numeric(12, 2);--> statement-breakpoint

--> 2. Los renglones que ya existían arrancan con el precio VIGENTE. Con
--> cualquier otro valor, el primer comprador que abra su carrito vería un
--> aviso de un cambio que nunca presenció.
UPDATE "cart_items" ci
   SET "last_seen_price" = p."final_price"
  FROM "product_variants" v
  JOIN "products" p ON p."id" = v."product_id"
 WHERE v."id" = ci."variant_id";--> statement-breakpoint

--> 3. Ahora sí, obligatoria: todo renglón tiene variante (la clave es NOT NULL
--> con cascada), así que el paso 2 no deja ninguna vacía.
ALTER TABLE "cart_items" ALTER COLUMN "last_seen_price" SET NOT NULL;
