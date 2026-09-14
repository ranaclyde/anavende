"use client";

import { LogOut } from "lucide-react";
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
      <LogOut aria-hidden />
      Cerrar sesión
    </Button>
  );
}
