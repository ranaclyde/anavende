"use client";

import { Lock, LockOpen } from "lucide-react";
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
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { readErrors } from "@/lib/form";
import {
  bloquearCuenta,
  desbloquearCuenta,
} from "@/modules/users/panel/actions";
import { MAXIMO_DEL_MOTIVO } from "@/modules/users/panel/schemas";

/**
 * Bloquear y desbloquear una cuenta — RF-27, TS §13.5. El motivo se pide en
 * el diálogo y no es una nota interna: es lo que la persona lee al intentar
 * entrar. Sobre la propia cuenta, o una dada de baja, no hay botón sino una
 * explicación.
 */
export function BloqueoDeLaCuenta({
  id,
  nombre,
  bloqueado,
  dadoDeBaja,
  esMiCuenta,
  esLaUnicaAdministradora,
}: {
  id: string;
  nombre: string;
  bloqueado: boolean;
  /** Dada de baja no se bloquea: ya no entra. */
  dadoDeBaja: boolean;
  esMiCuenta: boolean;
  /** Bloquearla dejaría la tienda sin nadie que entre al panel. */
  esLaUnicaAdministradora: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  /**
   * Qué preguntaba el diálogo al abrirse, y no `bloqueado` a secas: el estado
   * cambia antes de que el diálogo termine de irse, y mientras se desvanece se
   * daba vuelta y mostraba la pregunta contraria.
   */
  const [preguntando, setPreguntando] = useState<"bloquear" | "desbloquear">(
    "bloquear",
  );
  const [motivo, setMotivo] = useState("");
  const [errorDelMotivo, setErrorDelMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function abrir() {
    setPreguntando(bloqueado ? "desbloquear" : "bloquear");
    setMotivo("");
    setErrorDelMotivo(null);
    setError(null);
    setAviso(null);
    setAbierto(true);
  }

  function bloquear() {
    if (!motivo.trim()) {
      setErrorDelMotivo(
        "Escribí el motivo: es lo que va a leer al intentar entrar.",
      );
      return;
    }

    setError(null);
    iniciar(async () => {
      const r = await bloquearCuenta({ id, motivo });

      if (!r.ok) {
        // El motivo vacío vuelve como error del campo; la regla de la última
        // administradora, como mensaje del diálogo. Los dos son VALIDATION.
        const delCampo = readErrors<"motivo">(r).fields.motivo;
        if (delCampo) setErrorDelMotivo(delCampo);
        else setError(r.message);
        return;
      }

      // El flotante confirma; la caja de abajo se queda si Supabase Auth no
      // respondió, que hay que ir a revisar (DR §6.15).
      avisar(`Bloqueaste la cuenta de ${nombre}.`);

      setAviso(
        r.data.errorDeAuth
          ? "Quedó bloqueada en la tienda y no va a poder hacer nada, pero " +
              "Supabase Auth no respondió: hasta que se resuelva, todavía " +
              "puede iniciar sesión. Ya quedó registrado para revisarlo."
          : null,
      );
      setAbierto(false);
    });
  }

  function desbloquear() {
    setError(null);
    iniciar(async () => {
      const r = await desbloquearCuenta({ id });

      if (!r.ok) {
        setError(r.message);
        return;
      }

      avisar(`Desbloqueaste la cuenta de ${nombre}.`);

      setAviso(
        r.data.errorDeAuth
          ? "Quedó desbloqueada en la tienda, pero Supabase Auth no " +
              "respondió: hasta que se resuelva, puede que siga sin poder " +
              "iniciar sesión. Ya quedó registrado para revisarlo."
          : null,
      );
      setAbierto(false);
    });
  }

  if (esMiCuenta) {
    return (
      <p className="text-body-sm text-ink-secondary">
        Es tu cuenta, así que no la bloqueás vos: te dejaría afuera del panel en
        la pantalla siguiente.
      </p>
    );
  }

  // Sin botón, y dicho: la operación lo rechaza. Lo que sigue estando es
  // revertir la baja.
  if (dadoDeBaja) {
    return (
      <p className="text-body-sm text-ink-secondary">
        Está dada de baja, así que no hace falta bloquearla: ya no puede entrar.
      </p>
    );
  }

  if (esLaUnicaAdministradora && !bloqueado) {
    return (
      <p className="text-body-sm text-ink-secondary">
        Es la única administradora que queda, así que no se puede bloquear: si
        lo hacés, nadie va a poder entrar al panel. Nombrá a otra administradora
        primero.
      </p>
    );
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
          variant={bloqueado ? "secondary" : "destructive"}
          size="sm"
          onClick={abrir}
        >
          {bloqueado ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
          {bloqueado ? "Desbloquear la cuenta" : "Bloquear la cuenta"}
        </Button>
      </div>

      <Dialog
        open={abierto}
        onOpenChange={(v) => (v ? null : setAbierto(false))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {preguntando === "desbloquear"
                ? `¿Devolverle el acceso a ${nombre}?`
                : `Bloquear la cuenta de ${nombre}`}
            </DialogTitle>
            <DialogDescription>
              {preguntando === "desbloquear"
                ? "Va a poder volver a entrar con la misma contraseña de siempre. Sus compras, su carrito y sus favoritos están donde los dejó."
                : "No va a poder entrar, y al intentarlo va a leer el motivo que escribas acá abajo. Sus órdenes activas siguen su curso: bloquear no cancela nada."}
            </DialogDescription>
          </DialogHeader>

          {preguntando === "desbloquear" ? (
            <p className="text-body-sm text-ink-secondary">
              El desbloqueo queda registrado con tu nombre y la fecha, igual que
              el bloqueo.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="motivo-del-bloqueo">¿Por qué la bloqueás?</Label>
              <Textarea
                id="motivo-del-bloqueo"
                name="motivo"
                rows={3}
                maxLength={MAXIMO_DEL_MOTIVO}
                required
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  if (errorDelMotivo) setErrorDelMotivo(null);
                }}
                aria-invalid={!!errorDelMotivo || undefined}
                aria-describedby="motivo-del-bloqueo-ayuda"
              />
              {errorDelMotivo ? (
                <FieldError id="motivo-del-bloqueo-ayuda">
                  {errorDelMotivo}
                </FieldError>
              ) : (
                <FieldHint id="motivo-del-bloqueo-ayuda">
                  Lo va a leer {nombre} al intentar entrar. Hasta{" "}
                  {MAXIMO_DEL_MOTIVO} caracteres.
                </FieldHint>
              )}
            </div>
          )}

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              disabled={enCurso}
              onClick={() => setAbierto(false)}
            >
              Dejarlo como está
            </Button>
            {preguntando === "desbloquear" ? (
              <Button
                variant="brand"
                loading={enCurso}
                loadingLabel="Desbloqueando"
                onClick={desbloquear}
              >
                Sí, desbloquear
              </Button>
            ) : (
              <Button
                variant="destructive-solid"
                loading={enCurso}
                loadingLabel="Bloqueando"
                onClick={bloquear}
              >
                Sí, bloquear
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
