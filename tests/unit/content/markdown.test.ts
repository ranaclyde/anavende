import { describe, expect, test } from "vitest";

import {
  LIMITE_DE_TEXTO,
  longitudDeTexto,
  sanitizarMarkdown,
} from "@/modules/content/markdown";

/**
 * La lista blanca de §16 y RF-15, con lo que llega al pegar desde Word, Google
 * Docs o una página web. Se prueba el servidor: que el editor también filtre
 * no garantiza nada, porque corre en la máquina del que escribe.
 */

/** El serializador agrega un \n al final. */
const sale = (entrada: string) => sanitizarMarkdown(entrada).trim();

describe("lo que la vendedora puede usar", () => {
  test("la negrita sobrevive", () => {
    expect(sale("Teclado **mecánico** de verdad.")).toBe(
      "Teclado **mecánico** de verdad.",
    );
  });

  test("la cursiva sobrevive", () => {
    expect(sale("Teclado *retroiluminado*.")).toBe("Teclado *retroiluminado*.");
  });

  test("la lista con viñetas sobrevive", () => {
    expect(sale("- Uno\n- Dos")).toBe("- Uno\n- Dos");
  });

  test("la lista numerada sobrevive", () => {
    expect(sale("1. Uno\n2. Dos")).toBe("1. Uno\n2. Dos");
  });

  test("los párrafos sobreviven", () => {
    expect(sale("Uno\n\nDos")).toBe("Uno\n\nDos");
  });

  // Un solo nivel de subtítulo (DR §6.11): un `#` de la descripción
  // competiría con el nombre del producto en la ficha.
  test.each(["#", "##", "####", "######"])(
    "«%s Qué trae» se normaliza al único nivel",
    (nivel) => {
      expect(sale(`${nivel} Qué trae`)).toBe("### Qué trae");
    },
  );
});

describe("lo que se descarta conservando las palabras", () => {
  // Perder la palabra además del marcado sería descartar contenido.
  test("el enlace se va y las palabras quedan", () => {
    expect(
      sale(
        "Mirá el [manual del fabricante](https://ejemplo.com) antes de usarlo.",
      ),
    ).toBe("Mirá el manual del fabricante antes de usarlo.");
  });

  test("la cita pierde el marco y conserva el texto", () => {
    expect(sale("> Garantía de 12 meses.")).toBe("Garantía de 12 meses.");
  });

  test("el tachado se va y el texto queda", () => {
    expect(sale("Modelo ~~viejo~~ nuevo.")).toBe("Modelo viejo nuevo.");
  });

  test("el código en línea queda como texto", () => {
    expect(sale("Poné `sudo apt install` y listo.")).toBe(
      "Poné sudo apt install y listo.",
    );
  });
});

describe("lo que se borra entero", () => {
  // No hay nada legible que rescatar; las imágenes del producto van por RF-16.
  test("la imagen se borra entera", () => {
    expect(sale("![Foto del teclado](https://ejemplo.com/foto.jpg)")).toBe("");
  });

  test("el HTML crudo se borra y el texto de al lado no se rompe", () => {
    expect(sale("Antes\n\n<script>alert(1)</script>\n\nDespués")).toBe(
      "Antes\n\nDespués",
    );
  });

  test("el HTML en línea tampoco pasa", () => {
    expect(sale('<img src=x onerror="alert(1)">')).toBe("");
  });

  test("la línea divisoria se borra", () => {
    expect(sale("Uno\n\n---\n\nDos")).toBe("Uno\n\nDos");
  });

  // Sin la extensión GFM la tabla llega como texto suelto: lo que importa es
  // que no salga una tabla.
  test("la tabla no sobrevive como tabla", () => {
    expect(sanitizarMarkdown("| a | b |\n|---|---|\n| 1 | 2 |")).not.toContain(
      "|---",
    );
  });
});

describe("pegar desde Word, que es el caso real", () => {
  const pegado = [
    "# Teclado mecánico K120",
    "",
    "El **mejor** teclado *de la línea*. Ver [ficha técnica](https://ejemplo.com).",
    "",
    "![banner](https://ejemplo.com/b.png)",
    "",
    "| Tecla | Vida útil |",
    "|---|---|",
    "| Roja | 50M |",
    "",
    "## Incluye",
    "",
    "- Cable USB-C",
    "- Apoya muñecas",
    "",
    '<div style="color:red">Oferta</div>',
  ].join("\n");

  const limpio = sanitizarMarkdown(pegado);

  test("la negrita se conserva", () => {
    expect(limpio).toContain("**mejor**");
  });

  test("la cursiva se conserva", () => {
    expect(limpio).toContain("*de la línea*");
  });

  test("la lista se conserva", () => {
    expect(limpio).toContain("- Cable USB-C");
  });

  test("el título se conserva como subtítulo", () => {
    expect(limpio).toContain("### Teclado mecánico K120");
  });

  test("no queda ninguna URL", () => {
    expect(limpio).not.toContain("ejemplo.com");
  });

  test("no queda ninguna imagen", () => {
    expect(limpio).not.toContain("![");
  });

  test("no queda HTML", () => {
    expect(limpio).not.toContain("<div");
    expect(limpio).not.toContain("style=");
  });

  test("el texto del enlace no se pierde", () => {
    expect(limpio).toContain("ficha técnica");
  });

  /**
   * §16 sanitiza también al renderizar: si la segunda pasada moviera algo, la
   * ficha mostraría un texto distinto del guardado.
   */
  test("sanitizar dos veces da lo mismo que sanitizar una", () => {
    expect(sanitizarMarkdown(limpio)).toBe(limpio);
  });
});

describe("el límite cuenta texto, no sintaxis (RF-15)", () => {
  test("cuenta las letras, no los asteriscos", () => {
    expect(longitudDeTexto("**hola**")).toBe(4);
  });

  test("una descripción vacía mide cero", () => {
    expect(longitudDeTexto("")).toBe(0);
  });

  test(`el límite es de ${LIMITE_DE_TEXTO} caracteres de texto`, () => {
    expect(longitudDeTexto("a".repeat(LIMITE_DE_TEXTO))).toBe(LIMITE_DE_TEXTO);
  });

  /**
   * El servidor cuenta menos que el editor, nunca más: al revés, la vendedora
   * escribiría hasta el tope que le muestran y perdería el texto al guardar.
   */
  test("no cuenta los saltos entre bloques: cuenta menos que el editor", () => {
    expect(longitudDeTexto("Uno\n\nDos")).toBeLessThanOrEqual(
      "Uno\n\nDos".length,
    );
  });
});

describe("vacío", () => {
  // Cadena vacía y no el salto que agrega el serializador: «hay descripción»
  // se decide comparando contra "".
  test("una descripción vacía se guarda vacía", () => {
    expect(sanitizarMarkdown("")).toBe("");
  });

  test("una descripción de puro espacio también", () => {
    expect(sanitizarMarkdown("   \n\n  ")).toBe("");
  });
});
