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
 * Los logos —de marca (RF-18) y de medio de pago (RF-19)— usan la misma
 * convención con DOS tamaños.
 *
 * `-detail` está pensado para la galería de una ficha a 1400px y un logo no
 * tiene dónde usarlo: hoy se muestra chico y solo en el listado del panel. Se
 * reutilizan los anchos de los otros dos en vez de inventar números nuevos —
 * 200px cubre el listado en cualquier densidad de pantalla, y 600px queda
 * para las franjas de la tienda: la de marcas y la de medios de pago (RF-01).
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

/**
 * Dónde vive cada logo. `marcas/{id}/{imageId}`, `medios-de-pago/{id}/…`
 * (§9.2).
 *
 * La carpeta se decide acá y no en quien sube: es lo que hay que saber para
 * BORRAR, y el borrado ocurre lejos de la subida —al reemplazar el logo y al
 * borrar la fila entera—. Un prefijo escrito a mano en dos lugares distintos
 * es un archivo que un día no se encuentra.
 */
export const CARPETAS_DE_LOGO = {
  marca: "marcas",
  "medio-de-pago": "medios-de-pago",
} as const;

export type DestinoDeLogo = keyof typeof CARPETAS_DE_LOGO;

/** `{carpeta}/{id}/{imageId}` — la base del logo, sin sufijo (§9.2). */
export function claveDeLogo(
  destino: DestinoDeLogo,
  id: string,
  imageId: string,
): string {
  return `${CARPETAS_DE_LOGO[destino]}/${id}/${imageId}`;
}

/** `…/{imageId}-card.webp` */
export function clave(base: string, sufijo: string): string {
  return `${base}-${sufijo}.webp`;
}
