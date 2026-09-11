"use client";

import { Lock, LockOpen } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cambiarElModoMantenimiento } from "@/modules/settings/actions";

/**
 * Modo mantenimiento — F2.7b.
 *
 * **El estado sale de la página y no de un `useState`.** La acción revalida
 * todo el sitio, así que después de cambiarlo el servidor vuelve a mandar
 * esta pantalla con el valor nuevo. Guardarlo acá también dejaría dos lugares
 * que pueden decir cosas distintas —y el día que alguien guarde la
 * configuración por primera vez, este quedaría diciendo «guardala primero».
 *
 * **Cerrar pide confirmación y reabrir no.** Cerrar cambia lo que ven todos
 * los compradores en el acto; reabrir es volver a lo normal, y un diálogo ahí
 * sería una pregunta que siempre se contesta que sí.
 */
export function ModoMantenimiento({
  activo,
}: {
  /** `null` = la configuración nunca se guardó y no hay fila donde anotarlo. */
  activo: boolean | null;
}) {
  const [enCurso, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (siguiente: boolean) => {
    setConfirmando(false);
    setError(null);
    iniciar(async () => {
      const r = await cambiarElModoMantenimiento({ activo: siguiente });
      if (!r.ok) setError(r.message);
    });
  };

  const cerrada = activo === true;

  return (
    <section
      aria-labelledby="mantenimiento-titulo"
      className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mantenimiento-titulo" className="text-heading text-ink">
            Tienda
          </h2>
          {/* Con texto siempre, no solo el color (§6.4, §9). Se omite sin
              fila: «abierta» sería cierto, pero es un estado que todavía no
              se puede cambiar, y la frase de abajo ya lo explica. */}
          {activo === null ? null : cerrada ? (
            <Badge tone="warning">
              <Lock aria-hidden />
              Cerrada al público
            </Badge>
          ) : (
            <Badge tone="success">
              <LockOpen aria-hidden />
              Abierta
            </Badge>
          )}
        </div>
        <p className="text-body-sm text-ink-secondary">
          {cerrada
            ? "Quien entra ve un aviso de que volvemos en un rato, y no puede registrarse. Vos la seguís viendo normal."
            : "Cerrala mientras cargás productos: los compradores ven un aviso de que volvemos en un rato, y vos la seguís viendo normal para revisar cada ficha."}
        </p>
      </div>

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col items-start gap-2">
        {cerrada ? (
          <Button
            variant="secondary"
            loading={enCurso}
            loadingLabel="Abriendo la tienda"
            onClick={() => cambiar(false)}
          >
            <LockOpen aria-hidden />
            Volver a abrir la tienda
          </Button>
        ) : (
          <Button
            variant="secondary"
            loading={enCurso}
            loadingLabel="Cerrando la tienda"
            disabled={activo === null}
            aria-describedby={
              activo === null ? "mantenimiento-sin-configurar" : undefined
            }
            onClick={() => setConfirmando(true)}
          >
            <Lock aria-hidden />
            Cerrar la tienda al público
          </Button>
        )}

        {/* §8: lo deshabilitado dice por qué, escrito y no en un `title`. */}
        {activo === null ? (
          <p
            id="mantenimiento-sin-configurar"
            className="text-caption text-ink-secondary"
          >
            Guardá primero la configuración de arriba: hasta que exista, no
            hay dónde anotar que la tienda está cerrada.
          </p>
        ) : null}
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar la tienda al público?</DialogTitle>
            <DialogDescription>
              Quien entre va a ver «Volvemos en un rato» hasta que la vuelvas a
              abrir, y nadie va a poder registrarse. Vos la seguís viendo
              normal. Puede tardar unos segundos en notarse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={() => cambiar(true)}>
              Cerrar la tienda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
