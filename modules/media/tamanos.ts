/**
 * Tamaños generados y convención de nombres — TECHNICAL-SPEC §9.2.
 *
 * Esta tabla es la única fuente: la usan quien genera los archivos y quien
 * arma la URL para mostrarlos. Duplicar «600» en un componente es la forma
 * más barata de que un día se sirva un tamaño que no existe.
 */
export const TAMANOS = [
  { sufijo: "thumb", ancho: 200, calidad: 75 },
  { sufijo: "card", ancho: 600, calidad: 78 },
  { sufijo: "detail", ancho: 1400, calidad: 82 },
] as const;

export type Tamano = { sufijo: string; ancho: number; calidad: number };
export type Sufijo = (typeof TAMANOS)[number]["sufijo"];

/**
 * El logo de marca (RF-18) usa la misma convención con DOS tamaños.
 *
 * `-detail` está pensado para la galería de una ficha a 1400px y un logo no
 * tiene dónde usarlo: hoy se muestra chico y solo en el listado del panel. Se
 * reutilizan los anchos de los otros dos en vez de inventar números nuevos —
 * 200px cubre el listado en cualquier densidad de pantalla, y 600px queda
 * para el día que haya una franja de marcas.
 */
export const TAMANOS_LOGO = TAMANOS.filter(
  (t) => t.sufijo !== "detail",
) as unknown as readonly Tamano[];

/** Formatos que se aceptan en la subida (RF-17). El de salida es siempre WEBP. */
export const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"] as const;

/** RF-17. Se interpreta en mebibytes, que es como lo cuenta Storage. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** RF-17: hasta 5 imágenes por variante. */
export const MAXIMO_POR_VARIANTE = 5;

/**
 * `productos/{productId}/{variantId}/{imageId}` — la base, sin sufijo ni
 * extensión. Es lo que se guarda en `variant_images.storage_key`: guardar la
 * URL completa ataría las filas al backend de almacenamiento del día que se
 * escribieron.
 */
export function claveBase(
  productId: string,
  variantId: string,
  imageId: string,
): string {
  return `productos/${productId}/${variantId}/${imageId}`;
}

/** `marcas/{brandId}/{imageId}` — la base del logo (§9.2). */
export function claveDeLogo(brandId: string, imageId: string): string {
  return `marcas/${brandId}/${imageId}`;
}

/** `…/{imageId}-card.webp` */
export function clave(base: string, sufijo: string): string {
  return `${base}-${sufijo}.webp`;
}
