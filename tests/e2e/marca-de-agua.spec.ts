import { expect, test } from "./apoyo/test";
import sharp from "sharp";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Color, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F2.16 — La marca de agua de punta a punta (RF-39): se sube una imagen a la
 * biblioteca, se arma una capa, se prueba en la vista previa, se guarda y se
 * activa; la ficha del producto avisa que está activada y la foto que se
 * sube queda marcada.
 *
 * La marca es una para toda la tienda: se anota cómo estaba y se deja igual.
 */

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let negro: Color;
let producto: { id: string };
let antes: { activa: boolean; capas: Record<string, unknown>[] };
const CAPTURAS = process.env.CAPTURAS;

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  producto = await datos.unProducto({
    nombre: `Mouse ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "15000.00",
    colores: [negro],
    stock: 3,
  });
  admin = await datos.unaCuenta("Ana", "admin");

  const [fila] = await datos.sql<{ enabled: boolean }[]>`
    SELECT enabled FROM watermark_settings WHERE id = 1`;
  const capas = await datos.sql<Record<string, unknown>[]>`
    SELECT image_id, mode, anchor, size_pct, margin_pct, opacity_pct, sort_order
      FROM watermark_layers`;
  antes = { activa: fila?.enabled ?? false, capas: [...capas] };
  await datos.sql`DELETE FROM watermark_layers`;
  await datos.sql`UPDATE watermark_settings SET enabled = false WHERE id = 1`;
});

test.afterAll(async () => {
  // Las imágenes que subió el test, también si falló a mitad: el borrado
  // del final es parte de lo que se prueba y puede no haber llegado.
  const subidas = await datos.sql<{ id: string; storage_key: string }[]>`
    DELETE FROM watermark_images WHERE name = ${`logo-${palabra}`}
    RETURNING id, storage_key`;
  for (const { storage_key } of subidas) {
    await datos.borrarArchivo(`${storage_key}-marca.webp`);
  }
  await datos.sql`DELETE FROM watermark_layers`;
  for (const c of antes.capas) {
    await datos.sql`INSERT INTO watermark_layers ${datos.sql(c)}`;
  }
  await datos.sql`
    UPDATE watermark_settings SET enabled = ${antes.activa} WHERE id = 1`;
  await datos.desarmar();
});

/** Un logo de prueba: un cuadrado rojo sobre transparente. */
function logo(): Promise<Buffer> {
  return sharp({
    create: {
      width: 300,
      height: 300,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: 200,
            height: 200,
            channels: 4,
            background: { r: 200, g: 20, b: 40, alpha: 1 },
          },
        },
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
}

function foto(): Promise<Buffer> {
  return sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#d8d4cc" },
  })
    .jpeg()
    .toBuffer();
}

test("se arma, se prueba, se activa y la foto que se sube queda marcada", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "anavende:ayudas:v1",
      JSON.stringify(["panel-producto", "ficha"]),
    ),
  );
  // Sin animaciones: axe mide el contraste en el momento, y un aviso a
  // mitad de aparecer tiene el texto a medio color.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ingresar(page, admin);
  await page.goto("/admin/configuracion/marca-de-agua");

  // El estado y su botón están en el encabezado, y solo si hay imágenes:
  // sin ninguna, la pantalla es solo «subí tu marca».
  const activar = page.getByRole("button", {
    name: "Activar la marca de agua",
  });

  // Un JPG no entra: no tiene transparencia.
  const biblioteca = page.getByRole("region", { name: "Imágenes" });
  const archivo = biblioteca.locator("input[type=file]");
  await archivo.setInputFiles({
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: await foto(),
  });
  await expect(biblioteca.getByRole("alert")).toContainText("PNG");

  const nombre = `logo-${palabra}`;
  await archivo.setInputFiles({
    name: `${nombre}.png`,
    mimeType: "image/png",
    buffer: await logo(),
  });
  await expect(biblioteca.getByText(nombre, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Desactivada", { exact: true })).toBeVisible();
  await expect(activar).toBeDisabled();

  // Una capa en la esquina, al 30% y sin transparencia de más.
  const capas = page.getByRole("region", { name: "Capas" });
  await capas.getByRole("button", { name: "Agregar capa" }).click();
  await capas.getByRole("radio", { name: nombre }).check();
  await capas.getByRole("radio", { name: "Abajo a la derecha" }).check();
  const opacidad = capas.getByRole("slider", { name: "Opacidad" });
  await opacidad.focus();
  await page.keyboard.press("End");
  await expect(capas.getByText("100%, como está la imagen")).toBeVisible();

  // La vista previa la arma el servidor con lo que está en pantalla.
  const previa = page.getByRole("region", { name: "Vista previa" });
  await previa.locator("input[type=file]").setInputFiles({
    name: "prueba.jpg",
    mimeType: "image/jpeg",
    buffer: await foto(),
  });
  const imagen = previa.getByRole("img", {
    name: "La foto de prueba con la marca de agua puesta",
  });
  await expect(imagen).toBeVisible({ timeout: 20_000 });

  // Con cambios sin guardar no se activa: activaría otra cosa.
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
  await expect(activar).toBeDisabled();

  // Con dos capas se pliegan y se abre una por vez: la nueva se abre, y la
  // primera queda cerrada y resumida en su cabecera.
  await capas.getByRole("button", { name: "Agregar capa" }).click();
  const primera = capas.getByRole("button", { name: /^Capa 1/ });
  await expect(primera).toHaveAttribute("aria-expanded", "false");
  await expect(primera).toContainText(
    "Abajo a la derecha · tamaño 20% · opacidad 100%",
  );
  await expect(capas.getByRole("button", { name: /^Capa 2/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(capas.getByRole("slider", { name: "Opacidad" })).toHaveCount(1);
  expect(await hallazgosDeAxe(page)).toEqual([]);

  if (CAPTURAS) {
    await expect(previa.getByText("Actualizando")).toBeHidden();
    for (const ancho of [1280, 1497]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await expect(previa.getByText("Actualizando")).toBeHidden();
      await page.screenshot({
        path: `${CAPTURAS}/marca-${ancho}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${CAPTURAS}/marca-390.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 800 });
  }

  // Se quita la segunda y la que queda vuelve a estar abierta, sin plegar.
  await capas.getByRole("button", { name: "Quitar la capa 2" }).click();
  await expect(capas.getByRole("slider", { name: "Opacidad" })).toHaveCount(1);
  await expect(capas.getByRole("button", { name: /^Capa 1/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Guardar capas" }).click();
  await expect(page.getByText("Actualizado")).toBeVisible();

  await activar.click();
  await expect(page.getByText("Activada", { exact: true })).toBeVisible();

  expect(await hallazgosDeAxe(page)).toEqual([]);

  // En la ficha del producto se avisa, y la foto sube marcada.
  await page.goto(`/admin/productos/${producto.id}`);
  const seccion = page.getByRole("region", { name: "Colores y stock" });
  await expect(
    seccion.getByRole("link", { name: "Marca de agua activada" }),
  ).toBeVisible();

  const fila = seccion
    .getByRole("listitem")
    .filter({ hasText: `${negro.nombre} ` })
    .first();
  await fila.locator("input[type=file]").setInputFiles({
    name: "producto.jpg",
    mimeType: "image/jpeg",
    buffer: await foto(),
  });
  await expect(
    fila.getByRole("button", {
      name: `Opciones de la imagen 1 de ${negro.nombre}`,
    }),
  ).toBeVisible({ timeout: 30_000 });

  const [subida] = await datos.sql<{ marca: boolean }[]>`
    SELECT i.has_watermark AS marca
      FROM variant_images i JOIN product_variants v ON v.id = i.variant_id
     WHERE v.product_id = ${producto.id}`;
  expect(subida.marca).toBe(true);

  // Borrar la imagen de la única capa la apaga.
  await page.goto("/admin/configuracion/marca-de-agua");
  await page
    .getByRole("region", { name: "Imágenes" })
    .getByRole("button", { name: `Borrar «${nombre}»` })
    .click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("La usa la capa 1");
  await dialogo.getByRole("button", { name: "Borrar" }).click();
  // Con el diálogo abierto lo de atrás no cuenta como visible: se espera a
  // la base, que es lo que dice que se borró y se apagó.
  await expect
    .poll(async () => {
      const [fila] = await datos.sql<{ enabled: boolean }[]>`
        SELECT enabled FROM watermark_settings WHERE id = 1`;
      return fila.enabled;
    })
    .toBe(false);
  await expect(
    page.getByRole("button", { name: `Borrar «${nombre}»` }),
  ).toHaveCount(0);
});
