import { Undo2 } from "lucide-react";
import Link from "next/link";

import { VacioDelPanel } from "@/components/admin/vacio";
import { TarjetaDeDevolucion } from "@/components/admin/devoluciones/tarjeta";
import { Button } from "@/components/ui/button";
import { FILTROS_VACIOS, urlDeFiltros } from "@/modules/returns/filtros";
import type { DevolucionDelListado } from "@/modules/returns/queries";

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

/** Sin resultados (§8): hay devoluciones, pero ninguna con estos filtros. */
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
 * Vacío de verdad (§8). Sugiere las órdenes finalizadas porque una devolución
 * empieza en la orden; por eso tampoco hay botón de «nueva».
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
      Se registran desde la orden que se devuelve, y solo sobre órdenes
      finalizadas: abrí la orden y usá «Registrar devolución». Ahí elegís qué
      productos vuelven y cuáles vuelven al stock.
    </VacioDelPanel>
  );
}
