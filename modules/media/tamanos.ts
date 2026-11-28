// Tamaños y nombres (TECHNICAL-SPEC §9.2). Esta tabla es la única fuente:
// la usan quien genera los archivos y quien arma la URL.
export const TAMANOS = [
  { sufijo: "thumb", ancho: 200, calidad: 75 },
  { sufijo: "card", ancho: 600, calidad: 78 },
  { sufijo: "detail", ancho: 1400, calidad: 82 },
  // Vista previa al compartir: la única en JPEG y con alto fijo (ver `FORMATOS`).
  { sufijo: "og", ancho: 1200, alto: 630, calidad: 82, formato: "jpeg" },
] as const;

export type Tamano = {
  sufijo: string;
  ancho: number;
  calidad: number;
  alto?: number;
  formato?: "webp" | "jpeg";
  /** Recorta a un cuadrado. Solo la foto de perfil, que se dibuja en un círculo. */
  cuadrado?: boolean;
};
export type Sufijo = (typeof TAMANOS)[number]["sufijo"];

/**
 * WhatsApp no dibuja vistas previas en WEBP: por eso `og` sale en JPEG, y con
 * extensión `.jpg` para que Storage no confunda.
 */
const FORMATOS = {
  webp: { extension: "webp" },
  jpeg: { extension: "jpg" },
} as const;

function formatoDe(sufijo: string): "webp" | "jpeg" {
  // El `as`: por el `as const`, TypeScript ve una unión de literales y
  // `formato` solo existe en uno.
  const tamano = TAMANOS.find((t) => t.sufijo === sufijo) as Tamano | undefined;
  return tamano?.formato ?? "webp";
}

export function tipoDe(sufijo: string): string {
  return `image/${formatoDe(sufijo)}`;
}

/** `-thumb` no lleva marca: a 200px una plantilla es una mancha. */
export const SUFIJOS_CON_MARCA: ReadonlySet<string> = new Set([
  "card",
  "detail",
]);

/**
 * Se nombran los que sí y no se excluyen los que no: una lista por exclusión
 * hereda sola cualquier tamaño que se sume a `TAMANOS`.
 */
export const TAMANOS_LOGO = TAMANOS.filter(
  (t) => t.sufijo === "thumb" || t.sufijo === "card",
) as unknown as readonly Tamano[];

/**
 * Aparte de `TAMANOS` a propósito: sumarla ahí haría que cada foto de producto
 * sacara también un recorte de perfil.
 */
export const TAMANOS_PERFIL: readonly Tamano[] = [
  { sufijo: "avatar", ancho: 256, calidad: 78, cuadrado: true },
];

/** Formatos que se aceptan en la subida (RF-17). */
export const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Mebibytes, que es como lo cuenta Storage. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export const MAXIMO_POR_VARIANTE = 5;

/**
 * Lo que se guarda en `variant_images.storage_key`: la base sin sufijo, no la
 * URL, para no atar las filas a un backend de almacenamiento.
 */
export function claveBase(
  productId: string,
  variantId: string,
  imageId: string,
): string {
  return `productos/${productId}/${variantId}/${imageId}`;
}

/** La carpeta se decide acá porque el borrado ocurre lejos de la subida. */
export const CARPETAS_DE_LOGO = {
  marca: "marcas",
  "medio-de-pago": "medios-de-pago",
  // No es un logo, pero se comporta como uno (FA-21).
  categoria: "categorias",
} as const;

export type DestinoDeLogo = keyof typeof CARPETAS_DE_LOGO;

export function claveDeLogo(
  destino: DestinoDeLogo,
  id: string,
  imageId: string,
): string {
  return `${CARPETAS_DE_LOGO[destino]}/${id}/${imageId}`;
}

/**
 * El `imageId` es nuevo en cada subida: con una clave fija, el navegador y las
 * cachés seguirían mostrando la foto anterior.
 */
export function claveDeFotoDePerfil(userId: string, imageId: string): string {
  return `usuarios/${userId}/${imageId}`;
}

/** `…/{imageId}-card.webp`, `…/{imageId}-og.jpg` */
export function clave(base: string, sufijo: string): string {
  return `${base}-${sufijo}.${FORMATOS[formatoDe(sufijo)].extension}`;
}
