"use server";

import * as Sentry from "@sentry/nextjs";
import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { action } from "@/lib/action";
import { urlDelSitio } from "@/lib/env";
import { domainError } from "@/lib/errors";
import { frenarSiInsiste } from "@/lib/limite";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { quitarFotoDePerfil } from "@/modules/media/subir";
import { laTiendaEstaCerradaPara } from "@/modules/settings/mantenimiento";
import { sinDatos } from "@/modules/users/baja/schemas";
import { coincideLaContrasena } from "@/modules/users/contrasena";
import { importarFotoDeGoogle } from "@/modules/users/datos-de-google";
import { actualizarDatos } from "@/modules/users/perfil";
import {
  cambioDeContrasenaSchema,
  completarPerfilSchema,
  definicionDeContrasenaSchema,
  ingresoSchema,
  misDatosSchema,
  registroSchema,
  recuperacionSchema,
  reenvioSchema,
} from "@/modules/users/schemas";

const MINUTO = 60_000;

function conCaptcha(token: string | undefined) {
  return token ? { captchaToken: token } : {};
}

/** No dice nada de la cuenta: se informa igual en todas las pantallas. */
function captchaFallido() {
  return domainError("VALIDATION", {
    message:
      "No pudimos comprobar que sos una persona. Esperá a que termine la verificación de abajo y probá de nuevo.",
  });
}

const CUPOS = {
  ingreso: { tope: 10, ventanaMs: 5 * MINUTO },
  alta: { tope: 5, ventanaMs: 60 * MINUTO },
  reenvio: { tope: 5, ventanaMs: 15 * MINUTO },
  recuperacion: { tope: 5, ventanaMs: 15 * MINUTO },
  contrasenaActual: { tope: 10, ventanaMs: 15 * MINUTO },
};

function urlDeConfirmacion(volver?: string) {
  const base = urlDelSitio();
  const destino = volver ?? "/mi-cuenta";
  return `${base}/api/auth/confirmar?next=${encodeURIComponent(destino)}`;
}

export const registrar = action
  .input(registroSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("alta", CUPOS.alta);
    const supabase = await createClient();

    // `signUp` y no `admin.createUser` + `resend`: ver `mandarVerificacion`.
    const { data: alta, error: errorAlta } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Las plantillas de GoTrue saludan con `user_metadata` (`{{ .Data }}`).
        data: {
          full_name: `${input.firstName} ${input.lastName}`,
          first_name: input.firstName,
        },
        emailRedirectTo: urlDeConfirmacion(input.volver),
        ...conCaptcha(input.captcha),
      },
    });

    if (errorAlta?.code === "captcha_failed") throw captchaFallido();

    // Tope de emails por hora de GoTrue: sin email, tampoco se crea la cuenta.
    if (errorAlta?.code === "over_email_send_rate_limit") {
      throw domainError("VALIDATION", {
        message:
          "Ahora no podemos mandarte el email para confirmar la cuenta. Probá de nuevo en un rato.",
      });
    }

    if (errorAlta || !alta.user) {
      throw new Error(`signUp falló: ${errorAlta?.message}`);
    }

    // `signUp` no da error si el email ya existe: devuelve `identities` vacío.
    if ((alta.user.identities?.length ?? 0) === 0) {
      throw domainError("VALIDATION", {
        fields: {
          properties: {
            email: { errors: ["Ya hay una cuenta con ese email."] },
          },
        },
      });
    }

    // Si el perfil falla, se borra la identidad: los dos o ninguno (§13.4).
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

    return { email: input.email, emailEnviado: true };
  });

/**
 * No usa `auth.resend()`: el `/resend` de GoTrue descarta el `code_challenge`,
 * no deja fila en `auth.flow_state` y el enlace vuelve por el flujo implícito
 * (`#access_token=…`), que nunca llega al servidor. `signInWithOtp` sí la deja.
 * `shouldCreateUser: false` evita que sea un alta encubierta.
 */
async function mandarVerificacion(
  email: string,
  volver?: string,
  captcha?: string,
) {
  const supabase = await createClient();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: urlDeConfirmacion(volver),
      shouldCreateUser: false,
      ...conCaptcha(captcha),
    },
  });
}

export const enviarVerificacion = action
  .input(reenvioSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("reenvio", CUPOS.reenvio);
    // Se responde igual haya o no cuenta, y también ante el freno por email:
    // GoTrue solo frena a una cuenta que existe, así que avisarlo la delataría.
    const { error } = await mandarVerificacion(
      input.email,
      input.volver,
      input.captcha,
    );
    if (error?.code === "captcha_failed") throw captchaFallido();
    return { enviado: true };
  });

/**
 * Contesta «enviado» haya o no cuenta, y también ante el freno por email, por
 * lo mismo que `enviarVerificacion` (RF-06).
 */
export const pedirRecuperacion = action
  .input(recuperacionSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("recuperacion", CUPOS.recuperacion);
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: urlDeConfirmacion("/recuperar/nueva-contrasena"),
      ...conCaptcha(input.captcha),
    });

    if (error?.code === "captcha_failed") throw captchaFallido();
    if (error && error.code !== "over_email_send_rate_limit") {
      throw domainError("VALIDATION", {
        message: "No pudimos mandar el email. Probá de nuevo en un momento.",
      });
    }
    return { enviado: true };
  });

const NO_COINCIDEN = "Ese email y esa contraseña no coinciden. Probá de nuevo.";
// Genérico a propósito: no dice quién sí puede entrar.
const TIENDA_CERRADA =
  "El sitio está en mantenimiento. Por favor, intentá de nuevo más tarde.";

export const ingresar = action
  .input(ingresoSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("ingreso", CUPOS.ingreso);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
      options: conCaptcha(input.captcha),
    });

    if (!error) {
      // Se mira después de la contraseña: no le dice nada a quien no la sabe.
      if (await laTiendaEstaCerradaPara(data.user.id)) {
        await supabase.auth.signOut();
        throw domainError("FORBIDDEN", { message: TIENDA_CERRADA });
      }
      return { ok: true as const };
    }

    // GoTrue mira el token antes que la cuenta: esto no dice si existe.
    if (error.code === "captcha_failed") throw captchaFallido();

    // GoTrue da `user_banned` aun con la contraseña equivocada: el motivo o la
    // fecha de baja salen solo si coincide (§13.5). Bloqueo y baja son lo
    // mismo para GoTrue; cuál es cuál lo dice el perfil (§13.5b).
    if (error.code === "user_banned") {
      if (!(await coincideLaContrasena(input.email, input.password))) {
        throw domainError("VALIDATION", { message: NO_COINCIDEN });
      }

      const [perfil] = await db
        .select({
          motivo: userProfiles.banReason,
          closedAt: userProfiles.closedAt,
        })
        .from(userProfiles)
        .where(eq(sql`lower(${userProfiles.email})`, input.email))
        .limit(1);

      if (perfil?.closedAt) {
        throw domainError("ACCOUNT_CLOSED", {
          dadaDeBajaEl: perfil.closedAt.toISOString(),
        });
      }

      throw domainError("USER_BANNED", {
        motivo: perfil?.motivo ?? null,
      });
    }

    if (error.code === "email_not_confirmed") {
      throw domainError("EMAIL_NOT_VERIFIED", { email: input.email });
    }

    throw domainError("VALIDATION", {
      message: NO_COINCIDEN,
    });
  });

export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

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

    await importarFotoDeGoogle(claims.sub);

    return { yaEstaba: false };
  });

export const guardarMisDatos = action
  .input(misDatosSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    await actualizarDatos(ctx.session.profile.id, input);

    // Los emails de GoTrue saludan con `user_metadata`, no con el perfil. Si
    // falla, el perfil ya se guardó: se reporta y no se le dice «no pudimos».
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

    refresh();
    return { guardado: true };
  });

export const quitarMiFoto = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    await quitarFotoDePerfil(ctx.session.profile.id);
    refresh();
    return { quitada: true };
  });

/**
 * GoTrue no suma `email` a `providers` cuando una cuenta social define
 * contraseña: sin esta marca, «Mis datos» la dejaría cambiar sin pedir la
 * actual. Va en `app_metadata`, que la persona no puede escribir.
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

const VIGENCIA_DEL_ENLACE_MS = 60 * 60 * 1000;

/**
 * Si la sesión salió de un enlace del email en la última hora. GoTrue anota
 * en `amr` `recovery` al canjear el de recuperación (PKCE) y `otp` al de la
 * invitación E3 (`token_hash`); un ingreso con contraseña o con Google no. Tener el enlace prueba que el email es suyo,
 * que es lo que reemplaza a la contraseña actual.
 */
async function vieneDeUnEnlaceReciente() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const metodos = (data?.claims?.amr ?? []) as {
    method?: string;
    timestamp?: number;
  }[];
  return metodos.some(
    (m) =>
      (m.method === "recovery" || m.method === "otp") &&
      typeof m.timestamp === "number" &&
      Date.now() - m.timestamp * 1000 < VIGENCIA_DEL_ENLACE_MS,
  );
}

function errorEnCampo(campo: string, mensaje: string) {
  return domainError("VALIDATION", {
    fields: { properties: { [campo]: { errors: [mensaje] } } },
  });
}

export const definirContrasena = action
  .input(definicionDeContrasenaSchema)
  .auth("customer")
  .handler(async ({ input, ctx }) => {
    if (!(await vieneDeUnEnlaceReciente())) {
      throw domainError("VALIDATION", {
        message:
          "El enlace para definir la contraseña venció. Pedí uno nuevo desde «Olvidé mi contraseña».",
      });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: input.nueva });

    if (!error) {
      const { identity } = ctx.session;
      if (!identity.tieneContrasena) await anotarContrasenaDefinida(identity);
      return { definida: true };
    }

    if (error.code === "same_password") {
      throw errorEnCampo("nueva", "Es la misma que ya tenías. Elegí otra.");
    }

    if (error.code === "weak_password") {
      throw errorEnCampo(
        "nueva",
        "Esa contraseña es muy fácil de adivinar. Probá con una más larga.",
      );
    }

    throw new Error(`updateUser falló: ${error.message}`);
  });

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
      // El tope de GoTrue no aplica a `coincideLaContrasena`: va el propio.
      await frenarSiInsiste("contrasena-actual", CUPOS.contrasenaActual);
      if (!(await coincideLaContrasena(identity.email, input.actual))) {
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
      throw errorEnCampo(
        "nueva",
        "Esa contraseña es muy fácil de adivinar. Probá con una más larga.",
      );
    }

    // *Secure password change*: GoTrue pide reingresar pasadas 24 horas.
    if (error.code === "reauthentication_needed") {
      throw domainError("VALIDATION", {
        message:
          "Por seguridad, cerrá sesión y volvé a entrar antes de cambiarla.",
      });
    }

    throw new Error(`updateUser falló: ${error.message}`);
  });
