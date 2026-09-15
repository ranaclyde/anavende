"use client";

import { Minus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

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
import {
  quitarItemDeLaOrden,
  reducirCantidadDelItem,
} from "@/modules/orders/actions-panel";
import type { ItemDeLaOrdenDelPanel } from "@/modules/orders/queries-panel";

/**
 * Editar un renglón de una orden activa — FS RF-22. Tarea F7.2.
 *
 * **Dos acciones y dos diálogos, no uno con opciones.** Bajar la cantidad y
 * quitar el renglón se parecen —las dos sueltan reserva— y son decisiones
 * distintas: una deja el producto en la orden y la otra lo saca, y si es el
 * único, además la cancela. El propio dominio ya las separa y se niega a
 * colarse de una a la otra por un cero (`editar.ts`). Juntarlas acá en un
 * selector que llega hasta cero sería devolver esa confusión por la pantalla.
 *
 * **Las dos preguntan, y las dos dicen qué pasa con el stock.** Ninguna se
 * puede deshacer: RF-22 no tiene «volver a agregar» —habría que reservar de
 * nuevo y puede no haber— y RF-13 no deja salir de `cancelada`. Y lo que se
 * libera es lo que importa: el diálogo dice en cuánto queda el disponible,
 * que es el número con el que se decide si conviene o no.
 *
 * La isla es chica: la orden entera se pinta en el servidor y acá queda sólo
 * lo que responde al clic.
 */
export function EditarElRenglon({
  numero,
  item,
  esElUnico,
}: {
  numero: number;
  item: ItemDeLaOrdenDelPanel;
  /** Si es el único renglón, quitarlo cancela la orden (RF-22). */
  esElUnico: boolean;
}) {
  const [abierto, setAbierto] = useState<"cantidad" | "quitar" | null>(null);

  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Con una sola unidad no hay a qué bajar: lo único que se puede hacer
          con ese renglón es quitarlo, y el botón que no sirve no está. */}
      {item.cantidad > 1 ? (
        <Button
          variant="tertiary"
          size="icon"
          title="Bajar la cantidad"
          onClick={() => setAbierto("cantidad")}
        >
          <Minus aria-hidden />
          <span className="sr-only">Bajar la cantidad de {item.nombre}</span>
        </Button>
      ) : null}

      <Button
        variant="tertiary"
        size="icon"
        title="Quitar de la orden"
        className="text-ink-secondary hover:text-danger"
        onClick={() => setAbierto("quitar")}
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Quitar {item.nombre} de la orden</span>
      </Button>

      <DialogoDeCantidad
        abierto={abierto === "cantidad"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        item={item}
      />
      <DialogoDeQuitar
        abierto={abierto === "quitar"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        item={item}
        esElUnico={esElUnico}
      />
    </div>
  );
}

/** «Auricular Cloud II (negro)», como lo nombra el historial. */
function nombrar(item: ItemDeLaOrdenDelPanel): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/**
 * Qué pasa con el stock al soltar `cuantas` unidades de este renglón.
 *
 * Una variante borrada llega con `disponible` en `null` (§5.6): el renglón
 * se lee igual —el snapshot sobrevive— pero no hay contador que mover, y
 * decirlo es mejor que mostrar un número inventado.
 */
function ImpactoEnElStock({
  item,
  cuantas,
}: {
  item: ItemDeLaOrdenDelPanel;
  cuantas: number;
}) {
  if (item.disponible === null) {
    return (
      <>
        Ese color ya no está en el catálogo, así que no hay stock que devolver.
      </>
    );
  }

  return (
    <>
      Se liberan {cuantas} {cuantas === 1 ? "unidad" : "unidades"}: el
      disponible de {nombrar(item)} pasa de{" "}
      <strong className="font-medium text-ink">{item.disponible}</strong> a{" "}
      <strong className="font-medium text-ink">
        {item.disponible + cuantas}
      </strong>
      .
    </>
  );
}

function DialogoDeCantidad({
  abierto,
  cerrar,
  numero,
  item,
}: {
  abierto: boolean;
  cerrar: () => void;
  numero: number;
  item: ItemDeLaOrdenDelPanel;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Arranca en una menos: es el movimiento que se hace nueve de cada diez
  // veces, y deja el diálogo listo para confirmar sin tocar el selector.
  const [cantidad, setCantidad] = useState(item.cantidad - 1);

  const opciones = Array.from({ length: item.cantidad - 1 }, (_, i) => i + 1);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await reducirCantidadDelItem({
        numero,
        itemId: item.id,
        cantidad,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // **Acá sí hay que cerrarlo a mano**, al revés de «Cancelar el pedido»
      // de la tienda (F6.5): allá el componente desaparecía con el refresco y
      // el diálogo se iba con él. Bajar la cantidad deja el renglón donde
      // estaba, así que sin esto el diálogo queda abierto mostrando el número
      // viejo sobre una tabla que ya se actualizó. Lo encontró el repaso.
      //
      // Va después del `await`: para entonces el refresco ya llegó con la
      // acción, y las dos cosas se pintan juntas.
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bajar la cantidad de {item.nombre}</DialogTitle>
          <DialogDescription>
            La orden #{numero} tiene {item.cantidad} unidades. Elegí con cuántas
            queda; lo que saques vuelve al stock enseguida. Después no se pueden
            volver a agregar desde acá.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <label htmlFor="cantidad-nueva" className="text-body-sm text-ink">
            Queda con
          </label>
          <Select
            id="cantidad-nueva"
            value={cantidad}
            // `parseInt` y no `Number`: la regla de lint que prohíbe `Number`
            // cuida los montos (§7.1), y acá lo que se lee es una cantidad
            // entera. Escribirlo así deja dicho cuál de las dos cosas es.
            onChange={(e) => setCantidad(Number.parseInt(e.target.value, 10))}
            className="w-28"
          >
            {opciones.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-body-sm text-ink-secondary">
          <ImpactoEnElStock item={item} cuantas={item.cantidad - cantidad} />
        </p>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            Dejarlo como está
          </Button>
          <Button
            variant="brand"
            loading={enCurso}
            loadingLabel="Guardando"
            onClick={guardar}
          >
            Bajar a {cantidad}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoDeQuitar({
  abierto,
  cerrar,
  numero,
  item,
  esElUnico,
}: {
  abierto: boolean;
  cerrar: () => void;
  numero: number;
  item: ItemDeLaOrdenDelPanel;
  esElUnico: boolean;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function quitar() {
    setError(null);
    iniciar(async () => {
      const r = await quitarItemDeLaOrden({
        numero,
        itemId: item.id,
        // Lo que la pantalla sabe al pintarse. Quien decide de verdad es el
        // dominio: si entre medio otra pestaña dejó este renglón como el
        // único, `quitarItem` se niega y lo explica en vez de cancelar sola.
        cancelarSiEsElUltimo: esElUnico,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // El renglón se va y este componente con él, así que cerrar sería casi
      // siempre redundante. Casi: si quitar el último canceló la orden, la
      // pantalla se repinta entera y conviene no depender de en qué orden
      // desmonta React.
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esElUnico
              ? `Quitar ${item.nombre} y cancelar la orden #${numero}`
              : `Quitar ${item.nombre} de la orden #${numero}`}
          </DialogTitle>
          <DialogDescription>
            {esElUnico
              ? "Es el único producto de la orden, así que sacarlo la deja vacía y la cancela. No hay vuelta atrás: si después hace falta, se carga de nuevo."
              : "Sale de la orden y el total se recalcula. Esto no se puede deshacer: volver a agregarlo no se hace desde acá."}
          </DialogDescription>
        </DialogHeader>

        <p className="text-body-sm text-ink-secondary">
          <ImpactoEnElStock item={item} cuantas={item.cantidad} />
        </p>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            No, dejarlo
          </Button>
          <Button
            variant="destructive-solid"
            loading={enCurso}
            loadingLabel="Quitando"
            onClick={quitar}
          >
            {esElUnico ? "Quitar y cancelar la orden" : "Quitar de la orden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
