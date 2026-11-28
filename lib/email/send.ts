import "server-only";

import * as Sentry from "@sentry/nextjs";

export type Email = {
  to: string;
  subject: string;
  html: string;
  /**
   * Cómo se nombra el envío en Sentry («orden #1043»). No el asunto: lleva el
   * nombre de quien compró y `scrubEvent` no filtra «asunto».
   */
  reference: string;
};

/**
 * `true` si Resend lo aceptó. Nunca lanza: se llama después del COMMIT y un
 * fallo de envío no revierte la operación (RF-30); queda en Sentry.
 */
export async function sendEmail({
  to,
  subject,
  html,
  reference,
}: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM;

  // Al log y no a Sentry: en desarrollo es lo normal.
  if (!apiKey || !sender) {
    console.warn(
      `[email] Sin RESEND_API_KEY o RESEND_FROM: no se manda ${reference}.`,
    );
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject: subject,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      Sentry.captureException(
        new Error(
          `Resend respondió ${response.status}: ${detail.slice(0, 500)}`,
        ),
        { tags: { email: "envio" }, extra: { referencia: reference } },
      );
      return false;
    }

    return true;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { email: "envio" },
      extra: { referencia: reference },
    });
    return false;
  }
}
