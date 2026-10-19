"use client";

import { FalloDePantalla } from "@/components/ui/fallo-de-pantalla";

/** Una pantalla de la tienda que falló, con el encabezado puesto (§8). */
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
