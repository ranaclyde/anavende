import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin `cacheComponents` en el MVP: TECHNICAL-SPEC §2.3 y §12.
  // Se activa después, con medición previa, no antes.

  // Solo afecta a `next dev`: permite abrir el sitio por IP —127.0.0.1 o la
  // de la LAN— para probarlo desde el teléfono. Sin esto Next bloquea el
  // recargado en caliente entre orígenes, la página llega SIN JavaScript y
  // los formularios parecen rotos por un motivo que no se ve.
  allowedDevOrigins: ["127.0.0.1", "192.168.68.107"],
};

export default nextConfig;
