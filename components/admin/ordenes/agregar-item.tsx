"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { AvisoAlComprador } from "@/components/admin/ordenes/editar-item";
import { BuscadorDeVariantes } from "@/components/admin/ordenes/nueva/buscador-variantes";
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
 * **Arranca plegado.** Editar una orden es sobre todo mirarla; el buscador
 * abierto todo el tiempo empujaría el pedido hacia abajo para una acción que
 * se hace de vez en cuando.
 */
export function AgregarALaOrden({ numero }: { numero: number }) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<VarianteParaLaOrden | null>(null);

  if (!abierto) {
    return (
      <div className="border-t border-border px-3 py-2">
        <Button
          variant="tertiary"
          size="sm"
          className="-ml-3"
          onClick={() => setAbierto(true)}
        >
          <Plus aria-hidden />
          Agregar un producto
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <BuscadorDeVariantes
          alElegir={setElegida}
          etiqueta="Agregar un producto a la orden"
        />
        <Button
          variant="tertiary"
          size="icon"
          title="Cerrar el buscador"
          onClick={() => setAbierto(false)}
        >
          <X aria-hidden />
          <span className="sr-only">Cerrar el buscador</span>
        </Button>
      </div>

      <DialogoDeAgregar
        numero={numero}
        variante={elegida}
        cerrar={() => setElegida(null)}
        alAgregar={() => {
          setElegida(null);
          setAbierto(false);
        }}
      />
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
function DialogoDeAgregar({
  numero,
  variante,
  cerrar,
  alAgregar,
}: {
  numero: number;
  variante: VarianteParaLaOrden | null;
  cerrar: () => void;
  alAgregar: () => void;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);

  const hay = variante?.disponible ?? 0;

  function agregar() {
    if (!variante) return;
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
      alAgregar();
    });
  }

  return (
    <Dialog
      open={variante !== null}
      onOpenChange={(v) => {
        if (v) return;
        setError(null);
        setCantidad(1);
        cerrar();
      }}
    >
      <DialogContent>
        {variante === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>
                Agregar {variante.nombre}
                {variante.color ? ` (${variante.color.toLowerCase()})` : ""} a
                la orden #{numero}
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
                  <label
                    htmlFor="cantidad-agregar"
                    className="text-body-sm text-ink"
                  >
                    Cantidad
                  </label>
                  <Select
                    id="cantidad-agregar"
                    value={cantidad}
                    onChange={(e) =>
                      setCantidad(Number.parseInt(e.target.value, 10))
                    }
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
                  <strong className="font-medium text-ink">
                    {hay - cantidad}
                  </strong>
                  .
                </p>

                <AvisoAlComprador />
              </>
            ) : null}

            {error === null ? null : (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
                {hay > 0 ? "Mejor no" : "Entendido"}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
