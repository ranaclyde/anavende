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
 * En gris y con la cuota en tinta. **Sin interés, en verde hasta la cuota**
 * —«Mismo precio en 3 cuotas de $ X»— y «con …» sigue en gris (pedidos del
 * 2026-11-16): el verde de éxito y no el de WhatsApp, que es solo de lo que abre WhatsApp (§2.6) y está justo
 * debajo. **Sin ícono y en `caption`**: informa, y no pesa más que el texto
 * de abajo (2026-11-16).
 */
export function CuotasDeLaFicha({
  promociones,
}: {
  promociones: PromocionesDeLaFicha;
}) {
  const { destacada: p, todas } = promociones;
  if (!p) return null;

  return (
    <div className="flex flex-col gap-1 pt-1 text-caption text-ink-secondary">
      <p>
        <span className={p.sinRecargo ? "text-success" : undefined}>
          {p.sinRecargo ? "Mismo precio en " : null}
          <strong
            className={cn(
              "font-semibold tabular-nums",
              p.sinRecargo ? null : "text-ink",
            )}
          >
            {p.cuotas} cuotas de {formatMoney(p.cuota)}
          </strong>
        </span>{" "}
        con {conQuien(p)}
      </p>

      {todas.length < 2 ? null : (
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
      )}
    </div>
  );
}
