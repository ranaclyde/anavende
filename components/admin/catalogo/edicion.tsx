"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import {
  DESTACADO,
  IMAGEN_DE_CATEGORIA,
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
import { Input } from "@/components/ui/input";
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

const SIN_RELACIONADAS: CategoriaRelacionada[] = [];
const SIN_RELACIONABLES: CategoriaRelacionable[] = [];

/**
 * Sube el logo de la marca, o la imagen de la categoría (FA-21), por el
 * Route Handler (§9.1). Devuelve el motivo del fallo, o `null` si salió bien.
 *
 * Sin progreso: un logo pesa poco y la barra aparecería y desaparecería antes
 * de poder leerse. El de las imágenes de producto sí lo usa (RF-17).
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
 * Alta y edición de un ítem del catálogo — RF-18.
 *
 * **Es un drawer y no un diálogo** desde el 2026-10-14 (DR §6.14.3): con la
 * imagen, «Destacada» y las relacionadas, la categoría pasó a tener tres
 * secciones y una lista que crece, y un diálogo centrado con tope de alto la
 * cortaba. El drawer usa el alto entero y deja fijos el título y «Guardar».
 * Marcas, colores y medios de pago van igual aunque sean más cortos: son
 * solapas de la misma pantalla y se tienen que comportar igual.
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
 *
 * **También se abre desde el producto** (F2.13), cuando lo que hace falta no
 * está en el selector: llega con `nombreInicial` —lo que se escribió en el
 * buscador— y avisa con `alCrear` para que el producto lo deje elegido. Ahí
 * no ofrece las relacionadas: son lo único que pide recorrer el resto del
 * catálogo, y quien está cargando un producto viene a destrabarlo, no a
 * ordenar categorías. Se eligen después, desde Catálogo.
 *
 * Con `incrustado` no trae su propio drawer y se pinta adentro del de quien
 * lo usa, como un paso (§6.14.2): la variante de color lo usa así, porque
 * un drawer encima de otro tapa lo que se estaba cargando. El Escape de ese
 * paso lo maneja el drawer de afuera; por eso solo lo usan los colores, que
 * no tienen un paso propio.
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
  /** Solo las categorías las usan (RF-31). */
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
  // Una categoría nueva no nace destacada: destacar es elegir un puñado, y un
  // valor por omisión que destaca todo vacía la distinción.
  const [destacada, setDestacada] = useState(item?.isFeatured ?? false);
  const originales = item?.relacionadas ?? SIN_RELACIONADAS;
  const [relacionadas, setRelacionadas] = useState(originales);
  // El paso de elegir relacionadas (RF-31) va adentro del mismo drawer
  // (§6.14.2): el formulario se esconde pero no se desmonta, así lo escrito
  // y la imagen elegida siguen ahí al volver.
  const [eligiendo, setEligiendo] = useState(false);
  const botonElegir = useRef<HTMLButtonElement>(null);
  const disponibles = relacionables.filter((c) => c.id !== item?.id);
  const [logo, setLogo] = useState<AccionDeLogo>(LOGO_SIN_TOCAR);
  const [errorDelLogo, setErrorDelLogo] = useState<string | null>(null);

  const direccion = item ? item.slug : slugificar(nombre);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    // Solo lo que el servidor necesita: el orden lo da la posición.
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
                relacionadas: pedidas,
              })
            : await EDITAR.marca({ id: item.id, name: nombre })
        : tipo === "color"
          ? await CREAR.color({ name: nombre, hexCode: hex })
          : tipo === "categoria"
            ? await CREAR.categoria({
                name: nombre,
                isFeatured: destacada,
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

      // El logo va después de guardar el nombre, y por dos caminos distintos:
      // subirlo necesita mandar un archivo, así que va por el Route Handler
      // (§9.1); quitarlo es un booleano y va por una Server Action.
      if (tipo !== "color" && logo.tipo !== "mantener") {
        const id = item?.id ?? resultado.data.id;

        if (logo.tipo === "reemplazar") {
          const fallo = await subirLogo(tipo, id, logo.archivo);
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

      // El diálogo se cierra y la fila nueva queda en algún lugar de un
      // listado ordenado alfabéticamente, que puede ni estar en esta página:
      // sin aviso, guardar no contesta nada (§6.15).
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
   * Lo que ya estaba y sigue marcado conserva su lugar —y su «Recíproca»—;
   * lo nuevo entra al final, en el orden en que se marcó. Las inactivas no
   * aparecen para elegir, así que no se pueden haber desmarcado: se quedan.
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
                    {/* El selector nativo y el campo de texto escriben el
                          mismo valor: se puede elegir a ojo o pegar el código
                          exacto que vino de la marca. */}
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
                <div className="flex flex-col gap-1.5">
                  {/* La casilla y su etiqueta son un solo blanco: `htmlFor`
                        sobre el Checkbox de Radix hace que tocar el texto
                        también marque, que en un teléfono es la diferencia
                        entre poder y no. */}
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
                  {/* Alineada con el texto de la etiqueta y no con la
                        casilla: 16px de la casilla más 8 de separación. Sin
                        la sangría la ayuda se lee como un párrafo suelto. */}
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
          // Escape en el paso de elegir vuelve al formulario: cerrar todo
          // perdería lo escrito por querer salir de una lista.
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
