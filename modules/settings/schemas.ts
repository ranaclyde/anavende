import { z } from "zod";

import { comoMonto, compare, isMoney, money } from "@/lib/money";
import { telefonoArgentino } from "@/lib/telefono";
import {
  AYUDA_DEL_UMBRAL,
  UMBRAL_MAXIMO,
  UMBRAL_MINIMO,
} from "@/modules/settings/limites";

/**
 * Validación de los medios de pago (RF-19) y de la configuración del sitio
 * (RF-20). Comparten archivo porque comparten módulo: los dos son las
 * tablas que la vendedora carga una vez y toca cada tanto (§5.9).
 *
 * No es `server-only` como el de productos: acá no hay nada que sanitizar
 * —la descripción es texto plano— y el formulario repite estos mismos
 * esquemas para avisar antes de enviar. Quien decide sigue siendo el
 * servidor, que los vuelve a correr en el envoltorio (§6.2, paso 3).
 */

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.");

/**
 * La descripción corta de RF-19 —«10% off transfiriendo»—, no un párrafo.
 *
 * Se guarda `null` y no `""` cuando está vacía: la columna es opcional, y
 * dos formas de decir «no hay» obligan a preguntar por las dos en cada
 * consulta y en cada pantalla. El tope de 120 no es arbitrario: es lo que
 * entra en la franja de la tienda sin partir la fila (RF-01).
 */
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

/**
 * Mover es «uno para arriba» o «uno para abajo», no «poné este número».
 *
 * `sort_order` es una posición y no un dato que la vendedora tenga que
 * llevar: pedirle el número la obliga a renumerar a mano cuando quiere meter
 * uno en el medio, que es justo el trabajo que la computadora hace bien.
 */
export const movimientoDePago = z.object({
  id: z.uuid(),
  direccion: z.enum(["arriba", "abajo"]),
});

export type CrearMedioDePago = z.infer<typeof crearMedioDePago>;
export type EditarMedioDePago = z.infer<typeof editarMedioDePago>;

/* ── Promociones de cuotas — RF-40, F2.17 ─────────────────────────────── */

export const CUOTAS_MINIMAS = 2;
export const CUOTAS_MAXIMAS = 48;
export const RECARGO_MAXIMO = 200;

const cuotas = z
  .number({ error: "Poné cuántas cuotas." })
  .int("Las cuotas son un número entero.")
  .min(CUOTAS_MINIMAS, `Tienen que ser al menos ${CUOTAS_MINIMAS} cuotas.`)
  .max(CUOTAS_MAXIMAS, `Pueden ser hasta ${CUOTAS_MAXIMAS} cuotas.`);

/**
 * El recargo en %, con coma o con punto: «15», «15,5». Vacío es 0, sin
 * interés, que es el caso más común y no tiene por qué obligar a escribir un
 * cero. Se guarda con dos decimales, como lo espera `surcharge_pct`.
 */
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

/** Vacío = sin mínimo, y se guarda `NULL` (lo mismo que la descripción). */
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

/**
 * El plan, cuando la promoción es de una tarjeta o un plan del medio y no del
 * medio entero: «Plan Z». Vacío se guarda `NULL`. El tope es lo que entra en
 * el renglón de la ficha sin partirlo en el teléfono.
 */
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
  /** Vacío = no vence (el plan Z de Naranja X no tiene fecha de fin). */
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

/* ── Configuración del sitio — RF-20, §5.9 ─────────────────────────────── */

/**
 * El número por el que se coordinan las ventas (RF-04).
 *
 * Es la misma regla que el teléfono del comprador y por eso sale del mismo
 * lugar (`lib/telefono.ts`): se guarda normalizado a `+549…` para que
 * `wa.me` se arme concatenando y no haya que adivinar, en cada enlace, qué
 * forma tenía el que se cargó.
 */
const numeroDeWhatsapp = telefonoArgentino({
  requerido: "Escribí el número de WhatsApp por el que vendés.",
  invalido:
    "Ese número no parece válido. Escribilo con característica, por ejemplo 11 5555 5555.",
});

/**
 * A dónde llegan los avisos de órdenes nuevas (E4).
 *
 * No es el email con el que la vendedora entra al panel: puede querer los
 * avisos en otra casilla, y atarlos a la identidad la obligaría a cambiar
 * de cuenta para cambiar de casilla.
 */
const emailDeAvisos = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Ese email no parece válido."));

/**
 * A partir de cuántas unidades se avisa «Quedan N» (RF-20).
 *
 * Llega como número: el formulario ya comprobó la forma, y dejar que el
 * esquema acepte texto sería una segunda gramática que mantener.
 *
 * Los topes y la frase que los explica viven en `limites.ts`, que el
 * formulario también lee. El máximo es el único con mensaje propio: es el
 * único que se puede chocar escribiendo un número perfectamente válido, y
 * ahí lo que hay que decir no es la regla sino por qué existe.
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
 * El perfil de una red social, para el pie de la tienda (2026-10-20).
 *
 * Se escribe **como salga**, igual que el WhatsApp: el enlace copiado del
 * navegador o de la app —con `?igsh=…` y todo—, sin `https://`, o solo el
 * usuario con o sin `@`. Se guarda siempre como `https://www.<red>.com/usuario`,
 * así la tienda lo pone en un `href` tal cual.
 *
 * **Solo se aceptan enlaces de esa red.** El pie los muestra con el logo de
 * Facebook o de Instagram, y un logo que lleva a otro sitio es exactamente lo
 * que no tiene que poder pasar.
 *
 * Vacío es `null`: las dos son opcionales y sin valor el pie no las muestra.
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
  // Las escenas por fecha (F9.5, RF-38). Con `default(true)` para que un
  // envío que no las nombre no apague ninguna: apagarla tiene que ser a
  // propósito.
  halloweenScene: z.boolean().default(true),
  christmasScene: z.boolean().default(true),
  easterScene: z.boolean().default(true),
});

export type EntradaDeConfiguracion = z.input<typeof configuracionDelSitio>;

/* ── Modo mantenimiento — F2.7b ────────────────────────────────────────── */

/**
 * «Cerrá» o «abrí», no «cambiá»: quien toca el botón vio un estado, y si en
 * otra pestaña ya lo cambiaron, un «cambiá» lo daría vuelta al revés de lo que
 * quería.
 */
export const modoMantenimiento = z.object({ activo: z.boolean() });
