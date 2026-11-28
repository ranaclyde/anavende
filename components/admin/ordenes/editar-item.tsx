"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

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
import {
  aumentarCantidadDelItem,
  quitarItemDeLaOrden,
  reducirCantidadDelItem,
} from "@/modules/orders/actions-panel";
import type { ItemDeLaOrdenDelPanel } from "@/modules/orders/queries-panel";

/**
 * Subir, bajar y quitar son tres diálogos y no un selector, como en el
 * dominio (`editar.ts`): una compromete stock, otra lo libera, y la tercera
 * puede cancelar la orden.
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
  const [abierto, setAbierto] = useState<
    "subir" | "cantidad" | "quitar" | null
  >(null);

  return (
    // `w-fit` y `ml-auto`: la guía resalta esta caja, y a todo el ancho
    // marcaba un recuadro vacío.
    <div
      data-ayuda="ajustar-renglon"
      // Separados en la tablet: a 2px se tocaban con el mismo dedo.
      className="ml-auto flex w-fit items-center gap-0.5 max-lg:gap-2"
    >
      {/* Subir está siempre, aunque no haya stock: el diálogo dice por qué
          no se puede. */}
      <Button
        variant="tertiary"
        size="icon"
        title="Subir la cantidad"
        onClick={() => setAbierto("subir")}
      >
        <Plus aria-hidden />
        <span className="sr-only">Subir la cantidad de {item.nombre}</span>
      </Button>

      {/* Con una sola unidad no hay a qué bajar. */}
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
        variant="destructive-ghost"
        size="icon"
        title="Quitar de la orden"
        onClick={() => setAbierto("quitar")}
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Quitar {item.nombre} de la orden</span>
      </Button>

      {/* `key` con la cantidad: el selector toma `item.cantidad` solo al
          montar, y sin la clave quedaba con el número viejo. */}
      <DialogoDeSubir
        key={`subir-${item.cantidad}`}
        abierto={abierto === "subir"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        item={item}
      />
      <DialogoDeCantidad
        key={`bajar-${item.cantidad}`}
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

function nombrar(item: ItemDeLaOrdenDelPanel): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/**
 * Una variante borrada llega con `disponible` en `null` (§5.6): se dice, no
 * se inventa un número.
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
      {cuantas === 1 ? "Se libera 1 unidad" : `Se liberan ${cuantas} unidades`}:
      el disponible de {nombrar(item)} pasa de{" "}
      <strong className="font-medium text-ink">{item.disponible}</strong> a{" "}
      <strong className="font-medium text-ink">
        {item.disponible + cuantas}
      </strong>
      .
    </>
  );
}

/** Las unidades nuevas van al precio que aceptó el comprador. */
function DialogoDeSubir({
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
  const [cantidad, setCantidad] = useState(item.cantidad + 1);

  const hay = item.disponible ?? 0;
  const opciones = Array.from({ length: hay }, (_, i) => item.cantidad + i + 1);

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await aumentarCantidadDelItem({
        numero,
        itemId: item.id,
        cantidad,
      });
      if (!r.ok) {
        // INSUFFICIENT_STOCK si otra orden se llevó las unidades entre medio.
        setError(r.message);
        return;
      }
      avisar(`${nombrar(item)} queda en ${cantidad} en la orden #${numero}.`);
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir la cantidad de {item.nombre}</DialogTitle>
          <DialogDescription>
            {item.disponible === null
              ? "Ese color ya no está en el catálogo, así que no se le pueden sumar unidades."
              : hay === 0
                ? `No queda stock disponible de ${nombrar(item)}, así que no hay unidades para sumar. Cargá stock y volvé a intentar.`
                : `La orden #${numero} tiene ${item.cantidad} ${item.cantidad === 1 ? "unidad" : "unidades"}. Elegí con cuántas queda: lo que sumes se reserva enseguida.`}
          </DialogDescription>
        </DialogHeader>

        {hay > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <label htmlFor="cantidad-mas" className="text-body-sm text-ink">
                Queda con
              </label>
              <Select
                id="cantidad-mas"
                value={cantidad}
                onChange={(e) =>
                  setCantidad(Number.parseInt(e.target.value, 10))
                }
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
              {cantidad - item.cantidad === 1
                ? "Se reserva 1 unidad"
                : `Se reservan ${cantidad - item.cantidad} unidades`}
              : el disponible de {nombrar(item)} pasa de{" "}
              <strong className="font-medium text-ink">{hay}</strong> a{" "}
              <strong className="font-medium text-ink">
                {hay - (cantidad - item.cantidad)}
              </strong>
              . Las unidades nuevas van al precio de este renglón.
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
            {hay > 0 ? "Dejarlo como está" : "Entendido"}
          </Button>
          {hay > 0 ? (
            <Button
              variant="brand"
              loading={enCurso}
              loadingLabel="Guardando"
              onClick={guardar}
            >
              Subir a {cantidad}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** RF-22: el sistema no le avisa al comprador de los cambios (FA-07). */
export function AvisoAlComprador() {
  return (
    <p className="rounded-panel-control bg-surface-sunken px-3 py-2 text-caption text-ink-secondary">
      El comprador no recibe ningún aviso: en «Mis compras» va a ver la orden
      cambiada, con el total nuevo. Contale vos por WhatsApp.
    </p>
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
      // Hay que cerrarlo a mano: el renglón sigue montado y el diálogo
      // quedaría abierto con el número viejo.
      avisar(`${nombrar(item)} queda en ${cantidad} en la orden #${numero}.`);
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
            queda; lo que saques vuelve al stock enseguida. Si después hacen
            falta de nuevo, se vuelven a sumar mientras haya stock.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <label htmlFor="cantidad-nueva" className="text-body-sm text-ink">
            Queda con
          </label>
          <Select
            id="cantidad-nueva"
            value={cantidad}
            // `parseInt`: la regla contra `Number` cuida los montos (§7.1).
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
        // Si otra pestaña lo dejó como el único, `quitarItem` se niega en vez
        // de cancelar sola.
        cancelarSiEsElUltimo: esElUnico,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Casi siempre redundante (el renglón se desmonta), pero no hay que
      // depender del orden en que desmonta React.
      avisar(
        esElUnico
          ? `Quitaste ${nombrar(item)}, que era el único renglón: la orden #${numero} quedó cancelada.`
          : `Quitaste ${nombrar(item)} de la orden #${numero}.`,
      );
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
              : "Sale de la orden y el total se recalcula. Volver a ponerlo es agregarlo de nuevo, y para eso tiene que haber stock."}
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
          <Button variant="secondary" disabled={enCurso} onClick={cerrar}>
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
