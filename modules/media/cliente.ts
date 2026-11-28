import { TAMANO_MAXIMO, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

// No es una barrera: el servidor vuelve a validar mirando los bytes
// (`validar.ts`). Esto evita subir diez megas para enterarse del rechazo.

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

/** «optimizando»: los bytes ya salieron y el servidor convierte y sube a Storage. */
export type Progreso = {
  fase: "subiendo" | "optimizando";
  porcentaje: number;
};

export type ResultadoDeSubida =
  { ok: true; data: unknown } | { ok: false; message: string };

/**
 * `XMLHttpRequest` y no `fetch`, a propósito: `fetch` no expone el progreso
 * de subida en todos los navegadores, y RF-17 lo pide.
 */
export function subirImagen(
  campos: Record<string, string>,
  archivo: File,
  alProgreso?: (p: Progreso) => void,
  // La foto de perfil va a su propia ruta: la del panel es solo de administradoras.
  ruta: "/api/admin/upload" | "/api/mi-cuenta/foto" = "/api/admin/upload",
): Promise<ResultadoDeSubida> {
  return new Promise((resolve) => {
    const cuerpo = new FormData();
    for (const [clave, valor] of Object.entries(campos)) {
      cuerpo.set(clave, valor);
    }
    cuerpo.set("archivo", archivo);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", ruta);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      alProgreso?.({
        fase: "subiendo",
        porcentaje: Math.round((e.loaded / e.total) * 100),
      });
    };

    xhr.upload.onload = () =>
      alProgreso?.({ fase: "optimizando", porcentaje: 100 });

    xhr.onload = () => {
      let json: { ok?: boolean; data?: unknown; message?: string } | null =
        null;
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
        message:
          "Se cortó la conexión mientras subía la imagen. Probá de nuevo.",
      });

    xhr.send(cuerpo);
  });
}
