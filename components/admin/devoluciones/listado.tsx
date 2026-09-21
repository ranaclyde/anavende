import { Undo2 } from "lucide-react";
import Link from "next/link";

import { VacioDelPanel } from "@/components/admin/vacio";
import { TarjetaDeDevolucion } from "@/components/admin/devoluciones/tarjeta";
import { Button } from "@/components/ui/button";
import { FILTROS_VACIOS, urlDeFiltros } from "@/modules/returns/filtros";
import type { DevolucionDelListado } from "@/modules/returns/queries";

/**
 * Listado de devoluciones — FS RF-25. Tarea F7.5.
 *
 * **Es un componente de servidor**, como el listado de órdenes: los filtros y
 * la paginación son enlaces, y lo único que se toca de una devolución —
 * anularla— es su propia isla adentro de la tarjeta.
 *
 * Va de la más nueva a la más vieja y no se ordena por columna: una devolución
 * se mira cuando acaba de pasar, o se busca por fecha.
 */
export function ListadoDeDevoluciones({
  devoluciones,
}: {
  devoluciones: DevolucionDelListado[];
}) {
  if (devoluciones.length === 0) return <SinResultados />;

  return (
    <ul className="flex flex-col gap-3">
      {devoluciones.map((devolucion) => (
        <li key={devolucion.id}>
          <TarjetaDeDevolucion
            devolucion={devolucion}
            orden={{
              numero: devolucion.numero,
              customerName: devolucion.customerName,
            }}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Sin resultados (§8), que no es lo mismo que vacío: hay devoluciones y
 * ninguna coincide con estos filtros.
 */
function SinResultados() {
  return (
    <VacioDelPanel
      titulo="Ninguna devolución coincide con los filtros."
      accion={
        <Button asChild variant="secondary" size="sm">
          <Link href={urlDeFiltros(FILTROS_VACIOS)}>Limpiar todo</Link>
        </Button>
      }
    >
      Probá con un rango de fechas más ancho.
    </VacioDelPanel>
  );
}

/**
 * Estado vacío de verdad (§8): todavía no se registró ninguna devolución.
 *
 * **La acción que sugiere es ir a las órdenes finalizadas**, porque una
 * devolución no empieza acá: empieza en la orden que se devuelve. Es la misma
 * razón por la que esta pantalla no tiene un botón de «nueva».
 */
export function SinDevoluciones() {
  return (
    <VacioDelPanel
      icono={Undo2}
      titulo="Todavía no registraste ninguna devolución."
      accion={
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/ordenes?estado=finalizadas">
            Ver las órdenes finalizadas
          </Link>
        </Button>
      }
    >
      Se registran desde la orden que se devuelve, y sólo sobre órdenes
      finalizadas: abrí la orden y usá «Registrar devolución». Ahí elegís qué
      productos vuelven y cuáles vuelven al stock.
    </VacioDelPanel>
  );
}
