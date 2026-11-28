import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { domainMessage, isDomainError } from "@/lib/errors";
import { consumir } from "@/lib/limite";
import { getSession } from "@/lib/session";
import { publicarFotoDePerfil } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * Route Handler por lo mismo que `app/api/admin/upload`: los controles del
 * envoltorio de §6.2 se repiten acá a mano. Ruta aparte para no aflojar el
 * control de rol de aquella con una excepción por destino.
 *
 * Siempre sobre la cuenta de la sesión: no recibe un id (§13.8).
 *
 * Corre en Node, no en Edge: sharp es un binario nativo.
 */
export const runtime = "nodejs";

/** Cualquier cuenta llega acá: el tope impide que una sola sature sharp. */
const SUBIDAS = { tope: 10, ventanaMs: 10 * 60_000 };

function fallo(status: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, message }, { status, headers });
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return fallo(401, "Tu sesión se cerró. Volvé a ingresar y probá de nuevo.");
  }
  if (session.profile.isBanned) {
    return fallo(403, domainMessage("USER_BANNED"));
  }
  // `!= null`: una fila leída sin la columna no deja a todos dados de baja.
  if (session.profile.closedAt != null) {
    return fallo(403, domainMessage("ACCOUNT_CLOSED"));
  }
  if (session.profile.closureRequestedAt != null) {
    return fallo(403, domainMessage("ACCOUNT_CLOSURE_PENDING"));
  }

  // Antes de leer el cuerpo: una subida rechazada no llega a memoria.
  const limite = consumir(`foto:${session.profile.id}`, SUBIDAS);
  if (!limite.permitido) {
    return fallo(
      429,
      `Cambiaste la foto muchas veces seguidas. Esperá ${Math.ceil(limite.reintentarEnSegundos / 60)} minutos y probá de nuevo.`,
      { "Retry-After": String(limite.reintentarEnSegundos) },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fallo(400, "No pudimos leer el archivo. Probá de nuevo.");
  }

  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return fallo(400, "No llegó ninguna foto. Elegila de nuevo.");
  }

  // Por tamaño ANTES de traer el cuerpo a memoria.
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return fallo(
      413,
      `La foto pesa ${mb} MB y el máximo son 10 MB. Probá con una más chica.`,
    );
  }

  try {
    const data = await publicarFotoDePerfil({
      userId: session.profile.id,
      archivo: Buffer.from(await archivo.arrayBuffer()),
    });

    // La foto está en el encabezado de toda la tienda. La otra mitad es el
    // `router.refresh()` de quien llama.
    revalidatePath("/", "layout");

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    // Esperado, no un incidente: no va a Sentry (§6.3).
    if (isDomainError(e)) {
      return fallo(400, e.message);
    }

    Sentry.captureException(e);
    return fallo(
      500,
      "No pudimos guardar la foto. Probá de nuevo en un momento.",
    );
  }
}
