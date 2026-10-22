import { describe, expect, test } from "vitest";

import { telefonoArgentino, telefonoLocal } from "@/lib/telefono";

/** El teléfono argentino: cuántos números, y qué se le dice a quien se equivoca. */

const esquema = telefonoArgentino({
  requerido: "Falta el teléfono.",
  invalido: "No parece un teléfono.",
});

const guardado = (v: string) => esquema.safeParse(v).data;
const error = (v: string) => esquema.safeParse(v).error?.issues[0]?.message;

describe("telefonoArgentino", () => {
  test.each([
    ["2920 55-5555", "+5492920555555"],
    ["(2920) 555555", "+5492920555555"],
    ["02920 555555", "+5492920555555"],
    ["+54 9 2920 555555", "+5492920555555"],
    ["+54 2920 555555", "+5492920555555"],
    ["5492920555555", "+5492920555555"],
    ["9 2920 555555", "+5492920555555"],
    ["11.5555.5555", "+5491155555555"],
  ])("«%s» se guarda %s", (escrito, esperado) => {
    expect(guardado(escrito)).toBe(esperado);
  });

  test("dice cuántos números faltan o sobran", () => {
    expect(error("2920 55555")).toBe(
      "Le falta un número: con la característica son 10, sin el 0 ni el 15.",
    );
    expect(error("2920 555")).toBe(
      "Le faltan 3 números: con la característica son 10, sin el 0 ni el 15.",
    );
    expect(error("2920 5555555")).toBe(
      "Le sobra un número: con la característica son 10, sin el 0 ni el 15.",
    );
  });

  test("pide sacar el 15 en vez de adivinar dónde estaba", () => {
    expect(error("2920 15 555555")).toBe(
      "Escribilo sin el 15: con la característica son 10 números.",
    );
    expect(error("011 15 5555 5555")).toBe(
      "Escribilo sin el 15: con la característica son 10 números.",
    );
  });

  test("letras, un + que no es el del país o una característica imposible", () => {
    expect(error("2920 ABC 555")).toBe("No parece un teléfono.");
    expect(error("+1 2920 555555")).toBe("No parece un teléfono.");
    expect(error("4920 555555")).toBe("No parece un teléfono.");
  });

  test("vacío pide el teléfono", () => {
    expect(error("   ")).toBe("Falta el teléfono.");
  });
});

describe("telefonoLocal", () => {
  test("lo guardado vuelve sin el +549, y al guardarlo otra vez es el mismo", () => {
    expect(telefonoLocal("+5492920555555")).toBe("2920555555");
    expect(guardado(telefonoLocal("+5492920555555"))).toBe("+5492920555555");
  });
});
