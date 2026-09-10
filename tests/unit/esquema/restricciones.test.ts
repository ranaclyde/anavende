import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  enTransaccionRevertida,
  rechaza,
  type Tx,
} from "@/tests/apoyo/transaccion";

/**
 * F1.5 — las restricciones de §5 RECHAZAN lo que tienen que rechazar.
 *
 * Migrado de `scripts/verificar-restricciones.mts` (F4.0b).
 *
 * Que un CHECK exista no prueba que haga algo, y `db:verificar` solo comprueba
 * que esté declarado. Las especificaciones dicen que estas restricciones son
 * «parte del diseño, no un adorno» (F1.5): esto es lo que lo demuestra.
 *
 * Los casos que se ACEPTAN no se conforman con que no explote: leen la fila de
 * vuelta. Una sentencia que no falla y tampoco escribe se ve igual desde
 * afuera, y es peor que una que falla.
 */

/**
 * Un sufijo distinto por corrida.
 *
 * La transacción se revierte, así que nada queda escrito — pero mientras vive,
 * los nombres y slugs SÍ chocan con lo que ya haya en la base, y ahí el test
 * muere con un 23505 que no tiene nada que ver con lo que estaba probando.
 * Pasó con una categoría «Teclados» cargada a mano y con una marca «Logitech»
 * cargada al probar F2.4.
 */
const n = () => Date.now() + Math.floor(Math.random() * 1000);

async function andamiaje(tx: Tx) {
  const s = n();
  const [marca] = await tx.execute<{ id: string }>(sql`
    INSERT INTO brands (name, slug)
    VALUES (${`Logitech ${s}`}, ${`logitech-${s}`}) RETURNING id`);
  const [categoria] = await tx.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug)
    VALUES (${`Teclados ${s}`}, ${`teclados-${s}`}) RETURNING id`);
  return { marca: marca.id, categoria: categoria.id, s };
}

async function unProducto(tx: Tx) {
  const { marca, categoria, s } = await andamiaje(tx);
  const [p] = await tx.execute<{
    id: string;
    price: string;
    discount: string;
    final_price: string;
  }>(sql`
    INSERT INTO products (name, slug, brand_id, category_id, price, discount)
    VALUES ('Teclado Mecánico K120', ${`k120-${s}`}, ${marca}, ${categoria},
            27500.00, 3000.00)
    RETURNING id, price, discount, final_price`);
  return { ...p, marca, categoria, s };
}

describe("products — RN-04b, §7.2", () => {
  test("rechaza descuento igual al precio", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria, s } = await andamiaje(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO products (name,slug,brand_id,category_id,price,discount)
            VALUES ('A',${`a-${s}`},${marca},${categoria},1000.00,1000.00)`),
        /discount_valid/i,
      );
    });
  });

  test("rechaza descuento mayor al precio", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria, s } = await andamiaje(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO products (name,slug,brand_id,category_id,price,discount)
            VALUES ('B',${`b-${s}`},${marca},${categoria},1000.00,1500.00)`),
        /discount_valid/i,
      );
    });
  });

  test("rechaza precio cero", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { marca, categoria, s } = await andamiaje(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO products (name,slug,brand_id,category_id,price)
            VALUES ('C',${`c-${s}`},${marca},${categoria},0)`),
        /price/i,
      );
    });
  });

  test("`final_price` lo calcula la base: 27500 − 3000 = 24500", async () => {
    await enTransaccionRevertida(async (tx) => {
      const p = await unProducto(tx);
      // Como texto: es `numeric`, y compararlo como número flotante sería
      // exactamente lo que `lib/money.ts` existe para impedir.
      expect(p.final_price).toBe("24500.00");
    });
  });
});

describe("product_variants — §8.2", () => {
  async function unaVariante(tx: Tx) {
    const p = await unProducto(tx);
    const [v] = await tx.execute<{ id: string }>(sql`
      INSERT INTO product_variants (product_id, stock_total, reserved_stock)
      VALUES (${p.id}, 5, 2) RETURNING id`);
    return { variante: v.id, producto: p.id };
  }

  async function contadores(tx: Tx, id: string) {
    const [f] = await tx.execute<{ total: number; reservado: number }>(sql`
      SELECT stock_total AS total, reserved_stock AS reservado
        FROM product_variants WHERE id = ${id}`);
    return f;
  }

  test("rechaza una reserva mayor al total", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { variante } = await unaVariante(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            UPDATE product_variants SET reserved_stock = 9 WHERE id = ${variante}`),
        /reserved_within_total/i,
      );
    });
  });

  test("rechaza una reserva negativa", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { variante } = await unaVariante(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            UPDATE product_variants SET reserved_stock = -1 WHERE id = ${variante}`),
        /reserved_not_negative/i,
      );
    });
  });

  /**
   * RF-24 y §8.1: una orden manual creada YA FINALIZADA descuenta de
   * `stock_total`, que «puede quedar negativo» — es la señal de que el stock
   * del sistema y el del depósito no coinciden, y borrarla escondería el
   * problema.
   */
  test("acepta stock_total negativo sin reservas (§5.4: señal de discrepancia)", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { variante } = await unaVariante(tx);
      await tx.execute(sql`
        UPDATE product_variants SET reserved_stock = 0, stock_total = -2
         WHERE id = ${variante}`);
      expect(await contadores(tx, variante)).toEqual({ total: -2, reservado: 0 });
    });
  });

  /**
   * EL CASO QUE JUSTIFICA LA GUARDA, y el que el script original no llegaba a
   * probar: dejaba `reserved_stock` en 0 en la comprobación anterior —cada
   * savepoint aceptado persiste— y llegaba acá con reserva cero, donde
   * `reserved <= total` no hace falta para nada.
   *
   * Con reserva viva es distinto: `2 <= -2` es FALSO, así que sin la guarda
   * `stock_total < 0` el CHECK rechazaría esto, y §5.4 dejó escrito que las
   * dos restricciones juntas implicaban en silencio `stock_total >= 0` y
   * rompían RF-24.
   */
  test("acepta stock_total negativo CON reservas web vivas (§8.1)", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { variante } = await unaVariante(tx);
      await tx.execute(sql`
        UPDATE product_variants SET stock_total = -2 WHERE id = ${variante}`);
      expect(await contadores(tx, variante)).toEqual({ total: -2, reservado: 2 });
    });
  });

  test("una variante no puede tomar sus propias imágenes", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { variante } = await unaVariante(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            UPDATE product_variants SET images_source_id = ${variante}
             WHERE id = ${variante}`),
        /images_source_not_self/i,
      );
    });
  });

  test("no puede haber dos variantes del mismo producto sin color", async () => {
    await enTransaccionRevertida(async (tx) => {
      const { producto } = await unaVariante(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO product_variants (product_id) VALUES (${producto})`),
        /variant_product_color_key|duplicate key/i,
      );
    });
  });
});

describe("user_profiles — RF-27", () => {
  /**
   * Se escribe en `auth.users` con SQL crudo a propósito. El esquema de GoTrue
   * no se administra con Drizzle (`db/schema/users.ts`), pero la clave foránea
   * que se está probando apunta ahí: sin la identidad del otro lado no hay
   * nada que verificar.
   */
  async function unaAdministradora(tx: Tx) {
    const email = `ana-${n()}@test.local`;
    const [u] = await tx.execute<{ id: string }>(sql`
      INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', ${email})
      RETURNING id`);
    await tx.execute(sql`
      INSERT INTO user_profiles (id, first_name, last_name, email, phone, role)
      VALUES (${u.id}, 'Ana', 'Vende', ${email}, '+5491100000000', 'admin')`);
    return u.id;
  }

  test("bloquear SIN motivo se rechaza", async () => {
    await enTransaccionRevertida(async (tx) => {
      const id = await unaAdministradora(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            UPDATE user_profiles SET is_banned = true WHERE id = ${id}`),
        /ban_has_reason/i,
      );
    });
  });

  test("bloquear CON motivo se acepta", async () => {
    await enTransaccionRevertida(async (tx) => {
      const id = await unaAdministradora(tx);
      await tx.execute(sql`
        UPDATE user_profiles SET is_banned = true, ban_reason = 'Prueba'
         WHERE id = ${id}`);

      const [f] = await tx.execute<{ bloqueado: boolean; motivo: string }>(sql`
        SELECT is_banned AS bloqueado, ban_reason AS motivo
          FROM user_profiles WHERE id = ${id}`);
      expect(f).toEqual({ bloqueado: true, motivo: "Prueba" });
    });
  });

  test("un rol que no existe se rechaza", async () => {
    await enTransaccionRevertida(async (tx) => {
      const id = await unaAdministradora(tx);
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            UPDATE user_profiles SET role = 'superadmin' WHERE id = ${id}`),
        /role_valid/i,
      );
    });
  });

  /**
   * Borrar la identidad se lleva el perfil por el `ON DELETE CASCADE` de la
   * migración `0002`. De esto depende la compensación de §13.4 paso 3, que
   * borra la identidad recién creada cuando el alta del perfil falla: si el
   * perfil sobreviviera, quedaría huérfano apuntando a un `auth.users` que ya
   * no existe.
   */
  test("borrar la identidad se lleva el perfil (ON DELETE CASCADE)", async () => {
    await enTransaccionRevertida(async (tx) => {
      const id = await unaAdministradora(tx);
      await tx.execute(sql`DELETE FROM auth.users WHERE id = ${id}`);

      const quedan = await tx.execute(
        sql`SELECT 1 FROM user_profiles WHERE id = ${id}`,
      );
      expect(quedan).toHaveLength(0);
    });
  });
});

describe("orders — §5.6", () => {
  test("una orden web SIN usuario se rechaza", async () => {
    await enTransaccionRevertida(async (tx) => {
      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO orders (origin, customer_name, customer_phone)
            VALUES ('web','Alguien','+5491100000000')`),
        /web_order_has_user/i,
      );
    });
  });

  test("una orden manual SIN usuario se acepta (RF-24)", async () => {
    await enTransaccionRevertida(async (tx) => {
      const [o] = await tx.execute<{ id: string; origin: string }>(sql`
        INSERT INTO orders (origin, customer_name, customer_phone)
        VALUES ('manual','Cliente de mostrador','+5491100000000')
        RETURNING id, origin`);
      expect(o.origin).toBe("manual");
    });
  });
});

describe("site_settings — §5.9", () => {
  test("no puede haber una segunda fila de configuración", async () => {
    await enTransaccionRevertida(async (tx) => {
      // La base puede tener ya su fila cargada; se saca DENTRO de la
      // transacción, que se revierte. Sin esto el test pasa o falla según lo
      // que haya en la máquina de cada quien.
      await tx.execute(sql`DELETE FROM site_settings`);
      await tx.execute(sql`
        INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
        VALUES (1,'+5491100000000','ana@test.local')`);

      await rechaza(
        tx,
        (sp) =>
          sp.execute(sql`
            INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
            VALUES (2,'+5491100000001','otra@test.local')`),
        /singleton/i,
      );
    });
  });
});
