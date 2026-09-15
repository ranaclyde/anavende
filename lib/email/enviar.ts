import "server-only";

import * as Sentry from "@sentry/nextjs";

/**
 * El envío de los emails que manda la aplicación — TECHNICAL-SPEC §14.
 *
 * Hoy es uno solo, E4 (RF-30): los otros tres los emite GoTrue con sus propias
 * plantillas y no pasan por acá.
 *
 * **Por la API REST y no por el SDK de Resend.** Es lo que ya hace
 * `scripts/sondear-resend.mts`, que es el único código del proyecto que le
 * habló a Resend hasta ahora: son dos campos y un `fetch`, y un SDK más en el
 * `package.json` hay que actualizarlo y auditarlo para siempre.
 *
 * **Nunca lanza.** Quien llama está después del COMMIT (§8.4 paso 10) y la
 * orden ya existe: un fallo de Resend no puede volverse un error del
 * comprador, que además no podría hacer nada al respecto. Devuelve si salió o
 * no, y lo registra en Sentry por su cuenta (RF-30: «un fallo de envío nunca
 * revierte la operación de negocio asociada; queda registrado»).
 */

export type Email = {
  para: string;
  asunto: string;
  html: string;
  /**
   * Cómo se nombra este envío en Sentry y en el log.
   *
   * **No es el asunto**, aunque se le parezca: el asunto lleva el nombre de
   * quien compró, y §16 exige que los datos personales no salgan hacia
   * Sentry. `scrubEvent` filtra por nombre de campo y «asunto» no está en su
   * lista, así que la protección tiene que venir de acá. Algo como
   * «orden #1043» alcanza para saber cuál falló.
   */
  referencia: string;
};

/** `true` si Resend lo aceptó. */
export async function enviarEmail({
  para,
  asunto,
  html,
  referencia,
}: Email): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM;

  // Sin configurar no es un error del que haya que enterarse en Sentry cada
  // vez: en desarrollo es lo normal, y en producción lo que falta es una
  // variable de entorno, que no se arregla mirando trazas. Queda en el log
  // del servidor, una línea, y sigue.
  if (!clave || !remitente) {
    console.warn(
      `[email] Sin RESEND_API_KEY o RESEND_FROM: no se manda ${referencia}.`,
    );
    return false;
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: asunto,
        html,
      }),
      // Resend caído no puede dejar colgada la petición que lo llamó. Diez
      // segundos es de sobra para una API que responde en menos de uno.
      signal: AbortSignal.timeout(10_000),
    });

    if (!respuesta.ok) {
      // El cuerpo del error trae el motivo —dominio sin verificar, clave
      // revocada, destinatario inválido—, y sin él en Sentry solo se ve un
      // 4xx que no dice qué arreglar.
      const detalle = await respuesta.text().catch(() => "");
      Sentry.captureException(
        new Error(
          `Resend respondió ${respuesta.status}: ${detalle.slice(0, 500)}`,
        ),
        { tags: { email: "envio" }, extra: { referencia } },
      );
      return false;
    }

    return true;
  } catch (e) {
    // Red caída, DNS, timeout.
    Sentry.captureException(e, {
      tags: { email: "envio" },
      extra: { referencia },
    });
    return false;
  }
}
