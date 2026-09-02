import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin `cacheComponents` en el MVP: TECHNICAL-SPEC §2.3 y §12.
  // Se activa después, con medición previa, no antes.
};

export default nextConfig;
