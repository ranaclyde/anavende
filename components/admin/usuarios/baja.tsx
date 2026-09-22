"use client";

import { DoorOpen, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

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
import {
  ejecutarBajaDeCuenta,
  revertirBajaDeCuenta,
} from "@/modules/users/panel/actions";

/**
 * Ejecutar y revertir la baja de una cuenta — FS RF-34, RN-13 · TS §13.5b.
 * Tarea F7.9.
 *
 * **No hay «dar de baja» acá**, y es la decisión que ordena toda la pantalla
 * (2026-09-17): la baja la pide la persona y la administradora la ejecuta. Si
 * este control pudiera iniciarla sería un segundo bloqueo con otro nombre, y
 * alguien leería «te diste de baja» sin haberlo pedido, que es exactamente lo
 * que RN-13 no quiere.
 *
 * **Tampoco pide motivo**, al revés que el bloqueo (F7.7): el motivo ya está
 * escrito y es el del comprador. Lo que el diálogo hace es contar qué va a
 * pasar —se le cierra la sesión, no se borra nada— antes de que sea tarde.
 */
export function BajaDeLaCuenta({
  id,
  nombre,
  dadoDeBaja,
}: {
  id: string;
  nombre: string;
  /** `false` es la baja pedida y sin ejecutar: el único otro caso que se dibuja. */
  dadoDeBaja: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  /**
   * Qué preguntaba el diálogo cuando se abrió, y no `dadoDeBaja` a secas: el
   * mismo motivo que en el bloqueo (F7.7), donde el diálogo alcanzaba a darse
   * vuelta mientras se desvanecía.
   */
  const [preguntando, setPreguntando] = useState<"ejecutar" | "revertir">(
    "ejecutar",
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function abrir() {
    setPreguntando(dadoDeBaja ? "revertir" : "ejecutar");
    setError(null);
    setAviso(null);
    setAbierto(true);
  }

  function ejecutar() {
    setError(null);
    iniciar(async () => {
      const r = await ejecutarBajaDeCuenta({ id });

      if (!r.ok) {
        setError(r.message);
        return;
      }

      // El flotante confirma; la caja de abajo se queda para el caso en que
      // Auth no respondió, que hay que ir a revisar (§6.15).
      avisar(`Diste de baja la cuenta de ${nombre}.`);

      setAviso(
        r.data.errorDeAuth
          ? "La cuenta quedó dada de baja y no va a poder hacer nada, pero " +
              "Supabase Auth no respondió: hasta que se resuelva, todavía " +
              "puede iniciar sesión. Ya quedó registrado para revisarlo."
          : null,
      );
      setAbierto(false);
    });
  }

  function revertir() {
    setError(null);
    iniciar(async () => {
      const r = await revertirBajaDeCuenta({ id });

      if (!r.ok) {
        setError(r.message);
        return;
      }

      avisar(`Revertiste la baja de la cuenta de ${nombre}.`);

      setAviso(
        r.data.errorDeAuth
          ? "La cuenta volvió en la tienda, pero Supabase Auth no respondió: " +
              "hasta que se resuelva, puede que siga sin poder iniciar " +
              "sesión. Ya quedó registrado para revisarlo."
          : null,
      );
      setAbierto(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {aviso === null ? null : (
        <p
          role="alert"
          className="rounded-image border border-warning bg-warning-tint p-3 text-body-sm text-ink"
        >
          {aviso}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant={dadoDeBaja ? "secondary" : "destructive"}
          size="sm"
          onClick={abrir}
        >
          {dadoDeBaja ? <Undo2 aria-hidden /> : <DoorOpen aria-hidden />}
          {dadoDeBaja ? "Revertir la baja" : "Dar de baja la cuenta"}
        </Button>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(v) => (v ? null : setAbierto(false))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {preguntando === "revertir"
                ? `¿Devolverle la cuenta a ${nombre}?`
                : `Dar de baja la cuenta de ${nombre}`}
            </DialogTitle>
            <DialogDescription>
              {preguntando === "revertir"
                ? "Va a poder volver a entrar con la misma contraseña de siempre, y con sus compras, sus direcciones y sus favoritos donde los dejó. El pedido de baja se borra: si más adelante se quiere ir otra vez, lo pide de nuevo."
                : `Es lo que ${nombre} pidió. No va a poder entrar más, y la sesión que tenga abierta se cierra. No se borra nada: sus órdenes y su historial quedan como están, y podés revertirlo desde acá.`}
            </DialogDescription>
          </DialogHeader>

          {preguntando === "revertir" ? (
            <p className="text-body-sm text-ink-secondary">
              La reversión queda registrada con tu nombre y la fecha, igual que
              la baja.
            </p>
          ) : (
            <p className="text-body-sm text-ink-secondary">
              Al intentar entrar va a leer que su cuenta está dada de baja, no
              que está bloqueada: son dos cosas distintas y se dicen distinto.
            </p>
          )}

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="tertiary"
              disabled={enCurso}
              onClick={() => setAbierto(false)}
            >
              Dejarlo como está
            </Button>
            {preguntando === "revertir" ? (
              <Button
                variant="brand"
                loading={enCurso}
                loadingLabel="Revirtiendo"
                onClick={revertir}
              >
                Sí, devolvérsela
              </Button>
            ) : (
              <Button
                variant="destructive-solid"
                loading={enCurso}
                loadingLabel="Dando de baja"
                onClick={ejecutar}
              >
                Sí, darla de baja
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
