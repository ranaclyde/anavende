import "server-only";

import { cookies } from "next/headers";

import type { LineaDelCarrito } from "@/modules/cart/operaciones";
import { lineaDelCarrito } from "@/modules/cart/schemas";

/**
 * La compra que quedó esperando a que alguien inicie sesión (RF-08).
 *
 * Cookie y no un parámetro en la dirección: con la dirección, cualquier enlace
 * podría agregar algo al carrito de quien lo abra. Y no `sessionStorage`: el
 * enlace del email de verificación abre otra pestaña.
 *
 * `sameSite: "lax"` y no `strict`: el regreso desde el email viene de otro
 * sitio, y con `strict` la cookie no viajaría justo ahí.
 */

export const COOKIE_PENDIENTE = "carrito_pendiente";

const VIDA_EN_SEGUNDOS = 60 * 60;

/**
 * Una cookie manipulada o de una versión anterior se ignora, no rompe la ficha.
 * Si la variante existe y hay stock lo decide la base, al agregar.
 */
export function interpretar(valor: string | undefined): LineaDelCarrito | null {
  if (!valor) return null;

  let crudo: unknown;
  try {
    crudo = JSON.parse(valor);
  } catch {
    return null;
  }

  const resultado = lineaDelCarrito.safeParse(crudo);
  return resultado.success ? resultado.data : null;
}

export async function recordar(linea: LineaDelCarrito): Promise<void> {
  const almacen = await cookies();

  almacen.set(COOKIE_PENDIENTE, JSON.stringify(linea), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIDA_EN_SEGUNDOS,
  });
}

/** Solo lee: un Server Component no puede escribir cookies, borrarla es de la acción. */
export async function mirar(): Promise<LineaDelCarrito | null> {
  const almacen = await cookies();
  return interpretar(almacen.get(COOKIE_PENDIENTE)?.value);
}

/**
 * Se borra antes de intentar agregar, a propósito: si agregar falla (sin
 * stock), la cookie no debe reintentarlo en cada visita a la ficha.
 */
export async function tomar(): Promise<LineaDelCarrito | null> {
  const almacen = await cookies();
  const linea = interpretar(almacen.get(COOKIE_PENDIENTE)?.value);
  almacen.delete(COOKIE_PENDIENTE);
  return linea;
}
