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
 * Cada salida mira un contador distinto: finalizar baja el stock real (la
 * reserva ya estaba descontada del disponible); cancelar sube el disponible.
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
    <div
      data-ayuda="resolver-orden"
      className="flex flex-wrap items-center gap-2"
    >
      <Button variant="brand" size="sm" onClick={() => setAbierto("finalizar")}>
        <Check aria-hidden />
        Finalizar
      </Button>

      {/* Contorno pizarra y no rojo: al lado del burdeos, a 7° de matiz, se
          confundían en el teléfono. */}
      <Button
        variant="secondary"
        size="sm"
        className="border-accent text-accent hover:border-accent-hover hover:bg-accent-tint hover:text-accent-hover"
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

function nombrar(item: RenglonParaResolver): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

/**
 * Una variante borrada (§5.6) llega con el contador en `null`: se dice, no
 * se muestra un cero.
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
          {/* Sin esto, el catálogo parece no haberse enterado (§8.1). */}
          <p className="text-caption text-ink-secondary">
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
          <Button variant="secondary" disabled={enCurso} onClick={cerrar}>
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

        {/* Opcional (RF-23). */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo}>Motivo (opcional)</Label>
          <Textarea
            id={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAXIMO_DEL_MOTIVO}
            // Es una frase, no un párrafo; `field-sizing-content` lo estira.
            className="min-h-16"
            rows={2}
            aria-describedby={`${campo}-ayuda`}
          />
          <p id={`${campo}-ayuda`} className="text-caption text-ink-secondary">
            {loLeeElComprador
              ? "Por ejemplo: «sin stock del rojo». El comprador lo puede ver."
              : "Por ejemplo: «no contestó». Queda en el historial."}
          </p>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" disabled={enCurso} onClick={cerrar}>
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
