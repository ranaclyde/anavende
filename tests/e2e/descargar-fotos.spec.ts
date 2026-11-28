import { execFileSync } from "node:child_process";

import sharp from "sharp";

import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";
import { slugificar } from "@/lib/slug";

/**
 * «Descargar fotos»: un zip con las fotos del producto, en JPG y con una
 * carpeta por color. Se abre con el `zipfile` de Python.
 */

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let producto: { id: string; slug: string };
const color = `Azul ${palabra}`;

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const azul = await datos.unColor(color, "#2244CC");
  producto = await datos.unProducto({
    nombre: `Joystick ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "25000.00",
    colores: [azul],
    stock: 3,
  });
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

function zipfile(ruta: string, codigo: string): string {
  return execFileSync(
    "python3",
    [
      "-I",
      "-c",
      `import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); ${codigo}`,
      ruta,
    ],
    { encoding: "utf8" },
  ).trim();
}

test("baja un zip con las fotos del producto en JPG", async ({ page }) => {
  await ingresar(page, admin);
  await page.goto(`/admin/productos/${producto.id}`);
  const seccion = page.getByRole("region", { name: "Colores y stock" });
  await expect(
    seccion.getByRole("button", { name: "Agregar color" }),
  ).toBeVisible();
  // Sin fotos no hay botón: un zip vacío no sirve.
  await expect(
    seccion.getByRole("button", { name: "Descargar fotos" }),
  ).toHaveCount(0);

  const fila = seccion
    .getByRole("listitem")
    .filter({ hasText: `${color} ` })
    .first();
  await fila.locator("input[type=file]").setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 900, height: 600, channels: 3, background: "#2244CC" },
    })
      .png()
      .toBuffer(),
  });
  const descargar = seccion.getByRole("button", { name: "Descargar fotos" });
  await expect(descargar).toBeVisible();
  expect(await hallazgosDeAxe(page)).toEqual([]);

  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    descargar.click(),
  ]);
  expect(descarga.suggestedFilename()).toBe(`${producto.slug}-fotos.zip`);
  const ruta = await descarga.path();

  expect(
    JSON.parse(zipfile(ruta, "print(__import__('json').dumps(z.namelist()))")),
  ).toEqual([`${slugificar(color)}/1.jpg`]);
  // Del tamaño de la `-detail`: la de 900 no se agranda.
  const foto = await sharp(
    execFileSync("python3", [
      "-I",
      "-c",
      "import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))",
      ruta,
      `${slugificar(color)}/1.jpg`,
    ]),
  ).metadata();
  expect(foto).toMatchObject({ format: "jpeg", width: 900, height: 600 });
});
