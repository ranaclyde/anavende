"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  completarPerfilSchema,
  ingresoSchema,
  registroSchema,
  reenvioSchema,
} from "@/modules/users/schemas";

/**
 * Identidad — TECHNICAL-SPEC §13.4, §13.5 · FUNCTIONAL-SPEC RF-05, RF-06.
 *
 * El alta NO usa el `signUp` del cliente: el perfil es obligatorio (teléfono
 * incluido, RF-05) y la identidad sin perfil es un usuario que puede entrar y
 * con el que la aplicación no sabe qué hacer. Por eso el flujo lo controla el
 * servidor y compensa si falla a mitad.
 */

/** Destino del enlace de verificación de los emails E1 y E2. */
function urlDeConfirmacion(volver?: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const destino = volver && volver.startsWith("/") ? volver : "/mi-cuenta";
  return `${base}/api/auth/confirmar?next=${encodeURIComponent(destino)}`;
}

// ── Registro (RF-05) ───────────────────────────────────────────────────

export const registrar = action
  .input(registroSchema)
  .auth("public")
  .handler(async ({ input }) => {
    const servicio = createServiceClient();

    // 1. Identidad. `email_confirm: false` la deja sin verificar: hasta que
    //    abra el enlace no va a poder entrar (RF-05, comprobado en F1.7).
    const { data: alta, error: errorAlta } =
      await servicio.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
        user_metadata: { full_name: input.fullName },
      });

    if (errorAlta || !alta.user) {
      // RF-05 pide un mensaje claro si el email ya existe. Es la única
      // excepción a no revelar existencia de cuentas en el alta: sin ella
      // la persona no entiende por qué no puede registrarse.
      if (
        errorAlta?.code === "email_exists" ||
        errorAlta?.status === 422
      ) {
        throw domainError("VALIDATION", {
          fields: {
            properties: {
              email: { errors: ["Ya hay una cuenta con ese email."] },
            },
          },
        });
      }
      throw new Error(`createUser falló: ${errorAlta?.message}`);
    }

    // 2. Perfil. 3. Si falla, se borra la identidad: o quedan los dos, o
    //    ninguno (§13.4). Sin esta compensación queda una identidad huérfana.
    try {
      await db.insert(userProfiles).values({
        id: alta.user.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        role: "customer",
      });
    } catch (e) {
      await servicio.auth.admin.deleteUser(alta.user.id);
      throw e;
    }

    // 4. Verificación (RF-05). Va DESPUÉS del perfil y su fallo no revierte
    //    nada: la cuenta ya existe y se puede pedir el reenvío. Perder un
    //    registro entero por un problema de correo sería peor.
    const { error: errorEmail } = await mandarVerificacion(input.email);

    return { email: input.email, emailEnviado: !errorEmail };
  });

/**
 * Único punto de envío de la verificación, para que el alta y el reenvío no
 * puedan divergir en el destino del enlace.
 */
async function mandarVerificacion(email: string) {
  const supabase = await createClient();
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: urlDeConfirmacion() },
  });
}

/**
 * Reenvío de la verificación, desde la pantalla de ingreso o desde «revisá tu
 * email» (RF-05): sin tener que volver a registrarse.
 */
export const enviarVerificacion = action
  .input(reenvioSchema)
  .auth("public")
  .handler(async ({ input }) => {
    const { error } = await mandarVerificacion(input.email);

    // El límite de frecuencia SÍ se informa: la persona necesita saber que
    // tiene que esperar, no quedarse mirando un «listo» que no pasó.
    if (error?.code === "over_email_send_rate_limit") {
      throw domainError("VALIDATION", {
        message: "Recién te mandamos uno. Esperá un momento y probá de nuevo.",
      });
    }

    // El resto se responde igual haya o no cuenta: distinguir «no existe» de
    // «ya está verificada» convertiría esta pantalla en un detector de
    // cuentas (RF-06).
    return { enviado: true };
  });

// ── Ingreso (RF-06) ────────────────────────────────────────────────────

export const ingresar = action
  .input(ingresoSchema)
  .auth("public")
  .handler(async ({ input }) => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (!error) return { ok: true as const };

    // RF-27: el bloqueado ve LA RAZÓN. GoTrue devuelve `user_banned` —también
    // cuando la contraseña es incorrecta, comprobado en F1.7— pero no guarda
    // el motivo: ese es nuestro (§13.5).
    if (error.code === "user_banned") {
      const [perfil] = await db
        .select({ motivo: userProfiles.banReason })
        .from(userProfiles)
        .where(eq(sql`lower(${userProfiles.email})`, input.email))
        .limit(1);

      throw domainError("USER_BANNED", {
        motivo: perfil?.motivo ?? null,
      });
    }

    // RF-05: se explica y se ofrece reenviar, sin volver a registrarse.
    if (error.code === "email_not_confirmed") {
      throw domainError("EMAIL_NOT_VERIFIED", { email: input.email });
    }

    // Para todo lo demás, un mensaje que no revela si el email existe (RF-06).
    throw domainError("VALIDATION", {
      message: "Ese email y esa contraseña no coinciden. Probá de nuevo.",
    });
  });

export async function salir() {
  const supabase = await createClient();
  // El carrito vive en la base y no se toca: cerrar sesión no lo borra (RF-06).
  await supabase.auth.signOut();
  redirect("/");
}

// ── Perfil tras OAuth (RF-06, §13.4) ──────────────────────────────────

/**
 * Ningún proveedor social entrega teléfono, así que después del primer
 * ingreso por Google o Facebook falta el perfil. Hasta completarlo se puede
 * navegar, pero no operar: el envoltorio de acciones lo trata como falta de
 * autorización (§13.4).
 */
export const completarPerfil = action
  .input(completarPerfilSchema)
  .auth("public")
  .handler(async ({ input }) => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;

    if (!claims?.sub) {
      throw domainError("FORBIDDEN", {
        message: "Necesitás iniciar sesión para completar tu perfil.",
      });
    }

    const [existente] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, claims.sub))
      .limit(1);

    if (existente) return { yaEstaba: true };

    await db.insert(userProfiles).values({
      id: claims.sub,
      fullName: input.fullName,
      email: String(claims.email ?? ""),
      phone: input.phone,
      role: "customer",
    });

    return { yaEstaba: false };
  });
