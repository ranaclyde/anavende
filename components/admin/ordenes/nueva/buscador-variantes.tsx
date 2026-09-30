"use client";

import { Check, Plus } from "lucide-react";
import { useId, useState } from "react";

import {
  ALTO_DEL_DIALOGO,
  CuerpoDeBusqueda,
  RENGLON_DE_RESULTADO,
  useBusqueda,
} from "@/components/admin/ordenes/nueva/busqueda";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { buscarVariantes } from "@/modules/orders/actions-manual";
import type { VarianteParaLaOrden } from "@/modules/orders/queries-manual";

async function buscar(q: string) {
  const r = await buscarVariantes({ q });
  return r.ok ? r.data.resultados : [];
}

/**
 * Buscar un producto para agregarlo a una orden — FS RF-24. Tarea F7.4.
 *
 * **Es el cuerpo de un diálogo, no un campo de la página** (2026-09-30):
 * con la lista debajo del campo, cada búsqueda empujaba el formulario o la
 * orden hacia abajo. Lo usan la orden manual (`AgregarProductos`, abajo) y
 * agregar a una orden activa (F7.2a, `agregar-item.tsx`).
 *
 * **Busca variantes, no productos**: lo que entra en una orden es un color
 * concreto, y elegir primero el producto y después el color serían dos pasos
 * donde alcanza con uno.
 *
 * **Muestra el disponible de cada uno**, que es el número con el que se
 * decide. Lo dado de baja aparece marcado y se puede elegir igual: una venta
 * a mano puede ser la del último que quedaba de algo que ya se sacó del
 * catálogo — el requisito no la prohíbe y esconderla obligaría a reactivar un
 * producto para poder anotar que se vendió.
 */
export function BuscadorDeVariantes({
  alElegir,
  enLaOrden,
  id,
}: {
  alElegir: (variante: VarianteParaLaOrden) => void;
  /** Cuántos renglones de cada color ya tiene la orden, para marcarlos. */
  enLaOrden?: ReadonlyMap<string, number>;
  /** El id del campo, para que quien lo contiene pueda devolverle el foco. */
  id?: string;
}) {
  const [termino, setTermino] = useState("");
  const { resultados, buscando } = useBusqueda(termino, buscar);
  const propio = useId();
  const campo = id ?? propio;

  return (
    <CuerpoDeBusqueda
      campo={campo}
      etiqueta="Buscar un producto"
      placeholder="Nombre del producto o marca"
      termino={termino}
      alCambiar={setTermino}
      buscando={buscando}
      cantidad={resultados.length}
      inicial="Escribí el nombre del producto o la marca."
      vacio={`No hay productos que coincidan con «${termino.trim()}».`}
    >
      {resultados.map((v) => {
        const yaEsta = enLaOrden?.get(v.variantId) ?? 0;
        return (
          <li
            key={v.variantId}
            className="border-b border-border last:border-b-0"
          >
            <button
              type="button"
              // **Elegir no vacía la búsqueda** (2026-09-30). Antes sí, porque
              // la lista vivía en la página y había que sacarla del medio;
              // en el diálogo no molesta, y quedarse deja ver la marca de
              // «Ya en la orden» como confirmación y elegir otro color de lo
              // mismo sin volver a escribirlo.
              onClick={() => alElegir(v)}
              className={RENGLON_DE_RESULTADO}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                {/* Sin `truncate`: a 390px se comía el color, que es justo lo
                    que distingue un renglón del de abajo. */}
                <span className="text-body-sm text-ink">
                  {v.nombre}
                  {v.color ? (
                    <span className="text-ink-secondary"> · {v.color}</span>
                  ) : null}
                </span>
                <span className="text-caption text-ink-secondary">
                  {v.marca}
                  {v.inactiva ? " · dado de baja" : ""}
                </span>
                {yaEsta > 0 ? (
                  <span className="flex items-center gap-1 text-caption text-success">
                    <Check aria-hidden className="size-3" />
                    Ya en la orden
                    {yaEsta > 1 ? ` (${yaEsta} renglones)` : ""}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-body-sm text-ink tabular-nums">
                  {formatMoney(v.precio)}
                </span>
                <span
                  className={
                    v.disponible > 0
                      ? "block text-caption text-ink-secondary tabular-nums"
                      : "block text-caption text-danger tabular-nums"
                  }
                >
                  {v.disponible > 0
                    ? `${v.disponible} disponible${v.disponible === 1 ? "" : "s"}`
                    : "sin stock"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </CuerpoDeBusqueda>
  );
}

/**
 * «Agregar productos» de la orden manual: el botón y el diálogo.
 *
 * **El diálogo queda abierto después de elegir** (decisión del 2026-09-30):
 * una venta a mano suele ser de varios productos, y cerrarlo con cada uno
 * obligaría a abrirlo otra vez para el siguiente. Lo ya elegido queda
 * marcado en la lista y el pie dice cuántos renglones lleva la orden.
 *
 * El precio no se edita acá: se edita en el renglón, en el formulario, que
 * es donde se ve al lado del total.
 */
export function AgregarProductos({
  id,
  renglones,
  enLaOrden,
  alElegir,
}: {
  /** Para que el formulario pueda enfocar acá cuando falta un ítem. */
  id?: string;
  renglones: number;
  enLaOrden: ReadonlyMap<string, number>;
  alElegir: (variante: VarianteParaLaOrden) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ultimo, setUltimo] = useState("");

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setUltimo("");
      }}
    >
      <Button
        id={id}
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setAbierto(true)}
      >
        <Plus aria-hidden />
        Agregar productos
      </Button>

      <DialogContent className={ALTO_DEL_DIALOGO}>
        <DialogHeader>
          <DialogTitle>Agregar productos</DialogTitle>
          <DialogDescription>
            Elegí los que quieras: cada uno se suma a la orden y podés seguir
            buscando. El precio se ajusta después, en la lista.
          </DialogDescription>
        </DialogHeader>

        <BuscadorDeVariantes
          enLaOrden={enLaOrden}
          alElegir={(v) => {
            alElegir(v);
            setUltimo(
              `Agregaste ${v.nombre}${v.color ? ` (${v.color.toLowerCase()})` : ""}.`,
            );
          }}
        />

        {/* En una fila también en el teléfono: el primitivo apila el pie
            para dos botones, y acá hay uno solo y una línea de estado. */}
        <DialogFooter className="flex-row items-center justify-between">
          <p aria-live="polite" className="text-body-sm text-ink-secondary">
            {ultimo ||
              (renglones === 0
                ? "Todavía no hay productos en la orden."
                : `${renglones} ${renglones === 1 ? "producto" : "productos"} en la orden.`)}
          </p>
          <Button
            type="button"
            variant="brand"
            onClick={() => setAbierto(false)}
          >
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
