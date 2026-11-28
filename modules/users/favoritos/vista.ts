import "server-only";

import { cookies } from "next/headers";

import {
  vistaDeFavoritos,
  type VistaDeFavoritos,
} from "@/modules/users/favoritos/schemas";

// Cookie y no `localStorage`: la página es de servidor y, sin conocer la
// vista, la dibujaría como lista y saltaría a tarjetas al cargar.

export const COOKIE_VISTA = "vista_favoritos";

const RUTA = "/mi-cuenta/favoritos";
const UN_ANIO = 60 * 60 * 24 * 365;

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
