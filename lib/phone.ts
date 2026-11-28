import { z } from "zod";

// Se guarda siempre como `+549` + diez dígitos: así `wa.me/<numero>` se arma
// concatenando (`lib/whatsapp.ts`).

/** Lo guardado, sin el `+549` que el campo ya muestra. */
export function localPhone(stored: string): string {
  return stored.replace(/^\+549/, "");
}

type PhoneReading =
  | { ok: true; digits: string }
  | {
      ok: false;
      reason: "formato" | "quince" | "faltan" | "sobran";
      count: number;
    };

/**
 * Los diez dígitos (característica más número), o por qué no se pudieron sacar.
 *
 * El 15 no se quita solo, se pide sacar: saber dónde termina la
 * característica exige una tabla de las 300 que hay, y quitar el que no era
 * guardaría otro número sin avisar.
 */
export function readPhone(input: string): PhoneReading {
  const clean = input.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(clean))
    return { ok: false, reason: "formato", count: 0 };

  let d = clean.replace(/^\+/, "");
  // Una característica nunca empieza con 5: un 54 adelante es el código del
  // país.
  if (clean.startsWith("+") || (d.startsWith("54") && d.length >= 12)) {
    if (!d.startsWith("54")) return { ok: false, reason: "formato", count: 0 };
    d = d.slice(2);
  }
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);

  if (d.length === 12 && d.slice(2, 6).includes("15")) {
    return { ok: false, reason: "quince", count: 12 };
  }
  if (d.length < 10) return { ok: false, reason: "faltan", count: d.length };
  if (d.length > 10) return { ok: false, reason: "sobran", count: d.length };
  if (!/^[123]/.test(d)) return { ok: false, reason: "formato", count: 10 };
  return { ok: true, digits: d };
}

function whyInvalid(
  l: Exclude<PhoneReading, { ok: true }>,
  invalid: string,
): string {
  const difference = Math.abs(10 - l.count);
  const single = difference === 1;
  const digitsText = single ? "un número" : `${difference} números`;
  switch (l.reason) {
    case "quince":
      return "Escribilo sin el 15: con la característica son 10 números.";
    case "faltan":
      return `Le ${single ? "falta" : "faltan"} ${digitsText}: con la característica son 10, sin el 0 ni el 15.`;
    case "sobran":
      return `Le ${single ? "sobra" : "sobran"} ${digitsText}: con la característica son 10, sin el 0 ni el 15.`;
    case "formato":
      return invalid;
  }
}

export function argentinePhone(messages: {
  required: string;
  invalid: string;
}) {
  return z
    .string()
    .trim()
    .min(1, messages.required)
    .transform((v, ctx) => {
      const l = readPhone(v);
      if (!l.ok) {
        ctx.addIssue({
          code: "custom",
          message: whyInvalid(l, messages.invalid),
        });
        return z.NEVER;
      }
      return `+549${l.digits}`;
    });
}
