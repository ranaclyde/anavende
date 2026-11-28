// La zona se nombra y no se hereda: el contenedor corre en UTC. La misma
// constante va a `AT TIME ZONE` en SQL, para que la pantalla y el filtro
// coincidan. Sin `server-only`: la usan la consulta y las pantallas.

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

// En 24 horas: `es-AR` por omisión imprime «01:07 p. m.».
const CON_HORA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZONA_HORARIA,
});

export function fechaCorta(iso: string): string {
  return CORTA.format(new Date(iso));
}

export function fechaConHora(iso: string): string {
  return CON_HORA.format(new Date(iso));
}

const LARGA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

export function fechaLarga(fecha: Date): string {
  return LARGA.format(fecha);
}

const MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: ZONA_HORARIA,
});

export function mesEnCurso(): string {
  return MES.format(new Date());
}

// Para un día de calendario (columna `date`), en UTC a propósito: pasado por
// la zona de Argentina, `2026-11-30` sería el 29 a las 21.
const DIA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function diaCorto(dia: string): string {
  return DIA.format(new Date(`${dia}T00:00:00Z`));
}

// `en-CA` da `AAAA-MM-DD`, el valor de un `<input type="date">`.
const ISO_DEL_DIA = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONA_HORARIA,
});

export function hoyEnArgentina(): string {
  return ISO_DEL_DIA.format(new Date());
}
