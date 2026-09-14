"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
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
import {
  eliminarLaDireccion,
  usarComoPredeterminada,
} from "@/modules/users/direcciones/actions";

/**
 * Lo que se puede hacer con una dirección desde la lista — RF-09, F5.3.
 *
 * Una isla chica: la tarjeta —la dirección escrita— se pinta en el
 * servidor, y acá queda solo lo que responde a un clic.
 *
 * **Eliminar pregunta antes**, y dice qué pasa con la predeterminada: que
 * otra tome su lugar sin avisar es exactamente el cambio que después alguien
 * descubre al ver que el pedido salió para la casa equivocada.
 */
export function AccionesDeDireccion({
  id,
  etiqueta,
  predeterminada,
  siguientePredeterminada,
}: {
  id: string;
  etiqueta: string;
  predeterminada: boolean;
  /** La que toma el lugar si se elimina esta, cuando esta es la predeterminada. */
  siguientePredeterminada: string | null;
}) {
  const [enCurso, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function elegir() {
    setError(null);
    iniciar(async () => {
      const r = await usarComoPredeterminada({ id });
      if (!r.ok) setError(r.message);
    });
  }

  function eliminar() {
    setError(null);
    iniciar(async () => {
      const r = await eliminarLaDireccion({ id });
      if (r.ok) setConfirmando(false);
      else setError(r.message);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {predeterminada ? null : (
          <Button variant="tertiary" size="md" disabled={enCurso} onClick={elegir}>
            <Star aria-hidden />
            Usar como predeterminada
            <span className="sr-only"> «{etiqueta}»</span>
          </Button>
        )}
        <Button asChild variant="tertiary" size="md">
          <Link href={`/mi-cuenta/direcciones/${id}`}>
            <Pencil aria-hidden />
            Editar
            <span className="sr-only"> «{etiqueta}»</span>
          </Link>
        </Button>
        <Button
          variant="tertiary"
          size="md"
          disabled={enCurso}
          onClick={() => setConfirmando(true)}
        >
          <Trash2 aria-hidden />
          Eliminar
          <span className="sr-only"> «{etiqueta}»</span>
        </Button>
      </div>

      {error === null || confirmando ? null : (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{etiqueta}»?</DialogTitle>
            <DialogDescription>
              {predeterminada && siguientePredeterminada
                ? `Es tu dirección predeterminada: «${siguientePredeterminada}» pasa a serlo. `
                : null}
              Las compras que ya hiciste con esta dirección no cambian.
            </DialogDescription>
          </DialogHeader>

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="tertiary" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              loading={enCurso}
              loadingLabel="Eliminando la dirección"
              onClick={eliminar}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
