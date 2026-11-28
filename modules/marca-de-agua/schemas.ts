import { z } from "zod";

import { ANCLAS, MAXIMO_DE_CAPAS, MODOS } from "@/modules/media/capas-de-marca";

/** Los topes son los mismos CHECK de `watermark_layers`: acá dan un mensaje, en la base un error. */
export const capa = z.object({
  imageId: z.uuid(),
  mode: z.enum(MODOS),
  anchor: z.enum(ANCLAS),
  sizePct: z.number().int().min(5).max(100),
  marginPct: z.number().int().min(0).max(20),
  opacityPct: z.number().int().min(5).max(100),
});

export const capas = z
  .array(capa)
  .max(MAXIMO_DE_CAPAS, `Entran hasta ${MAXIMO_DE_CAPAS} capas.`);

export const guardarLasCapas = z.object({ capas });
export const activacion = z.object({ activa: z.boolean() });
export const soloImagen = z.object({ id: z.uuid() });
