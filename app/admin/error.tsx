"use client";

import { FalloDePantalla } from "@/components/ui/fallo-de-pantalla";

/** Una pantalla del panel que falló, con el menú puesto (§8). */
export default function ErrorDelPanel(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <FalloDePantalla
      {...props}
      inicio={{ href: "/admin", texto: "Volver al inicio del panel" }}
    />
  );
}
