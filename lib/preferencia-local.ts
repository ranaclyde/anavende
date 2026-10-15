/**
 * Una preferencia de este navegador, guardada en `localStorage` y leída con
 * `useSyncExternalStore` — el menú colapsado y el tema del panel.
 *
 * **Por qué no un `useEffect` que la lea al montar.** Es lo que había, y pinta
 * dos veces: primero con el valor de relleno y después con el guardado. Las
 * reglas de React Hooks 7 lo marcan como error (`set-state-in-effect`), y
 * `useSyncExternalStore` es lo que la guía de React recomienda para leer algo
 * que vive fuera de React: el servidor y la hidratación usan
 * `getServerSnapshot`, y el cliente pasa al valor guardado sin efecto.
 *
 * **Sin almacenamiento, el cambio vale para esta sesión**, como antes: si
 * `localStorage` está bloqueado o no deja escribir, el valor queda en memoria
 * y se sigue leyendo de ahí.
 */
export function crearPreferencia(clave: string) {
  const oyentes = new Set<() => void>();
  let enMemoria: string | null = null;
  let soloEnMemoria = false;

  function leer(): string | null {
    if (soloEnMemoria) return enMemoria;
    try {
      return localStorage.getItem(clave);
    } catch {
      return enMemoria;
    }
  }

  function escribir(valor: string) {
    enMemoria = valor;
    try {
      localStorage.setItem(clave, valor);
    } catch {
      soloEnMemoria = true;
    }
    for (const avisar of oyentes) avisar();
  }

  function suscribir(avisar: () => void) {
    oyentes.add(avisar);
    return () => {
      oyentes.delete(avisar);
    };
  }

  return { leer, escribir, suscribir };
}
