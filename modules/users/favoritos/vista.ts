import "server-only";

import { cookies } from "next/headers";

import {
  vistaDeFavoritos,
  type VistaDeFavoritos,
} from "@/modules/users/favoritos/schemas";

/**
 * La vista elegida en «Favoritos» — F5.4 (pedido del 2026-09-14).
 *
 * **Cookie y no `localStorage`.** La página es de servidor: con la cookie la
 * dibuja directamente como la dejó el comprador. Con `localStorage` el
 * servidor no la conoce, dibujaría la lista, y quien eligió tarjetas vería la
 * página saltar de una a otra apenas carga.
 *
 * Solo viaja a `/mi-cuenta/favoritos`: es lo único que la lee, y no tiene por
 * qué ir en cada pedido del resto del sitio.
 */

export const COOKIE_VISTA = "vista_favoritos";

const RUTA = "/mi-cuenta/favoritos";
const UN_ANIO = 60 * 60 * 24 * 365;

/** Lo que no es una vista conocida vale lista, que es la de omisión. */
export function interpretarVista(valor: string | undefined): VistaDeFavoritos {
  const resultado = vistaDeFavoritos.safeParse(valor);
  return resultado.success ? resultado.data : "lista";
}

export async function leerVista(): Promise<VistaDeFavoritos> {
  const almacen = await cookies();
  return interpretarVista(almacen.get(COOKIE_VISTA)?.value);
}

export async function guardarVista(vista: VistaDeFavoritos): Promise<void> {
  const almacen = await cookies();

  almacen.set(COOKIE_VISTA, vista, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: RUTA,
    maxAge: UN_ANIO,
  });
}
