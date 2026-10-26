import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * La cara de una cuenta — F5.9: la foto que subió, o su blobatar.
 *
 * **Recibe la `src` ya resuelta** (`caraDe`, en `modules/users/avatar.ts`) y
 * no decide nada: es un círculo con una imagen adentro. Así sirve igual en un
 * componente de servidor que en el encabezado, que es de cliente, sin cargar
 * el generador en el navegador.
 *
 * **Decorativa (`alt=""`)**: en todos los lugares donde aparece, el nombre de
 * la persona está escrito al lado, y un lector de pantalla que dijera «foto de
 * Ana» antes de «Ana» repetiría lo mismo dos veces. Donde no hay nombre a la
 * vista, quien la usa lo pone en `sr-only`.
 *
 * `unoptimized` porque ya llega optimizada: la foto es un único WEBP de 256px
 * hecho al subirla (§9.0) y el blobatar es un SVG en un `data:`. Pasarlas por
 * `/_next/image` sería volver a comprimir lo comprimido.
 *
 * El anillo de `--border` es para la foto de fondo blanco, que sobre la
 * superficie blanca no tendría borde.
 */
export const TAMANOS_DE_AVATAR = {
  32: "size-8",
  40: "size-10",
  64: "size-16",
  96: "size-24",
} as const;

export function Avatar({
  src,
  tamano = 32,
  arriba = false,
  className,
}: {
  src: string;
  tamano?: keyof typeof TAMANOS_DE_AVATAR;
  /**
   * Para la cara grande de una pantalla —«Mis datos», la ficha del panel—,
   * que está arriba de todo y en una cuenta nueva es lo más grande que hay:
   * Next la marca como el LCP, y con la carga diferida llega tarde.
   */
  arriba?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={tamano}
      height={tamano}
      loading={arriba ? "eager" : "lazy"}
      unoptimized
      className={cn(
        "shrink-0 rounded-pill bg-surface-sunken object-cover ring-1 ring-border",
        TAMANOS_DE_AVATAR[tamano],
        className,
      )}
    />
  );
}
