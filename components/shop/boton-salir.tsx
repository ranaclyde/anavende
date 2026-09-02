"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { salir } from "@/modules/users/actions";

export function BotonSalir() {
  const [saliendo, iniciar] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      className="self-start"
      loading={saliendo}
      loadingLabel="Cerrando sesión"
      onClick={() => iniciar(() => salir())}
    >
      Cerrar sesión
    </Button>
  );
}
