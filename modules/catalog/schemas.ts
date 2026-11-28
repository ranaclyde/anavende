import { z } from "zod";

import { slugify } from "@/lib/slug";

const nombre = z
  .string()
  .trim()
  .min(2, "El nombre necesita al menos 2 caracteres.")
  .max(60, "El nombre no puede pasar de 60 caracteres.")
  // Uno hecho solo de signos deja el slug vacío.
  .refine((v) => slugify(v).length > 0, {
    message: "El nombre necesita al menos una letra o un número.",
  });

/** Con o sin `#`, 3 o 6 dígitos; se guarda siempre en minúscula y largo. */
const hex = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("#") ? v : `#${v}`))
  .refine((v) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v), {
    message: "Poné un color en formato #a1b2c3.",
  })
  .transform((v) => {
    const cuerpo = v.slice(1).toLowerCase();
    return cuerpo.length === 3
      ? `#${cuerpo[0]}${cuerpo[0]}${cuerpo[1]}${cuerpo[1]}${cuerpo[2]}${cuerpo[2]}`
      : `#${cuerpo}`;
  });

export const TIPOS = ["marca", "categoria", "color"] as const;
export type TipoDeItem = (typeof TIPOS)[number];

const destacada = z.boolean();

/**
 * En orden: el índice es la prioridad en los recomendados. Sin el campo, las
 * relaciones no se tocan; con una lista vacía, se quitan todas.
 */
const relacionadas = z
  .array(z.object({ id: z.uuid(), reciproca: z.boolean().default(true) }))
  .max(50, "Son demasiadas categorías relacionadas.")
  .refine((l) => new Set(l.map((r) => r.id)).size === l.length, {
    message: "Una categoría está repetida entre las relacionadas.",
  })
  .optional();

/** Vacío se guarda como `null`. */
export const TOPE_DEL_TEXTO_DE_CATEGORIA = 300;
const textoDeCategoria = z
  .string()
  .trim()
  .max(
    TOPE_DEL_TEXTO_DE_CATEGORIA,
    `El texto no puede pasar de ${TOPE_DEL_TEXTO_DE_CATEGORIA} caracteres.`,
  )
  .transform((v) => (v === "" ? null : v))
  .optional();

export const crearMarca = z.object({ name: nombre });
export const crearCategoria = z.object({
  name: nombre,
  isFeatured: destacada.default(false),
  description: textoDeCategoria,
  relacionadas,
});
export const crearColor = z.object({ name: nombre, hexCode: hex });

export const editarMarca = z.object({ id: z.uuid(), name: nombre });
export const editarCategoria = z.object({
  id: z.uuid(),
  name: nombre,
  isFeatured: destacada,
  description: textoDeCategoria,
  relacionadas,
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

/** Sin `tipo`: solo las categorías se destacan. */
export const cambioDeDestacada = z.object({
  id: z.uuid(),
  destacada: destacada,
});

export const soloId = z.object({ id: z.uuid() });

export type CrearColor = z.infer<typeof crearColor>;
export type EditarColor = z.infer<typeof editarColor>;
