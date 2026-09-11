"use client";

import { Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { Cantidad } from "@/components/shop/cantidad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cambiarCantidadDelCarrito,
  quitarDelCarrito,
  vaciarElCarrito,
} from "@/modules/cart/actions";

/**
 * Las partes vivas del carrito — F5.5, RF-08, DESIGN-REFERENCE §7.4.
 *
 * Son islas chicas dentro de una página de servidor: el renglón —foto,
 * nombre, precio, subtotal— se pinta en el servidor, y acá queda solo lo que
 * responde a un clic. El subtotal y el total NO se recalculan en el
 * navegador: la acción refresca la página y vuelven calculados por la base
 * (§7.1), que es la única que suma montos.
 */

/**
 * Cantidad y «Quitar» de un renglón.
 *
 * **La cantidad es optimista**: el número cambia al apretar y no cuando
 * vuelve el servidor, porque esperar un viaje de ida y vuelta para ver un 3
 * en lugar de un 2 se siente como un control roto. Si el servidor lo
 * rechaza, `useOptimistic` vuelve solo al valor de verdad al terminar la
 * transición, y el motivo queda escrito abajo.
 */
export function ControlesDelItem({
  variantId,
  nombre,
  cantidad,
  maximo,
}: {
  variantId: string;
  nombre: string;
  cantidad: number;
  /** El tope del selector: lo disponible, sin bajar de lo que ya hay. */
  maximo: number;
}) {
  const [enCurso, iniciar] = useTransition();
  const [mostrada, setMostrada] = useOptimistic(cantidad);
  const [error, setError] = useState<string | null>(null);

  function cambiar(n: number) {
    setError(null);
    iniciar(async () => {
      setMostrada(n);
      const r = await cambiarCantidadDelCarrito({ variantId, cantidad: n });
      if (!r.ok) setError(r.message);
    });
  }

  function quitar() {
    setError(null);
    iniciar(async () => {
      const r = await quitarDelCarrito({ variantId });
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Cantidad
          valor={mostrada}
          maximo={maximo}
          onCambio={cambiar}
          etiqueta={`Cantidad de ${nombre}`}
        />
        <Button variant="tertiary" size="md" disabled={enCurso} onClick={quitar}>
          <Trash2 aria-hidden />
          Quitar
          <span className="sr-only"> {nombre} del carrito</span>
        </Button>
      </div>

      {error === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Vaciar el carrito, con confirmación.
 *
 * A diferencia de «Quitar», que es un renglón y se vuelve a agregar en dos
 * clics, vaciar se lleva todo lo que la persona fue juntando, y no hay forma
 * de deshacerlo. Una pregunta de más acá cuesta menos que armar el carrito de
 * nuevo.
 */
export function VaciarCarrito({ renglones }: { renglones: number }) {
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function vaciar() {
    setError(null);
    iniciar(async () => {
      const r = await vaciarElCarrito({});
      if (r.ok) setAbierto(false);
      else setError(r.message);
    });
  }

  return (
    <>
      <Button variant="tertiary" size="md" onClick={() => setAbierto(true)}>
        <Trash2 aria-hidden />
        Vaciar el carrito
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Vaciar el carrito?</DialogTitle>
            <DialogDescription>
              {renglones === 1
                ? "Se quita el producto que agregaste."
                : `Se quitan los ${renglones} productos que agregaste.`}{" "}
              No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="tertiary" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              loading={enCurso}
              loadingLabel="Vaciando el carrito"
              onClick={vaciar}
            >
              Vaciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
