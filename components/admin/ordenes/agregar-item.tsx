"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { flushSync } from "react-dom";

import { AvisoAlComprador } from "@/components/admin/ordenes/editar-item";
import { BuscadorDeVariantes } from "@/components/admin/ordenes/nueva/buscador-variantes";
import { ALTO_DEL_DIALOGO } from "@/components/admin/ordenes/nueva/busqueda";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { agregarItemALaOrden } from "@/modules/orders/actions-panel";
import type { VarianteParaLaOrden } from "@/modules/orders/queries-manual";

/** Un diálogo con dos pasos: buscar la variante, y después cuántas. */
export function AgregarALaOrden({ numero }: { numero: number }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<VarianteParaLaOrden | null>(null);
  const campo = useId();

  function cambiarApertura(v: boolean) {
    setAbierto(v);
    if (!v) setElegida(null);
  }

  return (
    <div className="border-t border-border px-3 py-2">
      <Dialog open={abierto} onOpenChange={cambiarApertura}>
        <Button
          variant="tertiary"
          size="sm"
          className="-ml-3"
          onClick={() => setAbierto(true)}
          data-ayuda="agregar-a-la-orden"
        >
          <Plus aria-hidden />
          Agregar un producto
        </Button>

        <DialogContent className={ALTO_DEL_DIALOGO}>
          {/* Un solo título a la vez: Radix les da a los dos el mismo id. */}
          {elegida === null ? (
            <DialogHeader>
              <DialogTitle>
                Agregar un producto a la orden #{numero}
              </DialogTitle>
              <DialogDescription>
                Elegí el producto y el color. En el paso siguiente decidís
                cuántas unidades.
              </DialogDescription>
            </DialogHeader>
          ) : null}

          {/* Se esconde y no se desmonta: «Volver» conserva la búsqueda. */}
          <div
            hidden={elegida !== null}
            className="flex min-h-0 flex-1 flex-col"
          >
            <BuscadorDeVariantes id={campo} alElegir={setElegida} />
          </div>

          {elegida === null ? null : (
            <PasoDeCantidad
              key={elegida.variantId}
              numero={numero}
              variante={elegida}
              volver={() => {
                // Sincrónico: escondido, el buscador no se puede enfocar.
                flushSync(() => setElegida(null));
                document.getElementById(campo)?.focus();
              }}
              alAgregar={() => cambiarApertura(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * El tope es el disponible leído al buscar; el que decide es el `UPDATE`
 * condicional (TS §8.2), porque otra orden pudo llevarse las unidades.
 */
function PasoDeCantidad({
  numero,
  variante,
  volver,
  alAgregar,
}: {
  numero: number;
  variante: VarianteParaLaOrden;
  volver: () => void;
  alAgregar: () => void;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const hay = variante.disponible;

  function agregar() {
    setError(null);
    iniciar(async () => {
      const r = await agregarItemALaOrden({
        numero,
        variantId: variante.variantId,
        cantidad,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Avisa porque mueve el stock, que no se ve desde acá.
      avisar(
        `Agregaste ${cantidad === 1 ? "1 unidad" : `${cantidad} unidades`} de ${variante.nombre}${
          variante.color ? ` (${variante.color.toLowerCase()})` : ""
        } a la orden #${numero}.`,
      );
      alAgregar();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Agregar {variante.nombre}
          {variante.color ? ` (${variante.color.toLowerCase()})` : ""} a la
          orden #{numero}
        </DialogTitle>
        <DialogDescription>
          {hay === 0
            ? "No queda stock disponible de ese color, así que no se puede agregar. Cargá stock y volvé a intentar."
            : `Entra al precio vigente del catálogo, ${formatMoney(variante.precio)} por unidad, y queda congelado en la orden. Si ese producto ya está en la orden, las unidades se suman a su renglón y van al precio de esa línea.`}
        </DialogDescription>
      </DialogHeader>

      {hay > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="cantidad-agregar" className="text-body-sm text-ink">
              Cantidad
            </label>
            <Select
              // El botón que trajo hasta acá desapareció con el buscador.
              autoFocus
              id="cantidad-agregar"
              value={cantidad}
              onChange={(e) => setCantidad(Number.parseInt(e.target.value, 10))}
              className="w-28"
            >
              {Array.from({ length: hay }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>

          <p className="text-body-sm text-ink-secondary">
            {cantidad === 1
              ? "Se reserva 1 unidad"
              : `Se reservan ${cantidad} unidades`}
            : el disponible pasa de{" "}
            <strong className="font-medium text-ink">{hay}</strong> a{" "}
            <strong className="font-medium text-ink">{hay - cantidad}</strong>.
          </p>

          <AvisoAlComprador />
        </>
      ) : null}

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      {/* `mt-auto`: el diálogo tiene alto fijo por el buscador. */}
      <DialogFooter className="mt-auto">
        <Button
          variant="tertiary"
          disabled={enCurso}
          onClick={volver}
          autoFocus={hay === 0}
        >
          <ArrowLeft aria-hidden />
          Volver
        </Button>
        {hay > 0 ? (
          <Button
            variant="brand"
            loading={enCurso}
            loadingLabel="Agregando"
            onClick={agregar}
          >
            Agregar a la orden
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
