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
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  HEADING,
  ITALIC_STAR,
  ORDERED_LIST,
  UNORDERED_LIST,
  type Transformer,
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
  $isRangeSelection,
  $isRootOrShadowRoot,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from "lexical";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AVISO_DE_LIMITE, LIMITE_DE_TEXTO } from "@/modules/content/limites";

/**
 * Editor de la descripción de producto — RF-15, DESIGN-REFERENCE §6.11.
 *
 * La vendedora nunca ve la sintaxis: escribe con los botones y el resultado
 * se guarda como Markdown. Lo que hace que la regla se cumpla no es este
 * componente sino su lista de *transformadores*: **es** la lista blanca de
 * §16, no una copia. Un formato que no está acá no tiene ida ni vuelta
 * posible, así que agregarlo por accidente no se puede.
 *
 * El servidor vuelve a filtrar de todos modos (`modules/content/markdown.ts`).
 * Esto corre en la máquina de quien escribe y por eso no garantiza nada: es
 * para que se vea lo que va a quedar, no para que quede.
 */
const TRANSFORMADORES: Transformer[] = [
  HEADING,
  UNORDERED_LIST,
  ORDERED_LIST,
  // El combinado va primero: si `BOLD_STAR` mirara antes, `***texto***`
  // saldría como negrita con dos asteriscos sueltos alrededor.
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  ITALIC_STAR,
];

/**
 * El único nivel de subtítulo (RF-15). `h3` y no `h2`: en la ficha el nombre
 * del producto es el `h1` y «Descripción» el `h2`, así que un subtítulo
 * adentro de la descripción es el escalón siguiente. El sanitizador del
 * servidor normaliza a este mismo nivel.
 */
const SUBTITULO = "h3" as const;

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
function Contador() {
  const [editor] = useLexicalComposerContext();
  const [restantes, setRestantes] = useState<number | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const quedan = LIMITE_DE_TEXTO - $getRoot().getTextContent().length;
        // Fuera de la zona de aviso el estado es `null` y se queda en `null`:
        // escribir el mismo valor no repinta.
        setRestantes(quedan <= AVISO_DE_LIMITE ? quedan : null);
      });
    });
  }, [editor]);

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

/** Carga el Markdown guardado una sola vez, al montar. */
function CargaInicial({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!markdown) return;
    editor.update(() => $convertFromMarkdownString(markdown, TRANSFORMADORES));
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

export function EditorDeDescripcion({
  id,
  valorInicial,
  refEditor,
  invalido,
  describedBy,
}: {
  id: string;
  valorInicial: string;
  refEditor: React.RefObject<LexicalEditor | null>;
  invalido: boolean;
  describedBy?: string;
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
                aria-label="Descripción del producto"
                // El marcador de posición va acá y no en `RichTextPlugin`:
                // desde 0.4x es `ContentEditable` quien lo monta y lo esconde
                // en cuanto hay contenido. En el plugin se acepta sin quejarse
                // y no se dibuja nunca.
                aria-placeholder={MARCADOR}
                placeholder={
                  <p className="pointer-events-none absolute left-3 top-2.5 text-body-sm text-ink-tertiary">
                    {MARCADOR}
                  </p>
                }
                className={cn(
                  // 200px de alto mínimo, crece con el contenido hasta 480 y
                  // ahí scrollea (§6.11).
                  "min-h-50 max-h-120 overflow-y-auto px-3 py-2.5",
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
        <CargaInicial markdown={valorInicial} />
        <Contador />
        <EditorRefPlugin editorRef={refEditor} />
      </LexicalComposer>
    </div>
  );
}
