"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { DESTACADO, PALABRAS } from "@/components/admin/catalogo/copy";
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
 * Alta y edición de un ítem del catálogo — RF-18.
 *
 * El SLUG NO ES UN CAMPO. «Slug» es jerga (§10) y la vendedora no tiene por
 * qué saber qué es: se deriva del nombre y se muestra como la dirección que
 * va a tener, para leer. Al renombrar tampoco cambia —romper un enlace ya
 * compartido es peor que arrastrar una dirección vieja—, y el diálogo lo
 * dice en vez de dejar que se descubra después.
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
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [nombre, setNombre] = useState("");
  const [hex, setHex] = useState(HEX_POR_OMISION);
  const [destacada, setDestacada] = useState(false);

  // Al abrir se carga lo que hay: en alta, vacío; en edición, el ítem. Sin
  // esto el diálogo conserva lo que se escribió la vez anterior.
  useEffect(() => {
    if (!abierto) return;
    setErrores(SIN_ERRORES);
    setNombre(item?.name ?? "");
    setHex(item?.hexCode ?? HEX_POR_OMISION);
    // Una categoría nueva no nace destacada: destacar es elegir un puñado, y
    // un valor por omisión que destaca todo vacía la distinción.
    setDestacada(item?.isFeatured ?? false);
  }, [abierto, item]);

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
              loadingLabel="Guardando"
            >
              {item ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
