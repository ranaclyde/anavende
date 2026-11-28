/** «2 órdenes y 1 carrito»: por qué algo no se borró y se desactivó (RN-11). */
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
