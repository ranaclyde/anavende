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

/**
 * Agregar a una orden activa un producto que no estaba — FS RF-22. Tarea F7.2a.
 *
 * **El buscador es el mismo de la orden manual** (F7.4), y por eso esta tarea
 * se planificó después de aquélla: escribirlo dos veces era lo que había que
 * evitar. Lo que cambia es lo que pasa al elegir — allá se arma una lista con
 * precio editable, acá se confirma una reserva contra una orden que ya existe.
 *
 * **Un diálogo con dos pasos** (2026-09-30): buscar, y después cuántas y qué
 * pasa con el stock. Hasta entonces el buscador se abría dentro de la tabla,
 * empujaba el pedido hacia abajo con cada búsqueda, y al elegir abría un
 * diálogo encima: dos superficies para una sola acción. Ahora el segundo paso
 * reemplaza al primero dentro del mismo diálogo, y «Volver» regresa a la
 * búsqueda sin perderla.
 */
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
        >
          <Plus aria-hidden />
          Agregar un producto
        </Button>

        <DialogContent className={ALTO_DEL_DIALOGO}>
          {/* Un solo título a la vez: Radix les da a los dos el mismo id, y
              el diálogo se nombra con el del paso en que está. */}
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

          {/* El buscador se esconde y no se desmonta: «Volver» tiene que
              encontrar lo que se había buscado, no un campo vacío. */}
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
                // Sincrónico, para que el buscador ya esté visible cuando se
                // le devuelve el foco: escondido no se puede enfocar.
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
 * Cuántas y qué pasa con el stock, antes de confirmar — RF-22.
 *
 * **El tope es el disponible de hoy**, leído por el buscador: ofrecer más
 * sería ofrecer un error. Si no queda nada, se dice y no hay nada que elegir.
 * Quien decide de verdad es el `UPDATE` condicional de §8.2, porque entre que
 * se buscó y se confirmó otra orden pudo llevarse esas unidades; cuando eso
 * pasa, el mensaje que vuelve dice cuántas quedan ahora.
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
      // Los cuatro movimientos de ítems avisan, y el motivo no es que la
      // pantalla no cambie —el renglón y el total cambian a la vista— sino
      // que **cada uno escribe en el libro de stock**, que es lo único que
      // no se ve desde acá: agregar reserva unidades y quitar las libera.
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
              // El botón que llevó a este paso desapareció con el buscador:
              // el foco tiene que aterrizar en algún lado, y es acá.
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

      {/* `mt-auto`: el diálogo tiene alto fijo por el buscador, y sin esto
          los botones quedarían flotando a media altura. */}
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
