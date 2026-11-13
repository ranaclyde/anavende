import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { variantImages } from "@/db/schema/catalog";
import { isDomainError } from "@/lib/errors";
import { consumir } from "@/lib/limite";
import { getSession } from "@/lib/session";
import { almacenamiento } from "@/lib/storage";
import { prepararCapas } from "@/modules/marca-de-agua/service";
import { capas as esquemaDeCapas } from "@/modules/marca-de-agua/schemas";
import { procesarImagen } from "@/modules/media/procesar";
import { clave, TAMANO_MAXIMO, TAMANOS } from "@/modules/media/tamanos";

/**
 * Vista previa de la marca de agua — RF-39, TECHNICAL-SPEC §9.6.
 *
 * Recibe una foto de prueba y las capas que están EN PANTALLA —sin guardar—
 * y devuelve la versión `-detail` con la marca, armada por `procesarImagen`:
 * la misma función, con los mismos números, que la subida de verdad. La foto
 * no se guarda en ningún lado.
 *
 * En vez de la foto puede venir `muestra`, el id de una foto de producto ya
 * subida y sin marca: con ella arranca la pantalla, para que la vista previa
 * no aparezca vacía. Se lee su `-detail`, que ya mide lo que va a medir.
 *
 * Route Handler y no Server Action por lo mismo que la subida: entra un
 * binario y sale otro.
 */
export const runtime = "nodejs";

/**
 * Más holgado que la subida (30 por minuto): cada control que se mueve pide
 * una vista nueva. El navegador espera a que se deje de mover, pero arrastrar
 * un deslizador igual dispara varias.
 */
const VISTAS = { tope: 120, ventanaMs: 60_000 };

const DETALLE = TAMANOS.filter((t) => t.sufijo === "detail");

const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/** Los bytes de la foto de muestra, o `null` si no es una sin marca. */
async function bytesDeMuestra(id: string): Promise<Buffer | null> {
  if (!ES_UUID.test(id)) return null;
  const [fila] = await db
    .select({ storageKey: variantImages.storageKey })
    .from(variantImages)
    .where(and(eq(variantImages.id, id), eq(variantImages.hasWatermark, false)))
    .limit(1);
  if (!fila) return null;
  return almacenamiento().get(clave(fila.storageKey, "detail"));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  // 404 y no 403, como la subida (§13.3).
  if (session?.role !== "admin" || session.profile.isBanned) {
    return error("No pudimos armar la vista previa. Actualizá la página.", 404);
  }

  const limite = consumir(`vista-marca:${session.profile.id}`, VISTAS);
  if (!limite.permitido) {
    return error(
      `Demasiadas vistas seguidas. Esperá ${limite.reintentarEnSegundos} segundos.`,
      429,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("No pudimos leer la foto. Elegila de nuevo.", 400);
  }

  const foto = form.get("foto");
  const muestra = form.get("muestra");
  if (foto instanceof File && foto.size > TAMANO_MAXIMO) {
    return error("La foto pesa más de 10 MB. Probá con una más chica.", 413);
  }
  if (!(foto instanceof File) && typeof muestra !== "string") {
    return error("Elegí una foto para probar.", 400);
  }

  let crudas: unknown;
  try {
    crudas = JSON.parse(String(form.get("capas") ?? "[]"));
  } catch {
    crudas = null;
  }
  const capas = esquemaDeCapas.safeParse(crudas);
  if (!capas.success) {
    return error("Alguna capa tiene un valor fuera de rango.", 400);
  }

  try {
    const original =
      foto instanceof File
        ? Buffer.from(await foto.arrayBuffer())
        : await bytesDeMuestra(String(muestra));
    if (!original) {
      return error("Esa foto ya no está. Elegí otra para probar.", 400);
    }
    const listas = await prepararCapas(capas.data);
    const { versiones } = await procesarImagen(original, DETALLE, listas);
    const [detalle] = versiones;

    return new NextResponse(new Uint8Array(detalle.cuerpo), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        // Es la foto de quien la está probando: que no la guarde nadie.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isDomainError(e)) return error(e.message, 400);
    Sentry.captureException(e);
    return error("No pudimos armar la vista previa. Probá de nuevo.", 500);
  }
}
