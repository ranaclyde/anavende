import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { addresses } from "@/db/schema";
import { domainError } from "@/lib/errors";
import { MAXIMO_DE_DIRECCIONES } from "@/modules/users/direcciones/constantes";

/**
 * La libreta de direcciones — FS RF-09 · TS §5.5, §13.8. Tarea F5.3.
 *
 * **Todas reciben el `userId` de la sesión**, y cada consulta lo lleva en el
 * `WHERE` junto al id de la dirección: sin RLS, es la única barrera entre la
 * libreta de un comprador y la de otro (§13.8). Una dirección ajena responde
 * igual que una que no existe, NOT_FOUND, para no confirmar que el id es de
 * alguien.
 *
 * **Las que escriben más de una fila bloquean al comprador**: su fila de
 * `user_profiles`, con `FOR NO KEY UPDATE`. Agregar lee cuántas hay antes de
 * insertar, y sin el bloqueo dos pestañas con 2 direcciones leerían «2» a la
 * vez y guardarían la cuarta. `NO KEY` y no `FOR UPDATE`: el primero no frena
 * a quien inserta algo que apunta al perfil —un carrito, un favorito—, que
 * solo pide `KEY SHARE`.
 *
 * **Eliminar es una baja lógica** (`deleted_at`), la de §5.5: la orden que
 * usó la dirección guarda su propia copia (RN-12), y la fila se conserva por
 * si hace falta reconstruir algo.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Direccion = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  apartment: string | null;
  notes: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  isDefault: boolean;
};

export type DatosDeDireccion = Omit<Direccion, "id" | "isDefault">;

const columnas = {
  id: addresses.id,
  label: addresses.label,
  recipientName: addresses.recipientName,
  phone: addresses.phone,
  street: addresses.street,
  number: addresses.number,
  apartment: addresses.apartment,
  notes: addresses.notes,
  city: addresses.city,
  province: addresses.province,
  postalCode: addresses.postalCode,
  isDefault: addresses.isDefault,
};

/** La predeterminada primero; después, en el orden en que se cargaron. */
export async function listarDirecciones(userId: string): Promise<Direccion[]> {
  return db
    .select(columnas)
    .from(addresses)
    .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)))
    .orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

export async function leerDireccion(
  userId: string,
  id: string,
): Promise<Direccion | null> {
  const [d] = await db
    .select(columnas)
    .from(addresses)
    .where(
      and(
        eq(addresses.id, id),
        eq(addresses.userId, userId),
        isNull(addresses.deletedAt),
      ),
    )
    .limit(1);
  return d ?? null;
}

async function bloquearComprador(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`
    SELECT 1 FROM user_profiles WHERE id = ${userId} FOR NO KEY UPDATE`);
}

async function contarVivas(tx: Tx, userId: string): Promise<number> {
  const [fila] = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM addresses
     WHERE user_id = ${userId} AND deleted_at IS NULL`);
  return fila.n;
}

/**
 * La primera dirección es la predeterminada, sin preguntar: si hay
 * direcciones, una tiene que serlo (RF-09), y con una sola no hay nada que
 * elegir.
 */
export async function agregarDireccion(
  userId: string,
  datos: DatosDeDireccion,
): Promise<{ id: string; predeterminada: boolean }> {
  return db.transaction(async (tx) => {
    await bloquearComprador(tx, userId);
    const cuantas = await contarVivas(tx, userId);

    if (cuantas >= MAXIMO_DE_DIRECCIONES) {
      throw domainError("VALIDATION", {
        message: `Podés guardar hasta ${MAXIMO_DE_DIRECCIONES} direcciones. Eliminá una para agregar otra.`,
      });
    }

    const [nueva] = await tx
      .insert(addresses)
      .values({ ...datos, userId, isDefault: cuantas === 0 })
      .returning({ id: addresses.id, isDefault: addresses.isDefault });

    return { id: nueva.id, predeterminada: nueva.isDefault };
  });
}

export async function editarDireccion(
  userId: string,
  id: string,
  datos: DatosDeDireccion,
): Promise<void> {
  const filas = await db
    .update(addresses)
    .set(datos)
    .where(
      and(
        eq(addresses.id, id),
        eq(addresses.userId, userId),
        isNull(addresses.deletedAt),
      ),
    )
    .returning({ id: addresses.id });

  if (filas.length === 0) throw domainError("NOT_FOUND");
}

/**
 * **Primero se apaga la anterior y después se enciende la nueva.** Al revés,
 * habría un instante con dos predeterminadas, y el índice parcial
 * `one_default_address_per_user` lo rechaza: es la garantía de §5.5
 * haciendo su trabajo.
 */
export async function hacerPredeterminada(
  userId: string,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await bloquearComprador(tx, userId);

    const [existe] = await tx.execute<{ id: string }>(sql`
      SELECT id FROM addresses
       WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL`);
    if (!existe) throw domainError("NOT_FOUND");

    await tx.execute(sql`
      UPDATE addresses SET is_default = false
       WHERE user_id = ${userId} AND is_default AND deleted_at IS NULL
         AND id <> ${id}`);
    await tx.execute(sql`
      UPDATE addresses SET is_default = true WHERE id = ${id}`);
  });
}

/**
 * Si la que se elimina era la predeterminada, pasa a serlo la más antigua de
 * las que quedan: si hay direcciones, una tiene que serlo (RF-09). Elegir la
 * más antigua es arbitrario, pero es la que el comprador viene usando hace
 * más tiempo, y la puede cambiar con un clic.
 */
export async function eliminarDireccion(
  userId: string,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await bloquearComprador(tx, userId);

    // El `FROM` lee la fila antes del `UPDATE`: así el `RETURNING` dice si
    // ERA la predeterminada, que es justo lo que el `SET` borra.
    const [baja] = await tx.execute<{ eraPredeterminada: boolean }>(sql`
      UPDATE addresses a
         SET deleted_at = now(), is_default = false
        FROM (SELECT id, is_default FROM addresses
               WHERE id = ${id} AND user_id = ${userId}
                 AND deleted_at IS NULL) antes
       WHERE a.id = antes.id
      RETURNING antes.is_default AS "eraPredeterminada"`);

    if (!baja) throw domainError("NOT_FOUND");

    if (baja.eraPredeterminada) {
      await tx.execute(sql`
        UPDATE addresses SET is_default = true
         WHERE id = (SELECT id FROM addresses
                      WHERE user_id = ${userId} AND deleted_at IS NULL
                      ORDER BY created_at, id
                      LIMIT 1)`);
    }
  });
}
