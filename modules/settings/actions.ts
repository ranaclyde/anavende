"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { paymentMethods } from "@/db/schema/settings";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { borrarArchivos, clavesDelLogo, quitarLogo } from "@/modules/media/subir";
import { escribirLaConfiguracion } from "@/modules/settings/service";
import {
  cambioDeEstadoDePago,
  configuracionDelSitio,
  crearMedioDePago,
  editarMedioDePago,
  movimientoDePago,
  soloMedioDePago,
} from "@/modules/settings/schemas";

/**
 * ABM de medios de pago — RF-19, RN-01.
 *
 * **RN-11 no les cabe, y por eso acá no hay conteo de uso.** Marcas,
 * categorías y colores no se borran mientras algo los use porque las órdenes
 * los nombran. Un medio de pago no lo nombra nadie: no hay una sola clave
 * foránea que apunte a `payment_methods` (§5.9). Son informativos (RN-01), el
 * MVP no cobra online y la orden no guarda con qué se pagó. Borrar uno
 * siempre se puede, y lo único que hay que acordarse de llevar son sus
 * archivos.
 *
 * El día que una orden guarde el medio de pago, esta decisión se da vuelta y
 * hay que traer acá el mismo par de reglas del catálogo. Queda escrito para
 * que se vea que fue una decisión y no un olvido.
 */

function refrescar() {
  // Viven bajo /admin/catalogo (§4), así que comparten la invalidación con
  // marcas, categorías y colores.
  revalidatePath("/admin/catalogo", "layout");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Deja las posiciones en 0, 1, 2… respetando el orden que ya tenían.
 *
 * `sort_order` cumple dos papeles: es el orden en que se muestran y es de
 * dónde sale la posición del próximo que se cree —`max + 1`—. Borrar el
 * primero de tres dejaría [1, 2] y el siguiente volvería a ser 3: no rompe
 * nada hoy, pero deja la numeración contando cosas que ya no están, y con
 * ella cualquier cuenta que la mire.
 *
 * El orden del `row_number()` es el MISMO que el del listado y el de mover.
 * Los tres tienen que decidir igual: si uno renumerara por otro criterio, la
 * pantalla mostraría un orden y el botón movería sobre otro.
 */
async function renumerar(tx: Tx): Promise<void> {
  await tx.execute(sql`
    WITH ordenados AS (
      SELECT id,
             row_number() OVER (
               ORDER BY sort_order, immutable_unaccent(lower(name))
             ) - 1 AS n
        FROM payment_methods
    )
    UPDATE payment_methods p
       SET sort_order = o.n
      FROM ordenados o
     WHERE p.id = o.id AND p.sort_order <> o.n`);
}

export const crearUnMedioDePago = action
  .input(crearMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO payment_methods (name, description, sort_order)
      -- Al final de la lista. Elegir la posición es una acción aparte, igual
      -- que reordenar las imágenes de una variante (RF-17).
      VALUES (${input.name}, ${input.description},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id`);

    refrescar();
    return { id: fila.id };
  });

export const editarUnMedioDePago = action
  .input(editarMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentMethods)
      .set({ name: input.name, description: input.description })
      .where(eq(paymentMethods.id, input.id))
      .returning({ id: paymentMethods.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id };
  });

/**
 * Desactivar es lo que reemplaza a borrar cuando la vendedora deja de
 * aceptar un medio por un tiempo: la fila queda con su logo y su
 * descripción, y la tienda no lo muestra. No hay nada que verificar —RN-11b
 * habla de productos— y por eso no se rechaza nunca.
 */
export const cambiarEstadoDeMedioDePago = action
  .input(cambioDeEstadoDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(paymentMethods)
      .set({ isActive: input.activo })
      .where(eq(paymentMethods.id, input.id))
      .returning({ id: paymentMethods.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id, activo: input.activo };
  });

/**
 * Mover uno hacia arriba o hacia abajo — RF-19.
 *
 * Se lee la lista entera con `FOR UPDATE` y se reescriben TODAS las
 * posiciones, no solo las dos que se intercambian. Cuesta lo mismo con cinco
 * filas y arregla de paso cualquier numeración repetida o con huecos que
 * haya quedado de antes; intercambiar dos números sobre una lista que ya
 * tenía dos ceros no mueve nada y no hay forma de entender por qué desde la
 * pantalla.
 *
 * Llegar al borde NO es un error: la flecha ya no se ofrece en las puntas, y
 * si igual llega —dos pestañas abiertas—, la respuesta correcta es que la
 * lista quede como está.
 */
export const moverMedioDePago = action
  .input(movimientoDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    await db.transaction(async (tx) => {
      const filas = await tx.execute<{ id: string }>(sql`
        SELECT id FROM payment_methods
         ORDER BY sort_order, immutable_unaccent(lower(name))
           FOR UPDATE`);

      const ids = filas.map((f) => f.id);
      const desde = ids.indexOf(input.id);
      if (desde === -1) throw domainError("NOT_FOUND");

      const hasta = input.direccion === "arriba" ? desde - 1 : desde + 1;
      if (hasta < 0 || hasta >= ids.length) return;

      [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];

      // Los ids van como PARÁMETROS, no pegados en el texto de la consulta:
      // acaban de salir de la base, pero pegarlos es la forma de escribir una
      // inyección que hoy no lo es y mañana sí.
      const orden = sql.join(
        ids.map((id, n) => sql`(${id}::uuid, ${n}::int)`),
        sql`, `,
      );

      await tx.execute(sql`
        UPDATE payment_methods p
           SET sort_order = o.n
          FROM (VALUES ${orden}) AS o(id, n)
         WHERE p.id = o.id AND p.sort_order <> o.n`);
    });

    refrescar();
    return { id: input.id };
  });

/**
 * Quitar el logo. SUBIRLO no pasa por acá: va por `POST /api/admin/upload`,
 * porque una Server Action serializa su entrada y mandarle un archivo
 * significa pasarlo a base64 (§9.1). Quitarlo es un booleano.
 */
export const quitarElLogoDelMedioDePago = action
  .input(soloMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    await quitarLogo("medio-de-pago", input.id);
    refrescar();
    return { id: input.id };
  });

export const eliminarUnMedioDePago = action
  .input(soloMedioDePago)
  .auth("admin")
  .handler(async ({ input }) => {
    // Las claves se leen ANTES del DELETE: después la fila ya no está y se
    // perdieron con ella. Es la única forma de que borrar un medio de pago no
    // deje sus archivos dando vueltas en Storage.
    const archivos = await clavesDelLogo("medio-de-pago", input.id);

    await db.transaction(async (tx) => {
      const filas = await tx
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, input.id))
        .returning({ id: paymentMethods.id });

      if (!filas.length) throw domainError("NOT_FOUND");

      await renumerar(tx);
    });

    // Después del DELETE, y sin poder fallar hacia afuera: la fila ya no
    // existe, así que un archivo que sobreviva es basura, no un motivo para
    // decirle a la vendedora que no se pudo borrar algo que sí se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id: input.id };
  });

/* ── Configuración del sitio — RF-20, §5.9 ─────────────────────────────── */

/**
 * Guardar la configuración del sitio.
 *
 * La escritura vive en `service.ts` y no acá: es un UPSERT cuyo
 * comportamiento —la primera vez crea la fila, las siguientes la pisan— es
 * justo lo que hay que poder probar contra Postgres de verdad, y un script no
 * puede llamar a una Server Action. Acá quedan las tres cosas que sí son de
 * la acción: el rol, la validación y decidir qué se invalida.
 */
export const guardarLaConfiguracion = action
  .input(configuracionDelSitio)
  .auth("admin")
  .handler(async ({ input }) => {
    const guardada = await escribirLaConfiguracion(input);

    // Todo, y a propósito. El umbral lo lee el listado de productos y lo va a
    // leer el dashboard (RF-14); el número de WhatsApp, cada ficha y cada
    // botón de compra de la tienda (RF-04). Son tres o cuatro pantallas hoy y
    // más mañana, y una lista de rutas acá es una lista que el día que se
    // agrega una pantalla nadie se acuerda de actualizar: el síntoma sería un
    // umbral guardado que la tienda sigue ignorando, sin ningún error a la
    // vista. Se paga con revalidar de más algo que se toca una vez por mes.
    revalidatePath("/", "layout");

    // Se devuelve lo GUARDADO y no lo enviado: el número vuelve normalizado a
    // `+549…`, y el formulario lo muestra tal cual quedó. Escribir
    // «11 5555 5555» y ver «+5491155555555» es la confirmación de que se
    // entendió lo que se escribió.
    return guardada;
  });
