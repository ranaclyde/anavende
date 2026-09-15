"use client";

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
import { cancelarMiOrden } from "@/modules/orders/actions";

/**
 * «Cancelar el pedido» — FS RF-23, RF-34. Tarea F6.5.
 *
 * **Es el arrepentimiento, y por eso está a la vista.** RF-23 pide
 * explícitamente que no viva detrás de un menú: es el mecanismo con el que el
 * sitio cumple ese derecho, y su visibilidad es parte del requisito. La isla
 * es chica —el pedido entero se pinta en el servidor— y acá queda solo lo que
 * responde al clic.
 *
 * **Contorno y no relleno** (`destructive`, §6.3): el rojo lleno y el burdeos
 * de marca están a siete grados de matiz, así que las variantes destructivas
 * se separan por forma. Adentro del diálogo, donde ya no hay un botón de marca
 * al lado, sí va relleno.
 *
 * **Pregunta antes, y dice qué no pasa.** Cancelar no tiene vuelta —RF-13 no
 * deja salir de `cancelada`— y lo que más se teme al tocarlo es que ya te
 * hayan cobrado algo. El diálogo lo contesta antes de que haya que
 * preguntarlo.
 *
 * **No hay campo de motivo.** RF-23 se lo pide a la administradora, que
 * cancela la orden de otro; a quien se arrepiente no se le pide explicación.
 */
export function CancelarLaOrden({
  numero,
  total,
}: {
  numero: number;
  total: string;
}) {
  const [enCurso, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancelar() {
    setError(null);
    iniciar(async () => {
      const r = await cancelarMiOrden({ numero });
      // Sin cerrar el diálogo a mano: la acción llama a `refresh()`, la página
      // se vuelve a pintar como «Cancelada» y este componente deja de
      // dibujarse. Cerrarlo antes dejaría ver la pantalla vieja un instante.
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={() => setConfirmando(true)}
      >
        Cancelar el pedido
      </Button>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar el pedido #{numero}?</DialogTitle>
            <DialogDescription>
              Liberamos el stock que habíamos guardado y el pedido de {total} no
              se prepara. No se te cobró nada, así que no hay nada que
              devolverte. Esto no se puede deshacer: si después lo querés, hay
              que armarlo de nuevo.
            </DialogDescription>
          </DialogHeader>

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            {/* «No, dejarlo» y no «Cancelar»: en un diálogo que pregunta si
                cancelar algo, un botón que dice «Cancelar» es una adivinanza. */}
            <Button
              variant="tertiary"
              disabled={enCurso}
              onClick={() => setConfirmando(false)}
            >
              No, dejarlo
            </Button>
            <Button
              variant="destructive-solid"
              loading={enCurso}
              loadingLabel="Cancelando el pedido"
              onClick={cancelar}
            >
              Sí, cancelarlo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
