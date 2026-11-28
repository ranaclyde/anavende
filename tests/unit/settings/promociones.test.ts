import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { cuota } from "@/lib/money";
import {
  conQuien,
  promocionesParaElPrecio,
  type PromocionVigente,
} from "@/modules/settings/promociones";
import {
  listarMediosDePago,
  promocionesVigentes,
} from "@/modules/settings/queries";
import { crearPromocion } from "@/modules/settings/schemas";

/**
 * RF-40. Lo que no se ve leyendo el código:
 *
 *   · Que la cuota se redondee HACIA ARRIBA, y que sea la única cuenta del
 *     sistema que lo hace: tres cuotas tienen que sumar al menos el precio.
 *   · Que la vigencia se mida con el día de Argentina, no con el de UTC.
 *   · Que la destacada sea la de más cuotas sin recargo, y si no hay, la de
 *     cuota más baja, con los empates para el orden de los medios.
 */

describe("la cuota (RF-40)", () => {
  test("sin recargo, se redondea al centavo hacia arriba", () => {
    // 37000 / 3 = 12333,333… → 12333,34, y tres de esas no quedan cortas.
    expect(cuota("37000.00", "0.00", 3)).toBe("12333.34");
  });

  test("con recargo, sobre el precio con el recargo", () => {
    // 37000 × 1,15 / 3 = 14183,333… → 14183,34
    expect(cuota("37000.00", "15.00", 3)).toBe("14183.34");
  });

  test("una división exacta no suma un centavo", () => {
    expect(cuota("36000.00", "0.00", 3)).toBe("12000.00");
  });

  test("recargo con decimales", () => {
    // 10000 × 1,125 / 6 = 1875
    expect(cuota("10000.00", "12.50", 6)).toBe("1875.00");
  });

  test("menos de 2 cuotas no es una promoción de cuotas", () => {
    expect(() => cuota("1000.00", "0.00", 1)).toThrow(RangeError);
  });
});

describe("cuál se muestra (RF-40)", () => {
  const p = (
    id: string,
    medio: string,
    cuotas: number,
    recargo = "0.00",
    montoMinimo: string | null = null,
  ): PromocionVigente => ({
    id,
    medio,
    plan: null,
    logoUrl: null,
    cuotas,
    recargo,
    montoMinimo,
  });

  test("sin ninguna, no hay nada que mostrar", () => {
    expect(promocionesParaElPrecio([], "1000.00")).toEqual({
      destacada: null,
      todas: [],
    });
  });

  test("gana la de más cuotas sin recargo, aunque haya otra con cuota más baja", () => {
    const r = promocionesParaElPrecio(
      [
        p("a", "Go Cuotas", 3),
        p("b", "Naranja X", 12, "40.00"),
        p("c", "Visa", 6),
      ],
      "12000.00",
    );
    expect(r.destacada?.id).toBe("c");
  });

  test("todas, para el modal: la destacada incluida, primero las sin recargo y de menos a más cuotas", () => {
    const r = promocionesParaElPrecio(
      [
        p("doce", "Visa", 12, "40.00"),
        p("seis", "Go Cuotas", 6),
        p("tresRecargo", "Naranja X", 3, "15.00"),
        p("tres", "Go Cuotas", 3),
        p("tresOtro", "Naranja X", 3),
      ],
      "12000.00",
    );
    expect(r.todas.map((x) => x.id)).toEqual([
      // Empatadas en 3: en el orden en que llegaron, que es el de los medios.
      "tres",
      "tresOtro",
      "seis",
      "tresRecargo",
      "doce",
    ]);
  });

  test("si ninguna es sin recargo, gana la de cuota más baja", () => {
    const r = promocionesParaElPrecio(
      [p("a", "Naranja X", 3, "10.00"), p("b", "Visa", 12, "50.00")],
      "12000.00",
    );
    // 12000 × 1,1 / 3 = 4400; 12000 × 1,5 / 12 = 1500
    expect(r.destacada?.id).toBe("b");
  });

  test("en un empate gana la del medio que va primero", () => {
    const r = promocionesParaElPrecio(
      [p("a", "Go Cuotas", 3), p("b", "Naranja X", 3)],
      "9000.00",
    );
    expect(r.destacada?.id).toBe("a");
  });

  test("la que pide un mínimo que el precio no alcanza no aparece", () => {
    const r = promocionesParaElPrecio(
      [p("a", "Go Cuotas", 6, "0.00", "20000.00"), p("b", "Visa", 3)],
      "19999.99",
    );
    expect(r.destacada?.id).toBe("b");
    expect(r.todas.map((x) => x.id)).toEqual(["b"]);
  });

  test("el precio justo en el mínimo alcanza", () => {
    const r = promocionesParaElPrecio(
      [p("a", "Go Cuotas", 6, "0.00", "20000.00")],
      "20000.00",
    );
    expect(r.destacada?.id).toBe("a");
  });
});

describe("con quién (RF-40)", () => {
  test("sin plan, el medio; con plan, «Plan Z de NaranjaX»", () => {
    expect(conQuien({ medio: "NaranjaX", plan: null })).toBe("NaranjaX");
    expect(conQuien({ medio: "NaranjaX", plan: "Plan Z" })).toBe(
      "Plan Z de NaranjaX",
    );
  });
});

describe("validación (RF-40)", () => {
  const base = {
    paymentMethodId: "00000000-0000-4000-8000-000000000000",
    plan: "",
    cuotas: 3,
    recargo: "",
    desde: "2026-11-01",
    hasta: "2026-11-30",
    montoMinimo: "",
  };

  test("el plan se recorta, y vacío es NULL", () => {
    expect(
      crearPromocion.safeParse({ ...base, plan: "  Plan Z " }).data?.plan,
    ).toBe("Plan Z");
    expect(
      crearPromocion.safeParse({ ...base, plan: "" }).data?.plan,
    ).toBeNull();
    expect(
      crearPromocion.safeParse({ ...base, plan: "x".repeat(41) }).success,
    ).toBe(false);
  });

  test("recargo vacío es sin interés, y mínimo vacío es NULL", () => {
    const r = crearPromocion.safeParse(base);
    expect(r.data?.recargo).toBe("0.00");
    expect(r.data?.montoMinimo).toBeNull();
  });

  test("el recargo acepta coma decimal y el signo de porcentaje", () => {
    expect(
      crearPromocion.safeParse({ ...base, recargo: "15,5 %" }).data?.recargo,
    ).toBe("15.50");
  });

  test("el mínimo acepta punto de miles", () => {
    expect(
      crearPromocion.safeParse({ ...base, montoMinimo: "20.000" }).data
        ?.montoMinimo,
    ).toBe("20000.00");
  });

  test("sin fecha de fin, no vence", () => {
    expect(
      crearPromocion.safeParse({ ...base, hasta: "" }).data?.hasta,
    ).toBeNull();
  });

  test("el fin antes del inicio se rechaza en «hasta»", () => {
    const r = crearPromocion.safeParse({ ...base, hasta: "2026-10-31" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["hasta"]);
  });

  test("1 cuota, o más de 48, no", () => {
    expect(crearPromocion.safeParse({ ...base, cuotas: 1 }).success).toBe(
      false,
    );
    expect(crearPromocion.safeParse({ ...base, cuotas: 49 }).success).toBe(
      false,
    );
  });

  test("un recargo de más de 200 % no", () => {
    expect(crearPromocion.safeParse({ ...base, recargo: "201" }).success).toBe(
      false,
    );
  });
});

describe("contra Postgres (RF-40)", () => {
  const marca = `t-promo-${Date.now()}`;
  const medios: string[] = [];
  let activo: string;
  let inactivo: string;
  let hoy: string;

  async function medio(nombre: string, activo = true) {
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO payment_methods (name, is_active, sort_order)
      VALUES (${nombre}, ${activo},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id`);
    medios.push(fila.id);
    return fila.id;
  }

  async function promo(
    medio: string,
    cuotas: number,
    desde: string,
    hasta: string | null,
    activa = true,
  ) {
    const [fila] = await db.execute<{ id: string }>(sql`
      INSERT INTO payment_promotions
             (payment_method_id, installments, starts_on, ends_on, is_active)
      VALUES (${medio}, ${cuotas}, ${desde}, ${hasta}, ${activa})
      RETURNING id`);
    return fila.id;
  }

  /** Un día relativo a hoy en Argentina, como `AAAA-MM-DD`. */
  async function dia(delta: number) {
    const [f] = await db.execute<{ d: string }>(sql`
      SELECT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
              + ${delta}::int)::text AS d`);
    return f.d;
  }

  const ids: Record<string, string> = {};

  beforeAll(async () => {
    hoy = await dia(0);
    activo = await medio(`Go Cuotas ${marca}`);
    inactivo = await medio(`Apagado ${marca}`, false);

    ids.vigente = await promo(activo, 3, await dia(-5), await dia(5));
    ids.terminaHoy = await promo(activo, 4, await dia(-5), hoy);
    ids.empiezaHoy = await promo(activo, 5, hoy, null);
    ids.vencida = await promo(activo, 6, await dia(-10), await dia(-1));
    ids.programada = await promo(activo, 7, await dia(1), await dia(10));
    ids.apagada = await promo(activo, 8, await dia(-1), await dia(1), false);
    ids.deMedioApagado = await promo(inactivo, 9, await dia(-1), null);
  });

  afterAll(async () => {
    if (medios.length) {
      await db.delete(paymentMethods).where(inArray(paymentMethods.id, medios));
    }
  });

  test("la tienda ve solo las vigentes hoy, activas y de un medio activo", async () => {
    const vistas = new Set((await promocionesVigentes()).map((p) => p.id));
    expect(vistas.has(ids.vigente)).toBe(true);
    // Los bordes son inclusivos: el último día todavía vale, y el primero ya.
    expect(vistas.has(ids.terminaHoy)).toBe(true);
    expect(vistas.has(ids.empiezaHoy)).toBe(true);
    expect(vistas.has(ids.vencida)).toBe(false);
    expect(vistas.has(ids.programada)).toBe(false);
    expect(vistas.has(ids.apagada)).toBe(false);
    expect(vistas.has(ids.deMedioApagado)).toBe(false);
  });

  test("el recargo y el mínimo llegan como texto, listos para `lib/money`", async () => {
    const p = (await promocionesVigentes()).find((x) => x.id === ids.vigente);
    expect(p).toMatchObject({
      cuotas: 3,
      recargo: "0.00",
      montoMinimo: null,
      plan: null,
      logoUrl: null,
    });
    expect(p?.medio).toBe(`Go Cuotas ${marca}`);
  });

  test("el panel trae todas, con su estado, y las vencidas al final", async () => {
    let encontrado;
    for (let pagina = 1; !encontrado; pagina++) {
      const { items } = await listarMediosDePago(pagina);
      if (!items.length) break;
      encontrado = items.find((m) => m.id === activo);
    }
    const estados = Object.fromEntries(
      encontrado!.promociones.map((p) => [p.id, p.estado]),
    );
    expect(estados[ids.vigente]).toBe("vigente");
    expect(estados[ids.terminaHoy]).toBe("vigente");
    expect(estados[ids.vencida]).toBe("vencida");
    expect(estados[ids.programada]).toBe("programada");
    // Apagada sigue siendo vigente por fecha: `activa` es aparte.
    expect(estados[ids.apagada]).toBe("vigente");
    expect(encontrado!.promociones.at(-1)?.id).toBe(ids.vencida);
  });

  test("la base rechaza un fin anterior al inicio y 1 cuota", async () => {
    await expect(promo(activo, 3, hoy, await dia(-1))).rejects.toThrow();
    await expect(promo(activo, 1, hoy, null)).rejects.toThrow();
  });

  test("borrar el medio de pago se lleva sus promociones", async () => {
    await db
      .delete(paymentMethods)
      .where(inArray(paymentMethods.id, [inactivo]));
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM payment_promotions
       WHERE id = ${ids.deMedioApagado}`);
    expect(n).toBe(0);
  });
});
