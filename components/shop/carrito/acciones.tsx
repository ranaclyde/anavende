"use client";

import { Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { Cantidad } from "@/components/shop/cantidad";
import {
  propsDePausa,
  useCuentaEnPausa,
} from "@/components/shop/cuenta-en-pausa";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
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

// El subtotal y el total no se recalculan en el navegador: la acción refresca
// la página y vuelven calculados por la base, la única que suma montos.

/**
 * La cantidad es optimista: si el servidor la rechaza, `useOptimistic` vuelve
 * solo al valor de verdad al terminar la transición.
 */
export function ControlesDelItem({
  variantId,
  nombre,
  cantidad,
  maximo,
  soloQuitar = false,
}: {
  variantId: string;
  nombre: string;
  cantidad: number;
  /** El tope del selector: lo disponible, sin bajar de lo que ya hay. */
  maximo: number;
  /** Sin stock o ya no disponible: queda solo «Quitar». */
  soloQuitar?: boolean;
}) {
  const [enCurso, iniciar] = useTransition();
  const [mostrada, setMostrada] = useOptimistic(cantidad);
  const [error, setError] = useState<string | null>(null);
  const enPausa = useCuentaEnPausa();

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
      {/* El `fieldset` apaga todo lo de adentro sin que `Cantidad` sepa de la pausa. */}
      <fieldset
        disabled={enPausa}
        aria-describedby={enPausa ? ID_AVISO_DE_PAUSA : undefined}
        className="contents"
      >
        <div className="flex flex-wrap items-center gap-1">
          {soloQuitar ? null : (
            <Cantidad
              valor={mostrada}
              maximo={maximo}
              onCambio={cambiar}
              etiqueta={`Cantidad de ${nombre}`}
            />
          )}
          <Button
            variant="tertiary"
            size="md"
            disabled={enCurso}
            onClick={quitar}
          >
            <Trash2 aria-hidden />
            Quitar
            <span className="sr-only"> {nombre} del carrito</span>
          </Button>
        </div>
      </fieldset>

      {error === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Con confirmación, a diferencia de «Quitar»: vaciar no se puede deshacer. */
export function VaciarCarrito({ renglones }: { renglones: number }) {
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pausa = propsDePausa(useCuentaEnPausa());

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
      <Button
        variant="tertiary"
        size="md"
        onClick={() => setAbierto(true)}
        {...pausa}
      >
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
