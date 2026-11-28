import { NextResponse } from "next/server";

import { versionDelBuild } from "@/lib/version";

/**
 * Healthcheck de Docker. **No toca la base a propósito**: un hipo de Postgres
 * terminaría en reinicios en cadena del contenedor.
 *
 * `force-dynamic`: servido desde la caché diría que sí aunque el proceso
 * estuviera atascado.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { estado: "ok", version: versionDelBuild() },
    { status: 200 },
  );
}
