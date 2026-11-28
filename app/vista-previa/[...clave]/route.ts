import { getStorage } from "@/lib/storage";

/**
 * El `-og.jpg` de una ficha desde el dominio de la tienda: la excepción de
 * §9.4, porque desde Storage WhatsApp no dibuja la vista previa.
 *
 * Route handler y no *rewrite*: el *rewrite* se resuelve al compilar, y el
 * bucket existe recién en ejecución.
 *
 * **Solo vistas previas de productos**: sin el control de la clave, esto
 * sería una puerta a cualquier objeto del bucket.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CLAVE_DE_VISTA_PREVIA = new RegExp(
  `^productos/${UUID}/${UUID}/${UUID}-og\\.jpg$`,
);

export async function GET(
  _request: Request,
  ctx: RouteContext<"/vista-previa/[...clave]">,
) {
  const clave = (await ctx.params).clave.join("/");

  if (!CLAVE_DE_VISTA_PREVIA.test(clave)) {
    return new Response(null, { status: 404 });
  }

  const respuesta = await fetch(getStorage().publicUrl(clave), {
    cache: "no-store",
  });

  // Sin caché: una foto que todavía no se subió no tiene que quedar como
  // 404 en Cloudflare para siempre.
  if (!respuesta.ok || !respuesta.body) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(respuesta.body, {
    headers: {
      "Content-Type": "image/jpeg",
      // La clave nunca se reescribe: otra foto es otra URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
