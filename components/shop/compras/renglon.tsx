import { formatMoney } from "@/lib/money";
import type { ItemDeLaOrden } from "@/modules/orders/queries";

/**
 * Misma forma que el resumen del checkout, pero sin foto a propósito: el
 * snapshot (RN-12) no guarda imágenes, y la del producto de hoy al lado del
 * precio de ayer podría ser otro producto.
 */
export function RenglonDelPedido({ item }: { item: ItemDeLaOrden }) {
  return (
    <li className="flex gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-sm font-medium text-ink">{item.nombre}</p>
        <p className="text-caption text-ink-secondary tabular-nums">
          {item.color ? `${item.color} · ` : ""}
          {item.cantidad} × {formatMoney(item.precioUnitario)}
        </p>
      </div>
      <p className="text-body-sm font-medium text-ink tabular-nums">
        {formatMoney(item.subtotal)}
      </p>
    </li>
  );
}
