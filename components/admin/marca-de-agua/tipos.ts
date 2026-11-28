import type { Ancla, Modo } from "@/modules/media/capas-de-marca";

/** Una capa en pantalla: lo que se guarda más una clave local para React, que no viaja. */
export type CapaEnPantalla = {
  clave: string;
  imageId: string;
  mode: Modo;
  anchor: Ancla;
  sizePct: number;
  marginPct: number;
  opacityPct: number;
};

export type CapaGuardable = Omit<CapaEnPantalla, "clave">;

export function sinClave(capa: CapaEnPantalla): CapaGuardable {
  return {
    imageId: capa.imageId,
    mode: capa.mode,
    anchor: capa.anchor,
    sizePct: capa.sizePct,
    marginPct: capa.marginPct,
    opacityPct: capa.opacityPct,
  };
}

/** Con qué arranca una capa nueva: el logo en la esquina, a media opacidad. */
export function capaNueva(imageId: string): CapaEnPantalla {
  return {
    clave: crypto.randomUUID(),
    imageId,
    mode: "posicion",
    anchor: "abajo-derecha",
    sizePct: 20,
    marginPct: 3,
    opacityPct: 50,
  };
}

/** El fondo a cuadros que dice «acá es transparente». */
export const CUADRICULA: React.CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(var(--border) 0 25%, var(--surface) 0 50%)",
  backgroundSize: "12px 12px",
};
