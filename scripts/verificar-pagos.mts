/**
 * Comprueba las reglas de F2.6 contra Postgres y contra Storage de verdad —
 * RF-19, RN-01, §9.1, §9.2.
 *
 * Lo que se prueba acá es lo que NO se ve leyendo el código:
 *
 *   · Que el orden quede sin huecos ni repetidos después de mover y de
 *     borrar. `sort_order` decide el orden en la tienda Y de dónde sale la
 *     posición del próximo que se cree: una numeración con agujeros no falla
 *     el día que se hace, falla el día siguiente.
 *   · Que el listado, mover y renumerar ordenen IGUAL. Si discreparan, la
 *     flecha movería el de al lado.
 *   · Que la canalización de logos —ahora compartida con las marcas— suba
 *     los dos tamaños, borre el anterior al reemplazar y no deje archivos
 *     cuando la fila se va.
 *
 * Corre con `--conditions=react-server` (ver `package.json`): los módulos que
 * prueba llevan `server-only`.
 *
 * Deja la base y el bucket como los encontró.
 */
import postgres from "postgres";
import sharp from "sharp";

try { process.loadEnvFile(".env.local"); } catch {}

const { crearMedioDePago, editarMedioDePago } = await import(
  "../modules/settings/schemas.ts"
);
const { listarMediosDePago } = await import("../modules/settings/queries.ts");
const { publicarLogo, quitarLogo, clavesDelLogo, borrarArchivos } =
  await import("../modules/media/subir.ts");
const { almacenamiento } = await import("../lib/storage/index.ts");
const { clave, TAMANOS_LOGO } = await import("../modules/media/tamanos.ts");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const store = almacenamiento();
let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

const existe = async (key: string) => {
  const r = await fetch(store.publicUrl(key), { method: "HEAD" });
  return r.ok;
};

/** Un PNG chico con ruido, para que pese algo de verdad. */
async function png(ancho = 300, alto = 200) {
  const pixeles = Buffer.allocUnsafe(ancho * alto * 3);
  for (let i = 0; i < pixeles.length; i++) {
    pixeles[i] = Math.floor(Math.random() * 256);
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 3 } })
    .png()
    .toBuffer();
}

const marca = Date.now();

// ── 1. Validación (RF-19) ──────────────────────────────────────────────
console.log("── Validación (RF-19) ──");

ok(
  crearMedioDePago.safeParse({ name: "Transferencia" }).success,
  "Un medio de pago sin descripción es válido: la descripción es opcional",
);
ok(
  crearMedioDePago.safeParse({ name: "Transferencia" }).data?.description ===
    null,
  "…y la descripción vacía se guarda como NULL, no como cadena vacía",
);
ok(
  crearMedioDePago.safeParse({ name: "Efectivo", description: "  10% off  " })
    .data?.description === "10% off",
  "La descripción se recorta",
);
ok(
  !crearMedioDePago.safeParse({ name: "X" }).success,
  "Un nombre de una letra se rechaza",
);
ok(
  !crearMedioDePago.safeParse({
    name: "Transferencia",
    description: "x".repeat(121),
  }).success,
  "Una descripción de más de 120 caracteres se rechaza",
);
ok(
  !editarMedioDePago.safeParse({ name: "Transferencia" }).success,
  "Editar sin id se rechaza",
);

// ── 2. Contra la base ──────────────────────────────────────────────────
const creados: string[] = [];
const archivos: string[] = [];

/** Las mismas dos operaciones que hacen las Server Actions, sin la sesión. */
const crear = async (nombre: string) => {
  const [fila] = await sql`
    INSERT INTO payment_methods (name, sort_order)
    VALUES (${nombre},
            (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
    RETURNING id, sort_order AS "sortOrder"`;
  creados.push(fila.id);
  return fila as { id: string; sortOrder: number };
};

const posiciones = async () => {
  const filas = await sql`
    SELECT name, sort_order AS "sortOrder" FROM payment_methods
     ORDER BY sort_order, immutable_unaccent(lower(name))`;
  return filas as unknown as { name: string; sortOrder: number }[];
};

/** Mover, con la MISMA lógica de `modules/settings/actions.ts`. */
async function mover(id: string, direccion: "arriba" | "abajo") {
  await sql.begin(async (tx) => {
    const filas = await tx`
      SELECT id FROM payment_methods
       ORDER BY sort_order, immutable_unaccent(lower(name))
         FOR UPDATE`;
    const ids = filas.map((f) => f.id as string);
    const desde = ids.indexOf(id);
    const hasta = direccion === "arriba" ? desde - 1 : desde + 1;
    if (hasta < 0 || hasta >= ids.length) return;
    [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];
    for (const [n, cual] of ids.entries()) {
      await tx`UPDATE payment_methods SET sort_order = ${n} WHERE id = ${cual}`;
    }
  });
}

try {
  const previos = (await sql`SELECT count(*)::int AS n FROM payment_methods`)[0]
    .n as number;

  console.log("\n── El orden (RF-19) ──");

  const a = await crear(`Transferencia ${marca}`);
  const b = await crear(`Efectivo ${marca}`);
  const c = await crear(`Mercado Pago ${marca}`);

  ok(
    a.sortOrder === previos && b.sortOrder === previos + 1 &&
      c.sortOrder === previos + 2,
    "Cada alta se agrega al final, sin pisar al anterior",
  );

  const nombres = async () =>
    (await posiciones()).map((f) => f.name.split(" ")[0]).join(",");

  const antes = await nombres();
  ok(
    antes.endsWith("Transferencia,Efectivo,Mercado"),
    `El listado respeta el orden configurado (${antes})`,
  );

  await mover(c.id, "arriba");
  ok(
    (await nombres()).endsWith("Transferencia,Mercado,Efectivo"),
    "Mover uno hacia arriba lo intercambia con el de encima",
  );

  await mover(c.id, "arriba");
  ok(
    (await nombres()).endsWith("Mercado,Transferencia,Efectivo"),
    "…y otra vez lo deja primero",
  );

  const antesDelBorde = await nombres();
  await mover(c.id, "arriba");
  ok(
    (await nombres()) === antesDelBorde,
    "Subir el primero no falla y no cambia nada: el borde no es un error",
  );

  await mover(c.id, "abajo");
  ok(
    (await nombres()).endsWith("Transferencia,Mercado,Efectivo"),
    "Bajar deshace el movimiento",
  );

  const numeros = (await posiciones()).map((f) => f.sortOrder);
  ok(
    numeros.every((n, i) => n === i),
    `Después de mover, las posiciones quedan 0, 1, 2… sin huecos (${numeros.join(",")})`,
  );

  console.log("\n── El logo, que comparte canalización con las marcas ──");

  const subido = await publicarLogo({
    destino: "medio-de-pago",
    id: a.id,
    archivo: await png(),
  });
  archivos.push(...TAMANOS_LOGO.map((t) => clave(subido.logoKey, t.sufijo)));

  ok(
    subido.logoKey.startsWith(`medios-de-pago/${a.id}/`),
    "El logo se guarda bajo su propia carpeta (§9.2)",
  );
  ok(
    (await Promise.all(
      TAMANOS_LOGO.map((t) => existe(clave(subido.logoKey, t.sufijo))),
    )).every(Boolean),
    `Suben los ${TAMANOS_LOGO.length} tamaños del logo, y ninguno más`,
  );
  ok(
    !(await existe(clave(subido.logoKey, "detail"))),
    "…el tamaño `detail` no se genera: un logo no tiene dónde usarlo",
  );

  const [conLogo] = await sql`
    SELECT logo_key AS "logoKey" FROM payment_methods WHERE id = ${a.id}`;
  ok(
    conLogo.logoKey === subido.logoKey,
    "La fila guarda la CLAVE, no la URL (§9.4)",
  );

  const listado = await listarMediosDePago();
  const enListado = listado.find((m) => m.id === a.id);
  ok(
    !!enListado?.logoUrl?.includes(subido.logoKey),
    "El listado devuelve la URL ya resuelta, en el tamaño chico",
  );

  const reemplazo = await publicarLogo({
    destino: "medio-de-pago",
    id: a.id,
    archivo: await png(240, 240),
  });
  archivos.push(...TAMANOS_LOGO.map((t) => clave(reemplazo.logoKey, t.sufijo)));

  ok(
    reemplazo.logoKey !== subido.logoKey,
    "Reemplazar el logo escribe una clave nueva",
  );
  ok(
    !(await existe(clave(subido.logoKey, "thumb"))),
    "…y borra los archivos del anterior, que si no quedan para siempre",
  );

  await quitarLogo("medio-de-pago", a.id);
  const [sinLogo] = await sql`
    SELECT logo_key AS "logoKey" FROM payment_methods WHERE id = ${a.id}`;
  ok(sinLogo.logoKey === null, "Quitar el logo deja la columna en NULL");
  ok(
    !(await existe(clave(reemplazo.logoKey, "thumb"))),
    "…y se lleva los archivos",
  );

  console.log("\n── Borrar (RN-11 no le cabe) ──");

  const conArchivos = await publicarLogo({
    destino: "medio-de-pago",
    id: b.id,
    archivo: await png(),
  });
  archivos.push(...TAMANOS_LOGO.map((t) => clave(conArchivos.logoKey, t.sufijo)));

  // Lo que hace la acción: leer las claves ANTES del DELETE.
  const aBorrar = await clavesDelLogo("medio-de-pago", b.id);
  ok(aBorrar.length === TAMANOS_LOGO.length, "Se leen las claves antes de borrar");

  await sql`DELETE FROM payment_methods WHERE id = ${b.id}`;
  creados.splice(creados.indexOf(b.id), 1);
  await borrarArchivos(aBorrar);

  ok(
    !(await existe(clave(conArchivos.logoKey, "thumb"))),
    "Borrar el medio de pago se lleva su logo de Storage",
  );

  // Y la renumeración de la acción, tal cual.
  await sql`
    WITH ordenados AS (
      SELECT id, row_number() OVER (
               ORDER BY sort_order, immutable_unaccent(lower(name))
             ) - 1 AS n
        FROM payment_methods
    )
    UPDATE payment_methods p SET sort_order = o.n
      FROM ordenados o WHERE p.id = o.id AND p.sort_order <> o.n`;

  const despues = (await posiciones()).map((f) => f.sortOrder);
  ok(
    despues.every((n, i) => n === i),
    `Borrar uno del medio renumera al resto (${despues.join(",")})`,
  );
} finally {
  if (creados.length) {
    await sql`DELETE FROM payment_methods WHERE id = ANY(${creados})`;
  }
  await borrarArchivos(archivos);
}

console.log(
  fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden. Nada quedó en la base ni en Storage.",
);
await sql.end();
process.exit(fallos ? 1 : 0);
