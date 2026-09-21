"use client";

import { Ban } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leerErrores } from "@/lib/form";
import { anularUnaDevolucion } from "@/modules/returns/actions";
import { MAXIMO_DEL_MOTIVO } from "@/modules/returns/schemas";

/**
 * Anular una devolución — FS RF-25. Tarea F7.5.
 *
 * **Es la única corrección que existe**, y por eso está donde se ve la
 * devolución y no detrás de un menú: RF-25 dice que una devolución registrada
 * no se edita, se anula y se vuelve a cargar. Un renglón de más, la cantidad
 * equivocada o el producto que no era se arreglan así.
 *
 * **Anular no deshace la devolución: la corrige.** Lo que se había repuesto
 * sale del stock, el cupo del renglón vuelve a estar libre —de modo que se
 * puede cargar bien— y el asiento anulado se queda a la vista con su motivo.
 * Eso es lo que lo distingue de borrarlo, que es lo que no se hace.
 */
export function AnularLaDevolucion({
  returnId,
  /** Lo que vuelve a salir del stock, para decirlo antes de confirmar. */
  repuestas,
}: {
  returnId: string;
  repuestas: { nombre: string; cantidad: number }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [aperturas, setAperturas] = useState(0);

  return (
    <>
      {/* Contorno y no ghost: éste lleva rótulo y vive solo al pie de una
          tarjeta, no en una columna de acciones. Es el mismo caso que
          «Cancelar la orden» (§6.3). */}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          setAperturas((n) => n + 1);
          setAbierto(true);
        }}
      >
        <Ban aria-hidden />
        Anular
      </Button>

      <Dialogo
        key={aperturas}
        abierto={abierto}
        cerrar={() => setAbierto(false)}
        returnId={returnId}
        repuestas={repuestas}
      />
    </>
  );
}

function Dialogo({
  abierto,
  cerrar,
  returnId,
  repuestas,
}: {
  abierto: boolean;
  cerrar: () => void;
  returnId: string;
  repuestas: { nombre: string; cantidad: number }[];
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorDelMotivo, setErrorDelMotivo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const campo = useId();

  function anular() {
    setError(null);
    setErrorDelMotivo(null);

    iniciar(async () => {
      const r = await anularUnaDevolucion({ returnId, motivo });
      if (!r.ok) {
        // `INVALID_ORDER_STATE` es la que ya anuló otra pestaña: el dominio
        // pide actualizar la página, y decirlo es mejor que un error a secas.
        const errores = leerErrores<"motivo">(r);
        setErrorDelMotivo(errores.campos.motivo ?? null);
        setError(errores.general);
        return;
      }
      cerrar();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : cerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular esta devolución</DialogTitle>
          <DialogDescription>
            La devolución queda anulada y a la vista, con el motivo que
            escribas. Las unidades vuelven a estar disponibles para devolver,
            así que si hubo un error se carga de nuevo como iba.
          </DialogDescription>
        </DialogHeader>

        {repuestas.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-body-sm text-ink">Sale del stock lo repuesto:</p>
            <ul className="flex flex-col gap-1">
              {repuestas.map((item) => (
                <li
                  key={item.nombre}
                  className="text-body-sm text-ink-secondary"
                >
                  {item.nombre}:{" "}
                  {item.cantidad === 1
                    ? "1 unidad"
                    : `${item.cantidad} unidades`}
                  .
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-body-sm text-ink-secondary">
            Esta devolución no había repuesto nada, así que el stock no se
            mueve.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo}>Motivo de la anulación</Label>
          <Textarea
            id={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAXIMO_DEL_MOTIVO}
            className="min-h-16"
            rows={2}
            placeholder="Me equivoqué de producto"
            aria-describedby={`${campo}-ayuda`}
          />
          <p id={`${campo}-ayuda`} className="text-caption text-ink-tertiary">
            Obligatorio: es lo que explica un movimiento de stock que va y
            vuelve.
          </p>
          <FieldError>{errorDelMotivo}</FieldError>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="tertiary" disabled={enCurso} onClick={cerrar}>
            No, dejarla
          </Button>
          <Button
            variant="destructive-solid"
            loading={enCurso}
            loadingLabel="Anulando"
            onClick={anular}
          >
            Anular la devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
