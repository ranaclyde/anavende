import type { Metadata } from "next";

import { FormularioDeConfiguracion } from "@/components/admin/configuracion/formulario";
import { ModoMantenimiento } from "@/components/admin/configuracion/mantenimiento";
import {
  elModoMantenimiento,
  leerLaConfiguracion,
  UMBRAL_DE_STOCK_BAJO_POR_DEFECTO,
} from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Configuración" };

/**
 * Configuración del sitio — RF-20, F2.7.
 *
 * Lo que RF-20 llama «datos de contacto y textos legales» no está acá: son
 * las páginas de RF-29, que tienen su propia tabla (`legal_pages`), su
 * propio editor y su propia tarea (F9.3). Lo de esta pantalla son los tres
 * valores sueltos que hoy no tendrían dónde vivir salvo pegados en el
 * código.
 */
export default async function ConfiguracionDelSitio() {
  // En paralelo: son dos lecturas de la misma fila que no se esperan una a
  // la otra. El interruptor se lee de la base y no de la memoria del proxy
  // (`elModoMantenimiento`): recién cambiado, tiene que decir lo que quedó.
  const [configuracion, mantenimiento] = await Promise.all([
    leerLaConfiguracion(),
    elModoMantenimiento(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Configuración</h1>
        <p className="text-body-sm text-ink-secondary">
          Por dónde te escriben, dónde te avisamos y cuándo un producto se
          está por acabar.
        </p>
      </div>

      <FormularioDeConfiguracion
        configuracion={configuracion}
        umbralPorDefecto={UMBRAL_DE_STOCK_BAJO_POR_DEFECTO}
      />

      {/* Fuera del formulario y con su propio botón (F2.7b): cerrar la
          tienda no es un valor más que se guarda con «Guardar cambios», es
          una acción que se confirma y surte efecto en el acto. */}
      <ModoMantenimiento activo={mantenimiento} />
    </div>
  );
}
