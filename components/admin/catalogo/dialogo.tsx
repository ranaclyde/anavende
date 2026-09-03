"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageOff, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { DESTACADO, LOGO, PALABRAS } from "@/components/admin/catalogo/copy";
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
import { TAMANO_MAXIMO, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";
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
 * Qué hacer con el logo al guardar. Se decide acá y se aplica en el envío, en
 * vez de subir o borrar en cuanto se toca el botón: así «Cancelar» cancela de
 * verdad, incluido el logo.
 */
type AccionDeLogo =
  | { tipo: "mantener" }
  | { tipo: "reemplazar"; archivo: File; vistaPrevia: string }
  | { tipo: "quitar" };

/**
 * La misma comprobación que hace el servidor (`modules/media/validar.ts`),
 * repetida acá para responder sin esperar la subida — RF-17 pide que un
 * archivo inválido se rechace ANTES de subirse. No es una barrera: el
 * servidor vuelve a mirar, y además mira los bytes y no el tipo declarado.
 */
function motivoDeRechazo(archivo: File): string | null {
  if (!(TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) {
    return "Ese archivo no es una imagen JPG, PNG ni WEBP.";
  }
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return `La imagen pesa ${mb} MB y el máximo son 10 MB. Probá con una más chica.`;
  }
  return null;
}

/** Sube el logo por el Route Handler (§9.1). */
async function subirLogo(brandId: string, archivo: File): Promise<string | null> {
  const cuerpo = new FormData();
  cuerpo.set("destino", "marca");
  cuerpo.set("brandId", brandId);
  cuerpo.set("archivo", archivo);

  const r = await fetch("/api/admin/upload", { method: "POST", body: cuerpo });
  if (r.ok) return null;

  const json = await r.json().catch(() => null);
  return json?.message ?? "No pudimos subir el logo. Probá de nuevo.";
}

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
  const router = useRouter();
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [nombre, setNombre] = useState("");
  const [hex, setHex] = useState(HEX_POR_OMISION);
  const [destacada, setDestacada] = useState(false);
  const [logo, setLogo] = useState<AccionDeLogo>({ tipo: "mantener" });
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);
  const campoDeArchivo = useRef<HTMLInputElement>(null);

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
    setLogo({ tipo: "mantener" });
    setErrorDelLogo(null);
  }, [abierto, item]);

  // La vista previa es un objeto en memoria del navegador; si no se libera,
  // el archivo entero queda retenido hasta que se recargue la página.
  useEffect(() => {
    if (logo.tipo !== "reemplazar") return;
    return () => URL.revokeObjectURL(logo.vistaPrevia);
  }, [logo]);

  const elegirArchivo = (archivo: File | null) => {
    setErrorDelLogo(null);
    if (!archivo) return;

    const motivo = motivoDeRechazo(archivo);
    if (motivo) {
      setErrorDelLogo(motivo);
      // Se limpia el input: si no, elegir el MISMO archivo otra vez no
      // dispara `change` y parece que el botón dejó de andar.
      if (campoDeArchivo.current) campoDeArchivo.current.value = "";
      return;
    }

    setLogo({
      tipo: "reemplazar",
      archivo,
      vistaPrevia: URL.createObjectURL(archivo),
    });
  };

  /** Lo que se ve ahora: el elegido, el guardado, o nada. */
  const logoVisible =
    logo.tipo === "reemplazar"
      ? logo.vistaPrevia
      : logo.tipo === "quitar"
        ? null
        : (item?.logoUrl ?? null);

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
            setErrorDelLogo(item ? fallo : `${LOGO.falloTrasCrear} (${fallo})`);
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
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${idBase}-logo`}>
                {LOGO.etiqueta}{" "}
                <span className="font-normal text-ink-tertiary">
                  {LOGO.opcional}
                </span>
              </Label>

              <div className="flex items-center gap-3">
                {/* El recuadro tiene el mismo tamaño con logo y sin logo: si
                    creciera al elegir uno, el diálogo entero saltaría bajo el
                    cursor justo cuando hay que apretar «Guardar». */}
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-panel-control border border-border bg-logo-chip">
                  {logoVisible ? (
                    <Image
                      src={logoVisible}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized={logo.tipo === "reemplazar"}
                      className="size-full object-contain p-1"
                    />
                  ) : (
                    // Sobre el chip claro, el ícono también tiene que ser
                    // oscuro: `--ink-tertiary` se aclara en modo oscuro.
                    <ImageOff aria-hidden className="size-5 text-logo-chip-ink" />
                  )}
                </span>

                <div className="flex flex-col items-start gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => campoDeArchivo.current?.click()}
                      disabled={enviando}
                    >
                      <Upload aria-hidden />
                      {logoVisible ? LOGO.cambiar : LOGO.elegir}
                    </Button>

                    {logoVisible && (
                      <Button
                        type="button"
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setErrorDelLogo(null);
                          if (campoDeArchivo.current)
                            campoDeArchivo.current.value = "";
                          setLogo({ tipo: "quitar" });
                        }}
                        disabled={enviando}
                      >
                        {LOGO.quitar}
                      </Button>
                    )}
                  </div>

                  <FieldHint>
                    {logo.tipo === "reemplazar"
                      ? logo.archivo.name
                      : logoVisible
                        ? LOGO.ayuda
                        : `${LOGO.sinLogo}. ${LOGO.ayuda}`}
                  </FieldHint>
                </div>
              </div>

              {/* El input nativo va oculto y no `display:none`: escondido así
                  sigue siendo alcanzable por el `click()` del botón y por los
                  lectores de pantalla. */}
              <input
                ref={campoDeArchivo}
                id={`${idBase}-logo`}
                type="file"
                accept={TIPOS_ACEPTADOS.join(",")}
                className="sr-only"
                onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
              />

              <FieldError>{errorDelLogo}</FieldError>
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
