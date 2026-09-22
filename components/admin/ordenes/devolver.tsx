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

/**
 * Registrar una devolución de una orden finalizada — FS RF-25. Tarea F7.5.
 *
 * **Vive en el detalle de la orden y no en una pantalla propia**, porque una
 * devolución es siempre contra una orden: acá están los renglones, las
 * cantidades vendidas y lo que ya se devolvió, que es todo lo que hay que
 * mirar para decidir. Una pantalla aparte habría empezado por un buscador de
 * órdenes que no existe, para terminar mostrando esta misma tabla.
 *
 * **Sólo aparece si la orden está finalizada y queda algo por devolver.** Lo
 * primero es de RF-25 —lo que todavía no se entregó se edita (RF-22) o se
 * cancela (RF-23)—; lo segundo evita el diálogo que se abre para decir que no
 * hay nada, que es el que sobra.
 *
 * **Cada renglón decide si repone**, que es la pregunta de fondo del
 * requisito: el producto volvió sano y vuelve a la góndola, o volvió roto y se
 * descarta. La misma devolución puede tener de las dos, y por eso la pregunta
 * es por renglón y no por devolución.
 */
export type RenglonParaDevolver = {
  id: string;
  nombre: string;
  color: string | null;
  /** Lo vendido en ese renglón (el snapshot, RN-12). */
  cantidad: number;
  /** Lo ya devuelto en devoluciones **registradas**: las anuladas liberan cupo. */
  yaDevueltas: number;
  /** El stock total de hoy, que es el que sube al reponer. `null` si la variante ya no está. */
  stock: number | null;
};

/** Lo que queda por devolver de un renglón — el tope de RF-25. */
function porDevolver(item: RenglonParaDevolver): number {
  return item.cantidad - item.yaDevueltas;
}

/** «Auricular Cloud II (negro)», como lo nombran el historial y los diálogos. */
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
  // El diálogo se monta de nuevo en cada apertura: sin esto, una devolución
  // registrada dejaría sus casillas marcadas y su motivo escrito esperando a
  // la siguiente, que es de otra cosa.
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
  // Con un solo renglón devolvible no hay nada que elegir: viene marcado y el
  // diálogo queda listo para confirmar. Con varios, marcar es la decisión.
  const unoSolo = devolubles.length === 1;

  const [elecciones, setElecciones] = useState<Record<string, Eleccion>>(() =>
    Object.fromEntries(
      devolubles.map((item) => [
        item.id,
        {
          elegido: unoSolo,
          // Todo lo que queda por devolver: en el caso corriente —un renglón
          // de una unidad— deja el selector en su único valor posible.
          cantidad: porDevolver(item),
          // **Repone de fábrica**: lo habitual es que el producto vuelva en
          // condiciones. Lo otro es la excepción, y pide explicarse.
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
        // `RETURN_EXCEEDS_SOLD` llega acá cuando entre que se abrió el diálogo
        // y llegó el clic se registró otra devolución del mismo renglón: el
        // mensaje del dominio dice cuántas quedan por devolver.
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
            placeholder="Le quedaba chico y lo trajo al día siguiente"
            aria-describedby={`${campo}-ayuda`}
          />
          <p id={`${campo}-ayuda`} className="text-caption text-ink-secondary">
            Queda con la devolución y es lo único que va a explicar, dentro de
            seis meses, por qué volvió esta mercadería.
          </p>
          <FieldError>{errorDelMotivo}</FieldError>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {/*
          Lo mismo que recuerdan los diálogos de editar (RF-22, FA-07): el
          sistema no le manda nada al comprador. Acá importa más todavía,
          porque una devolución suele venir con plata de por medio.
        */}
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

/**
 * Un renglón elegible.
 *
 * **La cantidad y el destino sólo se ven si el renglón está elegido**: con
 * cinco productos en la orden, cinco selectores y cinco casillas apagadas son
 * una pantalla que hay que leer entera para descubrir que no dice nada.
 */
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
          // Con un solo renglón devolvible, desmarcarlo deja una devolución
          // vacía: no hay otra cosa que devolver, así que la casilla no se
          // toca y el diálogo se confirma o se cierra.
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
                // Una variante borrada (§5.6) no tiene contador que mover: la
                // devolución se registra igual —RF-28 la necesita— y reponerla
                // no significa nada.
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

          {/* El motivo del renglón aparece **sólo cuando no repone**: ahí dice
              algo que el motivo general no dice. En una devolución normal
              sería un campo más para dejar vacío. */}
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
