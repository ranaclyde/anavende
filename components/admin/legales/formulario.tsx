"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { LexicalEditor } from "lexical";

import {
  EditorDeDescripcion,
  leerMarkdown,
} from "@/components/admin/productos/editor";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { guardarUnTextoLegal } from "@/modules/content/actions";
import { LIMITE_DE_TEXTO_LEGAL } from "@/modules/content/limites";
import type { SlugLegal } from "@/modules/content/paginas";

type Campo = "contenido";

/**
 * El texto de una página legal — RF-29, F9.3.
 *
 * El mismo editor que la descripción de producto, con el mismo formato y el
 * mismo sanitizador del lado del servidor (§16). Guardar se queda en la
 * pantalla: no hay listado al que volver, y el aviso confirma lo que pasó.
 */
export function FormularioDeTextoLegal({
  slug,
  titulo,
  contenido,
  actualizada,
}: {
  slug: SlugLegal;
  titulo: string;
  contenido: string;
  /** Ya formateada en el servidor, en la zona del negocio. */
  actualizada: string;
}) {
  const router = useRouter();
  const editor = useRef<LexicalEditor | null>(null);
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [enviando, iniciar] = useTransition();

  const idDelCampo = `legal-${slug}`;
  const idDelError = `${idDelCampo}-error`;
  const error = errores.campos.contenido ?? errores.general;

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(SIN_ERRORES);

    const datos = { slug, contenido: leerMarkdown(editor.current) };

    iniciar(async () => {
      const resultado = await guardarUnTextoLegal(datos);

      if (!resultado.ok) {
        setErrores(leerErrores<Campo>(resultado));
        return;
      }

      avisar(`Guardaste «${titulo}». Ya se ve así en la tienda.`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <TarjetaDeSeccion
        id={`${idDelCampo}-titulo`}
        titulo={titulo}
        ayuda={`Última modificación: ${actualizada}. Podés usar negrita, cursiva, listas y subtítulos.`}
        acciones={
          <Button asChild variant="tertiary" size="sm">
            <a
              href={`/legales/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en la tienda
              <ExternalLink aria-hidden />
            </a>
          </Button>
        }
      >
        <EditorDeDescripcion
          // Una página por montaje: el editor carga su texto inicial una sola
          // vez, así que al cambiar de solapa tiene que ser otro editor.
          key={slug}
          id={idDelCampo}
          valorInicial={contenido}
          refEditor={editor}
          invalido={Boolean(error)}
          describedBy={error ? idDelError : undefined}
          etiqueta={`Texto de «${titulo}»`}
          marcador="Qué tiene que saber quien compra."
          limite={LIMITE_DE_TEXTO_LEGAL}
          largo
        />
        <FieldError id={idDelError}>{error}</FieldError>
      </TarjetaDeSeccion>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          variant="brand"
          loading={enviando}
          loadingLabel="Guardando"
        >
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
