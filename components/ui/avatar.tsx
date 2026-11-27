import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * La foto de una cuenta o su blobatar. Recibe la `src` ya resuelta (`caraDe`)
 * para no cargar el generador en el navegador.
 *
 * Decorativa (`alt=""`): el nombre está escrito al lado; donde no, quien la usa
 * lo pone en `sr-only`. `unoptimized` porque ya llega optimizada (WEBP de
 * 256px o SVG en `data:`).
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
  /** Carga sin diferir: la cara grande de una pantalla puede ser el LCP. */
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
