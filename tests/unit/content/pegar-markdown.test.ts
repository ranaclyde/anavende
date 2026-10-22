import { ListItemNode, ListNode } from "@lexical/list";
import { $convertToMarkdownString } from "@lexical/markdown";
import { $isHeadingNode, HeadingNode } from "@lexical/rich-text";
import { $getRoot, createEditor } from "lexical";
import { describe, expect, test } from "vitest";

import {
  $nodosDesdeMarkdown,
  pareceMarkdown,
  TRANSFORMADORES,
} from "@/components/admin/productos/formato";

/**
 * Pegar Markdown escrito como texto en el editor de la descripción — RF-15.
 *
 * El editor corre sin DOM: la conversión es la misma, y lo que se compara es
 * lo que se guardaría (`TRANSFORMADORES`) y qué bloques quedaron.
 */

function pegar(texto: string) {
  const editor = createEditor({
    nodes: [HeadingNode, ListNode, ListItemNode],
    onError(error) {
      throw error;
    },
  });

  editor.update(
    () => {
      $getRoot()
        .clear()
        .append(...$nodosDesdeMarkdown(texto));
    },
    { discrete: true },
  );

  return editor.getEditorState().read(() => ({
    guardado: $convertToMarkdownString(TRANSFORMADORES),
    bloques: $getRoot()
      .getChildren()
      .map((nodo) => ($isHeadingNode(nodo) ? nodo.getTag() : nodo.getType())),
  }));
}

describe("qué texto se convierte al pegar", () => {
  test.each([
    ["negrita con asteriscos", "Esto es **importante**."],
    ["negrita con guion bajo", "Esto es __importante__."],
    ["cursiva con asterisco", "Esto es *suave*."],
    ["cursiva con guion bajo", "Esto es _suave_."],
    ["negrita que cruza un salto de línea", "**una frase\nlarga** y sigue"],
    ["viñetas con guion", "- Cable\n- Mouse"],
    ["viñetas con asterisco", "* Cable\n* Mouse"],
    ["lista numerada", "1. Abrir la caja\n2. Enchufar"],
    ["subtítulo", "### Qué trae"],
  ])("%s", (_, texto) => {
    expect(pareceMarkdown(texto)).toBe(true);
  });

  test.each([
    ["renglones sueltos, como de WhatsApp", "Incluye:\nCable\nMouse"],
    ["una cuenta", "5*3*2 y 2 * 3 * 4"],
    ["un nombre de archivo", "manual_de_uso_v2.pdf"],
    ["un guion en el medio", "Precio $10.000 - envío gratis"],
    ["un porcentaje al principio", "-10% de descuento"],
    ["un enlace", "[la web](https://example.com)"],
    ["un énfasis que cruza párrafos", "Uno _a\n\nb_ dos y **c\n\nd**"],
  ])("%s, no", (_, texto) => {
    expect(pareceMarkdown(texto)).toBe(false);
  });
});

describe("cómo queda lo pegado", () => {
  test("el ejemplo que no andaba: negrita en un párrafo cortado en renglones", () => {
    const { guardado, bloques } = pegar(
      "**Ningún valor secreto va en este documento ni en ningún otro archivo del\n" +
        "repositorio, que es público.** Acá están los nombres de las variables y dónde\n" +
        "se cargan; los valores viven en Coolify y en el servidor de datos.",
    );

    expect(bloques).toEqual(["paragraph"]);
    expect(guardado).toBe(
      "**Ningún valor secreto va en este documento ni en ningún otro archivo del " +
        "repositorio, que es público.** Acá están los nombres de las variables y dónde " +
        "se cargan; los valores viven en Coolify y en el servidor de datos.",
    );
  });

  test("los guiones son viñetas", () => {
    expect(pegar("- Cable USB-C\n- Mouse\n- Manual")).toEqual({
      bloques: ["list"],
      guardado: "- Cable USB-C\n- Mouse\n- Manual",
    });
  });

  test("un renglón antes de la lista queda como párrafo aparte", () => {
    expect(pegar("Incluye:\n- Cable\n- Mouse")).toEqual({
      bloques: ["paragraph", "list"],
      guardado: "Incluye:\n\n- Cable\n- Mouse",
    });
  });

  test("la numerada sigue numerada", () => {
    expect(pegar("1. Abrir la caja\n2. Enchufar").guardado).toBe(
      "1. Abrir la caja\n2. Enchufar",
    );
  });

  test("con guion bajo se guarda con asteriscos, como lo escribe el editor", () => {
    expect(pegar("Es __muy__ _liviano_ y ___rápido___").guardado).toBe(
      "Es **muy** *liviano* y ***rápido***",
    );
  });

  test("cualquier nivel de título pasa a ser el subtítulo", () => {
    expect(pegar("# Qué trae\nTodo **nuevo**")).toEqual({
      bloques: ["h3", "paragraph"],
      guardado: "### Qué trae\n\nTodo **nuevo**",
    });
  });

  test("una línea en blanco separa párrafos", () => {
    expect(pegar("Uno **fuerte**\n\nDos").bloques).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });

  test("lo que no está en la lista blanca queda como texto", () => {
    expect(pegar("Ver **esto**: [la web](https://example.com)").guardado).toBe(
      "Ver **esto**: [la web](https://example.com)",
    );
  });
});
