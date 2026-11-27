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

/** Los textos legales no están acá: tienen su propio editor (RF-29). */
export default async function ConfiguracionDelSitio() {
  await exigirAdmin();

  // El interruptor se lee de la base, no de la memoria del proxy, para
  // mostrar lo recién guardado.
  const [configuracion, mantenimiento, marcaDeAgua] = await Promise.all([
    leerLaConfiguracion(),
    elModoMantenimiento(),
    laMarcaDeAguaEstaActiva(),
  ]);

  return (
    <div className="flex w-full flex-col gap-4">
      <EncabezadoDePanel
        titulo="Configuración"
        bajada="Acá está toda la configuración de tu tienda."
      />

      {/* A la izquierda lo que se guarda con un botón; al lado, lo que surte
          efecto solo. */}
      <div className="@container">
        <div className="grid max-w-admin-form items-start gap-4 @min-[56rem]:max-w-none @min-[56rem]:grid-cols-2">
          <FormularioDeConfiguracion
            configuracion={configuracion}
            umbralPorDefecto={UMBRAL_DE_STOCK_BAJO_POR_DEFECTO}
            periodos={{
              pascua: periodoEscrito("pascua"),
              halloween: periodoEscrito("halloween"),
              navidad: periodoEscrito("navidad"),
            }}
          />

          {/* Fuera del formulario: cerrar la tienda se confirma y surte efecto
              en el acto. */}
          <div className="flex min-w-0 flex-col gap-4">
            <ModoMantenimiento activo={mantenimiento} />

            {/* RF-39: se arma en su propia pantalla. */}
            <MarcaDeAguaEnConfiguracion activa={marcaDeAgua} />
          </div>
        </div>
      </div>
    </div>
  );
}
