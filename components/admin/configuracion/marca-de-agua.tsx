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
          <Badge tone="info">
            <Droplets aria-hidden />
            Activada
          </Badge>
        ) : (
          <Badge tone="neutral">
            <DropletOff aria-hidden />
            Desactivada
          </Badge>
        )
      }
      ayuda={
        activa
          ? "Las fotos de productos que subas llevan tu marca. Las que ya estaban no cambian."
          : "Poné tu logo o el nombre de la tienda sobre las fotos de productos que subas, para que no las usen en otro lado."
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
