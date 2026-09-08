/**
 * Enlaces de WhatsApp — F3.6, RF-04 y RF-03; TECHNICAL-SPEC §3 y §4.
 *
 * **No hay integración de servidor** (§3): son enlaces `wa.me` que abre el
 * navegador de quien mira la página. Por eso este archivo NO lleva
 * `server-only` — lo usa la ficha desde el cliente, donde el mensaje depende
 * del color y de la cantidad que se están viendo en ese momento.
 *
 * Tampoco importa `lib/money.ts`: los montos llegan ya formateados. Traer
 * `formatMoney` metería `decimal.js` entero en el paquete del navegador para
 * poner un punto de miles.
 */

/**
 * Los dos mensajes del sistema, y por qué son dos.
 *
 * El de COMPRA (RF-04) es un pedido: lleva cantidad y precio, que es lo que
 * la vendedora necesita para contestar con un total. El de DISPONIBILIDAD
 * (RF-03) es una pregunta sobre algo que hoy no existe, así que no lleva
 * ninguno de los dos: cotizar una unidad que no está en la caja es un precio
 * que después hay que desdecir, y una cantidad que nadie puede prometer.
 */
export type ProductoParaMensaje = {
  nombre: string;
  marca: string;
  /** El de la variante elegida. `null` si el producto no viene en colores. */
  color: string | null;
  /** Absoluta, y con el `?color=` puesto: es el enlace que abre lo que se vio. */
  url: string;
};

function encabezado(p: ProductoParaMensaje): string[] {
  const lineas = [`${p.nombre} (${p.marca})`];
  if (p.color) lineas.push(`Color: ${p.color.toLowerCase()}`);
  return lineas;
}

/** RF-04. `precioUnitario` llega formateado: «$ 24.500,00». */
export function mensajeDeCompra(
  p: ProductoParaMensaje,
  cantidad: number,
  precioUnitario: string,
): string {
  return [
    "¡Hola! Quiero comprar esto:",
    "",
    ...encabezado(p),
    `Cantidad: ${cantidad}`,
    `Precio por unidad: ${precioUnitario}`,
    "",
    p.url,
  ].join("\n");
}

/**
 * RF-03, la ficha sin stock.
 *
 * Dice «vi que está sin stock» a propósito: sin eso, la vendedora recibe una
 * consulta idéntica a la de compra y tiene que ir a fijarse por qué le
 * preguntan en vez de responderla.
 */
export function mensajeDeDisponibilidad(p: ProductoParaMensaje): string {
  return [
    "¡Hola! Vi que esto está sin stock y quería saber si va a haber:",
    "",
    ...encabezado(p),
    "",
    p.url,
  ].join("\n");
}

/**
 * `https://wa.me/<numero>?text=<mensaje>`.
 *
 * El número se guarda normalizado a `+549` más diez dígitos
 * (`lib/telefono.ts`, RF-20), y `wa.me` lo quiere sin el `+` y sin nada que
 * no sea un dígito. Se limpia acá y no en quien llama: es una sola regla y
 * el día que alguien escriba una fila a mano con guiones, el enlace sigue
 * saliendo bien.
 *
 * `encodeURIComponent` es lo que resuelve el criterio de RF-04 —acentos,
 * saltos de línea y el `$`—: los tres viajan escapados y WhatsApp los
 * devuelve tal cual. Con el mensaje pegado crudo, un `$` corta el texto en
 * algunos clientes y los saltos de línea se pierden.
 */
export function enlaceDeWhatsApp(numero: string, mensaje: string): string {
  const soloDigitos = numero.replace(/\D/g, "");
  return `https://wa.me/${soloDigitos}?text=${encodeURIComponent(mensaje)}`;
}
