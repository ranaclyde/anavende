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
 * Es el arrepentimiento (RF-23, RF-34): va a la vista y no detrás de un menú.
 * Sin campo de motivo a propósito: el motivo se le pide solo a la administradora.
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
      // Sin cerrar el diálogo a mano: la acción refresca y este componente deja
      // de dibujarse. Cerrarlo antes dejaría ver la pantalla vieja un instante.
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        data-ayuda="cancelar-pedido"
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
            {/* «No, dejarlo» y no «Cancelar»: acá «Cancelar» sería una adivinanza. */}
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
