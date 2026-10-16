"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/action";
import { escribirTextoLegal } from "@/modules/content/legales";
import { paginaLegal } from "@/modules/content/paginas";
import { textoLegal } from "@/modules/content/schemas";

/**
 * Guardar el texto de una página legal — RF-29: «editable desde el panel sin
 * necesidad de un deploy».
 */
export const guardarUnTextoLegal = action
  .input(textoLegal)
  .auth("admin")
  .handler(async ({ input }) => {
    // El enum del esquema ya garantiza que existe.
    const { titulo } = paginaLegal(input.slug)!;

    const { actualizada } = await escribirTextoLegal({
      slug: input.slug,
      titulo,
      contenido: input.contenido,
    });

    revalidatePath(`/legales/${input.slug}`);
    revalidatePath(`/admin/legales/${input.slug}`);
    return { actualizada };
  });
