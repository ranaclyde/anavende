import { z } from "zod";

import { slugificar } from "@/lib/slug";

/**
 * Validación del catálogo — RF-18.
 *
 * Se valida acá y no en el formulario: el envoltorio de Server Actions corre
 * estos esquemas en el SERVIDOR aunque el cliente ya haya validado (§6.2,
 * paso 3). El formulario los repite para avisar antes de enviar, no para
 * decidir.
 */

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.")
  // Un nombre hecho solo de signos —«···»— deja la dirección vacía y el
  // ítem sin URL. Se rechaza acá y no al guardar, para que el mensaje diga
  // qué pasa en vez de fallar con una clave duplicada vacía.
  .refine((v) => slugificar(v).length > 0, {
    message: "El nombre necesita al menos una letra o un número.",
  });

/** `#a1b2c3`. Se acepta con o sin `#` y con 3 o 6 dígitos; se normaliza. */
const hex = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("#") ? v : `#${v}`))
  .refine((v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v), {
    message: "Poné un color en formato #a1b2c3.",
  })
  .transform((v) => {
    const cuerpo = v.slice(1).toLowerCase();
    // #abc y #aabbcc son el mismo color: se guarda siempre la forma larga,
    // así comparar dos colores es comparar dos textos.
    return cuerpo.length === 3
      ? `#${cuerpo[0]}${cuerpo[0]}${cuerpo[1]}${cuerpo[1]}${cuerpo[2]}${cuerpo[2]}`
      : `#${cuerpo}`;
  });

export const TIPOS = ["marca", "categoria", "color"] as const;
export type TipoDeItem = (typeof TIPOS)[number];

/**
 * RF-18: destacar adelanta la categoría en la tienda. Es opcional al crear
 * —una categoría nueva no se destaca sola— y explícito al editar.
 */
const destacada = z.boolean();

export const crearMarca = z.object({ name: nombre });
export const crearCategoria = z.object({
  name: nombre,
  isFeatured: destacada.default(false),
});
export const crearColor = z.object({ name: nombre, hexCode: hex });

export const editarMarca = z.object({ id: z.uuid(), name: nombre });
export const editarCategoria = z.object({
  id: z.uuid(),
  name: nombre,
  isFeatured: destacada,
});
export const editarColor = z.object({
  id: z.uuid(),
  name: nombre,
  hexCode: hex,
});

export const referencia = z.object({
  tipo: z.enum(TIPOS),
  id: z.uuid(),
});

export const cambioDeEstado = referencia.extend({ activo: z.boolean() });

/**
 * Destacar no lleva `tipo`: sólo las categorías se destacan. Un esquema con
 * `tipo` obligaría al servidor a rechazar dos de los tres valores en tiempo
 * de ejecución; sin él, pedir destacar una marca no compila.
 */
export const cambioDeDestacada = z.object({
  id: z.uuid(),
  destacada: destacada,
});

export type CrearColor = z.infer<typeof crearColor>;
export type EditarColor = z.infer<typeof editarColor>;
