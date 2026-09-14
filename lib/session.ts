import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { userProfiles, type Role, type UserProfile } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolución de sesión — TECHNICAL-SPEC §13.3.
 *
 *   1. getClaims()          → verifica el JWT LOCALMENTE contra el JWKS
 *                             cacheado. Da el id sin salir del servidor APP.
 *   2. SELECT user_profiles → rol, teléfono y bloqueo FRESCOS de la base.
 *
 * Por qué las mutaciones no se conforman con el JWT: un rol o un bloqueo
 * escritos en el token quedan CONGELADOS hasta que el token se renueve.
 * RF-27 exige que bloquear invalide las sesiones activas; si la autorización
 * se apoyara solo en el JWT, alguien recién bloqueado podría seguir operando
 * hasta una hora.
 *
 * Consecuencia honesta: la verificación local ahorra la ida a la red en las
 * guardias de página, no en las mutaciones. Es el precio correcto.
 *
 * **Las dos van envueltas en `cache` de React** (F5.3). Desde que «Mi cuenta»
 * tiene layout propio, el layout de la tienda, el de la cuenta y la página
 * piden la sesión en el mismo pedido; sin `cache` eran tres lecturas del
 * perfil. `cache` dura un pedido y nada más, así que el perfil sigue siendo
 * fresco en cada uno, que es lo que §13.3 exige.
 */

export type Identity = {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  /**
   * Nombre que trae el proveedor social, para precargar «completá tu perfil»
   * (RF-06). No reemplaza al del perfil: es solo una sugerencia del alta.
   */
  nombreSugerido: string | null;
  /**
   * ¿Entra con contraseña? Decide si «Mis datos» la **cambia** —pidiendo la
   * actual— o la **define**, que es lo que RF-06 le promete a quien se dio de
   * alta con Google o Facebook.
   *
   * GoTrue anota en `app_metadata.providers` cada vía de ingreso de la cuenta,
   * y `email` es la de contraseña. **Ante la duda, se asume que sí**: pedirle
   * la actual a quien no tiene lo manda a «¿No la recordás?», y no pedírsela a
   * quien sí tiene deja cambiarla a cualquiera que encuentre la sesión abierta.
   */
  tieneContrasena: boolean;
};

export type Session = {
  identity: Identity;
  profile: UserProfile;
  role: Role;
};

/**
 * Paso 1 solo. Para guardias de página que no necesitan el rol y para
 * lecturas de datos propios, que se filtran por este id.
 */
export const getIdentity = cache(async (): Promise<Identity | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) return null;

  const metadata = claims.user_metadata as
    | { email_verified?: boolean; full_name?: string; name?: string }
    | undefined;
  const app = claims.app_metadata as
    | { providers?: string[]; contrasena_definida?: boolean }
    | undefined;
  const proveedores = app?.providers;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    // GoTrue lo publica como email_verified suelto o dentro de user_metadata,
    // según la versión; se acepta cualquiera de las dos formas.
    emailVerified:
      claims.email_verified === true || metadata?.email_verified === true,
    nombreSugerido: metadata?.full_name ?? metadata?.name ?? null,
    // Solo es «no» cuando GoTrue dice qué vías tiene, ninguna es `email`, y
    // nadie la definió desde «Mis datos»: GoTrue no suma `email` a
    // `providers` cuando la define una cuenta de Google, así que eso lo anota
    // la aplicación (`anotarContrasenaDefinida`, en `modules/users/actions`).
    tieneContrasena:
      !proveedores ||
      proveedores.includes("email") ||
      app?.contrasena_definida === true,
  };
});

/**
 * Pasos 1 y 2. Devuelve null si no hay identidad O si no hay perfil.
 *
 * SIN PERFIL NO SE OPERA (§13.4): una identidad sin fila en `user_profiles`
 * —el caso de OAuth antes de completar el teléfono— puede navegar, pero no
 * confirmar órdenes ni entrar al panel del comprador.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const identity = await getIdentity();
  if (!identity) return null;

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, identity.userId))
    .limit(1);

  if (!profile) return null;

  return { identity, profile, role: profile.role as Role };
});

/** ¿Hay identidad pero todavía no hay perfil? Dispara «Completá tu perfil». */
export async function needsProfile(): Promise<boolean> {
  const identity = await getIdentity();
  if (!identity) return false;

  const [profile] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.id, identity.userId))
    .limit(1);

  return !profile;
}
