import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

/**
 * El favorito que espera a que alguien inicie sesión (RF-05). Misma pieza que
 * `modules/cart/pendiente.ts`, con cookie propia: compartirla haría que
 * retomar una acción borre la otra.
 */

export const COOKIE_FAVORITO_PENDIENTE = "favorito_pendiente";

const VIDA_EN_SEGUNDOS = 60 * 60;

const productId = z.uuid();

export function interpretar(valor: string | undefined): string | null {
  const resultado = productId.safeParse(valor);
  return resultado.success ? resultado.data : null;
}

export async function recordar(id: string): Promise<void> {
  const almacen = await cookies();

  almacen.set(COOKIE_FAVORITO_PENDIENTE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIDA_EN_SEGUNDOS,
  });
}

export async function hayFavoritoPendiente(): Promise<boolean> {
  const almacen = await cookies();
  return interpretar(almacen.get(COOKIE_FAVORITO_PENDIENTE)?.value) !== null;
}

/** Leer y borrar en la misma pasada: se retoma una vez, salga bien o mal. */
export async function tomar(): Promise<string | null> {
  const almacen = await cookies();
  const id = interpretar(almacen.get(COOKIE_FAVORITO_PENDIENTE)?.value);
  almacen.delete(COOKIE_FAVORITO_PENDIENTE);
  return id;
}
