/**
 * Una preferencia de este navegador en `localStorage`, para leer con
 * `useSyncExternalStore`. Si `localStorage` está bloqueado, queda en memoria.
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
