import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { domainMessage, isDomainError } from "@/lib/errors";
import { consumir } from "@/lib/limite";
import { getSession } from "@/lib/session";
import { publicarFotoDePerfil } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * Subir la foto de perfil — RF-07, F5.9.
 *
 * **Por qué un Route Handler y no una Server Action**: el mismo motivo que la
 * subida del panel (`app/api/admin/upload/route.ts`) — una acción pasaría la
 * foto a base64 por el camino. Y como ahí, al no pasar por el envoltorio de
 * §6.2, sus controles se repiten acá a mano y en el mismo orden: sesión,
 * bloqueo, baja ejecutada, baja pedida.
 *
 * **Una ruta aparte y no un destino más de aquella**: aquella es solo de
 * administradoras y responde 404 a cualquier otra cuenta para no confirmar
 * que existe. Meter acá una excepción por destino es la forma de que un día
 * el control de rol se afloje para todos.
 *
 * **Siempre sobre la cuenta de la sesión**: no recibe un id. Nadie sube la
 * foto de otro (§13.8).
 *
 * Corre en Node, no en Edge: sharp es un binario nativo.
 */
export const runtime = "nodejs";

/**
 * 10 cada 10 minutos por cuenta (§16). La de la administradora es de 30 por
 * minuto porque carga productos enteros; acá alcanza para equivocarse de foto
 * varias veces seguidas, y cualquier cuenta registrada puede llegar a esta
 * ruta, así que el tope es lo que impide que una sola ponga a sharp a
 * trabajar sin parar.
 */
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
  // `!= null`, como el envoltorio: una fila leída sin la columna no deja a
  // todo el mundo dado de baja.
  if (session.profile.closedAt != null) {
    return fallo(403, domainMessage("ACCOUNT_CLOSED"));
  }
  // Con la baja pedida la cuenta es de solo lectura (RF-34).
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

    // La foto está en el encabezado de toda la tienda y en el menú del
    // panel, no solo en «Mi cuenta». La otra mitad es el `router.refresh()`
    // de quien llama, como en la subida del panel.
    revalidatePath("/", "layout");

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    // Un archivo que no era una imagen es un resultado esperado, no un
    // incidente: se responde y no se reporta (§6.3).
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
