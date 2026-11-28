// Sin `server-only`: lo usa la ficha en el cliente. No importa `lib/money.ts`
// para no meter `decimal.js` en el navegador: los montos llegan formateados.

export type ProductoParaMensaje = {
  nombre: string;
  marca: string;
  color: string | null;
  /** Absoluta, con el `?color=` puesto. */
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

/** RF-03. Sin cantidad ni precio: es una pregunta por algo que hoy no hay. */
export function mensajeDeDisponibilidad(p: ProductoParaMensaje): string {
  return [
    "¡Hola! Vi que esto está sin stock y quería saber si va a haber:",
    "",
    ...encabezado(p),
    "",
    p.url,
  ].join("\n");
}

// Sin `encodeURIComponent`, un `$` corta el texto en algunos clientes y los
// saltos de línea se pierden.
export function enlaceDeWhatsApp(numero: string, mensaje: string): string {
  const soloDigitos = numero.replace(/\D/g, "");
  return `https://wa.me/${soloDigitos}?text=${encodeURIComponent(mensaje)}`;
}

/** Del snapshot (RN-12). Sin `url`: el producto pudo cambiar desde entonces. */
export type ItemDeOrdenParaMensaje = {
  nombre: string;
  marca: string;
  color: string | null;
  cantidad: number;
};

/** RF-12. `nombre` es el del pedido, no el de la cuenta. */
export function mensajeDeOrden(
  numero: number,
  nombre: string,
  items: ItemDeOrdenParaMensaje[],
  total: string,
): string {
  return [
    "¡Hola! Acabo de hacer un pedido en la web.",
    "",
    `Pedido #${numero}, a nombre de ${nombre}`,
    "",
    ...items.map(
      (i) =>
        `${i.cantidad} × ${i.nombre} (${i.marca})` +
        (i.color ? `, ${i.color.toLowerCase()}` : ""),
    ),
    `Total: ${total}`,
    "",
    "Te escribo para agilizar el pago y la entrega.",
  ].join("\n");
}

/** RF-21: el único de la vendedora al comprador. */
export function mensajeParaElComprador(numero: number): string {
  return [
    `¡Hola! Te escribo de AnaVende por tu pedido #${numero}.`,
    "",
    "¿Coordinamos el pago y la entrega?",
  ].join("\n");
}

/** RF-35. */
export function mensajeDeBusquedaSinResultados(buscado: string): string {
  return `¡Hola! Busqué «${buscado.trim()}» entre las categorías y no lo encontré. ¿Lo tienen o piensan traerlo?`;
}

export function mensajeDeConsultaGeneral(): string {
  return "¡Hola! Quería consultar por algo que no encontré entre las categorías de la tienda.";
}

export function mensajeDesdeNosotros(): string {
  return "¡Hola, Ana! Estuve leyendo sobre la tienda y quería hacerte una consulta.";
}
