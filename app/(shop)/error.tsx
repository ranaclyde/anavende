"use client";

import { FalloDePantalla } from "@/components/ui/fallo-de-pantalla";

/** Dentro del layout de la tienda: el fallo sale con el encabezado puesto. */
export default function ErrorDeLaTienda(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <FalloDePantalla
      {...props}
      inicio={{ href: "/", texto: "Volver al inicio" }}
    />
  );
}
