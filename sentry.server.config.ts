import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sin DSN no se inicializa nada: en desarrollo previo a F0 esto es lo normal.
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // No se manda el cuerpo de la request ni la IP (§16).
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
