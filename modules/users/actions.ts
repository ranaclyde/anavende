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
    const supabase = await createClient();

    // 1. Identidad y email E1, en una sola llamada.
    //
    //    Va por `signUp` y no por `admin.createUser` + `resend`, que es lo que
    //    hacía antes, por un motivo que solo se ve en producción: `/resend`
    //    DESCARTA el `code_challenge` que le manda `@supabase/ssr`, así que no
    //    deja fila en `auth.flow_state`. Sin esa fila GoTrue no tiene un
    //    `code` que emitir y devuelve el enlace por el flujo implícito
    //    (`#access_token=...`), que vive en el fragmento de la URL y por lo
    //    tanto NUNCA llega al servidor: la confirmación moría en «enlace
    //    inválido» con la cuenta ya verificada. Comprobado contra el servidor
    //    DATA: `/signup` con `code_challenge` sí deja la fila, `/resend` no.
    //
    //    `email_confirm` deja de hacer falta: el servidor tiene
    //    `enable_confirmations`, y hasta que abra el enlace no puede entrar.
    const { data: alta, error: errorAlta } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.fullName },
        emailRedirectTo: urlDeConfirmacion(),
      },
    });

    if (errorAlta || !alta.user) {
      throw new Error(`signUp falló: ${errorAlta?.message}`);
    }

    // RF-05 pide un mensaje claro si el email ya existe. `signUp` no lo dice
    // como error —oculta a propósito la existencia de la cuenta— sino que
    // devuelve un usuario con `identities` vacío. Es la única señal que hay.
    if ((alta.user.identities?.length ?? 0) === 0) {
      throw domainError("VALIDATION", {
        fields: {
          properties: {
            email: { errors: ["Ya hay una cuenta con ese email."] },
          },
        },
      });
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
      await createServiceClient().auth.admin.deleteUser(alta.user.id);
      throw e;
    }

    // El email ya salió en el paso 1. Cambia un matiz respecto de antes: si
    // el correo falla, `signUp` falla entero y no queda cuenta. Antes el alta
    // sobrevivía a un problema de correo y se resolvía con el reenvío. Se
    // acepta el cambio porque la alternativa —el enlace roto de siempre— deja
    // a la persona con una cuenta que no puede usar y sin nada que reintentar.
    return { email: input.email, emailEnviado: true };
  });

/**
 * Reenvío del enlace de verificación.
 *
 * NO usa `auth.resend()`, que sería lo obvio: el endpoint `/resend` de GoTrue
 * DESCARTA el `code_challenge` que le manda `@supabase/ssr`, no deja fila en
 * `auth.flow_state`, y entonces el enlace vuelve por el flujo implícito
 * (`#access_token=...`). Eso vive en el fragmento de la URL, que el navegador
 * nunca manda al servidor, así que `/api/auth/confirmar` recibe una URL vacía
 * y responde «enlace inválido». Comprobado contra el servidor DATA: el mismo
 * `code_challenge` deja fila por `/signup` y no deja ninguna por `/resend`.
 *
 * `signInWithOtp` sí lo registra. El costo es que el email que sale es el de
 * enlace mágico y no el de verificación: se corrige en F1.8, cuando las
 * plantillas se sirvan desde `public/` de la app —GoTrue las busca por HTTP
 * contra `SITE_URL`, no las lee de un archivo—.
 *
 * `shouldCreateUser: false` es lo que evita que esto sea un alta encubierta:
 * si el email no tiene cuenta, no crea ninguna. El perfil sigue siendo
 * obligatorio y solo lo crea `registrar`.
 */
async function mandarVerificacion(email: string) {
  const supabase = await createClient();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: urlDeConfirmacion(),
      shouldCreateUser: false,
    },
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
