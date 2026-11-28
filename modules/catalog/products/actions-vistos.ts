"use server";

import { cookies } from "next/headers";

import { action } from "@/lib/action";
import { COOKIE_DE_VISTOS } from "@/modules/catalog/products/vistos-cookie";
import { sinDatos } from "@/modules/cart/schemas";

/**
 * Borrar la cookie desde una acción hace que Next vuelva a dibujar la página,
 * así que el bloque desaparece solo: ese es el aviso de que salió.
 */
export const borrarVistos = action
  .input(sinDatos)
  .auth("public")
  .handler(async () => {
    const almacen = await cookies();
    almacen.delete(COOKIE_DE_VISTOS);
    return { borrado: true };
  });
