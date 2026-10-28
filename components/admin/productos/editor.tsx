"use client";

import { useCallback, useEffect, useState } from "react";
import { Bold, Italic, Heading, List, ListOrdered } from "lucide-react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  type LexicalEditor,
} from "lexical";

import {
  $nodosDesdeMarkdown,
  pareceMarkdown,
  SUBTITULO,
  TRANSFORMADORES,
} from "@/components/admin/productos/formato";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AVISO_DE_LIMITE, LIMITE_DE_TEXTO } from "@/modules/content/limites";

/**
 * Editor de la descripción de producto — RF-15, DESIGN-REFERENCE §6.11.
 *
 * La vendedora nunca ve la sintaxis: escribe con los botones y el resultado
 * se guarda como Markdown. Lo que hace que la regla se cumpla no es este
 * componente sino su lista de *transformadores* (`formato.ts`): **es** la
 * lista blanca de §16, no una copia.
 *
 * El servidor vuelve a filtrar de todos modos (`modules/content/markdown.ts`).
 * Esto corre en la máquina de quien escribe y por eso no garantiza nada: es
 * para que se vea lo que va a quedar, no para que quede.
 */

/** Dice QUÉ escribir, no «Escribí acá» (§10). */
const MARCADOR = "Qué es, para qué sirve y qué trae en la caja.";

/**
 * El aspecto del texto DENTRO del editor. No es el de la ficha (§6.11, que
 * corre a 16px sobre 68 caracteres de ancho): acá manda la escala del panel,
 * 14px, porque el editor es un campo de formulario y tiene que verse como
 * los de al lado. Lo que sí se respeta es la jerarquía —el subtítulo pesa
 * más, la negrita no cambia de color— para que lo que se ve sea lo que va a
 * salir publicado.
 */
const TEMA = {
  paragraph: "mb-3 last:mb-0",
  heading: { h3: "mt-5 mb-2 font-semibold first:mt-0" },
  list: {
    ul: "mb-3 list-disc space-y-1.5 pl-5 marker:text-ink-tertiary",
    ol: "mb-3 list-decimal space-y-1.5 pl-5 marker:text-ink-tertiary",
    listitem: "pl-1",
  },
  text: {
    // Peso 600 y el MISMO color: el burdeos es de la marca y de lo
    // accionable, nunca del énfasis (§6.11).
    bold: "font-semibold",
    italic: "italic",
  },
};

type Bloque = "parrafo" | "subtitulo" | "vinetas" | "numerada";

/** Lo que la barra necesita saber del cursor, y nada más. */
type Estado = { negrita: boolean; cursiva: boolean; bloque: Bloque };

const ESTADO_INICIAL: Estado = {
  negrita: false,
  cursiva: false,
  bloque: "parrafo",
};

function BotonDeFormato({
  etiqueta,
  activo,
  Icono,
  alTocar,
}: {
  etiqueta: string;
  activo: boolean;
  Icono: typeof Bold;
  alTocar: () => void;
}) {
  return (
    <Button
      type="button"
      variant="tertiary"
      size="icon"
      // El estado no viaja solo en el color: `aria-pressed` lo dice, y el
      // fondo hundido lo muestra (§9, §6.11).
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={alTocar}
      className={cn(
        // 32px, el tamaño que §6.11 le pide a la barra. `admin:` va explícito
        // porque la variante `icon` trae su propio `admin:size-9`, y sin
        // repetir el prefijo ese gana justo en la escala del panel — que es
        // la única donde vive este editor.
        "size-8 admin:size-8 rounded-panel-control text-ink-secondary",
        activo && "bg-surface-sunken text-ink",
      )}
    >
      <Icono aria-hidden className="size-4" />
    </Button>
  );
}

/**
 * La barra. Es un plugin y no un componente suelto porque necesita el editor
 * del contexto: leer qué formato está activo bajo el cursor y mandar los
 * comandos.
 */
function Barra() {
  const [editor] = useLexicalComposerContext();
  const [estado, setEstado] = useState<Estado>(ESTADO_INICIAL);

  useEffect(() => {
    // Un solo `listener` para los dos: mover el cursor y escribir cambian lo
    // mismo, y registrar dos suscripciones para el mismo cálculo sería
    // pintar la barra dos veces por tecla.
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const seleccion = $getSelection();
        if (!$isRangeSelection(seleccion)) return;

        const ancla = seleccion.anchor.getNode();
        const lista = $getNearestNodeOfType(ancla, ListNode);

        const bloqueSuperior =
          $findMatchingParent(ancla, (n) => {
            const padre = n.getParent();
            return padre !== null && $isRootOrShadowRoot(padre);
          }) ?? ancla.getTopLevelElementOrThrow();

        const bloque: Bloque = lista
          ? $isListNode(lista) && lista.getListType() === "number"
            ? "numerada"
            : "vinetas"
          : $isHeadingNode(bloqueSuperior)
            ? "subtitulo"
            : "parrafo";

        // Si nada cambió, `setEstado` con un objeto nuevo igualmente
        // repintaría: se compara antes.
        setEstado((previo) =>
          previo.negrita === seleccion.hasFormat("bold") &&
          previo.cursiva === seleccion.hasFormat("italic") &&
          previo.bloque === bloque
            ? previo
            : {
                negrita: seleccion.hasFormat("bold"),
                cursiva: seleccion.hasFormat("italic"),
                bloque,
              },
        );
      });
    });
  }, [editor]);

  /** Poner y sacar son el mismo botón: se alterna contra lo que ya hay. */
  const alternarSubtitulo = useCallback(() => {
    editor.update(() => {
      const seleccion = $getSelection();
      if (!$isRangeSelection(seleccion)) return;
      $setBlocksType(seleccion, () =>
        estado.bloque === "subtitulo"
          ? $createParagraphNode()
          : $createHeadingNode(SUBTITULO),
      );
    });
  }, [editor, estado.bloque]);

  const alternarLista = useCallback(
    (cual: "vinetas" | "numerada") => {
      if (estado.bloque === cual) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        return;
      }
      editor.dispatchCommand(
        cual === "vinetas"
          ? INSERT_UNORDERED_LIST_COMMAND
          : INSERT_ORDERED_LIST_COMMAND,
        undefined,
      );
    },
    [editor, estado.bloque],
  );

  return (
    <div
      // `toolbar` con orientación: las flechas son la forma esperada de
      // recorrerla, y `Tab` alcanza igual cada botón (§6.11, §9).
      role="toolbar"
      aria-label="Formato de la descripción"
      aria-orientation="horizontal"
      className="flex items-center gap-0.5 border-b border-border px-1.5 py-1"
    >
      <BotonDeFormato
        etiqueta="Negrita"
        activo={estado.negrita}
        Icono={Bold}
        alTocar={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      />
      <BotonDeFormato
        etiqueta="Cursiva"
        activo={estado.cursiva}
        Icono={Italic}
        alTocar={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      />

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

      <BotonDeFormato
        etiqueta="Subtítulo"
        activo={estado.bloque === "subtitulo"}
        Icono={Heading}
        alTocar={alternarSubtitulo}
      />
      <BotonDeFormato
        etiqueta="Lista con viñetas"
        activo={estado.bloque === "vinetas"}
        Icono={List}
        alTocar={() => alternarLista("vinetas")}
      />
      <BotonDeFormato
        etiqueta="Lista numerada"
        activo={estado.bloque === "numerada"}
        Icono={ListOrdered}
        alTocar={() => alternarLista("numerada")}
      />
    </div>
  );
}

/**
 * El contador (§6.11): aparece recién en los últimos 500 caracteres.
 *
 * Vive acá adentro y no en el formulario a propósito. Es lo único que cambia
 * mientras se escribe, así que teniéndolo en su propio componente cada tecla
 * repinta doce caracteres de texto y no el formulario entero.
 */
function Contador({ limite }: { limite: number }) {
  const [editor] = useLexicalComposerContext();
  const [restantes, setRestantes] = useState<number | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const quedan = limite - $getRoot().getTextContent().length;
        // Fuera de la zona de aviso el estado es `null` y se queda en `null`:
        // escribir el mismo valor no repinta.
        setRestantes(quedan <= AVISO_DE_LIMITE ? quedan : null);
      });
    });
  }, [editor, limite]);

  if (restantes === null) return null;

  const pasado = restantes < 0;

  return (
    <p
      // Cambia mientras se escribe: `polite` lo anuncia sin interrumpir.
      aria-live="polite"
      className={cn(
        "px-3 pb-2 text-right text-caption",
        pasado ? "text-danger" : "text-ink-secondary",
      )}
    >
      {pasado
        ? `Te pasaste por ${(-restantes).toLocaleString("es-AR")} caracteres`
        : `Te quedan ${restantes.toLocaleString("es-AR")} caracteres`}
    </p>
  );
}

/**
 * Pegar Markdown escrito como texto: `**negrita**`, `*cursiva*`, renglones
 * con `- ` o `1. `, `### subtítulo`. Sin esto, lo copiado de un archivo, de
 * una terminal o de un bloc de notas entra con los asteriscos a la vista.
 *
 * **Decide el texto plano, no el HTML.** Lo que se copia de una página o de
 * Word trae su formato en HTML y Lexical ya lo respeta; pero un editor de
 * código también pone HTML en el portapapeles —el texto coloreado, con los
 * asteriscos adentro—, y ahí el formato real está en las marcas. Si el texto
 * plano trae marcas de Markdown, son la intención de quien copió. La única
 * excepción es lo copiado del mismo editor, que Lexical pega entero.
 *
 * Lo que no parece Markdown sigue el camino de siempre (ver `pareceMarkdown`).
 * Corre antes que el pegado de `RichTextPlugin`, que está en la prioridad más
 * baja, y deshacer lo revierte de un solo paso.
 */
function PegarMarkdown() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (evento) => {
        // El mismo comando llega también desde el teclado y desde `input`:
        // solo un evento de portapapeles trae lo pegado.
        if (!(evento instanceof ClipboardEvent)) return false;
        const datos = evento.clipboardData;
        if (!datos || datos.types.includes("application/x-lexical-editor")) {
          return false;
        }

        const texto = datos.getData("text/plain");
        if (!pareceMarkdown(texto)) return false;

        evento.preventDefault();
        $insertNodes($nodosDesdeMarkdown(texto));
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

/** Carga el Markdown guardado una sola vez, al montar. */
/** La marca de la carga inicial, para que no cuente como un cambio. */
const CARGA_INICIAL = "carga-inicial";

/**
 * Avisa cuando cambia el texto (F2.15): el formulario necesita saber si hay
 * algo sin guardar, y la descripción no es estado de React. Mover el cursor
 * no cuenta —no ensucia ningún nodo— y la carga inicial tampoco. Avisa en
 * cada cambio y no solo en el primero: Legales guarda sin salir de la
 * pantalla, y después de guardar tiene que volver a enterarse. Quien lo
 * recibe pone un `true`, que no repinta si ya lo era.
 */
function AvisarCambio({ alCambiar }: { alCambiar: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, tags }) => {
        if (tags.has(CARGA_INICIAL)) return;
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        alCambiar();
      },
    );
  }, [editor, alCambiar]);

  return null;
}

function CargaInicial({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!markdown) return;
    editor.update(() => $convertFromMarkdownString(markdown, TRANSFORMADORES), {
      tag: CARGA_INICIAL,
    });
    // A propósito solo al montar: si dependiera de `markdown`, cada respuesta
    // del servidor pisaría lo que la vendedora está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return null;
}

/**
 * Lee lo escrito como Markdown. Se llama AL ENVIAR y no en cada tecla:
 * serializar el documento entero sesenta veces por minuto es trabajo que
 * nadie mira, y el formulario no necesita el texto hasta que se guarda.
 */
export function leerMarkdown(editor: LexicalEditor | null): string {
  if (!editor) return "";
  return editor
    .getEditorState()
    .read(() => $convertToMarkdownString(TRANSFORMADORES));
}

/**
 * Sirve también para las páginas legales (RF-29, F9.3): mismo formato, mismo
 * sanitizador y mismo editor. Lo que cambia es el rótulo, el marcador, el
 * límite y el alto: una política de privacidad no entra en 480px.
 */
export function EditorDeDescripcion({
  id,
  valorInicial,
  refEditor,
  invalido,
  describedBy,
  etiqueta = "Descripción del producto",
  marcador = MARCADOR,
  limite = LIMITE_DE_TEXTO,
  largo = false,
  alCambiar,
}: {
  id: string;
  valorInicial: string;
  refEditor: React.RefObject<LexicalEditor | null>;
  invalido: boolean;
  describedBy?: string;
  etiqueta?: string;
  marcador?: string;
  limite?: number;
  /** Para textos largos: el área crece hasta el 70% de la pantalla. */
  largo?: boolean;
  /** Se llama la primera vez que quien escribe cambia el texto. */
  alCambiar?: () => void;
}) {
  return (
    <div
      className={cn(
        // La barra y el área son UN campo (§6.11): el borde las rodea a las
        // dos y el anillo de foco también. Por eso el anillo se apaga en el
        // área de escritura y se enciende acá.
        "overflow-hidden rounded-panel-control border border-border bg-surface",
        "transition-colors duration-150",
        "focus-within:border-border-strong",
        "has-[[contenteditable]:focus-visible]:shadow-focus",
        invalido && "border-danger",
      )}
    >
      <LexicalComposer
        initialConfig={{
          namespace: "descripcion-de-producto",
          theme: TEMA,
          // Los ÚNICOS nodos registrados. Un nodo que no está acá no se puede
          // crear ni pegar: al pegar desde Word, una tabla o una imagen no
          // encuentran dónde ir y se caen solas. Es la misma lista blanca,
          // del lado del editor.
          nodes: [HeadingNode, ListNode, ListItemNode],
          onError(error) {
            // Que lo tome el envoltorio de errores de React: tragarlo dejaría
            // el editor a medio andar sin que nadie se entere.
            throw error;
          },
        }}
      >
        <Barra />

        {/* `relative` para el marcador de posición, que se apoya sobre el
            área de escritura y no sobre el campo entero. */}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                aria-invalid={invalido || undefined}
                aria-describedby={describedBy}
                aria-label={etiqueta}
                // El marcador de posición va acá y no en `RichTextPlugin`:
                // desde 0.4x es `ContentEditable` quien lo monta y lo esconde
                // en cuanto hay contenido. En el plugin se acepta sin quejarse
                // y no se dibuja nunca.
                aria-placeholder={marcador}
                placeholder={
                  <p className="pointer-events-none absolute left-3 top-2.5 text-body-sm text-ink-secondary">
                    {marcador}
                  </p>
                }
                className={cn(
                  // 200px de alto mínimo, crece con el contenido hasta 480 y
                  // ahí scrollea (§6.11).
                  "min-h-50 overflow-y-auto px-3 py-2.5",
                  largo ? "max-h-[70vh]" : "max-h-120",
                  "text-body-sm leading-relaxed text-ink outline-none",
                  // El anillo lo pone el contenedor, que es el campo entero.
                  "focus-visible:shadow-none",
                )}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <ListPlugin />
        {/* ⌘Z y ⌘⇧Z. Sin esto, un formato mal puesto se deshace a mano. */}
        <HistoryPlugin />
        <PegarMarkdown />
        <CargaInicial markdown={valorInicial} />
        <Contador limite={limite} />
        <EditorRefPlugin editorRef={refEditor} />
        {alCambiar ? <AvisarCambio alCambiar={alCambiar} /> : null}
      </LexicalComposer>
    </div>
  );
}
