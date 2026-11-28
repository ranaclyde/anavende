import { z } from "zod";

// Se guarda siempre como `+549` + diez dígitos: así `wa.me/<numero>` se arma
// concatenando (`lib/whatsapp.ts`).

/** Lo guardado, sin el `+549` que el campo ya muestra. */
export function telefonoLocal(guardado: string): string {
  return guardado.replace(/^\+549/, "");
}

type Lectura =
  | { ok: true; digitos: string }
  | {
      ok: false;
      motivo: "formato" | "quince" | "faltan" | "sobran";
      cuantos: number;
    };

/**
 * Los diez dígitos (característica más número), o por qué no se pudieron sacar.
 *
 * El 15 no se quita solo, se pide sacar: saber dónde termina la
 * característica exige una tabla de las 300 que hay, y quitar el que no era
 * guardaría otro número sin avisar.
 */
export function leerTelefono(escrito: string): Lectura {
  const limpio = escrito.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(limpio))
    return { ok: false, motivo: "formato", cuantos: 0 };

  let d = limpio.replace(/^\+/, "");
  // Una característica nunca empieza con 5: un 54 adelante es el código del
  // país.
  if (limpio.startsWith("+") || (d.startsWith("54") && d.length >= 12)) {
    if (!d.startsWith("54"))
      return { ok: false, motivo: "formato", cuantos: 0 };
    d = d.slice(2);
  }
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);

  if (d.length === 12 && d.slice(2, 6).includes("15")) {
    return { ok: false, motivo: "quince", cuantos: 12 };
  }
  if (d.length < 10) return { ok: false, motivo: "faltan", cuantos: d.length };
  if (d.length > 10) return { ok: false, motivo: "sobran", cuantos: d.length };
  if (!/^[123]/.test(d)) return { ok: false, motivo: "formato", cuantos: 10 };
  return { ok: true, digitos: d };
}

function porQue(l: Exclude<Lectura, { ok: true }>, invalido: string): string {
  const diferencia = Math.abs(10 - l.cuantos);
  const uno = diferencia === 1;
  const numeros = uno ? "un número" : `${diferencia} números`;
  switch (l.motivo) {
    case "quince":
      return "Escribilo sin el 15: con la característica son 10 números.";
    case "faltan":
      return `Le ${uno ? "falta" : "faltan"} ${numeros}: con la característica son 10, sin el 0 ni el 15.`;
    case "sobran":
      return `Le ${uno ? "sobra" : "sobran"} ${numeros}: con la característica son 10, sin el 0 ni el 15.`;
    case "formato":
      return invalido;
  }
}

export function telefonoArgentino(mensajes: {
  requerido: string;
  invalido: string;
}) {
  return z
    .string()
    .trim()
    .min(1, mensajes.requerido)
    .transform((v, ctx) => {
      const l = leerTelefono(v);
      if (!l.ok) {
        ctx.addIssue({ code: "custom", message: porQue(l, mensajes.invalido) });
        return z.NEVER;
      }
      return `+549${l.digitos}`;
    });
}
