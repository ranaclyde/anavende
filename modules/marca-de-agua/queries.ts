import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productVariants, products, variantImages } from "@/db/schema/catalog";
import { watermarkImages } from "@/db/schema/settings";
import { almacenamiento } from "@/lib/storage";
import {
  archivoDeMarca,
  estaActiva,
  leerCapas,
  type CapaGuardada,
} from "@/modules/marca-de-agua/service";

export { estaActiva as laMarcaDeAguaEstaActiva };

export type ImagenDeLaBiblioteca = {
  id: string;
  nombre: string;
  url: string;
  ancho: number;
  alto: number;
};

/** La foto con la que arranca la vista previa: la última sin marca. */
export type FotoDeMuestra = { id: string; producto: string };

export type MarcaDeAguaDelPanel = {
  activa: boolean;
  biblioteca: ImagenDeLaBiblioteca[];
  capas: CapaGuardada[];
  muestra: FotoDeMuestra | null;
};

/**
 * La última foto de producto que se subió **sin marca**: con una marcada, la
 * vista previa pondría la marca encima de otra.
 */
async function ultimaFotoSinMarca(): Promise<FotoDeMuestra | null> {
  const [fila] = await db
    .select({ id: variantImages.id, producto: products.name })
    .from(variantImages)
    .innerJoin(productVariants, eq(productVariants.id, variantImages.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(variantImages.hasWatermark, false))
    .orderBy(desc(variantImages.createdAt))
    .limit(1);
  return fila ?? null;
}

/** Todo lo que necesita la pantalla de la marca de agua (RF-39). */
export async function leerLaMarcaDeAgua(): Promise<MarcaDeAguaDelPanel> {
  const [activa, filas, capas, muestra] = await Promise.all([
    estaActiva(),
    db.select().from(watermarkImages).orderBy(desc(watermarkImages.createdAt)),
    leerCapas(),
    ultimaFotoSinMarca(),
  ]);

  const store = almacenamiento();
  return {
    activa,
    capas,
    muestra,
    biblioteca: filas.map((f) => ({
      id: f.id,
      nombre: f.name,
      url: store.publicUrl(archivoDeMarca(f.storageKey)),
      ancho: f.width,
      alto: f.height,
    })),
  };
}
