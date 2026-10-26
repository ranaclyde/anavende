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
  // La vista previa al compartir la ficha — F3.9, RNF-04. Es la única que
  // sale en JPEG y la única con alto fijo; el porqué de las dos cosas está
  // abajo, en `FORMATOS`, y en `procesar.ts`.
  { sufijo: "og", ancho: 1200, alto: 630, calidad: 82, formato: "jpeg" },
] as const;

export type Tamano = {
  sufijo: string;
  ancho: number;
  calidad: number;
  /** Solo la de Open Graph: las demás salen con la proporción del original. */
  alto?: number;
  /** Por omisión WEBP (§9.2). */
  formato?: "webp" | "jpeg";
  /**
   * Recorta a un cuadrado de `ancho`×`ancho` en vez de conservar la
   * proporción. Solo la foto de perfil (F5.9): se dibuja en un círculo, y
   * una foto vertical metida entera dejaría franjas a los costados.
   */
  cuadrado?: boolean;
};
export type Sufijo = (typeof TAMANOS)[number]["sufijo"];

/**
 * **WhatsApp no dibuja vistas previas en WEBP**, y por eso la versión `og` es
 * la excepción de §9.2 —«el formato de salida es siempre WEBP»—.
 *
 * Detectado en producción el 2026-09-22: con los metadatos llegando enteros,
 * el título y el precio salían y la foto no. La única imagen que WhatsApp
 * llegó a mostrar en toda la prueba fue la de marca, que es PNG.
 *
 * La extensión del archivo acompaña al formato: `-og.jpg` y no `-og.webp`. Un
 * `.webp` con JPEG adentro se sirve igual, pero deja a cualquiera que mire
 * Storage creyendo lo que no es.
 */
const FORMATOS = {
  webp: { extension: "webp" },
  jpeg: { extension: "jpg" },
} as const;

function formatoDe(sufijo: string): "webp" | "jpeg" {
  // El `as` es por el `as const` de la tabla: sin él, TypeScript ve una unión
  // de cuatro literales distintos y `formato` solo existe en uno.
  const tamano = TAMANOS.find((t) => t.sufijo === sufijo) as Tamano | undefined;
  return tamano?.formato ?? "webp";
}

/** El `Content-Type` con el que se sube cada versión (§9.1). */
export function tipoDe(sufijo: string): string {
  return `image/${formatoDe(sufijo)}`;
}

/**
 * Los logos —de marca (RF-18) y de medio de pago (RF-19)— usan la misma
 * convención con DOS tamaños.
 *
 * `-detail` está pensado para la galería de una ficha a 1400px y un logo no
 * tiene dónde usarlo: hoy se muestra chico y solo en el listado del panel. Se
 * reutilizan los anchos de los otros dos en vez de inventar números nuevos —
 * 200px cubre el listado en cualquier densidad de pantalla, y 600px queda
 * para las franjas de la tienda: la de marcas y la de medios de pago (RF-01).
 *
 * **Se nombran los que SÍ, y no se excluyen los que no.** Hasta el 2026-09-22
 * esto decía `!== "detail"`, y el día que la tabla sumó la versión `og` de
 * F3.9 los logos se la llevaron puesta: una vista previa de 1200×630 por cada
 * marca y cada medio de pago, que no se muestra en ninguna pantalla. Una lista
 * por exclusión hereda sola todo lo que se agregue después.
 */
export const TAMANOS_LOGO = TAMANOS.filter(
  (t) => t.sufijo === "thumb" || t.sufijo === "card",
) as unknown as readonly Tamano[];

/**
 * Solo la versión de Open Graph, para regenerarla sin tocar las otras tres.
 * La usa `scripts/derivar-og-productos.mts`, que le da de comer el `-detail`
 * que ya está en Storage: el original no se guarda nunca (§9.0).
 */
export const TAMANOS_OG = TAMANOS.filter(
  (t) => t.sufijo === "og",
) as unknown as readonly Tamano[];

/**
 * La foto de perfil — F5.9. **Una sola versión**, y chica: se muestra a 32px
 * en el encabezado y a 96px en «Mi cuenta», y 256px cubre las dos al doble de
 * densidad. Pesa del orden de 10 a 20 KB, contra los ~350 KB de los cuatro
 * tamaños de una foto de producto.
 *
 * Va aparte de `TAMANOS` a propósito: esa tabla es la que se genera por
 * omisión para un producto, y sumarle esta haría que cada foto de producto
 * sacara también un recorte de cara que nadie mira.
 */
export const TAMANOS_PERFIL: readonly Tamano[] = [
  { sufijo: "avatar", ancho: 256, calidad: 78, cuadrado: true },
];

/** Formatos que se aceptan en la subida (RF-17). El de salida es siempre WEBP. */
export const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

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
 * Dónde vive cada logo. `marcas/{id}/{imageId}`, `medios-de-pago/{id}/…`,
 * `categorias/{id}/…` (§9.2).
 *
 * La carpeta se decide acá y no en quien sube: es lo que hay que saber para
 * BORRAR, y el borrado ocurre lejos de la subida —al reemplazar el logo y al
 * borrar la fila entera—. Un prefijo escrito a mano en dos lugares distintos
 * es un archivo que un día no se encuentra.
 */
export const CARPETAS_DE_LOGO = {
  marca: "marcas",
  "medio-de-pago": "medios-de-pago",
  // FA-21. No es un logo, pero se comporta como uno: una por fila, dos
  // tamaños, y la nueva reemplaza y borra a la anterior.
  categoria: "categorias",
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

/**
 * `usuarios/{userId}/{imageId}` — la base de la foto de perfil, sin sufijo.
 *
 * El `imageId` es nuevo en cada subida aunque haya una sola foto por persona:
 * con una clave fija, el navegador y cualquier caché intermedia seguirían
 * mostrando la anterior después de cambiarla.
 */
export function claveDeFotoDePerfil(userId: string, imageId: string): string {
  return `usuarios/${userId}/${imageId}`;
}

/** `…/{imageId}-card.webp`, `…/{imageId}-og.jpg` */
export function clave(base: string, sufijo: string): string {
  return `${base}-${sufijo}.${FORMATOS[formatoDe(sufijo)].extension}`;
}
