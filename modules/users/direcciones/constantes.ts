/**
 * Lo que la libreta de direcciones comparte entre el servidor y el
 * formulario — RF-09, F5.3.
 *
 * Vive aparte de `schemas.ts` para que el formulario, que corre en el
 * navegador, no se lleve zod en el paquete solo para tener la lista de
 * localidades.
 */

/**
 * Hasta 3 direcciones por comprador: la predeterminada y dos más para elegir
 * otra en el checkout (decisión del 2026-09-13, RF-09).
 */
export const MAXIMO_DE_DIRECCIONES = 3;

/**
 * Las localidades donde se entrega — RN-10: «Viedma, Carmen de Patagones y
 * alrededores» (decisión del 2026-09-13). Es una lista cerrada, no dos campos
 * libres: la vendedora no envía al resto del país, y ofrecer las 24
 * provincias prometía algo que no hace.
 *
 * **La provincia y el código postal no se preguntan: se deducen de acá.**
 * Los códigos son los del Correo Argentino: 8500, 8504, y 8501 para San
 * Javier y El Cóndor, que lo comparten.
 */
export const LOCALIDADES = [
  { nombre: "Viedma", provincia: "Río Negro", codigoPostal: "8500" },
  {
    nombre: "Carmen de Patagones",
    provincia: "Buenos Aires",
    codigoPostal: "8504",
  },
  { nombre: "San Javier", provincia: "Río Negro", codigoPostal: "8501" },
  { nombre: "El Cóndor", provincia: "Río Negro", codigoPostal: "8501" },
] as const;

/**
 * «Otra localidad cercana»: los alrededores. Pide el nombre y la provincia
 * —un paraje del partido de Patagones es de Buenos Aires, y uno cerca de
 * Viedma, de Río Negro— y deja el código postal vacío: no hay de dónde
 * sacarlo, y la entrega se coordina igual por WhatsApp.
 */
export const OTRA_LOCALIDAD = "otra";

export const PROVINCIAS_DE_LA_ZONA = ["Río Negro", "Buenos Aires"] as const;

/** Lo que muestra el formulario para una dirección ya guardada. */
export function valoresDeUbicacion(city: string, province: string) {
  return LOCALIDADES.some((l) => l.nombre === city)
    ? { localidad: city, otraLocalidad: "", provinciaDeOtra: "" }
    : {
        localidad: OTRA_LOCALIDAD,
        otraLocalidad: city,
        provinciaDeOtra: province,
      };
}
