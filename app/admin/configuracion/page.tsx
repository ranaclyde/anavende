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
    <div className="flex w-full flex-col gap-4">
      <EncabezadoDePanel
        titulo="Configuración"
        bajada="Por dónde te escriben y te siguen, dónde te avisamos y cuándo un producto se está por acabar."
      />

      {/* Lo que se guarda con un botón a la izquierda, y al lado lo que
          surte efecto solo —abrir o cerrar la tienda, la marca de agua—,
          como la ficha del producto con su stock. Apiladas por debajo de
          64rem de contenedor: el formulario necesita unos 36rem y cada
          tarjeta de al lado, 22. */}
      <div className="@container">
        <div className="grid max-w-admin-form items-start gap-4 @min-[64rem]:max-w-none @min-[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
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
          <div className="flex min-w-0 flex-col gap-4">
            <ModoMantenimiento activo={mantenimiento} />

            {/* RF-39. Se arma en su propia pantalla, con vista previa. */}
            <MarcaDeAguaEnConfiguracion activa={marcaDeAgua} />
          </div>
        </div>
      </div>
    </div>
  );
}
