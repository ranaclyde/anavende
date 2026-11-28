import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Se deriva de `NEXT_PUBLIC_SUPABASE_URL` y no se escribe a mano: el
 * subdominio de Storage cambia entre local y producción, y una lista fija
 * dejaría las imágenes rotas en silencio el día del despliegue.
 */
function origenesDeImagen(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const crudo = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!crudo) return [];

  try {
    const url = new URL(crudo);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port || undefined,
        // Sin esta ruta, `remotePatterns` habilitaría el host entero,
        // incluidas las APIs de Auth.
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const enProduccion = process.env.NODE_ENV === "production";

function origenDeSupabase(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
}

/**
 * CSP fija, sin *nonce* (TECHNICAL-SPEC §16): Next hidrata con scripts en
 * línea y sin *nonce* por pedido la única forma de dejarlos pasar es
 * `'unsafe-inline'`.
 *
 * - `blob:` en `img-src`: la vista previa de una foto antes de subirla.
 * - `'unsafe-eval'` solo en `next dev`: React lo usa para las pilas de error.
 * - `upgrade-insecure-requests` solo en producción: en local Storage es
 *   `http://127.0.0.1:54321` y forzar HTTPS rompería las fotos.
 * - Turnstile es el único origen de afuera en `script-src` y `frame-src`.
 */
const TURNSTILE = "https://challenges.cloudflare.com";

function politicaDeContenido(): string {
  const supabase = origenDeSupabase();
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${TURNSTILE}${enProduccion ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase}`,
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(enProduccion ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * HSTS sin `preload` (salir de la lista de los navegadores lleva meses) y sin
 * `includeSubDomains` (el dominio tiene subdominios de Resend que no son
 * sitios).
 */
const cabecerasDeSeguridad = [
  { key: "Content-Security-Policy", value: politicaDeContenido() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(enProduccion
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  // Sin `cacheComponents` en el MVP: TECHNICAL-SPEC §2.3 y §12.

  /**
   * Metadatos siempre dentro del `<head>`. Por omisión Next solo los espera
   * para los User-Agent que reconoce como bot, y WhatsApp Escritorio se
   * anuncia como navegador: recibía un `<head>` vacío y mostraba el enlace sin
   * vista previa. No cuesta otra consulta: `leerFicha` está en `cache()`.
   */
  htmlLimitedBots: /.*/,

  /**
   * `server.js` NO copia `public` ni `.next/static`: lo hace el Dockerfile.
   * Sin esas copias la tienda levanta sin estilos ni imágenes.
   */
  output: "standalone",

  /**
   * Solo el gancho de pre-push lo cambia: un `next build` sobre `.next` con
   * `next dev` levantado le pisa la caché al servidor de desarrollo. El
   * Dockerfile no lo define y la imagen busca el build en `.next`.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },

  images: {
    remotePatterns: origenesDeImagen(),

    /**
     * SOLO EN DESARROLLO. Next 16 no deja que el optimizador pida a una IP
     * privada (defensa contra SSRF), y el stack local sirve Storage desde
     * `127.0.0.1:54321`. Si `NEXT_PUBLIC_SUPABASE_URL` apuntara a la LAN
     * privada entre los servidores, fallaría en producción (§9.4).
     */
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    // `images.qualities` no se declara: las calidades de §9.2 son las de
    // sharp al generar los archivos, no las de `next/image`.
  },

  // Solo `next dev`: sin esto Next bloquea el recargado en caliente al abrir
  // el sitio por IP y la página llega sin JavaScript.
  allowedDevOrigins: ["127.0.0.1", "192.168.68.107"],

  // El optimizador carga el mismo sharp que la subida de fotos y fija sus
  // valores para todo el proceso: sin esto pisaría los de
  // `modules/media/procesar.ts`.
  experimental: {
    imgOptConcurrency: 1,
    imgOptOperationCache: false,
  },
};

/**
 * Sube los *source maps* y los borra del build. Sin `SENTRY_AUTH_TOKEN` no
 * sube nada y el build termina igual: la clave solo existe en Coolify.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  /*
   * Directo a `sentry.io` los eventos los frenan los bloqueadores. `proxy.ts`
   * excluye esta ruta: en modo mantenimiento recibiría un 503.
   */
  tunnelRoute: "/monitoring",

  widenClientFileUpload: true,

  // Coolify no define `CI`: con `!process.env.CI` el plugin callaba también
  // el motivo cuando no sube los mapas.
  silent: false,
  telemetry: false,
});
