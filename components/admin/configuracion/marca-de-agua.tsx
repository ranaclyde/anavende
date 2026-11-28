import { ArrowRight, DropletOff, Droplets } from "lucide-react";
import Link from "next/link";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * La marca de agua en Configuración — RF-39: el estado y el camino a su
 * pantalla, donde se arma y se activa.
 */
export function MarcaDeAguaEnConfiguracion({ activa }: { activa: boolean }) {
  return (
    <TarjetaDeSeccion
      id="marca-de-agua-titulo"
      titulo="Marca de agua"
      insignias={
        activa ? (
          <Badge tone="success">
            <Droplets aria-hidden />
            Activada
          </Badge>
        ) : (
          <Badge tone="danger">
            <DropletOff aria-hidden />
            Desactivada
          </Badge>
        )
      }
      ayuda={
        activa
          ? "Las fotos nuevas llevan tu marca; las que ya estaban, no."
          : "Tu logo sobre las fotos nuevas, para que no las copien."
      }
    >
      <Button asChild variant="secondary" className="self-start">
        <Link href="/admin/configuracion/marca-de-agua">
          {activa ? "Cambiar la marca de agua" : "Armar la marca de agua"}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </TarjetaDeSeccion>
  );
}

/**
 * La marca de agua en el inicio del panel, con la misma forma que la tienda
 * abierta o cerrada. Lleva a su pantalla: activarla se decide mirando la
 * vista previa.
 */
export function MarcaDeAguaEnElInicio({ activa }: { activa: boolean }) {
  const Icono = activa ? Droplets : DropletOff;

  return (
    <section
      aria-labelledby="marca-de-agua-estado"
      className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-10 shrink-0 items-center justify-center rounded-pill ${
            activa
              ? "bg-success-tint text-success"
              : "bg-danger-tint text-danger"
          }`}
        >
          <Icono className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id="marca-de-agua-estado"
            className="text-body font-medium text-ink"
          >
            {activa
              ? "La marca de agua está activada"
              : "La marca de agua está desactivada"}
          </h2>
          <p className="text-body-sm text-ink-secondary">
            {activa
              ? "Las fotos de productos que subas la llevan."
              : "Las fotos de productos que subas salen sin marca."}
          </p>
        </div>
      </div>

      <Button asChild variant="secondary" className="self-start sm:self-auto">
        <Link href="/admin/configuracion/marca-de-agua">
          {activa ? "Cambiar la marca de agua" : "Ir a la marca de agua"}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
