// Aparte de `schemas.ts` para que el formulario no lleve zod al navegador.

export const MAXIMO_DE_DIRECCIONES = 3;

/** RN-10. La provincia y el código postal no se preguntan: se deducen de acá. */
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

/** Los alrededores: pide nombre y provincia, y el código postal queda vacío. */
export const OTRA_LOCALIDAD = "otra";

export const PROVINCIAS_DE_LA_ZONA = ["Río Negro", "Buenos Aires"] as const;

export function valoresDeUbicacion(city: string, province: string) {
  return LOCALIDADES.some((l) => l.nombre === city)
    ? { localidad: city, otraLocalidad: "", provinciaDeOtra: "" }
    : {
        localidad: OTRA_LOCALIDAD,
        otraLocalidad: city,
        provinciaDeOtra: province,
      };
}
