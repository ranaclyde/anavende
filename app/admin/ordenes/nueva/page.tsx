import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { AltaDeOrdenManual } from "@/components/admin/ordenes/nueva/alta";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva orden" };

const PASOS_DE_LA_ORDEN_NUEVA: PasoDeAyuda[] = [
  {
    elemento: "agregar-productos",
    titulo: "Lo que vendiste",
    texto:
      "Buscalo por nombre o marca. Si vendiste más de lo que figura en stock, igual la podés cargar como finalizada.",
  },
  {
    elemento: "como-queda",
    titulo: "¿Ya la entregaste?",
    texto:
      "Si falta entregar, cobrar o cerrar el precio, dejala activa: así la podés ajustar. Una finalizada ya no se edita.",
  },
];

/**
 * Venta fuera de la web (RF-24). No trae datos: catálogo y compradores se
 * buscan mientras se escribe, para no mandar el catálogo entero al navegador.
 */
export default async function NuevaOrden() {
  await requireAdmin();

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nueva orden"
        bajada="Para las ventas por WhatsApp, por teléfono o en persona."
        volver={{ href: "/admin/ordenes", etiqueta: "Órdenes" }}
        acciones={
          <AyudaGuiada
            id="panel-orden-nueva"
            pasos={PASOS_DE_LA_ORDEN_NUEVA}
            tamano="sm"
          />
        }
      />

      <AltaDeOrdenManual />
    </div>
  );
}
