import type { TipoDeItem } from "@/modules/catalog/schemas";

/**
 * Las palabras de cada listado, en un solo lugar — DR §10: así marcas,
 * categorías y colores no terminan con géneros distintos. Los mensajes de
 * error no están acá: los redacta el servidor (`lib/errors.ts`).
 */
export type PalabrasDeItem = {
  singular: string;
  plural: string;
  nuevo: string;
  vacio: string;
  /** Qué se pierde de vista al desactivarlo. */
  desactivar: string;
  /** Concordancia: «Color» es masculino y las otras dos, femeninas. */
  activo: string;
  inactivo: string;
  demostrativo: string;
  /** Objeto directo: «borrar**la**» / «borrar**lo**». */
  pronombre: string;
  /** Artículo: «**la** marca», «**el** color». */
  articulo: string;
  /** «Al crear**la**, queda **elegida**». */
  elegido: string;
};

export const PALABRAS: Record<TipoDeItem, PalabrasDeItem> = {
  marca: {
    singular: "marca",
    plural: "marcas",
    nuevo: "Nueva marca",
    vacio: "Todavía no cargaste ninguna marca.",
    desactivar:
      "Va a dejar de ofrecerse al cargar productos y de aparecer en los filtros de la tienda.",
    activo: "Activa",
    inactivo: "Inactiva",
    demostrativo: "esta",
    pronombre: "la",
    articulo: "la",
    elegido: "elegida",
  },
  categoria: {
    singular: "categoría",
    plural: "categorías",
    nuevo: "Nueva categoría",
    vacio: "Todavía no cargaste ninguna categoría.",
    desactivar:
      "Va a dejar de ofrecerse al cargar productos y de aparecer en el menú de la tienda.",
    activo: "Activa",
    inactivo: "Inactiva",
    demostrativo: "esta",
    pronombre: "la",
    articulo: "la",
    elegido: "elegida",
  },
  color: {
    singular: "color",
    plural: "colores",
    nuevo: "Nuevo color",
    vacio: "Todavía no cargaste ningún color.",
    desactivar: "Va a dejar de ofrecerse al agregarle colores a un producto.",
    activo: "Activo",
    inactivo: "Inactivo",
    demostrativo: "este",
    pronombre: "lo",
    articulo: "el",
    elegido: "elegido",
  },
};

export const TEXTO_DE_CATEGORIA = {
  etiqueta: "Texto de la página (opcional)",
  ayuda: (tope: number) =>
    `Dos o tres renglones sobre qué hay en esta categoría. Se ve debajo del título y en Google. Sin texto, va la frase general de la tienda. Hasta ${tope} caracteres.`,
} as const;

/** Solo las categorías se destacan, por eso no entra en `PALABRAS`. */
export const DESTACADO = {
  etiqueta: "Destacada",
  ayuda:
    "Aparece primero en el menú de la tienda, en la portada y en los filtros. Si destacás todas, ninguna se adelanta.",
  destacar: "Destacar",
  quitar: "Quitar de destacadas",
} as const;

/** El logo de una marca o de un medio de pago: el trámite es el mismo. */
export const LOGO = {
  etiqueta: "Logo",
  opcional: "(opcional)",
  elegir: "Elegir archivo",
  cambiar: "Cambiar",
  quitar: "Quitar",
  ayuda: "JPG, PNG o WEBP, hasta 10 MB. Se guarda optimizado.",
  sinLogo: "Sin logo",
  subiendo: "Subiendo el logo",
  /**
   * Cuando la fila se creó pero su logo no pudo subirse. El sujeto y el verbo
   * los pone quien llama, para que concuerden en género.
   */
  falloTrasCrear: (sujeto: string, editar: string) =>
    `${sujeto} se creó, pero el logo no se pudo subir. ${editar} para intentar de nuevo.`,
} as const;

/** La imagen de categoría: usa el selector del logo y sus botones. */
export const IMAGEN_DE_CATEGORIA = {
  etiqueta: "Imagen",
  sinLogo: "Sin imagen",
  subiendo: "Subiendo la imagen",
  falloTrasCrear:
    "La categoría se creó, pero la imagen no se pudo subir. Editala para intentar de nuevo.",
} as const;

/**
 * Las categorías relacionadas — RF-31. Los avisos sobre la otra categoría
 * nombran a las dos: «Pads deja de recomendar Teclados».
 */
export const RELACIONADAS = {
  etiqueta: "Categorías relacionadas",
  ayuda:
    "En las fichas de esta categoría se recomiendan productos de estas, en este orden. Una recíproca recomienda también en el otro sentido.",
  elegir: "Elegir categorías",
  noHayOtras: "Todavía no hay otras categorías activas para relacionar.",
  inactiva: "Inactiva",
  aporta: (n: number) =>
    n === 0
      ? "No aporta productos activos"
      : n === 1
        ? "1 producto activo"
        : `${n} productos activos`,
  /** La versión corta, para el renglón del paso de elegir. */
  productos: (n: number) =>
    n === 0 ? "Sin productos" : n === 1 ? "1 producto" : `${n} productos`,
  reciprocaCorta: "Recíproca",
  reciproca: (otra: string, esta: string) =>
    `Recíproca: ${otra} también recomienda ${esta}`,
  dejaDeRecomendar: (otra: string, esta: string) =>
    `Al guardar, ${otra} deja de recomendar ${esta}.`,
  seQuitaDelOtroLado: (otras: string[], esta: string) =>
    otras.length === 1
      ? `Al guardar, ${otras[0]} también deja de recomendar ${esta}.`
      : `Al guardar, ${otras.slice(0, -1).join(", ")} y ${otras.at(-1)} también dejan de recomendar ${esta}.`,
  // El paso de elegir.
  tituloDeEleccion: "Elegir categorías relacionadas",
  bajadaDeEleccion: (esta: string) =>
    `Marcá las que complementan a ${esta}. Las nuevas se suman al final y las ordenás después.`,
  buscar: "Buscar una categoría",
  sinCoincidencias: (t: string) =>
    `Ninguna categoría activa coincide con «${t}». Probá con menos letras.`,
  listo: (n: number) => (n === 0 ? "Listo" : `Listo (${n})`),
} as const;
