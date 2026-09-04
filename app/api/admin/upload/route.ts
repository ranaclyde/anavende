import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isDomainError } from "@/lib/errors";
import { getSession } from "@/lib/session";
import {
  publicarImagenDeVariante,
  publicarLogoDeMarca,
} from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * Subida de imágenes — TECHNICAL-SPEC §9.1; RF-17.
 *
 * **Por qué un Route Handler y no una Server Action.** Las Server Actions
 * serializan su entrada; mandarle 8 MB de binario significa convertirlo a
 * base64 y crecerlo un tercio por el camino. Un Route Handler recibe el
 * `multipart/form-data` como stream y le entrega a sharp los bytes tal cual
 * llegaron. Es la única mutación del proyecto que no pasa por el envoltorio
 * de §6.2, así que las garantías que ese envoltorio da —rol, validación,
 * traducción de errores, Sentry solo para lo inesperado— se repiten acá a
 * mano, en el mismo orden.
 *
 * Corre en Node, no en Edge: sharp es un binario nativo.
 */
export const runtime = "nodejs";

/**
 * Un solo punto de entrada para toda imagen, con el destino discriminado.
 *
 * Dos rutas separadas duplicarían lo único que de verdad importa acá —el
 * control de rol, el corte por tamaño y la traducción de errores—, y el día
 * que una de las dos copias se olvidara de uno de los tres no fallaría: se
 * abriría.
 */
const entrada = z.discriminatedUnion("destino", [
  z.object({
    destino: z.literal("variante"),
    productId: z.uuid(),
    variantId: z.uuid(),
    altText: z.string().trim().max(200).optional(),
  }),
  z.object({
    destino: z.literal("marca"),
    brandId: z.uuid(),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getSession();

  // 404 y no 403: un `customer` que sondea el panel no recibe la confirmación
  // de que la ruta existe (§13.3, RF-14).
  if (session?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "No encontrado." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "No pudimos leer el archivo. Probá de nuevo." },
      { status: 400 },
    );
  }

  const campos = entrada.safeParse({
    destino: form.get("destino"),
    productId: form.get("productId") ?? undefined,
    variantId: form.get("variantId") ?? undefined,
    brandId: form.get("brandId") ?? undefined,
    altText: form.get("altText") ?? undefined,
  });

  if (!campos.success) {
    return NextResponse.json(
      { ok: false, message: "Faltan datos de la imagen." },
      { status: 400 },
    );
  }

  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "No llegó ningún archivo." },
      { status: 400 },
    );
  }

  // Se corta por tamaño ANTES de traer el cuerpo a memoria: `arrayBuffer()`
  // sobre un archivo de 300 MB lo carga entero para después rechazarlo.
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return NextResponse.json(
      {
        ok: false,
        message: `La imagen pesa ${mb} MB y el máximo son 10 MB. Probá con una más chica.`,
      },
      { status: 413 },
    );
  }

  try {
    const bytes = Buffer.from(await archivo.arrayBuffer());

    const data =
      campos.data.destino === "marca"
        ? await publicarLogoDeMarca({
            brandId: campos.data.brandId,
            archivo: bytes,
          })
        : await publicarImagenDeVariante({
            productId: campos.data.productId,
            variantId: campos.data.variantId,
            archivo: bytes,
            altText: campos.data.altText,
          });

    // Invalidar acá es la mitad del trabajo: una Server Action refresca al
    // cliente con su respuesta, pero un `fetch` a un Route Handler no. La
    // otra mitad es el `router.refresh()` de quien llama.
    revalidatePath(
      campos.data.destino === "marca" ? "/admin/catalogo" : "/admin/productos",
      "layout",
    );

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    // Un archivo que no era una imagen es un resultado esperado, no un
    // incidente: se responde y no se reporta (§6.3).
    if (isDomainError(e)) {
      return NextResponse.json(
        { ok: false, code: e.code, message: e.message },
        { status: e.code === "NOT_FOUND" ? 404 : 400 },
      );
    }

    Sentry.captureException(e);
    return NextResponse.json(
      {
        ok: false,
        message: "No pudimos guardar la imagen. Probá de nuevo en un momento.",
      },
      { status: 500 },
    );
  }
}
