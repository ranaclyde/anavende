"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/action";
import {
  activarMarca,
  borrarImagenDeMarca,
  guardarCapas,
} from "@/modules/marca-de-agua/service";
import {
  activacion,
  guardarLasCapas,
  soloImagen,
} from "@/modules/marca-de-agua/schemas";

/**
 * La marca de agua desde el panel — RF-39.
 *
 * Se invalida el layout de `/admin` entero y no solo esta pantalla: el aviso
 * «Marca de agua activada» vive en el editor de productos, y tiene que decir
 * lo que quedó.
 */
function refrescar() {
  revalidatePath("/admin", "layout");
}

export const cambiarLaMarcaDeAgua = action
  .input(activacion)
  .auth("admin")
  .handler(async ({ input }) => {
    const activa = await activarMarca(input.activa);
    refrescar();
    return { activa };
  });

export const guardarLasCapasDeLaMarca = action
  .input(guardarLasCapas)
  .auth("admin")
  .handler(async ({ input }) => {
    const resultado = await guardarCapas(input.capas);
    refrescar();
    return resultado;
  });

export const borrarDeLaBiblioteca = action
  .input(soloImagen)
  .auth("admin")
  .handler(async ({ input }) => {
    const resultado = await borrarImagenDeMarca(input.id);
    refrescar();
    return resultado;
  });
