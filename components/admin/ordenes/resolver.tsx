"use client";

import { Check, X } from "lucide-react";
import { useId, useState, useTransition } from "react";

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
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelarLaOrden,
  finalizarLaOrden,
} from "@/modules/orders/actions-panel";
import { MAXIMO_DEL_MOTIVO } from "@/modules/orders/schemas-panel";

/**
 * Finalizar o cancelar una orden activa — FS RF-23. Tarea F7.3.
 *
 * **Las dos salidas de la orden, juntas y a la misma altura**, porque son la
 * misma pregunta: este pedido ¿se entregó o no se entregó? Repartirlas —una
 * arriba y la otra al pie, o una detrás de un menú— obligaría a buscar la
 * segunda justo cuando ya se decidió cuál de las dos es.
 *
 * **Ninguna tiene vuelta** (RF-13): de `finalizada` y de `cancelada` no se
 * sale, y por eso las dos preguntan antes. No es la confirmación por reflejo
 * de todo botón rojo — es que acá el error no se arregla con otro clic.
 *
 * **Y las dos dicen qué le pasa al stock**, que es lo que pide el plan y lo
 * que no se puede deducir mirando la pantalla. Cada una mira un contador
 * distinto, y confundirlos sería mostrar un número que no va a pasar:
 * finalizar baja el stock real —la reserva ya estaba descontada del
 * disponible—, y cancelar sube el disponible sin tocar el stock real.
 */
export function ResolverLaOrden({
  numero,
  items,
  loLeeElComprador,
}: {
  numero: number;
  items: RenglonParaResolver[];
  /** Si la orden es de una cuenta, el motivo de la cancelación lo va a leer. */
  loLeeElComprador: boolean;
}) {
  const [abierto, setAbierto] = useState<"finalizar" | "cancelar" | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="brand" size="sm" onClick={() => setAbierto("finalizar")}>
        <Check aria-hidden />
        Finalizar
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => setAbierto("cancelar")}
      >
        <X aria-hidden />
        Cancelar la orden
      </Button>

      <DialogoDeFinalizar
        abierto={abierto === "finalizar"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        items={items}
      />
      <DialogoDeCancelar
        abierto={abierto === "cancelar"}
        cerrar={() => setAbierto(null)}
        numero={numero}
        items={items}
        loLeeElComprador={loLeeElComprador}
      />
    </div>
  );
}

/**
 * Lo que el diálogo necesita de cada renglón, y nada más: el precio y el
 * subtotal están en la tabla de al lado y no cambian con esto.
 */
export type RenglonParaResolver = {
  id: string;
  nombre: string;
  color: string | null;
  cantidad: number;
  /** Total − reservado. Lo que sube al cancelar. `null` si la variante no está. */
  disponible: number | null;
  /** El stock real. Lo que baja al finalizar. `null` si la variante no está. */
  stock: number | null;
};

/** «Auricular Cloud II (negro)», como lo nombran el historial y F7.2. */
function nombrar(item: RenglonParaResolver): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/**
 * El impacto en stock, renglón por renglón.
 *
 * `contador` es el número de hoy y `despues` el de después; una variante
 * borrada (§5.6) llega con el contador en `null` y se dice, en vez de mostrar
 * un cero que significaría otra cosa — el renglón sigue en la orden porque el
 * snapshot sobrevive, pero ya no hay nada que mover.
 */
function Impacto({
  items,
  contador,
  despues,
}: {
  items: RenglonParaResolver[];
  contador: (item: RenglonParaResolver) => number | null;
  despues: (actual: number, item: RenglonParaResolver) => number;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const actual = contador(item);

        return (
          <li key={item.id} className="text-body-sm text-ink-secondary">
            {nombrar(item)}:{" "}
            {actual === null ? (
              "ya no está en el catálogo, no hay stock que mover."
            ) : (
              <>
                de <strong className="font-medium text-ink">{actual}</strong> a{" "}
                <strong className="font-medium text-ink">
                  {despues(actual, item)}
                </strong>
                .
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DialogoDeFinalizar({
  abierto,
  cerrar,
  numero,
  items,
}: {
  abierto: boolean;
  cerrar: () => void;
  numero: number;
  items: RenglonParaResolver[];
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function finalizar() {
    setError(null);
    iniciar(async () => {
      const r = await finalizarLaOrden({ numero });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // La orden deja de estar activa y estos botones se van con el refresco,
      // pero cerrar no depende de en qué orden desmonte React (F7.2).
      avisar(`La orden #${numero} quedó finalizada.`);
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalizar la orden #{numero}</DialogTitle>
          <DialogDescription>
            Es la orden entregada y cobrada. Queda cerrada: una finalizada no
            vuelve a activa ni se cancela después, y editarla tampoco se puede.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-ink">Se descuenta del stock:</p>
          <Impacto
            items={items}
            contador={(item) => item.stock}
            despues={(actual, item) => actual - item.cantidad}
          />
          {/*
            El número que la vendedora ve en el catálogo es el disponible, y
            no se va a mover con esto: estas unidades ya estaban apartadas
            desde que entró la orden (§8.1). Sin decirlo, el catálogo después
            parece no haberse enterado.
          */}
          <p className="text-caption text-ink-tertiary">
            El disponible no cambia: estas unidades ya estaban reservadas para
            esta orden desde que se hizo.
          </p>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            Todavía no
          </Button>
          <Button
            variant="brand"
            loading={enCurso}
            loadingLabel="Finalizando"
            onClick={finalizar}
          >
            Finalizar la orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoDeCancelar({
  abierto,
  cerrar,
  numero,
  items,
  loLeeElComprador,
}: {
  abierto: boolean;
  cerrar: () => void;
  numero: number;
  items: RenglonParaResolver[];
  loLeeElComprador: boolean;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const campo = useId();

  function cancelar() {
    setError(null);
    iniciar(async () => {
      const r = await cancelarLaOrden({ numero, motivo });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Nombra lo que la pantalla NO muestra: que el stock volvió. La
      // insignia de arriba ya dice «Cancelada».
      avisar(
        `Cancelaste la orden #${numero} y se liberó lo que tenía reservado.`,
      );
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar la orden #{numero}</DialogTitle>
          <DialogDescription>
            El pedido no se entrega y se libera todo lo que tenía reservado. No
            hay vuelta atrás: si después se retoma, hay que cargarlo de nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-ink">Vuelve al disponible:</p>
          <Impacto
            items={items}
            contador={(item) => item.disponible}
            despues={(actual, item) => actual + item.cantidad}
          />
        </div>

        {/*
          Opcional, porque RF-23 dice que la administradora *puede* registrar
          un motivo. Y dicho dónde termina: es la diferencia entre escribir
          «no hay stock del rojo» y escribir una nota para uno mismo.
        */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo}>Motivo (opcional)</Label>
          <Textarea
            id={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAXIMO_DEL_MOTIVO}
            // El alto por defecto del campo es para un párrafo, y esto es una
            // frase: «no contestó», «se quedó sin stock». `field-sizing-content`
            // lo estira solo si hace falta.
            className="min-h-16"
            rows={2}
            placeholder="Nos quedamos sin stock del rojo"
            aria-describedby={`${campo}-ayuda`}
          />
          <p id={`${campo}-ayuda`} className="text-caption text-ink-tertiary">
            {loLeeElComprador
              ? "Queda en el historial de la orden y el comprador lo ve en su compra."
              : "Queda en el historial de la orden. Esta orden no tiene cuenta asociada, así que nadie más lo va a ver."}
          </p>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            No, dejarla activa
          </Button>
          <Button
            variant="destructive-solid"
            loading={enCurso}
            loadingLabel="Cancelando"
            onClick={cancelar}
          >
            Cancelar la orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
