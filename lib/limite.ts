import "server-only";

/**
 * Un tope de pedidos por ventana de tiempo — TECHNICAL-SPEC §16, F10.5.
 *
 * Lo usa la subida de imágenes, que es lo único que §16 pide limitar además
 * de Auth (y Auth lo limita GoTrue). Cada subida pone a sharp a generar
 * cuatro tamaños, y sharp es lo que más memoria come en el servidor (§9, R3):
 * un cliente que entre en un bucle, o una sesión de administradora robada,
 * puede tumbar el contenedor a fuerza de fotos sin pasar por ningún otro
 * control, porque todas son legítimas una por una.
 *
 * **En memoria, a propósito.** La aplicación corre en un solo contenedor
 * (§18), así que un `Map` ve todos los pedidos; Redis sería un servicio más
 * para mantener sin nada que lo justifique. Si un día hay dos réplicas, cada
 * una cuenta por su lado y el tope real pasa a ser el doble: sigue frenando
 * el bucle, que es para lo que está.
 *
 * Ventana deslizante: se guardan los instantes de los pedidos de cada clave y
 * se descartan los que ya salieron de la ventana. Con una ventana fija, el
 * tope entero cabría dos veces seguidas alrededor del cambio de minuto.
 */

const pedidos = new Map<string, number[]>();

export type Resultado =
  { permitido: true } | { permitido: false; reintentarEnSegundos: number };

export function consumir(
  clave: string,
  { tope, ventanaMs }: { tope: number; ventanaMs: number },
  ahora: number = Date.now(),
): Resultado {
  const desde = ahora - ventanaMs;
  const recientes = (pedidos.get(clave) ?? []).filter((t) => t > desde);

  if (recientes.length >= tope) {
    pedidos.set(clave, recientes);
    // Se libera un lugar cuando sale de la ventana el más viejo.
    const libre = recientes[0] + ventanaMs - ahora;
    return {
      permitido: false,
      reintentarEnSegundos: Math.max(1, Math.ceil(libre / 1000)),
    };
  }

  recientes.push(ahora);
  pedidos.set(clave, recientes);
  return { permitido: true };
}

/** Solo para los tests: cada uno arranca sin pedidos anteriores. */
export function reiniciarLimites(): void {
  pedidos.clear();
}
