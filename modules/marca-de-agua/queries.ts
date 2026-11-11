import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";
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

export type MarcaDeAguaDelPanel = {
  activa: boolean;
  biblioteca: ImagenDeLaBiblioteca[];
  capas: CapaGuardada[];
};

/** Todo lo que necesita la pantalla de la marca de agua (RF-39). */
export async function leerLaMarcaDeAgua(): Promise<MarcaDeAguaDelPanel> {
  const [activa, filas, capas] = await Promise.all([
    estaActiva(),
    db.select().from(watermarkImages).orderBy(desc(watermarkImages.createdAt)),
    leerCapas(),
  ]);

  const store = almacenamiento();
  return {
    activa,
    capas,
    biblioteca: filas.map((f) => ({
      id: f.id,
      nombre: f.name,
      url: store.publicUrl(archivoDeMarca(f.storageKey)),
      ancho: f.width,
      alto: f.height,
    })),
  };
}
