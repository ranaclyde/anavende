import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { AltaDeUsuario } from "@/components/admin/usuarios/alta";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva cuenta" };

/** Alta de una cuenta, administradora o compradora (RF-26, TS §13.4). */
export default async function NuevaCuenta() {
  await requireAdmin();

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nueva cuenta"
        bajada="El usuario recibe un email para configurar su contraseña."
        volver={{ href: "/admin/usuarios", etiqueta: "Usuarios" }}
      />

      <AltaDeUsuario />
    </div>
  );
}
