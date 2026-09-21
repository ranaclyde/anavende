import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { AltaDeUsuario } from "@/components/admin/usuarios/alta";

export const metadata: Metadata = { title: "Nueva cuenta" };

/**
 * Alta de una cuenta — FS RF-26 · TS §13.4. Tarea F7.6.
 *
 * **Es la vía por la que se suma una administradora**, que hasta hoy era un
 * `UPDATE` a mano en la base (está contado en PROGRESO). También sirve para
 * cargar a un comprador que compró por WhatsApp y quiere su cuenta.
 */
export default function NuevaCuenta() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nueva cuenta"
        bajada="Le va a llegar un email para elegir su contraseña. Vos no la ves ni la elegís."
        volver={{ href: "/admin/usuarios", etiqueta: "Usuarios" }}
      />

      <AltaDeUsuario />
    </div>
  );
}
