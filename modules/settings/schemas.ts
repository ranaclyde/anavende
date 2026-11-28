import { z } from "zod";

import { comoMonto, compare, isMoney, money } from "@/lib/money";
import { telefonoArgentino } from "@/lib/telefono";
import {
  AYUDA_DEL_UMBRAL,
  UMBRAL_MAXIMO,
  UMBRAL_MINIMO,
} from "@/modules/settings/limites";

// Sin `server-only`: no hay nada que sanitizar y el formulario los usa para
// avisar antes de enviar. El servidor los vuelve a correr.

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.");

/** Vacía se guarda `null`. 120 es lo que entra en la franja de la tienda. */
const descripcion = z
  .string()
  .trim()
  .max(120, "La descripción no puede pasar de 120 caracteres.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

export const crearMedioDePago = z.object({
  name: nombre,
  description: descripcion,
});

export const editarMedioDePago = z.object({
  id: z.uuid(),
  name: nombre,
  description: descripcion,
});

export const soloMedioDePago = z.object({ id: z.uuid() });

export const cambioDeEstadoDePago = z.object({
  id: z.uuid(),
  activo: z.boolean(),
});

export const movimientoDePago = z.object({
  id: z.uuid(),
  direccion: z.enum(["arriba", "abajo"]),
});

export type CrearMedioDePago = z.infer<typeof crearMedioDePago>;
export type EditarMedioDePago = z.infer<typeof editarMedioDePago>;

export const CUOTAS_MINIMAS = 2;
export const CUOTAS_MAXIMAS = 48;
export const RECARGO_MAXIMO = 200;

const cuotas = z
  .number({ error: "Poné cuántas cuotas." })
  .int("Las cuotas son un número entero.")
  .min(CUOTAS_MINIMAS, `Tienen que ser al menos ${CUOTAS_MINIMAS} cuotas.`)
  .max(CUOTAS_MAXIMAS, `Pueden ser hasta ${CUOTAS_MAXIMAS} cuotas.`);

/** En %, con coma o con punto. Vacío es 0, sin interés. */
const recargo = z
  .string()
  .trim()
  .transform((v) =>
    v === "" ? "0" : v.replace("%", "").trim().replace(",", "."),
  )
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), {
    message: "Poné el recargo como un número, con hasta dos decimales.",
  })
  .transform(money)
  .refine((v) => compare(v, `${RECARGO_MAXIMO}.00`) <= 0, {
    message: `El recargo puede ser hasta ${RECARGO_MAXIMO} %.`,
  });

const fecha = z.iso.date({ error: "Elegí una fecha." });

/** Vacío = sin mínimo. */
const montoMinimo = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : comoMonto(v)))
  .refine((v) => v === null || isMoney(v), {
    message: "Poné el monto con hasta dos decimales.",
  })
  .transform((v) => (v === null ? null : money(v)))
  .refine((v) => v === null || compare(v, "0.00") > 0, {
    message: "El mínimo tiene que ser mayor que cero, o dejalo vacío.",
  });

/** «Plan Z». El tope es lo que entra en el renglón de la ficha. */
const plan = z
  .string()
  .trim()
  .max(40, "El plan puede tener hasta 40 caracteres.")
  .transform((v) => (v === "" ? null : v));

const camposDePromocion = {
  plan,
  cuotas,
  recargo,
  desde: fecha,
  /** Vacío = no vence. */
  hasta: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(fecha.nullable()),
  montoMinimo,
};

/** Las fechas `AAAA-MM-DD` se comparan bien como texto. */
const hastaDespuesDeDesde = (p: { desde: string; hasta: string | null }) =>
  p.hasta === null || p.hasta >= p.desde;
const errorDeFechas = {
  message: "La fecha de fin no puede ser anterior a la de inicio.",
  path: ["hasta"],
};

export const crearPromocion = z
  .object({ paymentMethodId: z.uuid(), ...camposDePromocion })
  .refine(hastaDespuesDeDesde, errorDeFechas);

export const editarPromocion = z
  .object({ id: z.uuid(), ...camposDePromocion })
  .refine(hastaDespuesDeDesde, errorDeFechas);

export const soloPromocion = z.object({ id: z.uuid() });

export const cambioDeEstadoDePromocion = z.object({
  id: z.uuid(),
  activa: z.boolean(),
});

export type CrearPromocion = z.input<typeof crearPromocion>;

/** Normalizado a `+549…`, para que `wa.me` se arme concatenando. */
const numeroDeWhatsapp = telefonoArgentino({
  requerido: "Escribí el número de WhatsApp por el que vendés.",
  invalido:
    "Ese número no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

const emailDeAvisos = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ese email no parece válido."));

/**
 * Llega como número: el formulario ya comprobó la forma. El máximo tiene
 * mensaje propio porque se choca con un número bien escrito.
 */
const umbralDeStock = z
  .number({ error: AYUDA_DEL_UMBRAL })
  .int(AYUDA_DEL_UMBRAL)
  .min(UMBRAL_MINIMO, AYUDA_DEL_UMBRAL)
  .max(
    UMBRAL_MAXIMO,
    `Más de ${UMBRAL_MAXIMO} marca casi todo el catálogo, y el aviso deja de señalar nada.`,
  );

/**
 * Acepta el enlace copiado de la app, sin `https://` o solo el usuario, y lo
 * guarda como `https://www.<red>.com/usuario`. Solo enlaces de esa red: el pie
 * los muestra con su logo. Vacío es `null`.
 */
function redSocial({
  red,
  dominios,
  ejemplo,
}: {
  red: string;
  dominios: readonly string[];
  ejemplo: string;
}) {
  const invalido = `Ese enlace no es de un perfil de ${red}. Pegá el de tu perfil, por ejemplo ${ejemplo}.`;

  return z
    .string()
    .trim()
    .max(200, invalido)
    .transform((escrito, ctx) => {
      if (escrito === "") return null;

      const sinArroba = escrito.replace(/^@/, "");

      // Solo el usuario: sin barras ni algo que parezca un dominio. Los puntos
      // sueltos sí, que un usuario de Instagram puede ser «ana.vende».
      if (
        /^[a-z0-9._]+$/i.test(sinArroba) &&
        !/\.(com|net|org|ar|me)(\.|$)/i.test(sinArroba)
      ) {
        return `https://www.${dominios[0]}/${sinArroba}`;
      }

      let url: URL;
      try {
        url = new URL(
          /^https?:\/\//i.test(escrito) ? escrito : `https://${escrito}`,
        );
      } catch {
        ctx.addIssue({ code: "custom", message: invalido });
        return z.NEVER;
      }

      const host = url.hostname.toLowerCase();
      const esDeLaRed = dominios.some(
        (d) => host === d || host.endsWith(`.${d}`),
      );
      const ruta = url.pathname.replace(/\/+$/, "");

      if (!esDeLaRed || ruta === "") {
        ctx.addIssue({ code: "custom", message: invalido });
        return z.NEVER;
      }

      // Lo que viene después del `?` es rastreo de la app (`igsh`, `mibextid`),
      // salvo en los perfiles sin usuario de Facebook, que son `?id=`.
      const id = ruta === "/profile.php" ? url.searchParams.get("id") : null;
      return `https://www.${dominios[0]}${ruta}${id ? `?id=${id}` : ""}`;
    })
    .nullable()
    .default(null);
}

export const configuracionDelSitio = z.object({
  whatsappNumber: numeroDeWhatsapp,
  adminNotificationEmail: emailDeAvisos,
  lowStockThreshold: umbralDeStock,
  facebookUrl: redSocial({
    red: "Facebook",
    dominios: ["facebook.com", "fb.com"],
    ejemplo: "facebook.com/anavende",
  }),
  instagramUrl: redSocial({
    red: "Instagram",
    dominios: ["instagram.com"],
    ejemplo: "instagram.com/anavende",
  }),
  // Un envío que no las nombre no apaga ninguna.
  halloweenScene: z.boolean().default(true),
  christmasScene: z.boolean().default(true),
  easterScene: z.boolean().default(true),
});

export type EntradaDeConfiguracion = z.input<typeof configuracionDelSitio>;

/** El estado deseado y no «cambiá»: otra pestaña pudo haberlo cambiado ya. */
export const modoMantenimiento = z.object({ activo: z.boolean() });
