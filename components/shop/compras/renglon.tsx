import { formatMoney } from "@/lib/money";
import type { ItemDeLaOrden } from "@/modules/orders/queries";

/**
 * Un renglón de un pedido: producto, color, cantidad, precio y subtotal.
 * Compartido por la confirmación (F6.3) y el detalle de «Mis compras» (F6.5).
 *
 * **Tiene la misma forma que el resumen del checkout** (F6.1) — quien acaba de
 * confirmar está comparando una pantalla con la anterior, y que se lean igual
 * es parte de que se entienda que es lo mismo.
 *
 * **Sin foto, y ahí termina el parecido.** Estos datos salen del snapshot
 * (RN-12), que no guarda imágenes; el del checkout sale del carrito, que las
 * tiene. Traerlas del producto de hoy mostraría la foto actual al lado del
 * precio de ayer — y en «Mis compras», donde se mira una compra vieja, sería
 * directamente otro producto.
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
