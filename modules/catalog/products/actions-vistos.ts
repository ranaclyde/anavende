"use server";

import { cookies } from "next/headers";

import { action } from "@/lib/action";
import { COOKIE_DE_VISTOS } from "@/modules/catalog/products/vistos-cookie";
import { sinDatos } from "@/modules/cart/schemas";

/**
 * «Borrar historial» de «Vistos recientemente» — F8.4, RF-33.
 *
 * Es `public`: el historial es del navegador, con sesión o sin ella. Borrar
 * la cookie desde una acción hace que Next vuelva a dibujar la página con la
 * cookie nueva, así que el bloque desaparece sin pedir nada más: eso es el
 * aviso de que salió (DESIGN.md, la regla del aviso: lo que pasó se ve).
 */
export const borrarVistos = action
  .input(sinDatos)
  .auth("public")
  .handler(async () => {
    const almacen = await cookies();
    almacen.delete(COOKIE_DE_VISTOS);
    return { borrado: true };
  });
