import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { FILTROS_VACIOS } from "@/modules/catalog/products/filtros";
import { listarProductos } from "@/modules/catalog/products/queries";
import { AYUDA_DEL_UMBRAL } from "@/modules/settings/limites";
import {
  leerLaConfiguracion,
  umbralDeStockBajo,
  UMBRAL_DE_STOCK_BAJO_POR_DEFECTO,
} from "@/modules/settings/queries";
import { configuracionDelSitio } from "@/modules/settings/schemas";
import { escribirLaConfiguracion } from "@/modules/settings/service";
import { telefono } from "@/modules/users/schemas";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { motivoDel } from "@/tests/apoyo/errores";

/**
 * F2.7 — RF-20, §5.9, §10.3.
 *
 * Migrado de `scripts/verificar-configuracion.mts` (F4.0b).
 *
 * **No usa `enTransaccionRevertida`, y no es un olvido.** Lo que se prueba acá
 * son las FUNCIONES de la aplicación —`escribirLaConfiguracion`,
 * `listarProductos`—, que abren su propia conexión por el pool: desde afuera
 * de una transacción de test no verían nada de lo que esa transacción
 * escribió, y todo daría rojo sin que nada estuviera mal.
 *
 * La contrapartida es que acá SÍ se escribe de verdad, incluida la fila de
 * configuración. Se guarda la que hubiera antes y se repone al terminar: en el
 * stack local no es de nadie, pero el hábito de dejar la base como estaba es
 * lo que hace que estos tests se puedan correr sin pensarlo dos veces.
 */

const valido = (entrada: unknown) => configuracionDelSitio.safeParse(entrada);

const base = {
  whatsappNumber: "11 5555 5555",
  adminNotificationEmail: "ventas@anavende.com.ar",
  lowStockThreshold: 3,
};

type FilaPrevia = {
  whatsappNumber: string;
  adminNotificationEmail: string;
  lowStockThreshold: number;
  updatedAt: Date;
};

describe("el número de WhatsApp (RF-20)", () => {
  const numero = (v: string) =>
    valido({ ...base, whatsappNumber: v }).data?.whatsappNumber;

  test("se guarda normalizado a +549…, sin espacios", () => {
    expect(numero("11 5555 5555")).toBe("+5491155555555");
  });

  test.each([
    "+54 9 11 5555-5555",
    "(11) 5555-5555",
    "5491155555555",
    "11 5555 5555",
  ])("«%s» termina en la misma fila guardada", (escrito) => {
    expect(numero(escrito)).toBe("+5491155555555");
  });

  /**
   * La prueba que sostiene que sean UNA implementación y no dos parecidas.
   * Si se separaran, el número del sitio y el del comprador podrían guardarse
   * distinto y nadie lo notaría hasta que un `wa.me` no abriera.
   */
  test("el sitio y el comprador normalizan IGUAL: es la misma implementación", () => {
    expect(telefono.safeParse("11 5555 5555").data).toBe(numero("11 5555 5555"));
  });

  test.each(["", "1155", "no tengo"])("«%s» se rechaza", (malo) => {
    expect(valido({ ...base, whatsappNumber: malo }).success).toBe(false);
  });
});

describe("el email de avisos (RF-20)", () => {
  test("se recorta y se pasa a minúsculas", () => {
    // Dos formas de escribir la misma casilla tienen que ser una sola: si no,
    // cambiar el email por uno «distinto» que es el mismo no cambia nada y
    // parece que no se guardó.
    expect(
      valido({ ...base, adminNotificationEmail: "  Ventas@AnaVende.com.ar  " })
        .data?.adminNotificationEmail,
    ).toBe("ventas@anavende.com.ar");
  });

  test.each(["ventas@", ""])("«%s» se rechaza", (malo) => {
    expect(valido({ ...base, adminNotificationEmail: malo }).success).toBe(false);
  });
});

describe("el umbral de stock bajo (RF-20)", () => {
  const umbral = (v: unknown) => valido({ ...base, lowStockThreshold: v });

  test("1 y 100 entran: son los bordes", () => {
    expect(umbral(1).success).toBe(true);
    expect(umbral(100).success).toBe(true);
  });

  test("0 se rechaza: apagaría el aviso en vez de configurarlo", () => {
    // «Sin stock» ya cubre ese caso, y un cero se leería como «desactivado»
    // sin que ninguna pantalla lo diga.
    expect(umbral(0).success).toBe(false);
  });

  test("101 se rechaza: marcaría casi todo el catálogo", () => {
    expect(umbral(101).success).toBe(false);
  });

  test("3,5 se rechaza: el stock se cuenta en unidades enteras", () => {
    expect(umbral(3.5).success).toBe(false);
  });

  test("el texto «3» se rechaza: el formulario convierte, el esquema no adivina", () => {
    expect(umbral("3").success).toBe(false);
  });

  test("un umbral mal escrito explica la regla, con el MISMO texto del formulario", () => {
    // Que sea la misma constante y no dos frases parecidas es lo que evita
    // que el servidor y la pantalla se contradigan al explicar la regla.
    expect(umbral(0).error?.issues[0]?.message).toBe(AYUDA_DEL_UMBRAL);
    expect(umbral(3.5).error?.issues[0]?.message).toBe(AYUDA_DEL_UMBRAL);
  });
});

describe("guardar y leer (§5.9)", () => {
  let previa: FilaPrevia | undefined;

  beforeAll(async () => {
    [previa] = await db.execute<FilaPrevia>(sql`
      SELECT whatsapp_number          AS "whatsappNumber",
             admin_notification_email AS "adminNotificationEmail",
             low_stock_threshold      AS "lowStockThreshold",
             updated_at               AS "updatedAt"
        FROM site_settings WHERE id = 1`);
  });

  afterEach(limpiar);

  afterAll(async () => {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
    if (previa) {
      await db.execute(sql`
        INSERT INTO site_settings (id, whatsapp_number, admin_notification_email,
                                   low_stock_threshold, updated_at)
        VALUES (1, ${previa.whatsappNumber}, ${previa.adminNotificationEmail},
                ${previa.lowStockThreshold}, ${previa.updatedAt})`);
    }
  });

  async function sinFila() {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
  }

  test("sin fila se lee «todavía no se guardó», no valores vacíos", async () => {
    await sinFila();
    expect(await leerLaConfiguracion()).toBeNull();
  });

  test(`sin fila el umbral es el del código (${UMBRAL_DE_STOCK_BAJO_POR_DEFECTO}) y el listado no se cae`, async () => {
    await sinFila();
    expect(await umbralDeStockBajo()).toBe(UMBRAL_DE_STOCK_BAJO_POR_DEFECTO);
  });

  /**
   * La comprobación que justifica que sea un UPSERT y no un UPDATE. Con un
   * UPDATE el síntoma sería el peor posible: la pantalla diciendo «se guardó»
   * sobre una tabla vacía, y nadie mirando la tabla.
   */
  test("la PRIMERA vez CREA la fila", async () => {
    await sinFila();

    const primera = await escribirLaConfiguracion(
      valido({ ...base, whatsappNumber: "11 5555 5555" }).data!,
    );

    expect(primera.whatsappNumber).toBe("+5491155555555");
    expect(primera.lowStockThreshold).toBe(3);

    // Lo que devuelve guardar tiene que ser lo que después se lee: si no,
    // la pantalla muestra una cosa y la base guarda otra.
    expect((await leerLaConfiguracion())?.whatsappNumber).toBe(
      primera.whatsappNumber,
    );

    const [{ n }] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM site_settings`,
    );
    expect(n).toBe(1);
  });

  test("la SEGUNDA vez pisa la primera, y `updated_at` avanza", async () => {
    await sinFila();
    await escribirLaConfiguracion(valido(base).data!);

    const [antes] = await db.execute<{ updatedAt: Date }>(
      sql`SELECT updated_at AS "updatedAt" FROM site_settings WHERE id = 1`,
    );

    const segunda = await escribirLaConfiguracion(
      valido({
        whatsappNumber: "3512223344",
        adminNotificationEmail: "avisos@anavende.com.ar",
        lowStockThreshold: 7,
      }).data!,
    );

    const [despues] = await db.execute<{ updatedAt: Date; n: number }>(sql`
      SELECT updated_at AS "updatedAt",
             (SELECT count(*)::int FROM site_settings) AS n
        FROM site_settings WHERE id = 1`);

    expect(despues.n).toBe(1);
    expect(segunda.lowStockThreshold).toBe(7);

    // El DEFAULT de `updated_at` solo corre al INSERTAR: al pisar hay que
    // escribirlo a mano, y olvidarse deja una fecha que miente.
    expect(new Date(despues.updatedAt).getTime()).toBeGreaterThan(
      new Date(antes.updatedAt).getTime(),
    );
  });

  test("una segunda fila la rechaza el CHECK `singleton`, no el código", async () => {
    await sinFila();
    await escribirLaConfiguracion(valido(base).data!);

    let error: unknown;
    try {
      await db.execute(sql`
        INSERT INTO site_settings (id, whatsapp_number, admin_notification_email)
        VALUES (2, '+5491155555555', 'x@y.com')`);
    } catch (e) {
      error = e;
    }

    expect(error, "la segunda fila entró, y no debía").toBeDefined();
    expect(motivoDel(error)).toMatch(/singleton/i);
  });
});

describe("el umbral guardado es el que usa el listado (§10.3)", () => {
  let previa: FilaPrevia | undefined;

  beforeAll(async () => {
    [previa] = await db.execute<FilaPrevia>(sql`
      SELECT whatsapp_number          AS "whatsappNumber",
             admin_notification_email AS "adminNotificationEmail",
             low_stock_threshold      AS "lowStockThreshold",
             updated_at               AS "updatedAt"
        FROM site_settings WHERE id = 1`);
  });

  afterEach(limpiar);

  afterAll(async () => {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
    if (previa) {
      await db.execute(sql`
        INSERT INTO site_settings (id, whatsapp_number, admin_notification_email,
                                   low_stock_threshold, updated_at)
        VALUES (1, ${previa.whatsappNumber}, ${previa.adminNotificationEmail},
                ${previa.lowStockThreshold}, ${previa.updatedAt})`);
    }
  });

  /**
   * Todo el sentido de F2.7: hasta esa tarea el listado leía un 3 escrito en
   * el código. Un producto con CINCO disponibles es el borde exacto que el
   * umbral mueve, así que se prueba de los dos lados del borde — con uno solo
   * no se distingue «usa el umbral» de «siempre dice que sí».
   */
  test("con umbral 5 entra en «Para reponer»; con 4 sale", async () => {
    const { productId } = await unaVariante({ total: 5 });

    const paraReponer = async () => {
      const filas = await listarProductos(
        { ...FILTROS_VACIOS, stock: "reponer" },
        await umbralDeStockBajo(),
      );
      return filas.some((f) => f.id === productId);
    };

    await escribirLaConfiguracion(valido({ ...base, lowStockThreshold: 5 }).data!);
    expect(await umbralDeStockBajo()).toBe(5);
    expect(await paraReponer()).toBe(true);

    await escribirLaConfiguracion(valido({ ...base, lowStockThreshold: 4 }).data!);
    expect(await paraReponer()).toBe(false);
  });
});
