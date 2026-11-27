import { domainError } from "@/lib/errors";
import { TAMANO_MAXIMO, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

// El tipo se decide por los primeros bytes, no por el `Content-Type` ni la
// extensión, que los elige quien sube (TECHNICAL-SPEC §16).

type TipoAceptado = (typeof TIPOS_ACEPTADOS)[number];

/** WEBP no tiene firma contigua: «RIFF» en el byte 0 y «WEBP» en el 8. */
const FIRMAS: {
  tipo: TipoAceptado;
  tramos: { en: number; bytes: number[] }[];
}[] = [
  { tipo: "image/jpeg", tramos: [{ en: 0, bytes: [0xff, 0xd8, 0xff] }] },
  {
    tipo: "image/png",
    tramos: [
      { en: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    ],
  },
  {
    tipo: "image/webp",
    tramos: [
      { en: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
      { en: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP"
    ],
  },
];

export function tipoReal(bytes: Buffer): TipoAceptado | null {
  for (const { tipo, tramos } of FIRMAS) {
    const coincide = tramos.every(({ en, bytes: esperados }) =>
      esperados.every((b, i) => bytes[en + i] === b),
    );
    if (coincide) return tipo;
  }
  return null;
}

export function validarArchivo(bytes: Buffer): TipoAceptado {
  if (bytes.byteLength === 0) {
    throw domainError("VALIDATION", {
      message: "El archivo está vacío.",
    });
  }

  if (bytes.byteLength > TAMANO_MAXIMO) {
    const mb = (bytes.byteLength / 1024 / 1024).toFixed(1);
    throw domainError("VALIDATION", {
      message: `La imagen pesa ${mb} MB y el máximo son 10 MB. Probá con una más chica.`,
    });
  }

  const tipo = tipoReal(bytes);
  if (!tipo) {
    throw domainError("VALIDATION", {
      message: "Ese archivo no es una imagen JPG, PNG ni WEBP.",
    });
  }

  return tipo;
}
