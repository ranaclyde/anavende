import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { AltaDeOrdenManual } from "@/components/admin/ordenes/nueva/alta";

export const metadata: Metadata = { title: "Nueva orden" };

/**
 * Cargar una venta hecha fuera de la web — FS RF-24. Tarea F7.4.
 *
 * **La página no trae datos**: el catálogo y los compradores se buscan
 * mientras se escribe, y precargarlos sería mandar el catálogo entero al
 * navegador para que se use una fila. Lo único que hay acá es el encabezado
 * y la isla del formulario.
 *
 * **La guardia es el layout de `/admin`**, que verifica el rol contra la base
 * en cada petición; las acciones que este formulario llama la repiten con
 * `.auth("admin")`, porque una Server Action es una puerta propia (§6.2).
 */
export default function NuevaOrden() {
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nueva orden"
        bajada="Para las ventas que no pasaron por la tienda: por WhatsApp, por teléfono o en persona. Queda marcada como manual y mueve el stock igual que una web."
        volver={{ href: "/admin/ordenes", etiqueta: "Órdenes" }}
      />

      <AltaDeOrdenManual />
    </div>
  );
}
