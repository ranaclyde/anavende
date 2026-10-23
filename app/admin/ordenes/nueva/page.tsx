import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { AltaDeOrdenManual } from "@/components/admin/ordenes/nueva/alta";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva orden" };

/**
 * La guía de la orden manual (F6.7, RF-37). Dos pasos, porque el resto del
 * formulario se explica solo: la bajada, el aviso de que el precio se puede
 * cambiar y lo que hace cada estado ya están en pantalla.
 */
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
export default async function NuevaOrden() {
  await exigirAdmin();

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nueva orden"
        bajada="Para las ventas que no pasaron por la tienda: por WhatsApp, por teléfono o en persona. Queda marcada como manual y mueve el stock igual que una web."
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
