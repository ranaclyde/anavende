/**
 * La forma de entrega no tiene columna: se deduce de la dirección (con
 * dirección, envío). Es la única lectura de esa regla; nadie repite el `IS NULL`.
 *
 * Sin `server-only`: la pantalla también la usa.
 */

export type FormaDeEntrega = "envio" | "retiro";

export function formaDeEntrega(orden: {
  shippingAddress: object | null;
}): FormaDeEntrega {
  return orden.shippingAddress ? "envio" : "retiro";
}
