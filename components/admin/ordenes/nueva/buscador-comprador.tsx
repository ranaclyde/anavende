"use client";

import { UserSearch, X } from "lucide-react";
import { useId, useState } from "react";

import {
  ALTO_DEL_DIALOGO,
  CuerpoDeBusqueda,
  RENGLON_DE_RESULTADO,
  useBusqueda,
} from "@/components/admin/ordenes/nueva/busqueda";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buscarCompradores } from "@/modules/orders/actions-manual";
import type { CompradorParaLaOrden } from "@/modules/orders/queries-manual";

async function buscar(q: string) {
  const r = await buscarCompradores({ q });
  return r.ok ? r.data.resultados : [];
}

/**
 * Asociar la orden a un comprador registrado — FS RF-24. Tarea F7.4.
 *
 * **Es opcional, y el requisito lo dice así**: la orden manual existe
 * justamente para la venta de alguien que no tiene cuenta. Cuando la tiene,
 * asociarla hace que le aparezca en «Mis compras» como cualquier otra.
 *
 * Al elegir una cuenta, el formulario completa el nombre, el teléfono y el
 * email, y ofrece sus direcciones (decisión del 2026-09-16). Todo eso queda
 * editable: lo que se guarda es el snapshot de ESTE pedido, y quien compra
 * para un tercero pone los datos del tercero (F6.1).
 *
 * **La búsqueda va en un diálogo** (2026-09-30), igual que la de productos:
 * con la lista debajo del campo, cada búsqueda empujaba el resto del
 * formulario hacia abajo. A diferencia de aquélla, **elegir cierra el
 * diálogo**: una orden tiene una sola cuenta.
 */
export function BuscadorDeComprador({
  elegido,
  alElegir,
  alQuitar,
}: {
  elegido: CompradorParaLaOrden | null;
  alElegir: (comprador: CompradorParaLaOrden) => void;
  alQuitar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-panel-card border border-border bg-surface-sunken px-3 py-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm font-medium text-ink">
            {elegido.nombre}
          </span>
          <span className="truncate text-caption text-ink-secondary">
            {elegido.email}
          </span>
        </span>
        <Button type="button" variant="tertiary" size="sm" onClick={alQuitar}>
          <X aria-hidden />
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setAbierto(true)}
      >
        <UserSearch aria-hidden />
        Asociar una cuenta
      </Button>

      <DialogContent className={ALTO_DEL_DIALOGO}>
        <DialogHeader>
          <DialogTitle>Asociar una cuenta</DialogTitle>
          <DialogDescription>
            Al elegirla se completan los datos que estén vacíos, y la orden le
            aparece en «Mis compras». Si no tiene cuenta, la venta se carga
            igual.
          </DialogDescription>
        </DialogHeader>

        {/* Se desmonta al cerrar, y con eso la búsqueda: la próxima vez que
            se abre es para buscar a otra persona. */}
        {abierto ? (
          <Resultados
            alElegir={(c) => {
              alElegir(c);
              setAbierto(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Resultados({
  alElegir,
}: {
  alElegir: (comprador: CompradorParaLaOrden) => void;
}) {
  const [termino, setTermino] = useState("");
  const { resultados, buscando } = useBusqueda(termino, buscar);
  const campo = useId();

  return (
    <CuerpoDeBusqueda
      campo={campo}
      etiqueta="Buscar una cuenta"
      placeholder="Nombre o email"
      termino={termino}
      alCambiar={setTermino}
      buscando={buscando}
      cantidad={resultados.length}
      inicial="Escribí el nombre o el email de la cuenta."
      vacio="Nadie con ese nombre o email. La venta se puede cargar igual, sin cuenta."
    >
      {resultados.map((c) => (
        <li key={c.id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            onClick={() => alElegir(c)}
            className={RENGLON_DE_RESULTADO}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm text-ink">{c.nombre}</span>
              <span className="truncate text-caption text-ink-secondary">
                {c.email}
              </span>
            </span>
          </button>
        </li>
      ))}
    </CuerpoDeBusqueda>
  );
}
