"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import {
  DESTACADO,
  IMAGEN_DE_CATEGORIA,
  TEXTO_DE_CATEGORIA,
  LOGO,
  PALABRAS,
  RELACIONADAS,
} from "@/components/admin/catalogo/copy";
import {
  EleccionDeRelacionadas,
  ListaDeRelacionadas,
} from "@/components/admin/catalogo/relacionadas";
import { Seccion, Secciones } from "@/components/admin/formulario";
import {
  LOGO_SIN_TOCAR,
  SelectorDeLogo,
  type AccionDeLogo,
} from "@/components/admin/logo/selector";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetForm,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FieldError } from "@/components/ui/field-error";
import { Input, Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { slugificar } from "@/lib/slug";
import type {
  CategoriaRelacionable,
  CategoriaRelacionada,
  ItemDeCatalogo,
} from "@/modules/catalog/queries";
import {
  crearUnaCategoria,
  crearUnaMarca,
  crearUnColor,
  editarUnaCategoria,
  editarUnaMarca,
  editarUnColor,
} from "@/modules/catalog/actions";
import {
  quitarElLogo,
  quitarLaImagenDeCategoria,
} from "@/modules/catalog/actions";
import { subirImagen } from "@/modules/media/cliente";
import {
  TOPE_DEL_TEXTO_DE_CATEGORIA,
  type TipoDeItem,
} from "@/modules/catalog/schemas";

type Campo = "name" | "hexCode" | "description";

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

const SIN_RELACIONADAS: CategoriaRelacionada[] = [];
const SIN_RELACIONABLES: CategoriaRelacionable[] = [];

/**
 * Sube el logo de la marca, o la imagen de la categoría, por el Route Handler
 * (TS §9.1). Devuelve el motivo del fallo, o `null` si salió bien.
 */
async function subirLogo(
  tipo: "marca" | "categoria",
  id: string,
  archivo: File,
): Promise<string | null> {
  const r = await subirImagen(
    tipo === "marca"
      ? { destino: "marca", brandId: id }
      : { destino: "categoria", categoryId: id },
    archivo,
  );
  return r.ok ? null : r.message;
}

/** Quitarlo es un booleano y va por una Server Action, no por el Route Handler. */
const QUITAR = {
  marca: quitarElLogo,
  categoria: quitarLaImagenDeCategoria,
};

/**
 * Alta y edición de un ítem del catálogo, en un drawer — RF-18, DR §6.14.3.
 * La dirección (slug) no es un campo: se deriva del nombre y no cambia al
 * renombrar.
 *
 * Se monta al abrirse y se desmonta al cerrar, y por eso el estado arranca de
 * las props sin efecto que lo reponga. Limpiarlo al abrir no alcanza: el
 * cierre ocurre dentro de una transición que todavía revalida, y reabrir ahí
 * mostraba los valores del ítem anterior.
 *
 * Desde el producto llega con `nombreInicial` y avisa con `alCrear`; ahí no
 * ofrece las relacionadas. Con `incrustado` se pinta adentro del drawer de
 * quien lo usa, como un paso, y el Escape lo maneja el de afuera.
 */
export function EdicionDeItem({
  tipo,
  item,
  abierto,
  alCerrar,
  relacionables = SIN_RELACIONABLES,
  nombreInicial = "",
  alCrear,
  incrustado = false,
}: {
  tipo: TipoDeItem;
  /** `null` = alta. */
  item: ItemDeCatalogo | null;
  abierto: boolean;
  alCerrar: () => void;
  relacionables?: CategoriaRelacionable[];
  nombreInicial?: string;
  alCrear?: (creado: { id: string; name: string; hexCode: string }) => void;
  incrustado?: boolean;
}) {
  const palabras = PALABRAS[tipo];
  const router = useRouter();
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [nombre, setNombre] = useState(item?.name ?? nombreInicial);
  const [hex, setHex] = useState(item?.hexCode ?? HEX_POR_OMISION);
  // Una categoría nueva no nace destacada.
  const [destacada, setDestacada] = useState(item?.isFeatured ?? false);
  const [texto, setTexto] = useState(item?.description ?? "");
  const originales = item?.relacionadas ?? SIN_RELACIONADAS;
  const [relacionadas, setRelacionadas] = useState(originales);
  // El paso de elegir relacionadas va en el mismo drawer: el formulario se
  // esconde sin desmontarse, así lo escrito sigue al volver.
  const [eligiendo, setEligiendo] = useState(false);
  const botonElegir = useRef<HTMLButtonElement>(null);
  const disponibles = relacionables.filter((c) => c.id !== item?.id);
  const [logo, setLogo] = useState<AccionDeLogo>(LOGO_SIN_TOCAR);
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);

  const direccion = item ? item.slug : slugificar(nombre);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    const pedidas = relacionadas.map(({ id, reciproca }) => ({
      id,
      reciproca,
    }));

    iniciar(async () => {
      const resultado = item
        ? tipo === "color"
          ? await EDITAR.color({ id: item.id, name: nombre, hexCode: hex })
          : tipo === "categoria"
            ? await EDITAR.categoria({
                id: item.id,
                name: nombre,
                isFeatured: destacada,
                description: texto,
                relacionadas: pedidas,
              })
            : await EDITAR.marca({ id: item.id, name: nombre })
        : tipo === "color"
          ? await CREAR.color({ name: nombre, hexCode: hex })
          : tipo === "categoria"
            ? await CREAR.categoria({
                name: nombre,
                isFeatured: destacada,
                description: texto,
                relacionadas: pedidas,
              })
            : await CREAR.marca({ name: nombre });

      if (!resultado.ok) {
        setErrores(leerErrores<Campo>(resultado));
        return;
      }

      // Antes del logo: si subirlo falla, la marca ya existe y el producto
      // tiene que poder usarla igual.
      if (!item) {
        alCrear?.({ id: resultado.data.id, name: nombre.trim(), hexCode: hex });
      }

      if (tipo !== "color" && logo.tipo !== "mantener") {
        const id = item?.id ?? resultado.data.id;

        if (logo.tipo === "reemplazar") {
          const fallo = await subirLogo(tipo, id, logo.archivo);
          if (!fallo) {
            // Un `fetch`, a diferencia de una Server Action, no trae la vista
            // nueva: sin esto el listado sigue mostrando la fila sin el logo.
            router.refresh();
          }
          if (fallo) {
            // La marca ya se guardó: el diálogo queda abierto con el error del logo.
            setErrorDelLogo(
              item
                ? fallo
                : `${
                    tipo === "marca"
                      ? LOGO.falloTrasCrear("La marca", "Editala")
                      : IMAGEN_DE_CATEGORIA.falloTrasCrear
                  } (${fallo})`,
            );
            return;
          }
        } else {
          const r = await QUITAR[tipo]({ id });
          if (!r.ok) {
            setErrorDelLogo(r.message);
            return;
          }
        }
      }

      // La fila nueva puede ni estar en esta página: sin aviso, guardar no
      // contesta nada (DR §6.15).
      avisar(
        item
          ? `Guardaste ${palabras.articulo} ${palabras.singular} «${nombre.trim()}».`
          : `Creaste ${palabras.articulo} ${palabras.singular} «${nombre.trim()}».`,
      );
      alCerrar();
    });
  };

  const volverDeElegir = () => {
    setEligiendo(false);
    // El botón vuelve a existir recién en el próximo pintado.
    requestAnimationFrame(() => botonElegir.current?.focus());
  };

  /**
   * Lo que ya estaba conserva su lugar y su «Recíproca»; lo nuevo entra al
   * final. Las inactivas no aparecen para elegir, así que se quedan.
   */
  const aplicarEleccion = (marcadas: string[]) => {
    const marcada = new Set(marcadas);
    const elegibles = new Map(disponibles.map((c) => [c.id, c]));
    const quedan = relacionadas.filter(
      (r) => marcada.has(r.id) || !elegibles.has(r.id),
    );
    const yaEstaban = new Set(quedan.map((r) => r.id));
    const nuevas = marcadas
      .filter((m) => !yaEstaban.has(m))
      .map((m) => {
        const c = elegibles.get(m)!;
        return { ...c, isActive: true, reciproca: true };
      });
    setRelacionadas([...quedan, ...nuevas]);
    volverDeElegir();
  };

  const contenido = (
    <>
      <SheetHeader>
        <SheetTitle>
          {eligiendo
            ? RELACIONADAS.tituloDeEleccion
            : item
              ? `Editar ${palabras.singular}`
              : palabras.nuevo}
        </SheetTitle>
        <SheetDescription>
          {eligiendo
            ? RELACIONADAS.bajadaDeEleccion(nombre.trim() || "esta categoría")
            : item
              ? "El nombre cambia en todo el sitio. La dirección se mantiene."
              : alCrear
                ? `Al crear${palabras.pronombre}, queda ${palabras.elegido}.`
                : "Se va a poder elegir al cargar un producto."}
        </SheetDescription>
      </SheetHeader>

      {eligiendo ? (
        <EleccionDeRelacionadas
          id={`${idBase}-eleccion`}
          disponibles={disponibles}
          elegidas={relacionadas.map((r) => r.id)}
          alListo={aplicarEleccion}
          alVolver={volverDeElegir}
        />
      ) : null}

      <SheetForm
        onSubmit={enviar}
        noValidate
        className={eligiendo ? "hidden" : undefined}
      >
        <SheetBody>
          <Secciones>
            <Seccion>
              <div className="flex flex-col gap-1.5">
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

              {tipo === "color" ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${idBase}-hex`}>Color</Label>
                  <div className="flex items-center gap-2">
                    {/* El selector nativo y el campo de texto escriben el mismo valor. */}
                    <input
                      type="color"
                      aria-label="Elegir el color a ojo"
                      value={
                        /^#[0-9a-f]{6}$/i.test(hex) ? hex : HEX_POR_OMISION
                      }
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
              ) : (
                <SelectorDeLogo
                  id={`${idBase}-logo`}
                  palabras={tipo === "categoria" ? IMAGEN_DE_CATEGORIA : LOGO}
                  guardado={item?.logoUrl ?? null}
                  logo={logo}
                  alCambiar={setLogo}
                  error={errorDelLogo}
                  alError={setErrorDelLogo}
                  deshabilitado={enviando}
                />
              )}
            </Seccion>

            {tipo === "categoria" ? (
              <Seccion>
                {/* El texto va antes de «Destacada»: es contenido, no orden. */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${idBase}-texto`}>
                    {TEXTO_DE_CATEGORIA.etiqueta}
                  </Label>
                  <Textarea
                    id={`${idBase}-texto`}
                    name="description"
                    rows={3}
                    maxLength={TOPE_DEL_TEXTO_DE_CATEGORIA}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    aria-invalid={!!errores.campos.description || undefined}
                    aria-describedby={`${idBase}-texto-ayuda`}
                  />
                  {errores.campos.description ? (
                    <FieldError id={`${idBase}-texto-ayuda`}>
                      {errores.campos.description}
                    </FieldError>
                  ) : (
                    <FieldHint id={`${idBase}-texto-ayuda`}>
                      {TEXTO_DE_CATEGORIA.ayuda(TOPE_DEL_TEXTO_DE_CATEGORIA)}
                    </FieldHint>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* `htmlFor` sobre el Checkbox de Radix: tocar el texto también marca. */}
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
                  {/* Alineada con el texto de la etiqueta: casilla de 16px más 8. */}
                  <FieldHint id={`${idBase}-destacada-ayuda`} className="pl-6">
                    {DESTACADO.ayuda}
                  </FieldHint>
                </div>
              </Seccion>
            ) : null}

            {tipo === "categoria" && !alCrear ? (
              <ListaDeRelacionadas
                id={`${idBase}-relacionadas`}
                nombre={nombre}
                lista={relacionadas}
                originales={originales}
                hayParaElegir={disponibles.length > 0}
                alCambiar={setRelacionadas}
                alElegir={() => setEligiendo(true)}
                deshabilitado={enviando}
                refDelBoton={botonElegir}
              />
            ) : null}
          </Secciones>

          <FieldError className="mt-5">{errores.general}</FieldError>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="brand"
            loading={enviando}
            loadingLabel={
              logo.tipo !== "reemplazar"
                ? "Guardando"
                : tipo === "categoria"
                  ? IMAGEN_DE_CATEGORIA.subiendo
                  : LOGO.subiendo
            }
          >
            {item ? "Guardar" : "Crear"}
          </Button>
        </SheetFooter>
      </SheetForm>
    </>
  );

  if (incrustado) return contenido;

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent
        onEscapeKeyDown={(e) => {
          // Escape en el paso de elegir vuelve al formulario y no cierra todo.
          if (eligiendo) {
            e.preventDefault();
            volverDeElegir();
          }
        }}
      >
        {contenido}
      </SheetContent>
    </Sheet>
  );
}
