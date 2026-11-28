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
 * Una sola promoción a la vista, la que eligió `promocionesParaElPrecio`; el
 * modal con todas aparece solo si hay dos o más (RF-40).
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
