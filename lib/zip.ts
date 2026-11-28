import { crc32 } from "node:zlib";

// Zip sin compresión (STORE) y sin ZIP64: solo lleva JPG, que ya vienen
// comprimidos. Los nombres en UTF-8, marcado con el bit 11 de las banderas.

export type ZipEntry = {
  /** `"negro/1.jpg"`, sin `/` al principio. */
  name: string;
  data: Buffer;
};

const UTF8 = 0x0800;
const VERSION = 20; // 2.0: lo mínimo para carpetas, sin compresión.
const MAX_SIZE = 0xffffffff;

// En hora de Argentina (sin horario de verano): el zip no guarda zona y el
// contenedor corre en UTC.
function dosDateTime(date: Date): { time: number; day: number } {
  const ar = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return {
    time:
      (ar.getUTCHours() << 11) |
      (ar.getUTCMinutes() << 5) |
      Math.floor(ar.getUTCSeconds() / 2),
    day:
      ((ar.getUTCFullYear() - 1980) << 9) |
      ((ar.getUTCMonth() + 1) << 5) |
      ar.getUTCDate(),
  };
}

export function buildZip(
  entries: readonly ZipEntry[],
  date: Date = new Date(),
): Buffer {
  if (entries.length > 0xffff) {
    throw new RangeError("Demasiados archivos para un zip sin ZIP64.");
  }
  const { time, day } = dosDateTime(date);
  const chunks: Buffer[] = [];
  const centralDirectory: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    if (!name || name.startsWith("/") || name.includes("..")) {
      throw new TypeError(`Nombre inválido en el zip: «${name}».`);
    }
    if (data.length >= MAX_SIZE) {
      throw new RangeError("Un archivo de más de 4 GB no entra sin ZIP64.");
    }
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    // Extra, comentario, disco y atributos: todo en cero.
    central.writeUInt32LE(offset, 42);

    chunks.push(local, n, data);
    centralDirectory.push(central, n);
    offset += local.length + n.length + data.length;
    if (offset >= MAX_SIZE) {
      throw new RangeError("El zip pasaría de 4 GB, y no usa ZIP64.");
    }
  }

  const centralDirectorySize = centralDirectory.reduce(
    (s, b) => s + b.length,
    0,
  );
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, ...centralDirectory, end]);
}
