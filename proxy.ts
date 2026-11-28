import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/** En Next 16, `middleware.ts` se llama `proxy.ts`. */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // `monitoring` es el túnel de Sentry (`tunnelRoute` en `next.config.ts`).
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
