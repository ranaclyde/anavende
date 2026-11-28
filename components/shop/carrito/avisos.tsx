import { formatMoney } from "@/lib/money";
import type { Aviso } from "@/modules/cart/revision";

/**
 * Lo que cambió en precio y stock (RF-08). Sale una sola vez —la revisión deja
 * el carrito al día— y no frena nada: lo de abajo ya está corregido.
 */
export function Avisos({ avisos }: { avisos: Aviso[] }) {
  return (
    <section
      role="status"
      aria-labelledby="avisos-titulo"
      className="flex flex-col gap-2 rounded-card bg-warning-tint p-4 sm:p-5"
    >
      <h2 id="avisos-titulo" className="text-body font-medium text-ink">
        Tu carrito cambió desde la última vez
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-ink">
        {avisos.map((aviso) => (
          <li key={`${aviso.tipo}-${aviso.variantId}`}>{textoDe(aviso)}</li>
        ))}
      </ul>
    </section>
  );
}

function textoDe(aviso: Aviso): string {
  if (aviso.tipo === "precio") {
    return `El precio de ${aviso.nombre} pasó de ${formatMoney(aviso.antes)} a ${formatMoney(aviso.ahora)}.`;
  }
  return aviso.quedan === 1
    ? `Queda 1 sola unidad de ${aviso.nombre}: dejamos 1 en tu carrito.`
    : `Quedan ${aviso.quedan} unidades de ${aviso.nombre}: ajustamos la cantidad a ${aviso.quedan}.`;
}
