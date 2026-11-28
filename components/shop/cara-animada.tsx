import { Blobatar } from "blobatar/react";

import { Avatar, TAMANOS_DE_AVATAR } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { urlDeFotoDePerfil } from "@/modules/media/subir";

/**
 * La cara de una cuenta, con el blobatar que se mueve al pasar el mouse por
 * el control que la contiene (`data-anima-cara`, regla en `globals.css`).
 *
 * Componente de servidor a propósito: el `:hover` no entra a un `<img>`, así
 * que va como SVG en la página, y al navegador no le llega la biblioteca.
 */
export function CaraAnimada({
  cuenta,
  tamano = 32,
  arriba = false,
}: {
  cuenta: { id: string; avatarKey: string | null };
  tamano?: keyof typeof TAMANOS_DE_AVATAR;
  arriba?: boolean;
}) {
  const foto = urlDeFotoDePerfil(cuenta.avatarKey);
  if (foto) return <Avatar src={foto} tamano={tamano} arriba={arriba} />;

  // El círculo lo pone el `span`: el dibujo crece al moverse y no se sale.
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 overflow-hidden rounded-pill ring-1 ring-border",
        TAMANOS_DE_AVATAR[tamano],
      )}
    >
      <Blobatar
        name={cuenta.id}
        background="square"
        animate="hover"
        focusable="false"
        className="size-full"
      />
    </span>
  );
}
