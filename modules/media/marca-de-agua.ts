import "server-only";

import sharp, { type OverlayOptions, type Sharp } from "sharp";

// La única implementación de la marca (TECHNICAL-SPEC §9.6): la usan la subida
// y la vista previa, para que lo que se ve sea lo que se guarda.

export {
  ANCLAS,
  MAXIMO_DE_CAPAS,
  MODOS,
  type Ancla,
  type Capa,
  type Modo,
} from "@/modules/media/capas-de-marca";
import type { Ancla, Capa } from "@/modules/media/capas-de-marca";

export type CapaLista = Capa & { imagen: Buffer };

type Lienzo = { ancho: number; alto: number };

/** El margen se respeta contra el borde del ancla; en el eje libre, centrada. */
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

/** Devuelve RGBA crudo: `composite` lo pega sin volver a decodificar. */
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
          : // En `posicion` la capa no puede salirse del lienzo.
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
 * Recibe la versión en píxeles crudos: sharp aplica `composite` después de
 * `resize` en un mismo pipeline, pero cada capa depende del tamaño final.
 * La primera capa queda abajo.
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

  // Una tras otra y no en paralelo: cada una tiene su pico de memoria.
  const overlays: OverlayOptions[] = [];
  for (const capa of capas) {
    overlays.push(await prepararCapa(capa, lienzo));
  }

  return sharp(version.data, { raw }).composite(overlays);
}
