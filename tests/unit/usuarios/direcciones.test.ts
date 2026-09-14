import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  agregarDireccion,
  editarDireccion,
  eliminarDireccion,
  hacerPredeterminada,
  leerDireccion,
  type DatosDeDireccion,
} from "@/modules/users/direcciones/operaciones";
import {
  aDatosDeDireccion,
  direccionSchema,
} from "@/modules/users/direcciones/schemas";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { dosCompitiendo } from "@/tests/apoyo/concurrencia";

/**
 * La libreta de direcciones — RF-09, TS §5.5. Tarea F5.3.
 *
 * `unComprador()` ya trae una dirección predeterminada, «Casa»: la mayoría de
 * los casos arrancan de ahí, que es como arranca un comprador de verdad.
 */

afterEach(limpiarCompradores);

const datos = (label: string): DatosDeDireccion => ({
  label,
  recipientName: "Compradora de prueba",
  phone: "+5492920555555",
  street: "Belgrano",
  number: "123",
  apartment: null,
  notes: null,
  city: "Viedma",
  province: "Río Negro",
  postalCode: "8500",
});

async function libreta(userId: string) {
  return [
    ...(await db.execute<{ label: string; isDefault: boolean }>(sql`
      SELECT label, is_default AS "isDefault" FROM addresses
       WHERE user_id = ${userId} AND deleted_at IS NULL
       ORDER BY created_at, id`)),
  ];
}

describe("cuántas y cuál es la predeterminada", () => {
  test("la primera dirección es la predeterminada, y las siguientes no", async () => {
    const { userId } = await unComprador();
    await db.execute(sql`DELETE FROM addresses WHERE user_id = ${userId}`);

    expect(await agregarDireccion(userId, datos("Casa"))).toMatchObject({
      predeterminada: true,
    });
    expect(await agregarDireccion(userId, datos("Trabajo"))).toMatchObject({
      predeterminada: false,
    });
  });

  test("con 3 direcciones, la cuarta no entra y lo dice", async () => {
    const { userId } = await unComprador();
    await agregarDireccion(userId, datos("Trabajo"));
    await agregarDireccion(userId, datos("Mamá"));

    await expect(agregarDireccion(userId, datos("Otra"))).rejects.toMatchObject(
      {
        code: "VALIDATION",
        message: "Podés guardar hasta 3 direcciones. Eliminá una para agregar otra.",
      },
    );
    expect(await libreta(userId)).toHaveLength(3);
  });

  test("las eliminadas no cuentan para el máximo", async () => {
    const { userId, addressId } = await unComprador();
    await agregarDireccion(userId, datos("Trabajo"));
    await agregarDireccion(userId, datos("Mamá"));

    await eliminarDireccion(userId, addressId);
    await agregarDireccion(userId, datos("Otra"));

    expect(await libreta(userId)).toHaveLength(3);
  });

  test("dos pestañas guardando a la vez no llegan a la cuarta", async () => {
    const { userId } = await unComprador();
    await agregarDireccion(userId, datos("Trabajo"));

    // Las dos leen «hay 2» si nadie las ordena. El bloqueo del comprador es lo
    // que hace que la segunda lea «hay 3» y se frene.
    const [a, b] = await dosCompitiendo(
      async (tx) => {
        await tx.execute(sql`
          SELECT 1 FROM user_profiles WHERE id = ${userId} FOR NO KEY UPDATE`);
      },
      () => agregarDireccion(userId, datos("Pestaña A")),
      () => agregarDireccion(userId, datos("Pestaña B")),
    );

    const estados = [a.status, b.status].sort();
    expect(estados).toEqual(["fulfilled", "rejected"]);
    expect(await libreta(userId)).toHaveLength(3);
  });

  test("hacer predeterminada otra deja una sola", async () => {
    const { userId } = await unComprador();
    const { id } = await agregarDireccion(userId, datos("Trabajo"));

    await hacerPredeterminada(userId, id);

    expect(await libreta(userId)).toEqual([
      { label: "Casa", isDefault: false },
      { label: "Trabajo", isDefault: true },
    ]);
  });

  test("eliminar la predeterminada le pasa el lugar a la más antigua que queda", async () => {
    const { userId, addressId } = await unComprador();
    await agregarDireccion(userId, datos("Trabajo"));
    await agregarDireccion(userId, datos("Mamá"));

    await eliminarDireccion(userId, addressId);

    expect(await libreta(userId)).toEqual([
      { label: "Trabajo", isDefault: true },
      { label: "Mamá", isDefault: false },
    ]);
  });

  test("eliminar la única deja la libreta vacía, sin error", async () => {
    const { userId, addressId } = await unComprador();
    await eliminarDireccion(userId, addressId);
    expect(await libreta(userId)).toEqual([]);
  });

  test("la baja es lógica: la fila sigue, marcada", async () => {
    const { userId, addressId } = await unComprador();
    await eliminarDireccion(userId, addressId);

    const [fila] = await db.execute<{ deletedAt: Date | null }>(sql`
      SELECT deleted_at AS "deletedAt" FROM addresses WHERE id = ${addressId}`);
    expect(fila.deletedAt).not.toBeNull();
  });

  test("una dirección de «Otra localidad cercana» se guarda sin código postal", async () => {
    const { userId } = await unComprador();
    const { id } = await agregarDireccion(userId, {
      ...datos("Campo"),
      city: "Guardia Mitre",
      postalCode: null,
    });

    expect(await leerDireccion(userId, id)).toMatchObject({
      city: "Guardia Mitre",
      postalCode: null,
    });
  });
});

describe("la libreta de otro no se toca", () => {
  test("leer, editar, elegir y eliminar una dirección ajena responde como si no existiera", async () => {
    const duena = await unComprador();
    const otra = await unComprador();

    expect(await leerDireccion(otra.userId, duena.addressId)).toBeNull();
    await expect(
      editarDireccion(otra.userId, duena.addressId, datos("Robada")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      hacerPredeterminada(otra.userId, duena.addressId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      eliminarDireccion(otra.userId, duena.addressId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await libreta(duena.userId)).toEqual([
      { label: "Casa", isDefault: true },
    ]);
  });
});

describe("lo que llega del formulario", () => {
  const valido = {
    label: "Casa",
    recipientName: "Ana Pérez",
    phone: "2920 55-5555",
    street: "Belgrano",
    number: "123",
    apartment: "",
    localidad: "Viedma",
    otraLocalidad: "",
    provinciaDeOtra: "",
    notes: "",
  };

  const guardado = (entrada: typeof valido) =>
    aDatosDeDireccion(direccionSchema.parse(entrada));

  test("normaliza el teléfono y guarda lo opcional vacío como null", () => {
    const r = guardado(valido);
    expect(r.phone).toBe("+5492920555555");
    expect(r.apartment).toBeNull();
    expect(r.notes).toBeNull();
  });

  test("la provincia y el código postal salen de la localidad", () => {
    expect(guardado(valido)).toMatchObject({
      city: "Viedma",
      province: "Río Negro",
      postalCode: "8500",
    });
    expect(
      guardado({ ...valido, localidad: "Carmen de Patagones" }),
    ).toMatchObject({
      city: "Carmen de Patagones",
      province: "Buenos Aires",
      postalCode: "8504",
    });
  });

  test("«Otra localidad cercana» guarda el nombre y la provincia que se eligieron, sin código postal", () => {
    expect(
      guardado({
        ...valido,
        localidad: "otra",
        otraLocalidad: "Guardia Mitre",
        provinciaDeOtra: "Río Negro",
      }),
    ).toMatchObject({
      city: "Guardia Mitre",
      province: "Río Negro",
      postalCode: null,
    });
  });

  test("«Otra» sin nombre ni provincia no pasa, y cada error va en su campo", () => {
    const r = direccionSchema.safeParse({ ...valido, localidad: "otra" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "otraLocalidad",
      "provinciaDeOtra",
    ]);
  });

  test("una localidad fuera de la zona no pasa, aunque se fuerce desde afuera", () => {
    const r = direccionSchema.safeParse({ ...valido, localidad: "Rosario" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["localidad"]);
  });

  test("con «Otra», una provincia que no es de la zona no pasa", () => {
    const r = direccionSchema.safeParse({
      ...valido,
      localidad: "otra",
      otraLocalidad: "Rosario",
      provinciaDeOtra: "Santa Fe",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["provinciaDeOtra"]);
  });
});
