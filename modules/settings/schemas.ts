import { z } from "zod";

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
});

export type EntradaDeConfiguracion = z.input<typeof configuracionDelSitio>;

/* ── Modo mantenimiento — F2.7b ────────────────────────────────────────── */

/**
 * «Cerrá» o «abrí», no «cambiá»: quien toca el botón vio un estado, y si en
 * otra pestaña ya lo cambiaron, un «cambiá» lo daría vuelta al revés de lo que
 * quería.
 */
export const modoMantenimiento = z.object({ activo: z.boolean() });
