import { z } from "zod";

/**
 * Teléfono argentino — una sola implementación, varios consumidores.
 *
 * Lo usan el alta de comprador (F1.9, RF-05), el número de WhatsApp del
 * sitio (F2.7, RF-20), el checkout, las direcciones y el panel. Es la misma
 * regla: se acepta con o sin +54, con o sin 9, con o sin el 0 de la
 * característica, con espacios, puntos, guiones y paréntesis, y se guarda
 * normalizado a `+549` + los diez dígitos. Lo que cambia entre uno y otro
 * son los mensajes —a la compradora se le explica para qué lo pedimos, a la
 * vendedora se le dice qué número va— y por eso entran como parámetro en
 * vez de haber varias copias de la normalización.
 *
 * Guardar SIEMPRE la misma forma no es prolijidad: es lo que permite que
 * `wa.me/<numero>` se arme concatenando (§17, `lib/whatsapp.ts`) sin que
 * cada llamada tenga que adivinar si el que guardaron trae el 9 o no.
 */

/**
 * Lo guardado, como se escribe en el campo: sin el `+549`, que el campo ya
 * muestra (el 9 no se escribe: es el de los celulares en un número
 * internacional, y casi nadie lo conoce).
 */
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
 * Los diez dígitos de un número argentino —característica más número— o
 * por qué no se pudieron sacar (2026-10-21).
 *
 * **Se cuenta, y se dice cuánto falta o sobra.** «No parece válido» no le
 * dice a nadie qué corregir; «le falta un número» sí.
 *
 * **El 15 no se adivina, se pide sacar.** En Argentina, característica +
 * número suman siempre 10, y el 15 va en el medio sólo al marcar un celular
 * desde la misma zona. Doce dígitos con un 15 después de la característica
 * es casi seguro eso, pero saber dónde termina la característica exige una
 * tabla de las 300 que hay: quitar el que no era guardaría otro número sin
 * avisar. Mejor un mensaje claro que un número equivocado.
 *
 * **La característica empieza con 1, 2 o 3**: 11 es Buenos Aires, y las
 * demás son 2xx(x) y 3xx(x). Así se rechaza un número cortado o corrido.
 */
export function leerTelefono(escrito: string): Lectura {
  const limpio = escrito.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(limpio))
    return { ok: false, motivo: "formato", cuantos: 0 };

  let d = limpio.replace(/^\+/, "");
  // El código del país: «+54» escrito a mano, o los 54 adelante de un número
  // completo. Una característica nunca empieza con 5, así que no se confunde.
  if (limpio.startsWith("+") || (d.startsWith("54") && d.length >= 12)) {
    if (!d.startsWith("54"))
      return { ok: false, motivo: "formato", cuantos: 0 };
    d = d.slice(2);
  }
  // El 9 de los celulares en formato internacional, y el 0 de larga
  // distancia: ninguno es parte de los diez.
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
