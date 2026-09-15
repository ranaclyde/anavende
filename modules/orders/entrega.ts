/**
 * La forma de entrega de una orden — FS RF-11, RF-24 · TS §5.6.
 *
 * **No tiene columna: se deduce de la dirección** (decisión del 2026-09-14).
 * Con dirección es un envío; sin ella, un retiro. Vale porque todo envío lleva
 * dirección —el checkout la exige, y la orden manual de F7.4 también—, y una
 * columna aparte guardaría el mismo dato dos veces, con el riesgo de que un
 * día se contradigan.
 *
 * Es **la única lectura de esa regla**: el checkout, el panel, el email E4 y
 * el mensaje de WhatsApp preguntan acá y no repiten el `IS NULL`. Si alguna
 * vez aparece una tercera forma de entrega, este es el lugar que avisa que
 * hace falta la columna.
 *
 * Sin `server-only`: no toca la base, y la pantalla también la usa.
 */

export type FormaDeEntrega = "envio" | "retiro";

export function formaDeEntrega(orden: {
  shippingAddress: object | null;
}): FormaDeEntrega {
  return orden.shippingAddress ? "envio" : "retiro";
}
