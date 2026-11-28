"use client";

import { KeyRound } from "lucide-react";
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
import { mandarRestablecerContrasena } from "@/modules/users/panel/actions";

/**
 * Restablecer la contraseña — RF-26. Manda el mismo email que «¿Olvidaste tu
 * contraseña?» (E2). La contraseña actual sigue funcionando hasta que la
 * persona use el enlace, y el diálogo lo dice.
 */
export function RestablecerContrasena({
  id,
  nombre,
  email,
}: {
  id: string;
  nombre: string;
  email: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function mandar() {
    setError(null);
    iniciar(async () => {
      const r = await mandarRestablecerContrasena({ id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setEnviado(true);
    });
  }

  function abrir() {
    setError(null);
    setEnviado(false);
    setAbierto(true);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={abrir}>
        <KeyRound aria-hidden />
        Restablecer contraseña
      </Button>

      <Dialog
        open={abierto}
        onOpenChange={(v) => (v ? null : setAbierto(false))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {enviado
                ? "Email enviado"
                : `Mandarle a ${nombre} el email para elegir una contraseña nueva`}
            </DialogTitle>
            <DialogDescription>
              {enviado
                ? `Le llegó a ${email}. El enlace la lleva a elegir una contraseña nueva; si no lo usa, la que tiene sigue andando.`
                : `Le va a llegar a ${email} el mismo email que sale de «¿Olvidaste tu contraseña?». Vos no ves ni elegís su contraseña.`}
            </DialogDescription>
          </DialogHeader>

          {enviado ? null : (
            <p className="text-body-sm text-ink-secondary">
              Mientras tanto su contraseña de ahora sigue funcionando: el enlace
              no la deja afuera de la cuenta.
            </p>
          )}

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            {enviado ? (
              <Button variant="brand" onClick={() => setAbierto(false)}>
                Listo
              </Button>
            ) : (
              <>
                <Button
                  variant="tertiary"
                  disabled={enCurso}
                  onClick={() => setAbierto(false)}
                >
                  Todavía no
                </Button>
                <Button
                  variant="brand"
                  loading={enCurso}
                  loadingLabel="Enviando"
                  onClick={mandar}
                >
                  Mandar el email
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
