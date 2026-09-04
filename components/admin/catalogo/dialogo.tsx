"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { DESTACADO, LOGO, PALABRAS } from "@/components/admin/catalogo/copy";
import {
  LOGO_SIN_TOCAR,
  SelectorDeLogo,
  type AccionDeLogo,
} from "@/components/admin/logo/selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { slugificar } from "@/lib/slug";
import type { ItemDeCatalogo } from "@/modules/catalog/queries";
import {
  crearUnaCategoria,
  crearUnaMarca,
  crearUnColor,
  editarUnaCategoria,
  editarUnaMarca,
  editarUnColor,
} from "@/modules/catalog/actions";
import { quitarElLogo } from "@/modules/catalog/actions";
import { subirImagen } from "@/modules/media/cliente";
import type { TipoDeItem } from "@/modules/catalog/schemas";

type Campo = "name" | "hexCode";

const CREAR = {
  marca: crearUnaMarca,
  categoria: crearUnaCategoria,
  color: crearUnColor,
};

const EDITAR = {
  marca: editarUnaMarca,
  categoria: editarUnaCategoria,
  color: editarUnColor,
};

const HEX_POR_OMISION = "#8a8a8a";

/**
 * Sube el logo por el Route Handler (§9.1). Devuelve el motivo del fallo, o
 * `null` si salió bien.
 *
 * Sin progreso: un logo pesa poco y la barra aparecería y desaparecería antes
 * de poder leerse. El de las imágenes de producto sí lo usa (RF-17).
 */
async function subirLogo(brandId: string, archivo: File): Promise<string | null> {
  const r = await subirImagen({ destino: "marca", brandId }, archivo);
  return r.ok ? null : r.message;
}

/**
 * Alta y edición de un ítem del catálogo — RF-18.
 *
 * El SLUG NO ES UN CAMPO. «Slug» es jerga (§10) y la vendedora no tiene por
 * qué saber qué es: se deriva del nombre y se muestra como la dirección que
 * va a tener, para leer. Al renombrar tampoco cambia —romper un enlace ya
 * compartido es peor que arrastrar una dirección vieja—, y el diálogo lo
 * dice en vez de dejar que se descubra después.
 *
 * **Se monta cuando se abre y se desmonta al cerrar** (lo decide el panel),
 * y por eso el estado arranca de las props y no hay ningún efecto que lo
 * reponga. Mantenerlo montado y limpiarlo al abrir parece lo mismo y no lo
 * es: el cierre ocurre dentro de una transición —la acción todavía está
 * revalidando—, así que hay un rato en que la pantalla muestra el diálogo
 * con los valores viejos, y volver a abrirlo ahí no dispara ningún efecto.
 * Se descubrió en F2.6, con un medio de pago que se guardó con la
 * descripción del anterior.
 */
export function DialogoDeItem({
  tipo,
  item,
  abierto,
  alCerrar,
}: {
  tipo: TipoDeItem;
  /** `null` = alta. */
  item: ItemDeCatalogo | null;
  abierto: boolean;
  alCerrar: () => void;
}) {
  const palabras = PALABRAS[tipo];
  const router = useRouter();
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [nombre, setNombre] = useState(item?.name ?? "");
  const [hex, setHex] = useState(item?.hexCode ?? HEX_POR_OMISION);
  // Una categoría nueva no nace destacada: destacar es elegir un puñado, y un
  // valor por omisión que destaca todo vacía la distinción.
  const [destacada, setDestacada] = useState(item?.isFeatured ?? false);
  const [logo, setLogo] = useState<AccionDeLogo>(LOGO_SIN_TOCAR);
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);

  const direccion = item ? item.slug : slugificar(nombre);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const resultado = item
        ? tipo === "color"
          ? await EDITAR.color({ id: item.id, name: nombre, hexCode: hex })
          : tipo === "categoria"
            ? await EDITAR.categoria({
                id: item.id,
                name: nombre,
                isFeatured: destacada,
              })
            : await EDITAR.marca({ id: item.id, name: nombre })
        : tipo === "color"
          ? await CREAR.color({ name: nombre, hexCode: hex })
          : tipo === "categoria"
            ? await CREAR.categoria({ name: nombre, isFeatured: destacada })
            : await CREAR.marca({ name: nombre });

      if (!resultado.ok) {
        setErrores(leerErrores<Campo>(resultado));
        return;
      }

      // El logo va después de guardar el nombre, y por dos caminos distintos:
      // subirlo necesita mandar un archivo, así que va por el Route Handler
      // (§9.1); quitarlo es un booleano y va por una Server Action.
      if (tipo === "marca" && logo.tipo !== "mantener") {
        const id = item?.id ?? resultado.data.id;

        if (logo.tipo === "reemplazar") {
          const fallo = await subirLogo(id, logo.archivo);
          if (!fallo) {
            // El Route Handler invalida la caché del servidor, pero un
            // `fetch` —a diferencia de una Server Action— no trae la vista
            // nueva de vuelta. Sin esto el logo está guardado y el listado
            // sigue mostrando la fila sin él.
            router.refresh();
          }
          if (fallo) {
            // La marca YA se guardó. Decirlo tal cual es más honesto que
            // fingir que no pasó nada o que falló todo: el diálogo queda
            // abierto con el error y el nombre ya está a salvo.
            setErrorDelLogo(
              item
                ? fallo
                : `${LOGO.falloTrasCrear("La marca", "Editala")} (${fallo})`,
            );
            return;
          }
        } else {
          const r = await quitarElLogo({ id });
          if (!r.ok) {
            setErrorDelLogo(r.message);
            return;
          }
        }
      }

      alCerrar();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? `Editar ${palabras.singular}` : palabras.nuevo}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "El nombre cambia en todo el sitio. La dirección se mantiene."
              : `Se va a poder elegir al cargar un producto.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-name`}>Nombre</Label>
            <Input
              id={`${idBase}-name`}
              name="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              required
              maxLength={60}
              aria-invalid={!!errores.campos.name || undefined}
              aria-describedby={
                errores.campos.name ? `${idBase}-e-name` : `${idBase}-dir`
              }
            />
            {errores.campos.name ? (
              <FieldError id={`${idBase}-e-name`}>
                {errores.campos.name}
              </FieldError>
            ) : (
              <FieldHint id={`${idBase}-dir`}>
                {direccion
                  ? `Dirección: /${palabras.plural}/${direccion}`
                  : "La dirección se arma con el nombre."}
                {item && direccion ? " · No cambia al renombrar." : ""}
              </FieldHint>
            )}
          </div>

          {tipo === "color" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-hex`}>Color</Label>
              <div className="flex items-center gap-2">
                {/* El selector nativo y el campo de texto escriben el mismo
                    valor: se puede elegir a ojo o pegar el código exacto que
                    vino de la marca. */}
                <input
                  type="color"
                  aria-label="Elegir el color a ojo"
                  value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : HEX_POR_OMISION}
                  onChange={(e) => setHex(e.target.value)}
                  className="size-10 shrink-0 cursor-pointer rounded-panel-control border border-border bg-surface p-1"
                />
                <Input
                  id={`${idBase}-hex`}
                  name="hexCode"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  spellCheck={false}
                  className="font-mono"
                  aria-invalid={!!errores.campos.hexCode || undefined}
                  aria-describedby={
                    errores.campos.hexCode ? `${idBase}-e-hex` : undefined
                  }
                />
              </div>
              <FieldError id={`${idBase}-e-hex`}>
                {errores.campos.hexCode}
              </FieldError>
            </div>
          )}

          {tipo === "marca" && (
            <SelectorDeLogo
              id={`${idBase}-logo`}
              guardado={item?.logoUrl ?? null}
              logo={logo}
              alCambiar={setLogo}
              error={errorDelLogo}
              alError={setErrorDelLogo}
              deshabilitado={enviando}
            />
          )}

          {tipo === "categoria" && (
            <div className="flex flex-col gap-2">
              {/* La casilla y su etiqueta son un solo blanco: `htmlFor` sobre
                  el Checkbox de Radix hace que tocar el texto también marque,
                  que en un teléfono es la diferencia entre poder y no. */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${idBase}-destacada`}
                  checked={destacada}
                  onCheckedChange={(v) => setDestacada(v === true)}
                  aria-describedby={`${idBase}-destacada-ayuda`}
                />
                <Label htmlFor={`${idBase}-destacada`}>
                  {DESTACADO.etiqueta}
                </Label>
              </div>
              <FieldHint id={`${idBase}-destacada-ayuda`}>
                {DESTACADO.ayuda}
              </FieldHint>
            </div>
          )}

          <FieldError>{errores.general}</FieldError>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={enviando}
              loadingLabel={
                logo.tipo === "reemplazar" ? LOGO.subiendo : "Guardando"
              }
            >
              {item ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
