import { CreditCard } from "lucide-react";

import {
  OtrasOpcionesDeCuotas,
  type OpcionDeCuotas,
} from "@/components/shop/ficha/cuotas-opciones";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  conQuien,
  type PromocionesDeLaFicha,
} from "@/modules/settings/promociones";

/**
 * Las promociones de cuotas, debajo del precio — RF-40, F2.17.
 *
 * **Una sola a la vista**, la que eligió `promocionesParaElPrecio`; con dos
 * o más, «Ver otras opciones» abre un modal con todas, esta incluida. Con
 * una sola no hay enlace: prometería otras opciones que no hay (decisión del
 * 2026-11-16).
 *
 * Con recargo, en gris y con la cuota en tinta. **Sin interés, el renglón
 * entero va en verde**, ícono y texto (pedidos del 2026-11-16): el verde de
 * éxito y no el de WhatsApp, que es solo de lo que abre WhatsApp (§2.6) y
 * está justo debajo.
 */
export function CuotasDeLaFicha({
  promociones,
}: {
  promociones: PromocionesDeLaFicha;
}) {
  const { destacada: p, todas } = promociones;
  if (!p) return null;

  return (
    <div className="flex flex-col gap-1 pt-1 text-body-sm text-ink-secondary">
      <p
        className={cn(
          "flex items-start gap-2",
          p.sinRecargo ? "text-success" : null,
        )}
      >
        <CreditCard aria-hidden className="mt-[3px] size-4 shrink-0" />
        <span>
          {p.sinRecargo ? "Mismo precio en " : null}
          <strong
            className={cn(
              "font-semibold tabular-nums",
              p.sinRecargo ? null : "text-ink",
            )}
          >
            {p.cuotas} cuotas de {formatMoney(p.cuota)}
          </strong>{" "}
          con {conQuien(p)}
        </span>
      </p>

      {todas.length < 2 ? null : (
        <div className="pl-6">
          <OtrasOpcionesDeCuotas
            opciones={todas.map((o): OpcionDeCuotas => ({
              id: o.id,
              quien: conQuien(o),
              logoUrl: o.logoUrl,
              cuotas: o.cuotas,
              cuota: formatMoney(o.cuota),
              sinRecargo: o.sinRecargo,
            }))}
          />
        </div>
      )}
    </div>
  );
}
