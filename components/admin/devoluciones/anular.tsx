"use client";

import { Ban } from "lucide-react";
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
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readErrors } from "@/lib/form";
import { anularUnaDevolucion } from "@/modules/returns/actions";
import { MAXIMO_DEL_MOTIVO } from "@/modules/returns/schemas";

export function AnularLaDevolucion({
  returnId,
  repuestas,
}: {
  returnId: string;
  repuestas: { nombre: string; cantidad: number }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [aperturas, setAperturas] = useState(0);

  return (
    <>
      {/* Terciario y no contorno rojo: va en cada tarjeta, y el peso lo pone
          el diálogo de confirmación. */}
      <Button
        variant="tertiary"
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
        // `INVALID_ORDER_STATE`: ya la anuló otra pestaña.
        const errores = readErrors<"motivo">(r);
        setErrorDelMotivo(errores.fields.motivo ?? null);
        setError(errores.general);
        return;
      }
      avisar("Anulaste la devolución.");
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
            aria-describedby={`${campo}-ayuda`}
          />
          <p id={`${campo}-ayuda`} className="text-caption text-ink-secondary">
            Por ejemplo: «me equivoqué de producto».
          </p>
          <FieldError>{errorDelMotivo}</FieldError>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" disabled={enCurso} onClick={cerrar}>
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
