import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import {
  borrarArchivos,
  clavesDelLogo,
  publicarLogo,
  quitarLogo,
} from "@/modules/media/subir";
import { clave, TAMANOS_LOGO } from "@/modules/media/tamanos";
import { listarMediosDePago } from "@/modules/settings/queries";
import {
  crearMedioDePago,
  editarMedioDePago,
} from "@/modules/settings/schemas";
import { existe, png } from "@/tests/apoyo/imagenes";

/**
 * F2.6 — RF-19, RN-01, §9.1, §9.2. Contra Postgres y contra Storage de verdad.
 *
 * Migrado de `scripts/verificar-pagos.mts` (F4.0b).
 *
 * Lo que se prueba es lo que NO se ve leyendo el código:
 *
 *   · Que el orden quede sin huecos ni repetidos después de mover y de borrar.
 *     `sort_order` decide el orden en la tienda Y de dónde sale la posición del
 *     próximo que se cree: una numeración con agujeros no falla el día que se
 *     hace, falla el día siguiente.
 *   · Que el listado, mover y renumerar ordenen IGUAL. Si discreparan, la
 *     flecha movería el de al lado.
 *   · Que la canalización de logos —compartida con las marcas desde F2.6— suba
 *     los dos tamaños, borre el anterior al reemplazar y no deje archivos
 *     cuando la fila se va.
 *
 * **Los tests de orden y de logo son SECUENCIALES**, como el flujo que imitan:
 * mover dos veces y volver es una sola historia, y partirla en tres tests
 * independientes obligaría a rearmar el escenario tres veces para probar
 * menos. Vitest los corre en orden de declaración.
 */

describe("validación (RF-19)", () => {
  test("un medio de pago sin descripción es válido", () => {
    expect(crearMedioDePago.safeParse({ name: "Transferencia" }).success).toBe(
      true,
    );
  });

  test("…y la descripción vacía se guarda como NULL, no como cadena vacía", () => {
    // La diferencia se ve en la tienda: `null` no pinta el renglón, `""` pinta
    // uno vacío que corre todo lo de abajo.
    expect(
      crearMedioDePago.safeParse({ name: "Transferencia" }).data?.description,
    ).toBeNull();
  });

  test("la descripción se recorta", () => {
    expect(
      crearMedioDePago.safeParse({ name: "Efectivo", description: "  10% off  " })
        .data?.description,
    ).toBe("10% off");
  });

  test("un nombre de una letra se rechaza", () => {
    expect(crearMedioDePago.safeParse({ name: "X" }).success).toBe(false);
  });

  test("una descripción de más de 120 caracteres se rechaza", () => {
    expect(
      crearMedioDePago.safeParse({
        name: "Transferencia",
        description: "x".repeat(121),
      }).success,
    ).toBe(false);
  });

  test("editar sin id se rechaza", () => {
    expect(editarMedioDePago.safeParse({ name: "Transferencia" }).success).toBe(
      false,
    );
  });
});

describe("contra la base y contra Storage", () => {
  const marca = String(Date.now());
  const creados: string[] = [];
  const archivos: string[] = [];

  let a: { id: string; sortOrder: number };
  let b: { id: string; sortOrder: number };
  let c: { id: string; sortOrder: number };
  let previos = 0;

  /** El mismo INSERT que la Server Action, sin la sesión. */
  async function crear(nombre: string) {
    const [fila] = await db.execute<{ id: string; sortOrder: number }>(sql`
      INSERT INTO payment_methods (name, sort_order)
      VALUES (${nombre},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id, sort_order AS "sortOrder"`);
    creados.push(fila.id);
    return fila;
  }

  async function posiciones() {
    return db.execute<{ name: string; sortOrder: number }>(sql`
      SELECT name, sort_order AS "sortOrder" FROM payment_methods
       ORDER BY sort_order, immutable_unaccent(lower(name))`);
  }

  /** Los nombres en orden, recortados a la primera palabra. */
  const nombres = async () =>
    (await posiciones()).map((f) => f.name.split(" ")[0]).join(",");

  /**
   * Mover, con la MISMA lógica de `modules/settings/actions.ts`, incluido el
   * `FOR UPDATE`: sin el bloqueo, dos flechas apretadas casi a la vez leen la
   * misma lista y la segunda escribe posiciones calculadas sobre un orden que
   * ya cambió.
   */
  async function mover(id: string, direccion: "arriba" | "abajo") {
    await db.transaction(async (tx) => {
      const filas = await tx.execute<{ id: string }>(sql`
        SELECT id FROM payment_methods
         ORDER BY sort_order, immutable_unaccent(lower(name))
           FOR UPDATE`);
      const ids = filas.map((f) => f.id);
      const desde = ids.indexOf(id);
      const hasta = direccion === "arriba" ? desde - 1 : desde + 1;
      if (hasta < 0 || hasta >= ids.length) return;
      [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];
      for (const [n, cual] of ids.entries()) {
        await tx.execute(
          sql`UPDATE payment_methods SET sort_order = ${n} WHERE id = ${cual}`,
        );
      }
    });
  }

  beforeAll(async () => {
    const [{ n }] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM payment_methods`,
    );
    previos = n;

    a = await crear(`Transferencia ${marca}`);
    b = await crear(`Efectivo ${marca}`);
    c = await crear(`Mercado Pago ${marca}`);
  });

  afterAll(async () => {
    if (creados.length) {
      await db.delete(paymentMethods).where(inArray(paymentMethods.id, creados));
    }
    await borrarArchivos(archivos);
  });

  describe("el orden (RF-19)", () => {
    test("cada alta se agrega al final, sin pisar al anterior", () => {
      expect([a.sortOrder, b.sortOrder, c.sortOrder]).toEqual([
        previos,
        previos + 1,
        previos + 2,
      ]);
    });

    // Se compara con `endsWith` y no con igualdad: la base local puede tener
    // medios de pago cargados antes, y el test no es sobre ellos.
    test("el listado respeta el orden configurado", async () => {
      expect(await nombres()).toMatch(/Transferencia,Efectivo,Mercado$/);
    });

    test("mover uno hacia arriba lo intercambia con el de encima", async () => {
      await mover(c.id, "arriba");
      expect(await nombres()).toMatch(/Transferencia,Mercado,Efectivo$/);
    });

    test("…y otra vez lo deja primero", async () => {
      await mover(c.id, "arriba");
      expect(await nombres()).toMatch(/Mercado,Transferencia,Efectivo$/);
    });

    test("subir el primero no falla y no cambia nada: el borde no es un error", async () => {
      const antes = await nombres();
      await mover(c.id, "arriba");
      expect(await nombres()).toBe(antes);
    });

    test("bajar deshace el movimiento", async () => {
      await mover(c.id, "abajo");
      expect(await nombres()).toMatch(/Transferencia,Mercado,Efectivo$/);
    });

    test("después de mover, las posiciones quedan 0, 1, 2… sin huecos", async () => {
      const numeros = (await posiciones()).map((f) => f.sortOrder);
      expect(numeros).toEqual(numeros.map((_, i) => i));
    });
  });

  describe("el logo, que comparte canalización con las marcas", () => {
    let subido: { logoKey: string };
    let reemplazo: { logoKey: string };

    test("se guarda bajo su propia carpeta (§9.2)", async () => {
      subido = await publicarLogo({
        destino: "medio-de-pago",
        id: a.id,
        archivo: await png(),
      });
      archivos.push(...TAMANOS_LOGO.map((t) => clave(subido.logoKey, t.sufijo)));

      expect(subido.logoKey).toMatch(
        new RegExp(`^medios-de-pago/${a.id}/`),
      );
    });

    test(`suben los ${TAMANOS_LOGO.length} tamaños del logo`, async () => {
      const estan = await Promise.all(
        TAMANOS_LOGO.map((t) => existe(clave(subido.logoKey, t.sufijo))),
      );
      expect(estan).toEqual(TAMANOS_LOGO.map(() => true));
    });

    test("…y el tamaño `detail` no se genera: un logo no tiene dónde usarlo", async () => {
      // Generarlo sería un archivo de 1400px por logo que nadie pide nunca,
      // ocupando lugar para siempre.
      expect(await existe(clave(subido.logoKey, "detail"))).toBe(false);
    });

    test("la fila guarda la CLAVE, no la URL (§9.4)", async () => {
      const [f] = await db.execute<{ logoKey: string }>(
        sql`SELECT logo_key AS "logoKey" FROM payment_methods WHERE id = ${a.id}`,
      );
      // Guardar la URL ataría las filas al backend de almacenamiento del día
      // en que se escribieron.
      expect(f.logoKey).toBe(subido.logoKey);
    });

    test("el listado devuelve la URL ya resuelta, en el tamaño chico", async () => {
      const listado = await listarMediosDePago();
      expect(listado.find((m) => m.id === a.id)?.logoUrl).toContain(
        subido.logoKey,
      );
    });

    test("reemplazar el logo escribe una clave nueva", async () => {
      reemplazo = await publicarLogo({
        destino: "medio-de-pago",
        id: a.id,
        archivo: await png(240, 240),
      });
      archivos.push(
        ...TAMANOS_LOGO.map((t) => clave(reemplazo.logoKey, t.sufijo)),
      );

      expect(reemplazo.logoKey).not.toBe(subido.logoKey);
    });

    test("…y borra los archivos del anterior, que si no quedan para siempre", async () => {
      expect(await existe(clave(subido.logoKey, "thumb"))).toBe(false);
    });

    test("quitar el logo deja la columna en NULL y se lleva los archivos", async () => {
      await quitarLogo("medio-de-pago", a.id);

      const [f] = await db.execute<{ logoKey: string | null }>(
        sql`SELECT logo_key AS "logoKey" FROM payment_methods WHERE id = ${a.id}`,
      );
      expect(f.logoKey).toBeNull();
      expect(await existe(clave(reemplazo.logoKey, "thumb"))).toBe(false);
    });
  });

  describe("borrar (RN-11 no le cabe)", () => {
    let conArchivos: { logoKey: string };
    let aBorrar: string[];

    test("se leen las claves ANTES del DELETE", async () => {
      conArchivos = await publicarLogo({
        destino: "medio-de-pago",
        id: b.id,
        archivo: await png(),
      });
      archivos.push(
        ...TAMANOS_LOGO.map((t) => clave(conArchivos.logoKey, t.sufijo)),
      );

      // Es el orden que hace toda la diferencia: después del DELETE la fila ya
      // no está y las claves no se pueden averiguar. Los archivos quedarían en
      // el bucket sin nada que los nombre — y a un huérfano no lo encuentra ni
      // lo borra nadie.
      aBorrar = await clavesDelLogo("medio-de-pago", b.id);
      expect(aBorrar).toHaveLength(TAMANOS_LOGO.length);
    });

    test("borrar el medio de pago se lleva su logo de Storage", async () => {
      await db.delete(paymentMethods).where(inArray(paymentMethods.id, [b.id]));
      creados.splice(creados.indexOf(b.id), 1);
      await borrarArchivos(aBorrar);

      expect(await existe(clave(conArchivos.logoKey, "thumb"))).toBe(false);
    });

    test("borrar uno del medio renumera al resto", async () => {
      // La renumeración de la acción, tal cual.
      await db.execute(sql`
        WITH ordenados AS (
          SELECT id, row_number() OVER (
                   ORDER BY sort_order, immutable_unaccent(lower(name))
                 ) - 1 AS n
            FROM payment_methods
        )
        UPDATE payment_methods p SET sort_order = o.n
          FROM ordenados o WHERE p.id = o.id AND p.sort_order <> o.n`);

      const despues = (await posiciones()).map((f) => f.sortOrder);
      expect(despues).toEqual(despues.map((_, i) => i));
    });
  });
});
