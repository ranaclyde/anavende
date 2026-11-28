"use client";

import {
  ArrowRight,
  DoorClosedLocked,
  Lock,
  LockOpen,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
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
 * Modo mantenimiento. El estado sale de la página y no de un `useState`: la
 * acción revalida todo el sitio. Cerrar pide confirmación y reabrir no.
 */
export function ModoMantenimiento({
  activo,
}: {
  /** `null` = la configuración nunca se guardó y no hay fila donde anotarlo. */
  activo: boolean | null;
}) {
  const cerrada = activo === true;

  return (
    <TarjetaDeSeccion
      id="mantenimiento-titulo"
      titulo="Tienda"
      insignias={
        /* Con texto, no solo color (§9). Se omite sin fila: la frase de abajo
           lo explica. */
        activo === null ? null : cerrada ? (
          <Badge tone="warning">
            <Lock aria-hidden />
            Cerrada al público
          </Badge>
        ) : (
          <Badge tone="success">
            <LockOpen aria-hidden />
            Abierta
          </Badge>
        )
      }
      ayuda={
        cerrada
          ? "Abrila cuando termines los cambios."
          : "Cerrala mientras hacés cambios."
      }
    >
      <InterruptorDeLaTienda activo={activo} />
    </TarjetaDeSeccion>
  );
}

/**
 * La tienda en el inicio del panel: el mismo interruptor que en
 * Configuración, en un renglón. El ícono cambia de forma, no solo de color.
 */
export function TiendaEnElInicio({ activo }: { activo: boolean | null }) {
  const cerrada = activo === true;
  const Icono = cerrada ? DoorClosedLocked : Store;

  return (
    <section
      aria-labelledby="tienda-estado"
      className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-10 shrink-0 items-center justify-center rounded-pill ${
            cerrada
              ? "bg-warning-tint text-warning"
              : "bg-success-tint text-success"
          }`}
        >
          <Icono className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="tienda-estado" className="text-body font-medium text-ink">
            {cerrada
              ? "La tienda está cerrada al público"
              : "La tienda está abierta"}
          </h2>
          <p className="text-body-sm text-ink-secondary">
            {cerrada
              ? "Los compradores ven «Volvemos en un rato». Vos la seguís viendo normal."
              : "Los compradores la pueden ver y comprar."}
          </p>
        </div>
      </div>

      {/* Sin fila de configuración, se manda a donde se resuelve. */}
      {activo === null ? (
        <Button
          asChild
          variant="tertiary"
          size="sm"
          className="self-start sm:self-auto"
        >
          <Link href="/admin/configuracion">
            Guardá la configuración para poder cerrarla
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <InterruptorDeLaTienda activo={activo} />
      )}
    </section>
  );
}

/** El botón, su confirmación y su error, compartidos por Configuración y el inicio. */
function InterruptorDeLaTienda({ activo }: { activo: boolean | null }) {
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
    <div className="flex flex-col items-start gap-2">
      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

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
          Guardá primero la configuración de arriba: hasta que exista, no hay
          dónde anotar que la tienda está cerrada.
        </p>
      ) : null}

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
            <Button variant="secondary" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            {/* `destructive-solid`, como todo lo que saca algo de circulación (§6.3). */}
            <Button variant="destructive-solid" onClick={() => cambiar(true)}>
              Cerrar la tienda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
