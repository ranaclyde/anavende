import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { consumir } from "@/lib/limite";
import { getSession } from "@/lib/session";
import { fotosDelProducto, zipDeFotos } from "@/modules/media/descargar";

/**
 * Las fotos de un producto en un zip — F2.18.
 *
 * Route Handler y no Server Action por lo mismo que la subida: sale un
 * binario. Lo pide el botón «Descargar fotos» con `fetch`, y no un enlace:
 * así, si falla, el error se dice en la pantalla en vez de bajarse un
 * archivo con un JSON adentro.
 */
export const runtime = "nodejs";

/** Cada zip lee y convierte todas las fotos: no es para pedirlo en ráfaga. */
const DESCARGAS = { tope: 10, ventanaMs: 60_000 };

const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/productos/[id]/fotos">,
) {
  const session = await getSession();
  // 404 y no 403, como la subida (§13.3).
  if (session?.role !== "admin" || session.profile.isBanned) {
    return error("No encontramos el producto.", 404);
  }

  const limite = consumir(`fotos-zip:${session.profile.id}`, DESCARGAS);
  if (!limite.permitido) {
    return error(
      `Demasiadas descargas seguidas. Esperá ${limite.reintentarEnSegundos} segundos.`,
      429,
    );
  }

  const { id } = await ctx.params;
  if (!ES_UUID.test(id)) return error("No encontramos el producto.", 404);

  try {
    const producto = await fotosDelProducto(id);
    if (!producto) return error("No encontramos el producto.", 404);

    const zip = await zipDeFotos(producto);
    if (!zip) return error("Este producto todavía no tiene fotos.", 404);

    const nombre = `${producto.slug}-fotos.zip`;
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    Sentry.captureException(e);
    return error("No pudimos armar el zip. Probá de nuevo en un rato.", 500);
  }
}
