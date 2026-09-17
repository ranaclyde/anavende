/**
 * Fechas y horas en la zona del negocio — F7.1.
 *
 * **La zona se nombra, no se hereda del servidor.** El contenedor de
 * producción corre en UTC, y una orden de las 22:00 de un lunes en Argentina
 * es de la 01:00 del martes en UTC: mostrada sin zona, aparece con la fecha
 * del día siguiente. Peor todavía en el filtro por rango de RF-21, donde la
 * pantalla diría «lunes» y la consulta la contaría en el martes.
 *
 * Por eso la constante la comparten los dos lados: lo que se muestra y lo que
 * se corta en SQL (`queries-panel.ts` la pasa a `AT TIME ZONE`). Con dos
 * copias, el día que una cambie el listado deja de coincidir con su filtro.
 *
 * Sin `server-only`: la escribe la consulta y la leen las pantallas.
 */

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** «30/08/2026» — la de las tablas del panel, que se recorren con la vista. */
const CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

/**
 * «30/08/2026, 14:35» — la del detalle y del historial, donde la hora importa.
 *
 * **En 24 horas.** `es-AR` por omisión imprime «01:07 p. m.», que es cinco
 * caracteres más para decir lo mismo y se lee peor en una lista de
 * transiciones, donde lo que interesa es el orden entre ellas.
 */
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

/**
 * «septiembre» — el mes en curso, en la zona del negocio. Tarea F7.8.
 *
 * Lo usa el inicio del panel para que «Este mes» diga cuál es: en el primer
 * día del mes, un total que cayó a cero de golpe se entiende solo si la
 * pantalla nombra el mes que está contando.
 */
const MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: ZONA_HORARIA,
});

export function mesEnCurso(): string {
  return MES.format(new Date());
}
