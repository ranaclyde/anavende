import { crc32 } from "node:zlib";

/**
 * Un zip sin compresión (método STORE) — F2.18.
 *
 * **Sin dependencia**: lo único que mete en un zip la tienda son fotos en
 * JPG, que ya vienen comprimidas, y comprimirlas de nuevo gasta procesador
 * para ganar nada. Sin compresión el formato es un encabezado por archivo,
 * un índice al final y el CRC-32, que Node trae desde la 22
 * (`zlib.crc32`). Una librería de zip entera para esto pesaría más que el
 * problema.
 *
 * Los nombres van en UTF-8 y lo dicen (bit 11 de las banderas): «marrón/1.jpg»
 * se abre bien en Windows, macOS y el teléfono. Sin ZIP64: el armado se
 * niega antes de pasar de 4 GB o de 65.535 archivos, que es diez mil veces
 * lo que entra en un producto.
 */

export type ArchivoDelZip = {
  /** Con `/` para las carpetas: `"negro/1.jpg"`. Sin `/` al principio. */
  nombre: string;
  datos: Buffer;
};

const UTF8 = 0x0800;
const VERSION = 20; // 2.0: lo mínimo para carpetas, sin compresión.
const TOPE = 0xffffffff;

/**
 * Fecha y hora de MS-DOS, que es lo que guarda el zip. **En hora de
 * Argentina**, que no tiene horario de verano: el contenedor corre en UTC y
 * el zip no guarda zona, así que se vería tres horas corrido.
 */
function fechaDos(fecha: Date): { hora: number; dia: number } {
  const ar = new Date(fecha.getTime() - 3 * 60 * 60 * 1000);
  return {
    hora:
      (ar.getUTCHours() << 11) |
      (ar.getUTCMinutes() << 5) |
      Math.floor(ar.getUTCSeconds() / 2),
    dia:
      ((ar.getUTCFullYear() - 1980) << 9) |
      ((ar.getUTCMonth() + 1) << 5) |
      ar.getUTCDate(),
  };
}

export function armarZip(
  archivos: readonly ArchivoDelZip[],
  fecha: Date = new Date(),
): Buffer {
  if (archivos.length > 0xffff) {
    throw new RangeError("Demasiados archivos para un zip sin ZIP64.");
  }
  const { hora, dia } = fechaDos(fecha);
  const partes: Buffer[] = [];
  const indice: Buffer[] = [];
  let desplazamiento = 0;

  for (const { nombre, datos } of archivos) {
    if (!nombre || nombre.startsWith("/") || nombre.includes("..")) {
      throw new TypeError(`Nombre inválido en el zip: «${nombre}».`);
    }
    if (datos.length >= TOPE) {
      throw new RangeError("Un archivo de más de 4 GB no entra sin ZIP64.");
    }
    const n = Buffer.from(nombre, "utf8");
    const crc = crc32(datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    // Extra, comentario, disco y atributos: todo en cero.
    central.writeUInt32LE(desplazamiento, 42);

    partes.push(local, n, datos);
    indice.push(central, n);
    desplazamiento += local.length + n.length + datos.length;
    if (desplazamiento >= TOPE) {
      throw new RangeError("El zip pasaría de 4 GB, y no usa ZIP64.");
    }
  }

  const tamanoDelIndice = indice.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamanoDelIndice, 12);
  fin.writeUInt32LE(desplazamiento, 16);

  return Buffer.concat([...partes, ...indice, fin]);
}
