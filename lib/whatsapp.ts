// Sin `server-only`: lo usa la ficha en el cliente. No importa `lib/money.ts`
// para no meter `decimal.js` en el navegador: los montos llegan formateados.

export type ProductForMessage = {
  nombre: string;
  marca: string;
  color: string | null;
  /** Absoluta, con el `?color=` puesto. */
  url: string;
};

function header(p: ProductForMessage): string[] {
  const lines = [`${p.nombre} (${p.marca})`];
  if (p.color) lines.push(`Color: ${p.color.toLowerCase()}`);
  return lines;
}

/** RF-04. `unitPrice` llega formateado: «$ 24.500,00». */
export function purchaseMessage(
  p: ProductForMessage,
  quantity: number,
  unitPrice: string,
): string {
  return [
    "¡Hola! Quiero comprar esto:",
    "",
    ...header(p),
    `Cantidad: ${quantity}`,
    `Precio por unidad: ${unitPrice}`,
    "",
    p.url,
  ].join("\n");
}

/** RF-03. Sin cantidad ni precio: es una pregunta por algo que hoy no hay. */
export function availabilityMessage(p: ProductForMessage): string {
  return [
    "¡Hola! Vi que esto está sin stock y quería saber si va a haber:",
    "",
    ...header(p),
    "",
    p.url,
  ].join("\n");
}

// Sin `encodeURIComponent`, un `$` corta el texto en algunos clientes y los
// saltos de línea se pierden.
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Del snapshot (RN-12). Sin `url`: el producto pudo cambiar desde entonces. */
export type OrderItemForMessage = {
  nombre: string;
  marca: string;
  color: string | null;
  cantidad: number;
};

/** RF-12. `customerName` es el del pedido, no el de la cuenta. */
export function orderMessage(
  orderNumber: number,
  customerName: string,
  items: OrderItemForMessage[],
  total: string,
): string {
  return [
    "¡Hola! Acabo de hacer un pedido en la web.",
    "",
    `Pedido #${orderNumber}, a nombre de ${customerName}`,
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
export function messageToBuyer(orderNumber: number): string {
  return [
    `¡Hola! Te escribo de AnaVende por tu pedido #${orderNumber}.`,
    "",
    "¿Coordinamos el pago y la entrega?",
  ].join("\n");
}

/** RF-35. */
export function noResultsMessage(query: string): string {
  return `¡Hola! Busqué «${query.trim()}» entre las categorías y no lo encontré. ¿Lo tienen o piensan traerlo?`;
}

export function generalInquiryMessage(): string {
  return "¡Hola! Quería consultar por algo que no encontré entre las categorías de la tienda.";
}

export function aboutUsMessage(): string {
  return "¡Hola, Ana! Estuve leyendo sobre la tienda y quería hacerte una consulta.";
}
