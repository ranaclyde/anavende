"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
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
  aumentarCantidadDelItem,
  quitarItemDeLaOrden,
  reducirCantidadDelItem,
} from "@/modules/orders/actions-panel";
import type { ItemDeLaOrdenDelPanel } from "@/modules/orders/queries-panel";

/**
 * Editar un renglón de una orden activa — FS RF-22. Tareas F7.2 y F7.2a.
 *
 * **Tres acciones y tres diálogos, no uno con opciones.** Subir, bajar y
 * quitar se parecen —las tres mueven la misma reserva— y son decisiones
 * distintas: una compromete stock y puede no entrar, otra lo libera, y la
 * tercera saca el producto y, si era el único, cancela la orden. El propio
 * dominio las separa y se niega a colarse de una a otra por un número
 * (`editar.ts`). Juntarlas acá en un selector que va de cero a lo que haya
 * devolvería esa confusión por la pantalla.
 *
 * **Las tres preguntan, y las tres dicen qué pasa con el stock**, que es el
 * número con el que se decide. Con una diferencia de fondo entre ellas:
 * bajar y quitar **siempre se pueden**; subir puede no poderse, y entonces el
 * diálogo dice cuántas quedan en vez de fallar y ya.
 *
 * **Quitar no se puede deshacer** (de `cancelada` no se sale, RF-13), pero
 * bajar la cantidad sí: desde F7.2a se vuelve a subir mientras haya stock, y
 * los textos lo dicen así en vez de prometer lo contrario.
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
  const [abierto, setAbierto] = useState<
    "subir" | "cantidad" | "quitar" | null
  >(null);

  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* **Subir está siempre, aunque no haya stock.** Al revés que bajar, acá
          la razón por la que no se puede no se ve en la pantalla —el
          disponible es de otra tabla—, y un botón ausente sin explicación
          deja a quien mira preguntándose si el producto se agotó o si el
          panel no lo permite. El diálogo lo contesta. */}
      <Button
        variant="tertiary"
        size="icon"
        title="Subir la cantidad"
        onClick={() => setAbierto("subir")}
      >
        <Plus aria-hidden />
        <span className="sr-only">Subir la cantidad de {item.nombre}</span>
      </Button>

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

      <DialogoDeSubir
        abierto={abierto === "subir"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        item={item}
      />
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

/**
 * Subir la cantidad de un renglón — RF-22 (F7.2a).
 *
 * **El tope del selector es lo que hay disponible**, no un número grande: si
 * quedan tres, ofrecer diez es ofrecer siete que van a volver como error. Y si
 * no queda ninguna, el diálogo lo dice y no hay nada que elegir — es el «se
 * dice cuánto hay» del requisito, dicho antes de intentar y no después.
 *
 * **El precio no se toca**, y por eso no hay campo de precio: las unidades
 * nuevas van al de este renglón, que es el que el comprador aceptó. Para otro
 * precio existe la orden manual (RF-24).
 */
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

  // `disponible` en `null` es la variante borrada (§5.6): no hay contador que
  // reservar, así que tampoco hay unidades para ofrecer.
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
        // Puede ser INSUFFICIENT_STOCK: entre que se pintó la pantalla y
        // llegó el clic, otra orden pudo llevarse esas unidades. El mensaje
        // que arma el dominio dice cuántas quedan ahora.
        setError(r.message);
        return;
      }
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

/**
 * Lo que RF-22 pide que la pantalla recuerde: **el sistema no le avisa al
 * comprador**. No hay emails de cambios (FA-07); lo que sí pasa solo es que
 * «Mis compras» le muestra la orden ya cambiada, con su total nuevo.
 */
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
