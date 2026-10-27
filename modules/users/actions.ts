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
  ingresoSchema,
  misDatosSchema,
  registroSchema,
  recuperacionSchema,
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
/**
 * Los cupos por persona de lo que se puede pedir sin sesión (§16, F10.5).
 * Holgados para una persona que se equivoca —diez contraseñas en cinco
 * minutos es mucho errar— y cortos para un programa probando. El de GoTrue,
 * que frena a quien le pega directo, va aparte: PROGRESO.md, F10.5.
 */
const MINUTO = 60_000;

/**
 * El token de Turnstile, en las opciones que entiende GoTrue (F10.5b). Sin
 * token no se manda nada: en desarrollo sin claves no hay widget, y GoTrue
 * tampoco lo pide.
 */
function conCaptcha(token: string | undefined) {
  return token ? { captchaToken: token } : {};
}

/**
 * GoTrue rechazó el token de Turnstile: vencido, ya usado o de un robot. No
 * dice nada de la cuenta, así que se puede informar igual en todas las
 * pantallas. La pantalla pide un token nuevo después de cada envío.
 */
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

// ── Registro (RF-05) ───────────────────────────────────────────────────

export const registrar = action
  .input(registroSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("alta", CUPOS.alta);
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
        ...conCaptcha(input.captcha),
      },
    });

    if (errorAlta?.code === "captcha_failed") throw captchaFallido();

    // El tope de emails por hora de GoTrue (F10.5b): está para que un ataque
    // no se coma el cupo de Resend, y cuando se llega no sale el email de
    // verificación, así que tampoco se crea la cuenta.
    if (errorAlta?.code === "over_email_send_rate_limit") {
      throw domainError("VALIDATION", {
        message:
          "Ahora no podemos mandarte el email para confirmar la cuenta. Probá de nuevo en un rato.",
      });
    }

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

/**
 * Reenvío de la verificación, desde la pantalla de ingreso o desde «revisá tu
 * email» (RF-05): sin tener que volver a registrarse.
 */
export const enviarVerificacion = action
  .input(reenvioSchema)
  .auth("public")
  .handler(async ({ input }) => {
    await frenarSiInsiste("reenvio", CUPOS.reenvio);
    // Todo se responde igual haya o no cuenta: distinguir «no existe» de
    // «ya está verificada» convertiría esta pantalla en un detector de
    // cuentas (RF-06). **También el freno por email** (F10.5, 2026-10-17):
    // antes se avisaba «esperá un momento», pero GoTrue solo frena a una
    // cuenta que existe, así que pedir dos veces seguidas decía si el email
    // estaba registrado. Quien pidió dos veces ya tiene el primero en camino.
    const { error } = await mandarVerificacion(
      input.email,
      input.volver,
      input.captcha,
    );
    if (error?.code === "captcha_failed") throw captchaFallido();
    return { enviado: true };
  });

/**
 * El enlace para cambiar la contraseña (RF-05), por el servidor y con Zod
 * (§16) — hasta F10.5 lo pedía el navegador directo a GoTrue.
 *
 * Contesta «enviado» haya o no cuenta, y **también ante el freno por email**,
 * por lo mismo que `enviarVerificacion`: para un email que no existe GoTrue
 * contesta bien y no manda nada, y el freno solo existe para uno que sí
 * (RF-06, pedido del 2026-10-17: «solo que se mandó, aunque no sea verdad»).
 * Lo único que se informa es lo que le pasa a cualquiera: GoTrue caído o el
 * tope por cliente.
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

// ── Ingreso (RF-06) ────────────────────────────────────────────────────

/** El único mensaje de un ingreso fallido: no dice si el email existe. */
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
      // Con la tienda cerrada solo entran las administradoras. Se mira
      // después de la contraseña, así que no le dice nada a quien no la sabe.
      if (await laTiendaEstaCerradaPara(data.user.id)) {
        await supabase.auth.signOut();
        throw domainError("FORBIDDEN", { message: TIENDA_CERRADA });
      }
      return { ok: true as const };
    }

    // GoTrue mira el token antes que la cuenta: esto no dice si existe.
    if (error.code === "captcha_failed") throw captchaFallido();

    // RF-27: el bloqueado ve LA RAZÓN. GoTrue devuelve `user_banned` —también
    // cuando la contraseña es incorrecta, comprobado en F1.7— pero no guarda
    // el motivo: ese es nuestro (§13.5).
    //
    // **Y `user_banned` son dos cosas distintas** (RN-13, §13.5b): para GoTrue
    // una cuenta dada de baja y una bloqueada son idénticas —`ban_duration` es
    // lo único que esa capa entiende—, así que quién es cada una se decide acá,
    // mirando el perfil. Sin esto, a quien se fue por su cuenta le diríamos
    // que lo bloquearon.
    //
    // **Y el motivo solo con la contraseña correcta** (F10.5, 2026-10-17).
    // Como GoTrue corta antes de mirarla, cualquiera que escribiera un email
    // bloqueado leía lo que escribió Ana —y de una baja, la fecha—. La
    // contraseña se compara acá contra el hash de GoTrue: si no coincide, es
    // el mismo mensaje que una contraseña mal escrita.
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

    // RF-05: se explica y se ofrece reenviar, sin volver a registrarse.
    if (error.code === "email_not_confirmed") {
      throw domainError("EMAIL_NOT_VERIFIED", { email: input.email });
    }

    // Para todo lo demás, un mensaje que no revela si el email existe (RF-06).
    throw domainError("VALIDATION", {
      message: NO_COINCIDEN,
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

    // La foto de Google, si la vuelta de Google la dejó anotada. No lanza:
    // sin ella, la cuenta sigue con su blobatar. El formulario refresca al
    // terminar, así que el encabezado ya sale con la foto.
    await importarFotoDeGoogle(claims.sub);

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
 * «Quitar foto» — F5.9. La cuenta vuelve a su blobatar y el archivo se va de
 * Storage. Subirla es un Route Handler (`app/api/mi-cuenta/foto`), porque
 * lleva un archivo; quitarla no lleva nada, y pasa por el envoltorio como
 * cualquier otro cambio de «Mis datos» —con la baja pedida, no se puede—.
 */
export const quitarMiFoto = action
  .input(sinDatos)
  .auth("customer")
  .handler(async ({ ctx }) => {
    await quitarFotoDePerfil(ctx.session.profile.id);
    // La foto está también en el encabezado de toda la tienda.
    refresh();
    return { quitada: true };
  });

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
      // En la base y no ingresando en GoTrue, que con el captcha prendido
      // pediría un token (`coincideLaContrasena`, F10.5b). Por eso el tope:
      // el de GoTrue ya no aplica a esta comprobación.
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

    // Con *Secure password change* encendido, GoTrue pide reingresar a quien
    // entró hace más de 24 horas. En producción está encendido desde F10.5:
    // esto dice qué hacer en vez de fallar mudo.
    if (error.code === "reauthentication_needed") {
      throw domainError("VALIDATION", {
        message:
          "Por seguridad, cerrá sesión y volvé a entrar antes de cambiarla.",
      });
    }

    throw new Error(`updateUser falló: ${error.message}`);
  });
