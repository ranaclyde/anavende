import { TAMANO_MAXIMO, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

/**
 * El lado del navegador de la subida — RF-17, §9.1.
 *
 * Acá vive lo que el cliente necesita para subir una imagen, una sola vez: el
 * rechazo temprano y el envío con progreso. Lo tenía el diálogo de marcas
 * desde F2.1; con las variantes de F2.4 pasó a haber un segundo consumidor, y
 * dos copias de la misma regla son dos reglas el día que una se corrige.
 *
 * NO ES UNA BARRERA. El servidor vuelve a mirar todo, y además mira los bytes
 * y no el tipo que declara el navegador (`modules/media/validar.ts`). Esto es
 * una cortesía: contestar sin hacer esperar diez megabytes de subida para
 * decir que el archivo no servía.
 */

export function motivoDeRechazo(archivo: File): string | null {
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) {
    return "Ese archivo no es una imagen JPG, PNG ni WEBP.";
  }
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return `La imagen pesa ${mb} MB y el máximo son 10 MB. Probá con una más chica.`;
  }
  return null;
}

/**
 * Las dos fases que ve quien sube, y son distintas de verdad: primero salen
 * los bytes por la red, y después el servidor los convierte a tres tamaños y
 * los sube a Storage (§9.1). En una foto de 8 MB la segunda no es
 * instantánea: quedarse en «100%» sin decir nada parece que se colgó.
 */
export type Progreso = {
  fase: "subiendo" | "optimizando";
  porcentaje: number;
};

export type ResultadoDeSubida =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

/**
 * Sube un archivo al Route Handler informando el avance.
 *
 * **Con `XMLHttpRequest` y no con `fetch`, a propósito.** `fetch` no expone el
 * progreso de subida: el cuerpo como stream necesita HTTP/2 y `duplex`, y no
 * está en todos los navegadores. RF-17 pide progreso, así que se usa la API
 * que lo da. Es el único `XMLHttpRequest` del proyecto y este comentario es el
 * motivo.
 */
export function subirImagen(
  campos: Record<string, string>,
  archivo: File,
  alProgreso?: (p: Progreso) => void,
): Promise<ResultadoDeSubida> {
  return new Promise((resolve) => {
    const cuerpo = new FormData();
    for (const [clave, valor] of Object.entries(campos)) {
      cuerpo.set(clave, valor);
    }
    cuerpo.set("archivo", archivo);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      alProgreso?.({
        fase: "subiendo",
        porcentaje: Math.round((e.loaded / e.total) * 100),
      });
    };

    // Terminaron de salir los bytes; el trabajo del servidor recién empieza.
    xhr.upload.onload = () =>
      alProgreso?.({ fase: "optimizando", porcentaje: 100 });

    xhr.onload = () => {
      let json: { ok?: boolean; data?: unknown; message?: string } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && json?.ok) {
        resolve({ ok: true, data: json.data });
        return;
      }

      resolve({
        ok: false,
        message:
          json?.message ?? "No pudimos guardar la imagen. Probá de nuevo.",
      });
    };

    xhr.onerror = () =>
      resolve({
        ok: false,
        message: "Se cortó la conexión mientras subía la imagen. Probá de nuevo.",
      });

    xhr.send(cuerpo);
  });
}
