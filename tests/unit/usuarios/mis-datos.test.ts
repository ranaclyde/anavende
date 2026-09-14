import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { actualizarDatos } from "@/modules/users/perfil";
import {
  cambioDeContrasenaSchema,
  misDatosSchema,
} from "@/modules/users/schemas";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * «Mis datos» — RF-07, RF-05. Tarea F5.2.
 *
 * La contraseña no se prueba acá: la guarda GoTrue, y comprobarla metería la
 * red y medio Supabase adentro de un test de dominio (lo mismo que decide
 * `tests/apoyo/compradores.ts`). Se prueba lo que es nuestro: qué se guarda,
 * en qué cuenta, y qué deja pasar el formulario.
 */

afterEach(limpiarCompradores);

async function perfil(userId: string) {
  const [fila] = await db.execute<{
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    email: string;
  }>(sql`
    SELECT first_name AS "firstName",
           last_name  AS "lastName",
           full_name  AS "fullName",
           phone, email
      FROM user_profiles WHERE id = ${userId}`);
  return fila;
}

describe("guardar los datos", () => {
  test("cambia nombre, apellido y teléfono, y el nombre para mostrar se rearma solo", async () => {
    const { userId } = await unComprador();
    const { email } = await perfil(userId);

    await actualizarDatos(userId, {
      firstName: "Ana",
      lastName: "Pérez Gómez",
      phone: "+5493415551234",
    });

    expect(await perfil(userId)).toEqual({
      firstName: "Ana",
      lastName: "Pérez Gómez",
      fullName: "Ana Pérez Gómez",
      phone: "+5493415551234",
      email,
    });
  });

  test("toca solo la cuenta de quien guarda", async () => {
    const una = await unComprador();
    const otra = await unComprador();
    const antes = await perfil(otra.userId);

    await actualizarDatos(una.userId, {
      firstName: "Ana",
      lastName: "Pérez",
      phone: "+5493415551234",
    });

    expect(await perfil(otra.userId)).toEqual(antes);
  });
});

describe("lo que llega del formulario", () => {
  test("el teléfono precargado vuelve igual si no se lo toca", () => {
    // La página lo muestra sin el +549, como lo escribe la gente. Guardar sin
    // cambiarlo no puede convertirlo en otro número.
    const r = misDatosSchema.parse({
      firstName: "Ana",
      lastName: "Pérez",
      phone: "1155550000",
    });
    expect(r.phone).toBe("+5491155550000");
  });

  test("el teléfono no puede quedar vacío (RF-05)", () => {
    const r = misDatosSchema.safeParse({
      firstName: "Ana",
      lastName: "Pérez",
      phone: "   ",
    });
    expect(r.success).toBe(false);
  });

  test("un email que se cuele en la entrada se descarta", () => {
    const r = misDatosSchema.parse({
      firstName: "Ana",
      lastName: "Pérez",
      phone: "1155550000",
      email: "otra@ejemplo.test",
    });
    expect(r).not.toHaveProperty("email");
  });
});

describe("la contraseña nueva", () => {
  test("las dos tienen que coincidir, y el error va en la segunda", () => {
    const r = cambioDeContrasenaSchema.safeParse({
      actual: "la-de-antes",
      nueva: "una-clave-larga",
      repetida: "otra-clave-larga",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["repetida"]);
  });

  test("con menos de 8 caracteres no pasa", () => {
    const r = cambioDeContrasenaSchema.safeParse({
      actual: "la-de-antes",
      nueva: "corta",
      repetida: "corta",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["nueva"]);
  });

  test("quien no tiene contraseña puede no mandar la actual", () => {
    // Si hace falta o no lo decide la acción, con la sesión (RF-06).
    const r = cambioDeContrasenaSchema.safeParse({
      nueva: "una-clave-larga",
      repetida: "una-clave-larga",
    });
    expect(r.success).toBe(true);
  });
});
