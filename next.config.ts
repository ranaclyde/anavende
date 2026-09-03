import type { NextConfig } from "next";

/**
 * De dónde se pueden servir imágenes — TECHNICAL-SPEC §9.3.
 *
 * Se deriva de `NEXT_PUBLIC_SUPABASE_URL` en vez de escribirse a mano: el
 * subdominio de Storage cambia entre el stack local y producción (F0.3), y
 * una lista fija obligaría a acordarse de editarla el día del despliegue —el
 * día en que las imágenes dejarían de verse sin decir por qué—.
 */
function origenesDeImagen(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const crudo = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!crudo) return [];

  try {
    const url = new URL(crudo);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port || undefined,
        // Solo el prefijo público de Storage. Sin esta ruta, `remotePatterns`
        // habilitaría el host entero, incluidas las APIs de Auth.
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Sin `cacheComponents` en el MVP: TECHNICAL-SPEC §2.3 y §12.
  // Se activa después, con medición previa, no antes.

  images: {
    remotePatterns: origenesDeImagen(),
    // `images.qualities` NO se declara todavía. En Next 16 su valor por
    // omisión pasó a ser `[75]`, y hay que declarar cualquier otra calidad
    // que se use; pero las calidades de §9.2 —75, 78, 82— son las de sharp
    // al GENERAR los archivos, no las que `next/image` usaría al volver a
    // comprimirlos. Confundirlas acá dejaría un número sin dueño. Se decide
    // en F3, con el primer `next/image` real delante.
  },

  // Solo afecta a `next dev`: permite abrir el sitio por IP —127.0.0.1 o la
  // de la LAN— para probarlo desde el teléfono. Sin esto Next bloquea el
  // recargado en caliente entre orígenes, la página llega SIN JavaScript y
  // los formularios parecen rotos por un motivo que no se ve.
  allowedDevOrigins: ["127.0.0.1", "192.168.68.107"],
};

export default nextConfig;
