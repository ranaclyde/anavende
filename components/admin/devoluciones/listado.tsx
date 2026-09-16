import Link from "next/link";

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
    <div className="flex flex-col items-center gap-2 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink">
        Ninguna devolución coincide con los filtros.
      </p>
      <p className="text-caption text-ink-secondary">
        Probá con un rango de fechas más ancho.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-2">
        <Link href={urlDeFiltros(FILTROS_VACIOS)}>Limpiar todo</Link>
      </Button>
    </div>
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
    <div className="flex flex-col items-center gap-2 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink">
        Todavía no registraste ninguna devolución.
      </p>
      <p className="max-w-prose text-caption text-ink-secondary">
        Se registran desde la orden que se devuelve, y sólo sobre órdenes
        finalizadas: abrí la orden y usá «Registrar devolución». Ahí elegís qué
        productos vuelven y cuáles vuelven al stock.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-1">
        <Link href="/admin/ordenes?estado=finalizadas">
          Ver las órdenes finalizadas
        </Link>
      </Button>
    </div>
  );
}
