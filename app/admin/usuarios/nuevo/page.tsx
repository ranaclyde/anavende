import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AltaDeUsuario } from "@/components/admin/usuarios/alta";
import { Button } from "@/components/ui/button";

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
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <Button asChild variant="tertiary" size="sm" className="-ml-3">
          <Link href="/admin/usuarios">
            <ChevronLeft aria-hidden />
            Usuarios
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Nueva cuenta</h1>
        <p className="text-body-sm text-ink-secondary">
          Le va a llegar un email para elegir su contraseña. Vos no la ves ni la
          elegís.
        </p>
      </div>

      <AltaDeUsuario />
    </div>
  );
}
