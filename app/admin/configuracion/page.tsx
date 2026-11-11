import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { FormularioDeConfiguracion } from "@/components/admin/configuracion/formulario";
import { ModoMantenimiento } from "@/components/admin/configuracion/mantenimiento";
import { MarcaDeAguaEnConfiguracion } from "@/components/admin/configuracion/marca-de-agua";
import { laMarcaDeAguaEstaActiva } from "@/modules/marca-de-agua/queries";
import {
  elModoMantenimiento,
  leerLaConfiguracion,
  UMBRAL_DE_STOCK_BAJO_POR_DEFECTO,
} from "@/modules/settings/queries";
import { periodoEscrito } from "@/lib/escenas";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Configuración" };

/**
 * Configuración del sitio — RF-20, F2.7.
 *
 * Lo que RF-20 llama «datos de contacto y textos legales» no está acá: son
 * las páginas de RF-29, que tienen su propia tabla (`legal_pages`), su
 * propio editor y su propia tarea (F9.3). Lo de esta pantalla son los
 * valores sueltos que hoy no tendrían dónde vivir salvo pegados en el
 * código.
 */
export default async function ConfiguracionDelSitio() {
  await exigirAdmin();

  // En paralelo: son lecturas que no se esperan una a
  // la otra. El interruptor se lee de la base y no de la memoria del proxy
  // (`elModoMantenimiento`): recién cambiado, tiene que decir lo que quedó.
  const [configuracion, mantenimiento, marcaDeAgua] = await Promise.all([
    leerLaConfiguracion(),
    elModoMantenimiento(),
    laMarcaDeAguaEstaActiva(),
  ]);

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Configuración"
        bajada="Por dónde te escriben y te siguen, dónde te avisamos y cuándo un producto se está por acabar."
      />

      <FormularioDeConfiguracion
        configuracion={configuracion}
        umbralPorDefecto={UMBRAL_DE_STOCK_BAJO_POR_DEFECTO}
        periodos={{
          pascua: periodoEscrito("pascua"),
          halloween: periodoEscrito("halloween"),
          navidad: periodoEscrito("navidad"),
        }}
      />

      {/* Fuera del formulario y con su propio botón (F2.7b): cerrar la
          tienda no es un valor más que se guarda con «Guardar cambios», es
          una acción que se confirma y surte efecto en el acto. */}
      <ModoMantenimiento activo={mantenimiento} />

      {/* RF-39. Se arma en su propia pantalla, con vista previa. */}
      <MarcaDeAguaEnConfiguracion activa={marcaDeAgua} />
    </div>
  );
}
