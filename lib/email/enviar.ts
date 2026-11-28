import "server-only";

import * as Sentry from "@sentry/nextjs";

export type Email = {
  para: string;
  asunto: string;
  html: string;
  /**
   * Cómo se nombra el envío en Sentry («orden #1043»). No el asunto: lleva el
   * nombre de quien compró y `scrubEvent` no filtra «asunto».
   */
  referencia: string;
};

/**
 * `true` si Resend lo aceptó. Nunca lanza: se llama después del COMMIT y un
 * fallo de envío no revierte la operación (RF-30); queda en Sentry.
 */
export async function enviarEmail({
  para,
  asunto,
  html,
  referencia,
}: Email): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM;

  // Al log y no a Sentry: en desarrollo es lo normal.
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
      signal: AbortSignal.timeout(10_000),
    });

    if (!respuesta.ok) {
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
    Sentry.captureException(e, {
      tags: { email: "envio" },
      extra: { referencia },
    });
    return false;
  }
}
