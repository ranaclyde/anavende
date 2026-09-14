import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

/**
 * El favorito que quedó esperando a que alguien inicie sesión — F5.4 · RF-05,
 * RF-10.
 *
 * RF-05 lo pide junto con el carrito: «si el registro se inició desde una
 * acción de compra (agregar al carrito, favorito), al verificar e ingresar se
 * vuelve a esa acción y se ejecuta». Es la misma pieza que
 * `modules/cart/pendiente.ts`, y por los mismos motivos: una cookie y no la
 * dirección, porque un enlace no puede escribir en la cuenta de quien lo
 * abre; y una cookie y no `sessionStorage`, porque el alta con verificación
 * por email abre otra pestaña.
 *
 * Una cookie propia y no la del carrito: son dos acciones distintas, y
 * mezclarlas en una sola nota haría que retomar una borre la otra.
 */

export const COOKIE_FAVORITO_PENDIENTE = "favorito_pendiente";

/** Una hora, como la del carrito: lo que dura un alta con email. */
const VIDA_EN_SEGUNDOS = 60 * 60;

const productId = z.uuid();

/** Lee la cookie sin confiarle nada: lo que no es un uuid se ignora. */
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

/** Solo mirar: el layout decide si hay algo que retomar. */
export async function hayFavoritoPendiente(): Promise<boolean> {
  const almacen = await cookies();
  return interpretar(almacen.get(COOKIE_FAVORITO_PENDIENTE)?.value) !== null;
}

/**
 * Leer y borrar en la misma pasada: se retoma UNA vez, salga bien o mal
 * (ver `tomar` en `modules/cart/pendiente.ts`).
 */
export async function tomar(): Promise<string | null> {
  const almacen = await cookies();
  const id = interpretar(almacen.get(COOKIE_FAVORITO_PENDIENTE)?.value);
  almacen.delete(COOKIE_FAVORITO_PENDIENTE);
  return id;
}
