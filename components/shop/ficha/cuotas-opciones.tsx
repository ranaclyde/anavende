"use client";

import Image from "next/image";
import { useState } from "react";
import { CreditCard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AREA_TACTIL, cn } from "@/lib/utils";

/** Una promoción, ya formateada en el servidor. */
export type OpcionDeCuotas = {
  id: string;
  /** «NaranjaX» o «Plan Z de NaranjaX». */
  quien: string;
  logoUrl: string | null;
  cuotas: number;
  /** «$ 26.666,67». */
  cuota: string;
  sinRecargo: boolean;
};

/**
 * «Ver otras opciones» y el modal con todas las promociones que aplican al
 * producto — RF-40, F2.17, pedido del 2026-11-16 sobre el de MercadoLibre.
 *
 * **Filas y no una grilla de logos**: MercadoLibre muestra solo «12 cuotas»
 * porque tiene decenas de bancos; acá son pocos medios y entra el monto de
 * la cuota, que es lo que se compara. Dos grupos —mismo precio y con
 * recargo—, cada uno de menos a más cuotas. Sin el total con recargo: lo
 * calcula quien compra (decisión del 2026-11-16).
 *
 * Isla de cliente y chica: los montos llegan formateados, así que no viaja
 * `decimal.js` para poner un punto de miles.
 */
export function OtrasOpcionesDeCuotas({
  opciones,
}: {
  opciones: OpcionDeCuotas[];
}) {
  const [abierto, setAbierto] = useState(false);
  const sinRecargo = opciones.filter((o) => o.sinRecargo);
  const conRecargo = opciones.filter((o) => !o.sinRecargo);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "relative w-fit cursor-pointer rounded-pill text-left",
          "underline decoration-border-strong underline-offset-4 hover:text-ink hover:decoration-ink-secondary",
          AREA_TACTIL,
        )}
      >
        Ver otras opciones
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuotas para este producto</DialogTitle>
            {/* RN-01: la web no cobra. Dicho donde se eligen, no escondido. */}
            <DialogDescription>
              Las elegís cuando coordinamos el pago por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            {sinRecargo.length ? (
              <Grupo titulo="Mismo precio" opciones={sinRecargo} />
            ) : null}
            {conRecargo.length ? (
              <Grupo titulo="Con recargo" opciones={conRecargo} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Grupo({
  titulo,
  opciones,
}: {
  titulo: string;
  opciones: OpcionDeCuotas[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body-sm font-semibold text-ink">{titulo}</h3>
      <ul className="flex flex-col divide-y divide-border">
        {opciones.map((o) => (
          <li key={o.id} className="flex items-center gap-3 py-2.5">
            {/* El mismo chip claro de los logos de pago del panel (§6.10):
                los logos vienen sobre transparente y no son nuestros para
                repintarlos. Sin logo, la tarjeta genérica. */}
            <span className="relative grid h-8 w-14 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-logo-chip">
              {o.logoUrl ? (
                <Image
                  src={o.logoUrl}
                  alt=""
                  width={112}
                  height={64}
                  className="absolute inset-0 size-full object-contain p-[3px]"
                />
              ) : (
                <CreditCard aria-hidden className="size-4 text-logo-chip-ink" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-body-sm font-semibold tabular-nums",
                  o.sinRecargo ? "text-success" : "text-ink",
                )}
              >
                {o.cuotas} cuotas de {o.cuota}
              </span>
              <span className="text-caption text-ink-secondary">
                con {o.quien}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
