"use client";

import { Undo2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { leerErrores } from "@/lib/form";
import { registrarUnaDevolucion } from "@/modules/returns/actions";
import { MAXIMO_DEL_MOTIVO } from "@/modules/returns/schemas";

/** Sólo si la orden está finalizada y queda algo por devolver (RF-25). */
export type RenglonParaDevolver = {
  id: string;
  nombre: string;
  color: string | null;
  cantidad: number;
  /** Sólo devoluciones registradas: las anuladas liberan cupo. */
  yaDevueltas: number;
  /** El total, que sube al reponer. `null` si la variante ya no está. */
  stock: number | null;
};

function porDevolver(item: RenglonParaDevolver): number {
  return item.cantidad - item.yaDevueltas;
}

function nombrar(item: RenglonParaDevolver): string {
  return item.color
    ? `${item.nombre} (${item.color.toLowerCase()})`
    : item.nombre;
}

type Eleccion = {
  elegido: boolean;
  cantidad: number;
  repone: boolean;
  motivo: string;
};

export function DevolverDeLaOrden({
  numero,
  items,
}: {
  numero: number;
  items: RenglonParaDevolver[];
}) {
  const [abierto, setAbierto] = useState(false);
  // Se monta de nuevo en cada apertura, para no arrastrar lo de la anterior.
  const [aperturas, setAperturas] = useState(0);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setAperturas((n) => n + 1);
          setAbierto(true);
        }}
      >
        <Undo2 aria-hidden />
        Registrar devolución
      </Button>

      <DialogoDeDevolver
        key={aperturas}
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        numero={numero}
        items={items}
      />
    </>
  );
}

function DialogoDeDevolver({
  abierto,
  cerrar,
  numero,
  items,
}: {
  abierto: boolean;
  cerrar: () => void;
  numero: number;
  items: RenglonParaDevolver[];
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorDeItems, setErrorDeItems] = useState<string | null>(null);
  const [errorDelMotivo, setErrorDelMotivo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const campo = useId();

  const devolubles = items.filter((item) => porDevolver(item) > 0);
  const unoSolo = devolubles.length === 1;

  const [elecciones, setElecciones] = useState<Record<string, Eleccion>>(() =>
    Object.fromEntries(
      devolubles.map((item) => [
        item.id,
        {
          elegido: unoSolo,
          cantidad: porDevolver(item),
          repone: true,
          motivo: "",
        },
      ]),
    ),
  );

  const cambiar = (id: string, cambios: Partial<Eleccion>) =>
    setElecciones((previas) => ({
      ...previas,
      [id]: { ...previas[id], ...cambios },
    }));

  const elegidos = devolubles.filter((item) => elecciones[item.id]?.elegido);
  const reponen = elegidos.filter(
    (item) => elecciones[item.id].repone && item.stock !== null,
  );

  function registrar() {
    setError(null);
    setErrorDeItems(null);
    setErrorDelMotivo(null);

    iniciar(async () => {
      const r = await registrarUnaDevolucion({
        numero,
        motivo,
        items: elegidos.map((item) => ({
          itemId: item.id,
          cantidad: elecciones[item.id].cantidad,
          repone: elecciones[item.id].repone,
          motivo: elecciones[item.id].motivo,
        })),
      });

      if (!r.ok) {
        // `RETURN_EXCEEDS_SOLD` si entre medio se registró otra devolución del
        // mismo renglón.
        const errores = leerErrores<"motivo" | "items">(r);
        setErrorDeItems(errores.campos.items ?? null);
        setErrorDelMotivo(errores.campos.motivo ?? null);
        setError(errores.general);
        return;
      }

      avisar(
        `Registraste la devolución de ${elegidos.length === 1 ? "1 renglón" : `${elegidos.length} renglones`} de la orden #${numero}.`,
      );
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Registrar una devolución de la orden #{numero}
          </DialogTitle>
          <DialogDescription>
            Elegí qué vuelve y cuánto. Por cada producto decidí si vuelve al
            stock —está en condiciones y se puede vender— o no, que es lo que
            pasa con lo defectuoso: se registra igual, pero no suma nada.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {devolubles.map((item) => (
            <RenglonDevuelto
              key={item.id}
              item={item}
              eleccion={elecciones[item.id]}
              soloUno={unoSolo}
              alCambiar={(cambios) => cambiar(item.id, cambios)}
            />
          ))}
        </ul>

        <FieldError>{errorDeItems}</FieldError>

        {reponen.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-body-sm text-ink">Vuelve al stock:</p>
            <ul className="flex flex-col gap-1">
              {reponen.map((item) => (
                <li key={item.id} className="text-body-sm text-ink-secondary">
                  {nombrar(item)}: de{" "}
                  <strong className="font-medium text-ink">{item.stock}</strong>{" "}
                  a{" "}
                  <strong className="font-medium text-ink">
                    {item.stock! + elecciones[item.id].cantidad}
                  </strong>
                  .
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo}>Motivo de la devolución</Label>
          <Textarea
            id={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAXIMO_DEL_MOTIVO}
            className="min-h-16"
            rows={2}
          />
          <FieldError>{errorDelMotivo}</FieldError>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {/* El sistema no le avisa al comprador (FA-07). */}
        <p className="rounded-panel-control bg-surface-sunken px-3 py-2 text-caption text-ink-secondary">
          El comprador no recibe ningún aviso, y en «Mis compras» va a seguir
          viendo la orden como se entregó. Lo del dinero se arregla por fuera.
        </p>

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            Todavía no
          </Button>
          <Button
            variant="brand"
            loading={enCurso}
            loadingLabel="Registrando"
            onClick={registrar}
          >
            Registrar la devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** La cantidad y el destino sólo se ven si el renglón está elegido. */
function RenglonDevuelto({
  item,
  eleccion,
  soloUno,
  alCambiar,
}: {
  item: RenglonParaDevolver;
  eleccion: Eleccion;
  soloUno: boolean;
  alCambiar: (cambios: Partial<Eleccion>) => void;
}) {
  const id = useId();
  const quedan = porDevolver(item);

  return (
    <li className="flex flex-col gap-2 rounded-panel-card border border-border p-3">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={eleccion.elegido}
          // Con un solo renglón, desmarcarlo dejaría una devolución vacía.
          disabled={soloUno}
          onCheckedChange={(v) => alCambiar({ elegido: v === true })}
          className="mt-0.5"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={id} className="text-body-sm font-medium text-ink">
            {nombrar(item)}
          </label>
          <span className="text-caption text-ink-secondary">
            {item.cantidad === 1
              ? "1 unidad vendida"
              : `${item.cantidad} unidades vendidas`}
            {item.yaDevueltas > 0
              ? ` · ${item.yaDevueltas} ya devuelta${item.yaDevueltas === 1 ? "" : "s"}, quedan ${quedan}`
              : ""}
          </span>
        </div>
      </div>

      {eleccion.elegido ? (
        <div className="flex flex-col gap-2 pl-6.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor={`${id}-cantidad`}
                className="text-body-sm text-ink-secondary"
              >
                Vuelven
              </label>
              <Select
                id={`${id}-cantidad`}
                value={eleccion.cantidad}
                onChange={(e) =>
                  alCambiar({ cantidad: Number.parseInt(e.target.value, 10) })
                }
                className="w-20"
              >
                {Array.from({ length: quedan }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id={`${id}-repone`}
                checked={eleccion.repone}
                // Variante borrada (§5.6): se registra igual, para RF-28,
                // pero no hay stock que reponer.
                disabled={item.stock === null}
                onCheckedChange={(v) => alCambiar({ repone: v === true })}
              />
              <label
                htmlFor={`${id}-repone`}
                className="text-body-sm text-ink-secondary"
              >
                {item.stock === null
                  ? "Ya no está en el catálogo: no hay stock que sumar"
                  : "Vuelve al stock"}
              </label>
            </div>
          </div>

          {/* El motivo del renglón, sólo cuando no repone. */}
          {!eleccion.repone && item.stock !== null ? (
            <Input
              value={eleccion.motivo}
              onChange={(e) => alCambiar({ motivo: e.target.value })}
              maxLength={MAXIMO_DEL_MOTIVO}
              placeholder="Qué le pasó: llegó con la pantalla rota…"
              aria-label={`Por qué no vuelve al stock ${nombrar(item)}`}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
