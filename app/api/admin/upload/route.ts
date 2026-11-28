import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isDomainError } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { subirImagenDeMarca } from "@/modules/marca-de-agua/service";
import { publicarImagenDeVariante, publicarLogo } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * Route Handler y no Server Action: una acción pasaría el binario a base64
 * (§9.1). No pasa por el envoltorio de §6.2, así que sus controles —rol,
 * validación, traducción de errores, Sentry— se repiten acá a mano.
 *
 * Corre en Node, no en Edge: sharp es un binario nativo.
 */
export const runtime = "nodejs";

const SUBIDAS = { tope: 30, ventanaMs: 60_000 };

/**
 * Una sola ruta para toda imagen: una copia de los controles que se olvidara
 * de uno no fallaría, se abriría.
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
  z.object({
    destino: z.literal("medio-de-pago"),
    paymentMethodId: z.uuid(),
  }),
  z.object({
    destino: z.literal("categoria"),
    categoryId: z.uuid(),
  }),
  z.object({
    destino: z.literal("marca-de-agua"),
  }),
]);

export async function POST(request: NextRequest) {
  const session = await getSession();

  // 404 y no 403, y un texto que no confirma que la ruta exista (§13.3).
  if (session?.role !== "admin" || session.profile.isBanned) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No pudimos subir la imagen. Actualizá la página y probá de nuevo.",
      },
      { status: 404 },
    );
  }

  // Antes de leer el cuerpo: una subida rechazada no llega a memoria.
  const limite = consume(`subida:${session.profile.id}`, SUBIDAS);
  if (!limite.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `Subiste muchas imágenes seguidas. Esperá ${limite.retryAfterSeconds} segundos y probá de nuevo.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limite.retryAfterSeconds) },
      },
    );
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
    paymentMethodId: form.get("paymentMethodId") ?? undefined,
    categoryId: form.get("categoryId") ?? undefined,
    altText: form.get("altText") ?? undefined,
  });

  if (!campos.success) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No pudimos subir la imagen. Actualizá la página y probá de nuevo.",
      },
      { status: 400 },
    );
  }

  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        message: "No llegó ninguna imagen. Elegila de nuevo.",
      },
      { status: 400 },
    );
  }

  // Por tamaño ANTES de `arrayBuffer()`, que carga el archivo entero.
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
      campos.data.destino === "marca-de-agua"
        ? await subirImagenDeMarca(bytes, archivo.name)
        : campos.data.destino === "marca"
          ? await publicarLogo({
              destino: "marca",
              id: campos.data.brandId,
              archivo: bytes,
            })
          : campos.data.destino === "medio-de-pago"
            ? await publicarLogo({
                destino: "medio-de-pago",
                id: campos.data.paymentMethodId,
                archivo: bytes,
              })
            : campos.data.destino === "categoria"
              ? await publicarLogo({
                  destino: "categoria",
                  id: campos.data.categoryId,
                  archivo: bytes,
                })
              : await publicarImagenDeVariante({
                  productId: campos.data.productId,
                  variantId: campos.data.variantId,
                  archivo: bytes,
                  altText: campos.data.altText,
                });

    // Un `fetch` a un Route Handler no refresca al cliente como una Server
    // Action: la otra mitad es el `router.refresh()` de quien llama.
    revalidatePath(
      campos.data.destino === "variante"
        ? "/admin/productos"
        : campos.data.destino === "marca-de-agua"
          ? "/admin/configuracion"
          : "/admin/catalogo",
      "layout",
    );

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (e) {
    // Esperado, no un incidente: no va a Sentry (§6.3).
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
