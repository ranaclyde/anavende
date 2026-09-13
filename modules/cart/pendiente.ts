import "server-only";

import { cookies } from "next/headers";

import type { LineaDelCarrito } from "@/modules/cart/operaciones";
import { lineaDelCarrito } from "@/modules/cart/schemas";

/**
 * La compra que quedó esperando a que alguien inicie sesión — F5.7 · RF-08.
 *
 * **Por qué una cookie y no la dirección.** Lo obvio era colgar la acción del
 * `volver` —`/productos/x?agregar=…`— y que la ficha la ejecutara al llegar.
 * Eso convierte una dirección en una escritura: cualquiera podría mandar un
 * enlace que le mete 99 unidades en el carrito a quien lo abra con la sesión
 * puesta. No es destructivo —el carrito no reserva (RF-08)— pero es una
 * mutación que el comprador no pidió, disparada por navegar. La cookie la
 * escribe el servidor cuando el visitante aprieta el botón, y solo el
 * navegador que apretó la trae de vuelta.
 *
 * **Por qué una cookie y no `sessionStorage`.** El camino largo del alta
 * —registro, email de verificación, clic en el enlace— **abre otra pestaña**,
 * y `sessionStorage` no cruza esa puerta. Es justamente el visitante nuevo,
 * el que esta tarea existe para no perder. La cookie sí cruza: sobrevive al
 * ingreso con contraseña, al enlace del email y al callback de OAuth.
 *
 * Lo que no cruza, y está bien que no cruce, es **otro dispositivo**: quien
 * abre el email de verificación en el teléfono llega a la ficha sin la
 * cookie, y ahí el botón ya dice «Agregá al carrito» y funciona.
 *
 * `httpOnly`: el navegador no tiene nada que hacer con esto y una acción
 * pendiente legible desde JavaScript es una superficie de más, sin ninguna
 * ganancia. `sameSite: "lax"` y no `strict`: el regreso desde el enlace del
 * email es una navegación de arriba desde otro sitio, y `strict` no mandaría
 * la cookie justo en ese viaje.
 */

export const COOKIE_PENDIENTE = "carrito_pendiente";

/**
 * Una hora. El alta con verificación por email no se mide en segundos —hay
 * que ir al correo, encontrarlo, volver—, y guardar esto por días sería
 * agregar al carrito algo que se pidió en otra sesión, sin que nadie lo
 * vuelva a pedir.
 */
const VIDA_EN_SEGUNDOS = 60 * 60;

/**
 * Lee el contenido de la cookie sin confiarle nada.
 *
 * Es pura y se exporta para poder probarla: una cookie manipulada, vencida a
 * medias o escrita por una versión anterior no tiene que romper la ficha, se
 * ignora y listo. Quien decide si la variante existe y si hay stock sigue
 * siendo la base, al agregar.
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

/** Desde la acción del botón «Iniciá sesión para comprar». */
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

/**
 * Solo mirar, para que la ficha sepa si tiene algo que retomar. Un Server
 * Component puede leer cookies, pero no escribirlas: borrarla es de la
 * acción.
 */
export async function mirar(): Promise<LineaDelCarrito | null> {
  const almacen = await cookies();
  return interpretar(almacen.get(COOKIE_PENDIENTE)?.value);
}

/**
 * Leer y borrar, en ese orden y en la misma pasada.
 *
 * **Se borra antes de intentar agregar, y es a propósito.** Si el producto se
 * quedó sin stock mientras el comprador se registraba, agregar falla; con la
 * cookie todavía puesta, el intento volvería a fallar en cada visita a la
 * ficha, para siempre. Una acción pendiente se retoma UNA vez: salga bien o
 * salga mal, después se cuenta qué pasó.
 */
export async function tomar(): Promise<LineaDelCarrito | null> {
  const almacen = await cookies();
  const linea = interpretar(almacen.get(COOKIE_PENDIENTE)?.value);
  almacen.delete(COOKIE_PENDIENTE);
  return linea;
}
