/**
 * Una preferencia de este navegador en `localStorage`, para leer con
 * `useSyncExternalStore`. Si `localStorage` está bloqueado, queda en memoria.
 */
export function createPreference(key: string) {
  const listeners = new Set<() => void>();
  let inMemory: string | null = null;
  let memoryOnly = false;

  function read(): string | null {
    if (memoryOnly) return inMemory;
    try {
      return localStorage.getItem(key);
    } catch {
      return inMemory;
    }
  }

  function write(value: string) {
    inMemory = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryOnly = true;
    }
    for (const notify of listeners) notify();
  }

  function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }

  return { read, write, subscribe };
}
