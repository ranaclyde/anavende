"use server";

import * as Sentry from "@sentry/nextjs";
import { createClient as crearClienteSuelto } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { action } from "@/lib/action";
import { urlDelSitio } from "@/lib/env";
import { domainError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { actualizarDatos } from "@/modules/users/perfil";
import {
  cambioDeContrasenaSchema,
  completarPerfilSchema,
  ingresoSchema,
  misDatosSchema,
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

/**
 * Destino del enlace de verificación de los emails E1 y E2.
 *
 * **El `volver` llega hasta acá desde F5.7** (RF-08). Hasta el 2026-09-13
 * este parámetro existía y nadie se lo pasaba: quien se daba de alta para
 * comprar algo abría el enlace del email y aparecía en «Mi cuenta», lejos del
 * producto por el que se había registrado. El esquema ya descartó los
 * destinos que no son internos; `/api/auth/confirmar` lo vuelve a mirar, que
 * es donde de verdad se decide.
 */
function urlDeConfirmacion(volver?: string) {
  const base = urlDelSitio();
  const destino = volver ?? "/mi-cuenta";
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
        // `first_name` es lo único que los emails pueden usar para saludar:
        // GoTrue lee `user_metadata` (`{{ .Data }}`) y «¡Hola, Matías Emanuel
        // Sanhueza!» no suena a persona escribiendo. Desde el 2026-09-10 sale
        // del campo de verdad y no de partir un nombre por el primer espacio,
        // que era lo que hacía que «Sanhueza, Matías» saludara al apellido.
        data: {
          full_name: `${input.firstName} ${input.lastName}`,
          first_name: input.firstName,
        },
        emailRedirectTo: urlDeConfirmacion(input.volver),
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
        firstName: input.firstName,
        lastName: input.lastName,
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
async function mandarVerificacion(email: string, volver?: string) {
  const supabase = await createClient();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: urlDeConfirmacion(volver),
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
    const { error } = await mandarVerificacion(input.email, input.volver);

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
      firstName: input.firstName,
      lastName: input.lastName,
      email: String(claims.email ?? ""),
      phone: input.phone,
      role: "customer",
    });

    return { yaEstaba: false };
  });

// ── Mis datos (RF-07) — F5.2 ───────────────────────────────────────────

export const guardarMisDatos = action
  .input(misDatosSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    await actualizarDatos(ctx.session.profile.id, input);

    // Los emails de GoTrue saludan con `first_name` de `user_metadata` —lo
    // escribe `registrar`—, no con el perfil. Sin esto, quien corrige su
    // nombre acá sigue recibiendo la recuperación de contraseña con el viejo.
    //
    // Si falla, los datos ya se guardaron, y son los que la tienda usa: no se
    // le dice «no pudimos» a alguien cuyo cambio sí quedó. Se reporta.
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: `${input.firstName} ${input.lastName}`,
        first_name: input.firstName,
      },
    });
    if (error) {
      Sentry.captureException(error, {
        tags: { capa: "server-action", paso: "user_metadata" },
      });
    }

    // El encabezado y el saludo leen el perfil: que se vea el nombre nuevo.
    refresh();
    return { guardado: true };
  });

/**
 * ¿Es esta la contraseña de la cuenta? Se le pregunta a GoTrue ingresando.
 *
 * **Con un cliente suelto, que no escribe cookies.** El de la sesión, si el
 * ingreso sale bien, reemplazaría la sesión de la persona por la de la
 * comprobación. Y la sesión que abre la comprobación **se cierra en el acto,
 * con alcance `local`**: el `global` por omisión cerraría también la de ella.
 *
 * Existe la alternativa de GoTrue —`current_password` en `updateUser`—, pero
 * solo funciona con `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD`
 * encendido en el servidor DATA, y esto no depende de cómo esté configurado.
 */
async function esLaContrasena(email: string, password: string) {
  const cliente = crearClienteSuelto(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await cliente.auth.signInWithPassword({ email, password });

  if (!error) {
    await cliente.auth.signOut({ scope: "local" });
    return true;
  }

  if (error.code === "invalid_credentials") return false;

  if (error.code === "over_request_rate_limit") {
    throw domainError("VALIDATION", {
      message: "Probaste muchas veces seguidas. Esperá un momento.",
    });
  }

  throw new Error(`comprobar la contraseña falló: ${error.message}`);
}

/**
 * Deja anotado que una cuenta de Google o Facebook ya tiene contraseña.
 *
 * GoTrue **no suma `email` a `providers`** cuando la define —comprobado en
 * local el 2026-09-13—, así que sin esta marca la sesión seguiría creyendo
 * que no tiene, y «Mis datos» la dejaría cambiar sin pedir la actual.
 *
 * Va en `app_metadata` porque solo la escribe la clave de servicio: la persona
 * no puede ponérsela ni sacársela. Y se refresca la sesión para que el token
 * nuevo la traiga ya, y no cuando venza el actual.
 *
 * Si falla, la contraseña ya quedó definida: no se le dice «no pudimos» a
 * quien sí la tiene. Se reporta.
 */
async function anotarContrasenaDefinida({ userId }: { userId: string }) {
  const { error } = await createServiceClient().auth.admin.updateUserById(
    userId,
    { app_metadata: { contrasena_definida: true } },
  );

  if (error) {
    Sentry.captureException(error, {
      tags: { capa: "server-action", paso: "app_metadata" },
    });
    return;
  }

  const supabase = await createClient();
  await supabase.auth.refreshSession();
  refresh();
}

function errorEnCampo(campo: string, mensaje: string) {
  return domainError("VALIDATION", {
    fields: { properties: { [campo]: { errors: [mensaje] } } },
  });
}

export const cambiarContrasena = action
  .input(cambioDeContrasenaSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    const { identity } = ctx.session;

    if (identity.tieneContrasena) {
      if (!input.actual) {
        throw errorEnCampo("actual", "Escribí tu contraseña actual.");
      }
      if (!identity.email) {
        throw new Error("sesión con contraseña y sin email");
      }
      if (!(await esLaContrasena(identity.email, input.actual))) {
        throw errorEnCampo("actual", "Esa no es tu contraseña actual.");
      }
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: input.nueva });

    if (!error) {
      if (!identity.tieneContrasena) await anotarContrasenaDefinida(identity);
      return { cambiada: true };
    }

    if (error.code === "same_password") {
      throw errorEnCampo("nueva", "Es la misma que ya tenés. Elegí otra.");
    }

    if (error.code === "weak_password") {
      throw errorEnCampo("nueva", "Esa contraseña es muy fácil de adivinar.");
    }

    // Con *Secure password change* encendido, GoTrue pide reingresar a quien
    // entró hace más de 24 horas. Hoy está apagado; si alguien lo enciende,
    // esto dice qué hacer en vez de fallar mudo.
    if (error.code === "reauthentication_needed") {
      throw domainError("VALIDATION", {
        message:
          "Por seguridad, cerrá sesión y volvé a entrar antes de cambiarla.",
      });
    }

    throw new Error(`updateUser falló: ${error.message}`);
  });
