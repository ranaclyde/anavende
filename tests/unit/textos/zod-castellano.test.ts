import { describe, expect, test } from "vitest";
import { z } from "zod";

import "@/lib/zod-castellano";
import { cambioDeContrasenaSchema } from "@/modules/users/schemas";

/**
 * F10.7 — Lo que Zod diría por su cuenta sale en castellano, y un mensaje
 * propio del esquema le sigue ganando. DESIGN-REFERENCE §10.
 */
describe("los mensajes de respaldo de Zod", () => {
  test("la contraseña actual demasiado larga ya no dice «Too big»", () => {
    const r = cambioDeContrasenaSchema.safeParse({
      actual: "x".repeat(73),
      nueva: "una-contraseña-nueva",
      repetida: "una-contraseña-nueva",
    });
    expect(r.success).toBe(false);
    const mensajes = r.error!.issues.map((i) => i.message);
    expect(mensajes).toContain("Puede tener hasta 72 caracteres.");
    expect(mensajes.join(" ")).not.toMatch(/[Tt]oo big|expected|Invalid/);
  });

  test("lo que no tiene mensaje propio no sale en inglés", () => {
    const esquema = z.object({ id: z.uuid(), n: z.string().min(1) });
    const r = esquema.safeParse({ id: "x", n: "" });
    expect(r.error!.issues.map((i) => i.message)).toEqual([
      "Este dato no parece válido.",
      "Completá este dato.",
    ]);
  });

  test("un mensaje propio del esquema le gana al de respaldo", () => {
    const r = z.string().min(1, "Contanos tu nombre.").safeParse("");
    expect(r.error!.issues[0].message).toBe("Contanos tu nombre.");
  });
});
