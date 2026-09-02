import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * En Next 16 el antiguo `middleware.ts` pasa a llamarse `proxy.ts`
 * (TECHNICAL-SPEC §4, §6.1).
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos los estáticos de Next, el favicon y las imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
