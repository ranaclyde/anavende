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

// Esto no garantiza nada: el servidor vuelve a filtrar
// (`modules/content/markdown.ts`).

const MARCADOR = "Qué es, para qué sirve y qué trae en la caja.";

/** La escala del panel y no la de la ficha, pero con su misma jerarquía. */
const TEMA = {
  paragraph: "mb-3 last:mb-0",
  heading: { h3: "mt-5 mb-2 font-semibold first:mt-0" },
  list: {
    ul: "mb-3 list-disc space-y-1.5 pl-5 marker:text-ink-tertiary",
    ol: "mb-3 list-decimal space-y-1.5 pl-5 marker:text-ink-tertiary",
    listitem: "pl-1",
  },
  text: {
    // Mismo color: el burdeos nunca es del énfasis.
    bold: "font-semibold",
    italic: "italic",
  },
};

type Bloque = "parrafo" | "subtitulo" | "vinetas" | "numerada";

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
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={alTocar}
      className={cn(
        // `admin:size-8` explícito: si no, gana el `admin:size-9` de `icon`.
        "size-8 admin:size-8 rounded-panel-control text-ink-secondary",
        activo && "bg-surface-sunken text-ink",
      )}
    >
      <Icono aria-hidden className="size-4" />
    </Button>
  );
}

function Barra() {
  const [editor] = useLexicalComposerContext();
  const [estado, setEstado] = useState<Estado>(ESTADO_INICIAL);

  useEffect(() => {
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

        // Un objeto nuevo repintaría aunque nada cambiara.
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

// En su propio componente para que cada tecla no repinte el formulario.
function Contador({ limite }: { limite: number }) {
  const [editor] = useLexicalComposerContext();
  const [restantes, setRestantes] = useState<number | null>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const quedan = limite - $getRoot().getTextContent().length;
        setRestantes(quedan <= AVISO_DE_LIMITE ? quedan : null);
      });
    });
  }, [editor, limite]);

  if (restantes === null) return null;

  const pasado = restantes < 0;

  return (
    <p
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
 * Decide el texto plano y no el HTML: un editor de código también pone HTML en
 * el portapapeles, con los asteriscos adentro. Lo copiado del mismo editor lo
 * pega Lexical entero. Corre antes que `RichTextPlugin`, que está en la
 * prioridad más baja.
 */
function PegarMarkdown() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (evento) => {
        // El comando llega también desde el teclado y desde `input`.
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

const CARGA_INICIAL = "carga-inicial";

/**
 * Avisa en cada cambio y no solo en el primero: Legales guarda sin salir de la
 * pantalla. Mover el cursor no ensucia nodos, y la carga inicial no cuenta.
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
    // Solo al montar: si no, cada respuesta del servidor pisaría lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return null;
}

/** Se llama al enviar, no en cada tecla. */
export function leerMarkdown(editor: LexicalEditor | null): string {
  if (!editor) return "";
  return editor
    .getEditorState()
    .read(() => $convertToMarkdownString(TRANSFORMADORES));
}

/** Para el borrador recuperado: sí cuenta como cambio, no está guardado. */
export function escribirMarkdown(
  editor: LexicalEditor | null,
  markdown: string,
): void {
  editor?.update(() => $convertFromMarkdownString(markdown, TRANSFORMADORES));
}

/** Sirve también para las páginas legales (RF-29). */
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
  largo?: boolean;
  alCambiar?: () => void;
}) {
  return (
    <div
      className={cn(
        // Barra y área son un campo: el anillo de foco va acá, no en el área.
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
          // La lista blanca del lado del editor: lo demás no se puede pegar.
          nodes: [HeadingNode, ListNode, ListItemNode],
          onError(error) {
            // Tragarlo dejaría el editor a medio andar sin que nadie se entere.
            throw error;
          },
        }}
      >
        <Barra />

        {/* `relative` para el marcador de posición. */}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                aria-invalid={invalido || undefined}
                aria-describedby={describedBy}
                aria-label={etiqueta}
                // Acá y no en `RichTextPlugin`: desde Lexical 0.4x, ahí se
                // acepta sin quejarse y no se dibuja nunca.
                aria-placeholder={marcador}
                placeholder={
                  <p className="pointer-events-none absolute left-3 top-2.5 text-body-sm text-ink-secondary">
                    {marcador}
                  </p>
                }
                className={cn(
                  "min-h-50 overflow-y-auto px-3 py-2.5",
                  largo ? "max-h-[70vh]" : "max-h-120",
                  "text-body-sm leading-relaxed text-ink outline-none",
                  "focus-visible:shadow-none",
                )}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>

        <ListPlugin />
        {/* ⌘Z y ⌘⇧Z. */}
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
