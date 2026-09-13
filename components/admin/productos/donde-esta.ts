/**
 * «2 órdenes y 1 carrito»: por qué algo no se pudo borrar y se desactivó
 * (RN-11). La vendedora ve el motivo con el número, en vez de un «no se
 * puede» que la deja preguntándose qué lo está usando.
 *
 * Desde F5.6 los carritos también cuentan: borrar lo que alguien tiene en el
 * carrito se lo llevaría de ahí sin aviso (RF-08).
 */
export function dondeEsta(ordenes: number, carritos: number): string {
  const partes: string[] = [];
  if (ordenes > 0) {
    partes.push(ordenes === 1 ? "1 orden" : `${ordenes} órdenes`);
  }
  if (carritos > 0) {
    partes.push(carritos === 1 ? "1 carrito" : `${carritos} carritos`);
  }
  return partes.join(" y ");
}
