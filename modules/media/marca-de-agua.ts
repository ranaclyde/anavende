import "server-only";

import sharp, { type OverlayOptions, type Sharp } from "sharp";

/**
 * Componer la marca de agua sobre una versión ya redimensionada — RF-39,
 * TECHNICAL-SPEC §9.6.
 *
 * Es la ÚNICA implementación: la usa `procesarImagen` al subir y la vista
 * previa del panel. Si la vista previa tuviera su propia cuenta —en CSS, en
 * el navegador—, alcanzaría con un redondeo distinto para que lo que Ana ve
 * no sea lo que se guarda.
 *
 * Todo se mide contra el ANCHO de la versión: la misma capa se ve igual en
 * `-card` y en `-detail`, y en una foto vertical y en una apaisada.
 */

export const MODOS = ["posicion", "cubrir", "estirar", "mosaico"] as const;
export type Modo = (typeof MODOS)[number];

export const ANCLAS = [
  "arriba-izquierda",
  "arriba",
  "arriba-derecha",
  "izquierda",
  "centro",
  "derecha",
  "abajo-izquierda",
  "abajo",
  "abajo-derecha",
] as const;
export type Ancla = (typeof ANCLAS)[number];

/** Hasta cuántas capas se pueden armar (RF-39). */
export const MAXIMO_DE_CAPAS = 4;

export type Capa = {
  mode: Modo;
  anchor: Ancla;
  sizePct: number;
  marginPct: number;
  opacityPct: number;
};

/** Una capa con los bytes de su imagen ya leídos de Storage. */
export type CapaLista = Capa & { imagen: Buffer };

type Lienzo = { ancho: number; alto: number };

/**
 * Dónde cae una capa de `w × h` dentro del lienzo, según su ancla. El margen
 * se respeta contra el borde que el ancla nombra; en el eje que el ancla deja
 * libre, la capa va centrada.
 */
export function ubicar(
  ancla: Ancla,
  capa: { w: number; h: number },
  lienzo: Lienzo,
  margen: number,
): { left: number; top: number } {
  const horizontal = ancla.endsWith("izquierda")
    ? "inicio"
    : ancla.endsWith("derecha")
      ? "fin"
      : "medio";
  const vertical = ancla.startsWith("arriba")
    ? "inicio"
    : ancla.startsWith("abajo")
      ? "fin"
      : "medio";

  const en = (eje: "inicio" | "medio" | "fin", total: number, mide: number) =>
    eje === "inicio"
      ? margen
      : eje === "fin"
        ? total - mide - margen
        : Math.round((total - mide) / 2);

  return {
    left: Math.max(0, en(horizontal, lienzo.ancho, capa.w)),
    top: Math.max(0, en(vertical, lienzo.alto, capa.h)),
  };
}

/**
 * Redimensiona la imagen de la capa según su modo y le aplica la opacidad.
 * Devuelve píxeles crudos RGBA: es lo que `composite` pega sin volver a
 * decodificar nada.
 */
async function prepararCapa(
  capa: CapaLista,
  lienzo: Lienzo,
): Promise<OverlayOptions> {
  const margen = Math.round((lienzo.ancho * capa.marginPct) / 100);
  const anchoPedido = Math.max(
    1,
    Math.round((lienzo.ancho * capa.sizePct) / 100),
  );

  const base = sharp(capa.imagen).ensureAlpha();
  const redimensionada =
    capa.mode === "cubrir"
      ? base.resize(lienzo.ancho, lienzo.alto, { fit: "cover" })
      : capa.mode === "estirar"
        ? base.resize(lienzo.ancho, lienzo.alto, { fit: "fill" })
        : capa.mode === "mosaico"
          ? base.resize({ width: anchoPedido })
          : // En una posición, la capa no puede salirse del lienzo: el ancho
            // pedido manda, salvo que la foto sea tan baja que no entre.
            base.resize({
              width: Math.max(
                1,
                Math.min(anchoPedido, lienzo.ancho - 2 * margen),
              ),
              height: Math.max(1, lienzo.alto - 2 * margen),
              fit: "inside",
            });

  const { data, info } = await redimensionada
    .raw()
    .toBuffer({ resolveWithObject: true });

  // La opacidad multiplica el canal alfa que la imagen ya tiene: lo que era
  // transparente sigue siéndolo, y el texto a 100% queda a `opacityPct`.
  if (capa.opacityPct < 100) {
    const factor = capa.opacityPct / 100;
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * factor);
    }
  }

  const raw = { width: info.width, height: info.height, channels: 4 as const };

  if (capa.mode === "mosaico") {
    return { input: data, raw, tile: true, gravity: "northwest" };
  }
  if (capa.mode === "posicion") {
    const { left, top } = ubicar(
      capa.anchor,
      { w: info.width, h: info.height },
      lienzo,
      margen,
    );
    return { input: data, raw, left, top };
  }
  return { input: data, raw, left: 0, top: 0 };
}

/**
 * Pega las capas, en orden —la primera queda abajo—, sobre una versión ya
 * redimensionada y devuelve el pipeline listo para codificar. Recibe la
 * versión en píxeles crudos: sharp aplica `composite` DESPUÉS de `resize`
 * dentro de un mismo pipeline, pero el tamaño de cada capa depende del
 * tamaño final, que recién se conoce después de redimensionar.
 */
export async function ponerMarca(
  version: {
    data: Buffer;
    info: { width: number; height: number; channels: number };
  },
  capas: readonly CapaLista[],
): Promise<Sharp> {
  const lienzo = { ancho: version.info.width, alto: version.info.height };
  const raw = {
    width: version.info.width,
    height: version.info.height,
    channels: version.info.channels as 1 | 2 | 3 | 4,
  };

  // Una tras otra y no en paralelo, por lo mismo que las versiones en
  // `procesarImagen` (F10.6): cada una tiene su pico de memoria.
  const overlays: OverlayOptions[] = [];
  for (const capa of capas) {
    overlays.push(await prepararCapa(capa, lienzo));
  }

  return sharp(version.data, { raw }).composite(overlays);
}
