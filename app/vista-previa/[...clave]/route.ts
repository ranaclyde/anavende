import { almacenamiento } from "@/lib/storage";

/**
 * El `-og.jpg` de una ficha, desde el dominio de la tienda — la excepción a
 * TECHNICAL-SPEC §9.4 del 2026-10-19.
 *
 * §9.4 pide que las fotos lleguen directo del subdominio de Storage, y todas
 * lo siguen haciendo menos esta. Servida desde ahí, WhatsApp no dibujaba la
 * vista previa de la ficha —ni en el teléfono ni en Escritorio, con wifi o con
 * datos, con una URL nueva— mientras que la de la home, en `anavende.com.ar`,
 * salía entera. El tráfico que suma es poco: esta foto la piden los chats y
 * las redes al armar la tarjeta, no la gente, y Cloudflare la guarda.
 *
 * **Un route handler y no un *rewrite***: el *rewrite* se resuelve al
 * compilar, y el bucket (`SUPABASE_STORAGE_BUCKET`) existe recién en
 * ejecución. Así la URL la sigue armando el adaptador y nadie más.
 *
 * **Solo vistas previas de productos.** La clave tiene que tener la forma
 * exacta de `claveBase` con el sufijo `og`: sin ese control, esto sería una
 * puerta para pedirle al servidor cualquier objeto del bucket.
 *
 * `proxy.ts` no la toca: su `matcher` deja afuera lo que termina en `.jpg`.
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

  const respuesta = await fetch(almacenamiento().publicUrl(clave), {
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
      // La clave lleva un UUID nuevo por foto (§9.2) y nunca se reescribe:
      // otra foto es otra URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
