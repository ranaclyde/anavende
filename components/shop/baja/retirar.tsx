"use client";

import { Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { retirarElPedidoDeBaja } from "@/modules/users/baja/actions";

/** Sin confirmación a propósito: deshacer una baja no rompe nada. */
export function RetirarPedidoDeBaja() {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function retirar() {
    setError(null);
    iniciar(async () => {
      const r = await retirarElPedidoDeBaja({});
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        size="md"
        loading={enCurso}
        loadingLabel="Retirando el pedido"
        onClick={retirar}
      >
        <Undo2 aria-hidden />
        Retirar el pedido de baja
      </Button>
      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
