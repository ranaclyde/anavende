import { domainError } from "@/lib/errors";
import { TAMANO_MAXIMO, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

/**
 * Validación de la subida — TECHNICAL-SPEC §9.1, §16; RF-17.
 *
 * El tipo se decide por los PRIMEROS BYTES del archivo, no por el
 * `Content-Type` que mandó el navegador ni por la extensión del nombre. Los
 * dos últimos los elige quien sube: un `.jpg` que en realidad es un HTML con
 * un `<script>` adentro llega con `Content-Type: image/jpeg` si el que lo
 * manda quiere que llegue así.
 *
 * Esto NO reemplaza a la validación del cliente: el formulario revisa tipo y
 * tamaño antes de enviar para dar respuesta inmediata (RF-17), y el servidor
 * la revisa de nuevo porque el formulario no es una barrera, es una cortesía.
 */

type TipoAceptado = (typeof TIPOS_ACEPTADOS)[number];

/**
 * Firmas de los tres formatos aceptados.
 *
 * WEBP no tiene una firma contigua: son «RIFF» en el byte 0 y «WEBP» en el 8,
 * con el tamaño del archivo en el medio. Por eso la firma se describe como
 * una lista de tramos y no como un solo prefijo.
 */
const FIRMAS: { tipo: TipoAceptado; tramos: { en: number; bytes: number[] }[] }[] =
  [
    { tipo: "image/jpeg", tramos: [{ en: 0, bytes: [0xff, 0xd8, 0xff] }] },
    {
      tipo: "image/png",
      tramos: [{ en: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
    },
    {
      tipo: "image/webp",
      tramos: [
        { en: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
        { en: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP"
      ],
    },
  ];

/** El tipo real del archivo, o `null` si no es ninguno de los tres. */
export function tipoReal(bytes: Buffer): TipoAceptado | null {
  for (const { tipo, tramos } of FIRMAS) {
    const coincide = tramos.every(({ en, bytes: esperados }) =>
      esperados.every((b, i) => bytes[en + i] === b),
    );
    if (coincide) return tipo;
  }
  return null;
}

/**
 * Rechaza con un mensaje que dice qué pasa y qué hacer (RNF-08), nunca con un
 * código ni con el nombre de la comprobación que falló.
 */
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
