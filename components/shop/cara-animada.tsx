import { Blobatar } from "blobatar/react";

import { Avatar, TAMANOS_DE_AVATAR } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { urlDeFotoDePerfil } from "@/modules/media/subir";

/**
 * La cara de una cuenta en la tienda, **con el blobatar que se mueve al pasar
 * el mouse** — F5.9, pedido del 2026-10-26.
 *
 * Solo donde la cara es un control: el enlace a la cuenta del encabezado y la
 * fila de la foto en «Mis datos». En el panel queda quieta (`<Avatar>`): en
 * «Usuarios» hay cuarenta por página, y moverse al pasar por la tabla sería
 * ruido para quien viene a operar. Una foto subida no se anima.
 *
 * **Es un componente de servidor, y es a propósito.** El blobatar animado no
 * puede ser un `<img>` —el `:hover` no entra a una imagen—, así que es SVG en
 * la página; lo arma el servidor y al navegador no le llega la biblioteca,
 * solo el dibujo. El encabezado, que es de cliente, lo recibe hecho.
 *
 * Se mueve al pasar por el CONTROL y no solo por el dibujo: quien lo contiene
 * lleva `data-anima-cara`, y la regla está en `globals.css`. Sin mouse, o con
 * «reducir movimiento», se queda quieto (`blobatar/motion.css`).
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

  // El círculo lo pone el `span`: el bicho crece un 4% al moverse, y así no
  // se sale del borde.
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
