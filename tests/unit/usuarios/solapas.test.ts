import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * El contador de las solapas de estado del listado de usuarios — RF-26,
 * RF-34 · DR §6.9.
 *
 * Lo que se prueba acá no se ve leyendo la consulta: que **los cinco números
 * digan exactamente lo que el listado va a mostrar**. Son dos lugares que
 * repiten las mismas condiciones —`contarPorEstado` con `FILTER` y
 * `condiciones()` con `WHERE`—, y si se separan la solapa dice 3 y la tabla
 * trae 2.
 */

const { contarPorEstado, listarUsuarios } =
  await import("@/modules/users/panel/queries");
const { FILTROS_VACIOS, hayFiltros, sinFiltros, urlDeFiltros } =
  await import("@/modules/users/panel/filtros");

afterEach(limpiarCompradores);

/** Cuántos de los recién creados trae cada solapa, sin contar los de antes. */
async function filas(estado: (typeof FILTROS_VACIOS)["estado"], ids: string[]) {
  const { usuarios } = await listarUsuarios({ ...FILTROS_VACIOS, estado });
  return usuarios.filter((u) => ids.includes(u.id)).length;
}

describe("contarPorEstado (§6.9)", () => {
  test("devuelve los cinco estados, y «todos» es el total de la tabla", async () => {
    const conteo = await contarPorEstado();
    const [{ total }] = await db.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM user_profiles`,
    );

    expect(Object.keys(conteo).sort()).toEqual([
      "activos",
      "baja-pedida",
      "bloqueados",
      "dados-de-baja",
      "todos",
    ]);
    expect(conteo.todos).toBe(total);
  });

  test("cada número es el que el listado de esa solapa va a mostrar", async () => {
    // Toda baja ejecutada tuvo que pedirse antes (`closed_was_requested`),
    // así que no hay forma de crear una cerrada sin pedido.
    // Una cuenta sin nada: tiene que caer en «activas» y en «todas».
    await unComprador();
    const bloqueado = await unComprador();
    const pidioLaBaja = await unComprador();
    const deBaja = await unComprador();

    await db.execute(
      sql`UPDATE user_profiles SET is_banned = true, ban_reason = 'prueba' WHERE id = ${bloqueado.userId}`,
    );
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'prueba'
       WHERE id = ${pidioLaBaja.userId}`);
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'prueba',
             closed_at = now()
       WHERE id = ${deBaja.userId}`);

    // No se comparan números absolutos —la base de pruebas tiene cuentas de
    // otros archivos— sino que **la solapa y el listado digan lo mismo**, que
    // es lo único que puede romperse si las condiciones se separan.
    const conteo = await contarPorEstado();

    for (const estado of [
      "todos",
      "activos",
      "bloqueados",
      "baja-pedida",
      "dados-de-baja",
    ] as const) {
      const { total } = await listarUsuarios({ ...FILTROS_VACIOS, estado });
      expect(
        conteo[estado],
        `la solapa «${estado}» dice ${conteo[estado]} y el listado trae ${total}`,
      ).toBe(total);
    }
  });

  test("los cinco no suman el total: se pisan, y está bien", async () => {
    const doble = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET is_banned = true, ban_reason = 'prueba',
             closure_requested_at = now(),
             closure_reason = 'prueba'
       WHERE id = ${doble.userId}`);

    const conteo = await contarPorEstado();
    const ids = [doble.userId];

    // La misma cuenta aparece en «bloqueadas» y en «baja pedida», porque son
    // dos filtros y no una partición. Lo que no puede pasar es que alguna
    // solapa la esconda: la suma de las dos es mayor que la cuenta sola.
    expect(await filas("bloqueados", ids)).toBe(1);
    expect(await filas("baja-pedida", ids)).toBe(1);
    // Y no está entre las activas: el bloqueo la saca.
    expect(await filas("activos", ids)).toBe(0);
    expect(
      conteo.activos +
        conteo.bloqueados +
        conteo["baja-pedida"] +
        conteo["dados-de-baja"],
    ).toBeGreaterThan(conteo.todos - 1);
  });

  test("la baja pedida NO saca a la cuenta de «activas» (RF-34)", async () => {
    // La cuenta sigue entrando, en solo lectura, hasta que la baja se
    // ejecuta: por eso «baja pedida» es trabajo por hacer y no un estado.
    const pide = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'prueba'
       WHERE id = ${pide.userId}`);

    const ids = [pide.userId];
    expect(await filas("activos", ids)).toBe(1);
    expect(await filas("baja-pedida", ids)).toBe(1);
  });

  test("ejecutada la baja, sale de «activas» y entra en «dadas de baja»", async () => {
    const baja = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET closure_requested_at = now(), closure_reason = 'prueba',
             closed_at = now()
       WHERE id = ${baja.userId}`);

    const ids = [baja.userId];
    expect(await filas("activos", ids)).toBe(0);
    expect(await filas("dados-de-baja", ids)).toBe(1);
    // Y deja de contar como baja pedida: ya no hay nada que hacer con ella.
    expect(await filas("baja-pedida", ids)).toBe(0);
  });
});

describe("el estado dejó de ser un filtro que se limpia", () => {
  test("estar parada en una solapa no enciende «Limpiar todo»", () => {
    // Antes sí: era un desplegable, y elegir «Solo bloqueados» contaba como
    // filtro puesto. Como solapa dice dónde se está parada, y limpiar los
    // filtros no tiene por qué mover a nadie de pantalla.
    expect(hayFiltros({ ...FILTROS_VACIOS, estado: "bloqueados" })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, q: "ana" })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, rol: "admin" })).toBe(true);
  });

  test("«Limpiar todo» conserva la solapa y borra lo demás", () => {
    const limpio = sinFiltros({
      q: "ana",
      rol: "admin",
      estado: "baja-pedida",
      pagina: 3,
    });
    expect(limpio).toEqual({
      q: "",
      rol: "todos",
      estado: "baja-pedida",
      pagina: 1,
    });
  });

  test("el enlace de cada solapa conserva la búsqueda y vuelve a la 1", () => {
    const url = urlDeFiltros({
      q: "ana",
      rol: "admin",
      estado: "bloqueados",
      pagina: 1,
    });
    expect(url).toBe("/admin/usuarios?q=ana&rol=admin&estado=bloqueados");
    // Y el listado sin tocar sigue siendo la dirección a secas.
    expect(urlDeFiltros(FILTROS_VACIOS)).toBe("/admin/usuarios");
  });
});
