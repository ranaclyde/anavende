// La zona se nombra y no se hereda: el contenedor corre en UTC. La misma
// constante va a `AT TIME ZONE` en SQL, para que la pantalla y el filtro
// coincidan. Sin `server-only`: la usan la consulta y las pantallas.

export const TIME_ZONE = "America/Argentina/Buenos_Aires";

const SHORT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

// En 24 horas: `es-AR` por omisión imprime «01:07 p. m.».
const WITH_TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

export function shortDate(iso: string): string {
  return SHORT.format(new Date(iso));
}

export function dateWithTime(iso: string): string {
  return WITH_TIME.format(new Date(iso));
}

const LONG = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export function longDate(date: Date): string {
  return LONG.format(date);
}

const MONTH = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: TIME_ZONE,
});

export function currentMonth(): string {
  return MONTH.format(new Date());
}

// Para un día de calendario (columna `date`), en UTC a propósito: pasado por
// la zona de Argentina, `2026-11-30` sería el 29 a las 21.
const DAY = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function shortDay(day: string): string {
  return DAY.format(new Date(`${day}T00:00:00Z`));
}

// `en-CA` da `AAAA-MM-DD`, el valor de un `<input type="date">`.
const ISO_DAY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

export function todayInArgentina(): string {
  return ISO_DAY.format(new Date());
}
