/**
 * Comprueba la lista blanca de §16 y RF-15: qué sobrevive al sanitizador y
 * qué no, con lo que de verdad llega al pegar desde Word, Google Docs o una
 * página web.
 *
 * Es la mitad del «Hecho cuando» de F2.3 que no vive en la base. Lo que se
 * prueba es EL SERVIDOR: que el editor filtre también es cierto, pero no es
 * lo que garantiza nada — el editor corre en la máquina del que escribe.
 */
import {
  LIMITE_DE_TEXTO,
  longitudDeTexto,
  sanitizarMarkdown,
} from "../modules/content/markdown.ts";

let fallos = 0;

const ok = (b: boolean, msg: string) => {
  if (!b) fallos++;
  console.log(`${b ? "✅" : "❌"} ${msg}`);
};

const conserva = (entrada: string, esperado: string, msg: string) =>
  ok(sanitizarMarkdown(entrada).trim() === esperado.trim(), msg);

// ── Lo que la vendedora puede usar ──────────────────────────────────────

conserva("Teclado **mecánico** de verdad.", "Teclado **mecánico** de verdad.", "La negrita sobrevive");
conserva("Teclado *retroiluminado*.", "Teclado *retroiluminado*.", "La cursiva sobrevive");
conserva("- Uno\n- Dos", "- Uno\n- Dos", "La lista con viñetas sobrevive");
conserva("1. Uno\n2. Dos", "1. Uno\n2. Dos", "La lista numerada sobrevive");
conserva("Uno\n\nDos", "Uno\n\nDos", "Los párrafos sobreviven");

// Un solo nivel de subtítulo: venga como sea, sale como `###` (DR §6.11).
for (const nivel of ["#", "##", "####", "######"]) {
  conserva(`${nivel} Qué trae`, "### Qué trae", `«${nivel} Qué trae» se normaliza al único nivel`);
}

// ── Lo que se descarta conservando las palabras ─────────────────────────
//
// RF-15: «descarta el resto sin romper el resto del texto».

conserva(
  "Mirá el [manual del fabricante](https://ejemplo.com) antes de usarlo.",
  "Mirá el manual del fabricante antes de usarlo.",
  "El enlace se va y las palabras quedan",
);
conserva("> Garantía de 12 meses.", "Garantía de 12 meses.", "La cita pierde el marco y conserva el texto");
conserva("Modelo ~~viejo~~ nuevo.", "Modelo viejo nuevo.", "El tachado se va y el texto queda");
conserva("Poné `sudo apt install` y listo.", "Poné sudo apt install y listo.", "El código en línea queda como texto");

// ── Lo que se borra entero ──────────────────────────────────────────────
//
// No hay nada legible que rescatar, y RF-16 ya tiene las imágenes del
// producto, con su canalización, sus tamaños y su orden.

conserva("![Foto del teclado](https://ejemplo.com/foto.jpg)", "", "La imagen se borra entera");
conserva("Antes\n\n<script>alert(1)</script>\n\nDespués", "Antes\n\nDespués", "El HTML crudo se borra y el texto de al lado no se rompe");
conserva('<img src=x onerror="alert(1)">', "", "El HTML en línea tampoco pasa");
conserva("Uno\n\n---\n\nDos", "Uno\n\nDos", "La línea divisoria se borra");

// La tabla ni siquiera se parsea sin la extensión GFM: llega como texto. Lo
// que importa es que NO salga una tabla del otro lado.
ok(!sanitizarMarkdown("| a | b |\n|---|---|\n| 1 | 2 |").includes("|---"), "La tabla no sobrevive como tabla");

// ── Pegar desde Word, que es el caso real ───────────────────────────────

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

ok(limpio.includes("**mejor**"), "Pegado desde Word: la negrita se conserva");
ok(limpio.includes("*de la línea*"), "Pegado desde Word: la cursiva se conserva");
ok(limpio.includes("- Cable USB-C"), "Pegado desde Word: la lista se conserva");
ok(limpio.includes("### Teclado mecánico K120"), "Pegado desde Word: el título se conserva como subtítulo");
ok(!limpio.includes("ejemplo.com"), "Pegado desde Word: no queda ninguna URL");
ok(!limpio.includes("!["), "Pegado desde Word: no queda ninguna imagen");
ok(!limpio.includes("<div") && !limpio.includes("style="), "Pegado desde Word: no queda HTML");
ok(limpio.includes("ficha técnica"), "Pegado desde Word: el texto del enlace no se pierde");

// ── Dos pasadas: sanitizar lo ya sanitizado no cambia nada ──────────────
//
// §16 sanitiza también al renderizar. Si la segunda pasada moviera algo, la
// ficha mostraría un texto distinto del que se guardó.

ok(sanitizarMarkdown(limpio) === limpio, "Sanitizar dos veces da lo mismo que sanitizar una");

// ── El límite cuenta texto, no sintaxis (RF-15) ─────────────────────────

ok(longitudDeTexto("**hola**") === 4, "El límite cuenta las letras, no los asteriscos");
ok(longitudDeTexto("") === 0, "Una descripción vacía mide cero");
ok(
  longitudDeTexto("a".repeat(LIMITE_DE_TEXTO)) === LIMITE_DE_TEXTO,
  `El límite es de ${LIMITE_DE_TEXTO} caracteres de texto`,
);
// El servidor cuenta MENOS que el editor, nunca más: lo que el editor acepta
// se guarda. Al revés, el contador diría que entra y el guardado lo negaría.
ok(
  longitudDeTexto("Uno\n\nDos") <= "Uno\n\nDos".length,
  "El servidor no cuenta los saltos entre bloques: cuenta menos que el editor, nunca más",
);

// ── Vacío ───────────────────────────────────────────────────────────────
//
// RF-15: «Una descripción vacía es válida». Tiene que quedar como cadena
// vacía y no como el salto que agrega el serializador.

ok(sanitizarMarkdown("") === "", "Una descripción vacía se guarda vacía");
ok(sanitizarMarkdown("   \n\n  ") === "", "Una descripción de puro espacio también");

console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo en orden.");
process.exit(fallos ? 1 : 0);
