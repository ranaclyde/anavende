import "server-only";

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { userProfiles, type Role, type UserProfile } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// TECHNICAL-SPEC §13.3: el JWT se verifica localmente, pero rol y bloqueo se
// leen frescos de la base; en el token quedarían congelados hasta renovarlo.
// `cache` de React dura un pedido: el perfil sigue fresco en cada uno.

export type Identity = {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  /** El del proveedor social: solo una sugerencia para el alta (RF-06). */
  suggestedName: string | null;
  /**
   * Decide si «Mis datos» cambia la contraseña (pidiendo la actual) o la
   * define. Ante la duda, sí: no pedírsela a quien tiene deja cambiarla a
   * cualquiera que encuentre la sesión abierta.
   */
  hasPassword: boolean;
};

export type Session = {
  identity: Identity;
  profile: UserProfile;
  role: Role;
};

/** Solo el JWT, sin ir a la base: para lo que no necesita el rol. */
export const getIdentity = cache(async (): Promise<Identity | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) return null;

  const metadata = claims.user_metadata as
    { email_verified?: boolean; full_name?: string; name?: string } | undefined;
  const app = claims.app_metadata as
    { providers?: string[]; contrasena_definida?: boolean } | undefined;
  const providers = app?.providers;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    // Para mostrar, no para decidir: `user_metadata` lo escribe el propio
    // usuario. RF-11 se mira con `emailConfirmado`.
    emailVerified:
      claims.email_verified === true || metadata?.email_verified === true,
    suggestedName: metadata?.full_name ?? metadata?.name ?? null,
    // GoTrue no suma `email` a `providers` cuando una cuenta de Google define
    // contraseña: eso lo anota la aplicación (`anotarContrasenaDefinida`).
    hasPassword:
      !providers ||
      providers.includes("email") ||
      app?.contrasena_definida === true,
  };
});

/** `null` también sin perfil: sin perfil no se opera (§13.4). */
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

/**
 * Va en el layout de `/admin` y además al principio de cada página, antes de
 * leer nada: Next renderiza layout y página en paralelo, y los datos de la
 * página viajan aunque el layout dé 404 (TECHNICAL-SPEC §16).
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();

  if (!session) redirect("/ingresar?volver=/admin");

  // 404 y no 403: no confirma que la ruta existe (§13.3).
  if (session.role !== "admin" || session.profile.isBanned) notFound();

  return session;
}
