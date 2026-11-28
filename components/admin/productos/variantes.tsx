"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  DropletOff,
  Droplets,
  Palette,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { EdicionDeItem } from "@/components/admin/catalogo/edicion";
import { Seccion, Secciones } from "@/components/admin/formulario";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { VacioDelPanel } from "@/components/admin/vacio";
import { DescargarFotos } from "@/components/admin/productos/descargar-fotos";
import { dondeEsta } from "@/components/admin/productos/donde-esta";
import { ImagenesDeVariante } from "@/components/admin/productos/imagenes";
import { avisar, avisarConPero } from "@/components/ui/aviso";
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import { EsferaDeColor } from "@/components/ui/esfera-de-color";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  SelectorConBuscador,
  type OpcionDelSelector,
} from "@/components/ui/selector-con-buscador";
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
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import {
  agregarUnaVariante,
  editarUnaVariante,
  eliminarUnaVariante,
  reutilizarImagenes,
} from "@/modules/catalog/variants/actions";
import type {
  OpcionDeColor,
  VarianteDelPanel,
} from "@/modules/catalog/variants/queries";

// Solo en la edición: una imagen se guarda en
// `productos/{productId}/{variantId}/…`, y sin producto no hay dónde.

/** Con más colores que estos, se pliegan y se abre uno por vez. */
const HASTA_SIN_PLEGAR = 3;

const TARJETA =
  "flex flex-col gap-3 rounded-panel-card border border-border bg-surface-sunken p-3";

/** El valor para la variante sin color. */
const UNICO = "unico";

const SIN_SEGUNDO = "";

/** Sin orden: «Negro/Rojo» y «Rojo/Negro» son la misma variante. */
function combinacion(primero: string | null, segundo: string | null): string {
  if (!primero) return UNICO;
  return segundo ? [primero, segundo].sort().join("+") : primero;
}

function unidades(n: number): string {
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

function nombreDe(v: { colorName: string | null }): string {
  return v.colorName ?? "Único";
}

function colorInicial(v: VarianteDelPanel | null): string {
  return v ? (v.colorId ?? UNICO) : "";
}

export function VariantesDelProducto({
  productId,
  productoActivo,
  variantes,
  colores,
  categoriaConColor = null,
  marcaDeAgua = false,
  abrirAlta = false,
}: {
  productId: string;
  productoActivo: boolean;
  variantes: VarianteDelPanel[];
  colores: OpcionDeColor[];
  /** La categoría, si en ella se vende por color. */
  categoriaConColor?: string | null;
  /** Si las fotos que se suban ahora salen con marca de agua. */
  marcaDeAgua?: boolean;
  /** Llegó `?agregar=color`. */
  abrirAlta?: boolean;
}) {
  const [enEdicion, setEnEdicion] = useState<VarianteDelPanel | null>(null);
  const [agregando, setAgregando] = useState(abrirAlta);
  const [porBorrar, setPorBorrar] = useState<VarianteDelPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  /** El color recién agregado, hasta que su tarjeta aparezca y se la centre. */
  const paraFotos = useRef<string | null>(null);

  /**
   * Arranca abierto el primero: la guía del producto señala su «Editar». Vacío
   * es todos cerrados.
   */
  const [abierto, setAbierto] = useState(variantes[0]?.id ?? "");

  // En un efecto y no al cerrar: la tarjeta no existe hasta que llegan los
  // datos nuevos.
  useEffect(() => {
    const id = paraFotos.current;
    if (!id || !variantes.some((v) => v.id === id)) return;
    // Plegado llega cerrado: se abre y el efecto vuelve a correr.
    if (variantes.length > HASTA_SIN_PLEGAR && abierto !== id) {
      setAbierto(id);
      return;
    }
    paraFotos.current = null;

    const tarjeta = document.getElementById(`color-${id}`);
    if (!tarjeta) return;
    const quieto = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    tarjeta.scrollIntoView({
      block: "center",
      behavior: quieto ? "auto" : "smooth",
    });
    // `preventScroll`: el foco no pelea con el desplazamiento de arriba.
    tarjeta
      .querySelector<HTMLElement>("[data-agregar-fotos]")
      ?.focus({ preventScroll: true });
  }, [variantes, abierto]);

  // Sigue a `abrirAlta` y no solo lo lee al montar: si se navega a
  // `?agregar=color` desde la ficha misma, React reusa esta instancia.
  const [abrirAltaVisto, setAbrirAltaVisto] = useState(abrirAlta);
  if (abrirAltaVisto !== abrirAlta) {
    setAbrirAltaVisto(abrirAlta);
    if (abrirAlta) setAgregando(true);
  }

  const borrar = (v: VarianteDelPanel) => {
    setPorBorrar(null);
    setError(null);

    iniciar(async () => {
      const r = await eliminarUnaVariante({ id: v.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Aviso flotante: la tarjeta del color ya no está.
      if (r.data.resultado === "borrado") {
        avisar(`Sacaste «${nombreDe(v)}».`);
      } else {
        avisarConPero(
          `«${nombreDe(v)}» está en ${dondeEsta(r.data.ordenes, r.data.carritos)}, así que no se puede sacar: la desactivamos y ya no se ofrece en la tienda.`,
        );
      }
      router.refresh();
    });
  };

  const cerrarEdicion = () => {
    setEnEdicion(null);
    setAgregando(false);

    // Se saca `?agregar=color` para que recargar no reabra el alta. La
    // navegación ya trae los datos: sumar `refresh` los pediría dos veces.
    if (abrirAlta) {
      router.replace(pathname, { scroll: false });
      return;
    }
    router.refresh();
  };

  return (
    <TarjetaDeSeccion
      id="colores-y-stock"
      titulo="Colores y stock"
      insignias={<AvisoDeMarcaDeAgua activa={marcaDeAgua} />}
      ayuda="Cada color lleva su stock y sus fotos."
      acciones={
        variantes.length === 0 ? null : (
          // Solo con alguna foto propia: un zip vacío no sirve.
          <div className="flex flex-wrap items-center gap-2">
            {variantes.some((v) => v.propias > 0) ? (
              <DescargarFotos productId={productId} alFallar={setError} />
            ) : null}
            {/* En pizarra: sin colores no hay stock ni fotos. */}
            <Button
              variant="pizarra"
              size="sm"
              onClick={() => setAgregando(true)}
            >
              <Plus aria-hidden />
              Agregar color
            </Button>
          </div>
        )
      }
    >
      {/* Las reglas de las fotos, una vez para toda la sección. */}
      {variantes.length === 0 ? null : (
        <p className="text-caption text-ink-secondary">
          Hasta 5 fotos por color. Mejor si son de 1400&nbsp;×&nbsp;1400.
        </p>
      )}

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {/* Avisa y no frena: «Único» puede ser a propósito. */}
      {categoriaConColor && variantes.some((v) => v.colorId === null) ? (
        <p className="flex items-start gap-2 rounded-panel-control bg-warning-tint px-3 py-2 text-body-sm text-warning">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Casi todo en {categoriaConColor} tiene color. Con «Único», este
            producto no aparece al filtrar por color.
          </span>
        </p>
      ) : null}
      {variantes.length === 0 ? (
        <Vacio alAgregar={() => setAgregando(true)} />
      ) : variantes.length > HASTA_SIN_PLEGAR ? (
        <Accordion
          type="single"
          collapsible
          value={abierto}
          onValueChange={setAbierto}
          asChild
        >
          <ul className="flex flex-col gap-3">
            {variantes.map((v) => (
              <AccordionItem key={v.id} value={v.id} asChild>
                <li
                  id={`color-${v.id}`}
                  className={TARJETA}
                  // Arrastrar fotos encima abre el color.
                  onDragEnter={() => {
                    if (abierto !== v.id) setAbierto(v.id);
                  }}
                >
                  <AccordionHeader className="items-center gap-2">
                    {/* `-m-1.5 p-1.5`: más área táctil, sin correr nada. */}
                    <AccordionTrigger className="-m-1.5 min-h-11 min-w-0 rounded-panel-control p-1.5 hover:bg-canvas">
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <Identidad variante={v} />
                        <Estados variante={v} />
                      </span>
                    </AccordionTrigger>
                    {abierto === v.id ? (
                      <Acciones
                        variante={v}
                        enCurso={enCurso}
                        alEditar={setEnEdicion}
                        alSacar={setPorBorrar}
                      />
                    ) : null}
                  </AccordionHeader>
                  {/* `forceMount`: desmontar cortaría una subida en curso. */}
                  <AccordionContent
                    forceMount
                    className="flex flex-col gap-3 data-[state=closed]:hidden"
                  >
                    <Cuerpo
                      productId={productId}
                      variante={v}
                      variantes={variantes}
                    />
                  </AccordionContent>
                </li>
              </AccordionItem>
            ))}
          </ul>
        </Accordion>
      ) : (
        <ul className="flex flex-col gap-3">
          {variantes.map((v) => (
            <li key={v.id} id={`color-${v.id}`} className={TARJETA}>
              <div className="flex items-start justify-between gap-2">
                <Identidad variante={v} />
                <div className="flex shrink-0 items-center gap-1">
                  <Estados variante={v} />
                  <Acciones
                    variante={v}
                    enCurso={enCurso}
                    alEditar={setEnEdicion}
                    alSacar={setPorBorrar}
                  />
                </div>
              </div>
              <Cuerpo
                productId={productId}
                variante={v}
                variantes={variantes}
              />
            </li>
          ))}
        </ul>
      )}

      <EdicionDeVariante
        abierto={agregando || enEdicion !== null}
        productId={productId}
        productoActivo={productoActivo}
        variante={enEdicion}
        variantes={variantes}
        colores={colores}
        desdeElAlta={abrirAlta && variantes.length === 0}
        alAgregar={(id) => {
          paraFotos.current = id;
        }}
        alCerrar={cerrarEdicion}
      />

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Sacar «{porBorrar ? nombreDe(porBorrar) : ""}»
            </DialogTitle>
            <DialogDescription>
              {porBorrar?.ordenes
                ? "Este color está en órdenes ya hechas, así que no se borra: lo desactivamos para que se sigan leyendo enteras."
                : porBorrar?.carritos
                  ? "Este color está en el carrito de alguien, así que no se borra: lo desactivamos, y quien lo tenía lo ve como «Ya no disponible»."
                  : "Se van sus fotos y su stock, y no hay vuelta atrás."}
              {porBorrar?.prestadaA
                ? ` Además, ${porBorrar.prestadaA === 1 ? "otro color reutiliza" : `${porBorrar.prestadaA} colores reutilizan`} sus fotos y ${porBorrar.prestadaA === 1 ? "va a quedarse" : "van a quedarse"} sin ninguna.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPorBorrar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              onClick={() => porBorrar && borrar(porBorrar)}
            >
              Sacar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TarjetaDeSeccion>
  );
}

/** Lo que se ve con el color cerrado. */
function Identidad({ variante: v }: { variante: VarianteDelPanel }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Muestra hex={v.colorHex} hex2={v.colorHex2} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{nombreDe(v)}</span>
        <Stock variante={v} />
      </span>
    </span>
  );
}

function Estados({ variante: v }: { variante: VarianteDelPanel }) {
  if (v.isActive && v.colorIsActive !== false) return null;
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      {v.isActive ? null : <Badge tone="neutral">Inactiva</Badge>}
      {v.colorIsActive === false ? (
        <Badge tone="warning">Color inactivo</Badge>
      ) : null}
    </span>
  );
}

function Acciones({
  variante: v,
  enCurso,
  alEditar,
  alSacar,
}: {
  variante: VarianteDelPanel;
  enCurso: boolean;
  alEditar: (v: VarianteDelPanel) => void;
  alSacar: (v: VarianteDelPanel) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        variant="tertiary"
        size="icon"
        onClick={() => alEditar(v)}
        disabled={enCurso}
        title="Editar"
        data-ayuda="corregir-stock"
      >
        <Pencil aria-hidden />
        <span className="sr-only">Editar {nombreDe(v)}</span>
      </Button>
      <Button
        variant="destructive-ghost"
        size="icon"
        onClick={() => alSacar(v)}
        disabled={enCurso}
        title="Sacar"
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Sacar {nombreDe(v)}</span>
      </Button>
    </span>
  );
}

function Cuerpo({
  productId,
  variante: v,
  variantes,
}: {
  productId: string;
  variante: VarianteDelPanel;
  variantes: VarianteDelPanel[];
}) {
  return (
    <>
      <ImagenesDeVariante
        productId={productId}
        variantId={v.id}
        imagenes={v.imagenes}
        soloLectura={v.imagesSourceId !== null}
        etiqueta={nombreDe(v)}
      />
      {variantes.length > 1 ? (
        <Reutilizar variante={v} variantes={variantes} />
      ) : null}
    </>
  );
}

function Stock({ variante }: { variante: VarianteDelPanel }) {
  const { stockTotal, reservedStock, disponible } = variante;

  return (
    <span
      data-ayuda="stock-del-color"
      className="flex flex-wrap items-center gap-x-1.5 text-caption tabular-nums text-ink-secondary"
    >
      <span className={stockTotal < 0 ? "font-medium text-danger" : undefined}>
        {stockTotal} en total
      </span>
      <span aria-hidden>·</span>
      <span>{reservedStock} reservadas</span>
      <span aria-hidden>·</span>
      <span
        // Rojo y no ámbar, como «Sin stock» en el listado.
        className={disponible <= 0 ? "font-medium text-danger" : "text-ink"}
      >
        {disponible} disponibles
      </span>
    </span>
  );
}

function Muestra({ hex, hex2 }: { hex: string | null; hex2: string | null }) {
  if (!hex) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-pill border border-border-strong bg-surface text-ink-secondary">
        <Palette aria-hidden className="size-4" />
      </span>
    );
  }

  return (
    // `border-strong`: un color claro se pierde en el modo claro y uno
    // oscuro en el oscuro.
    <EsferaDeColor
      hex={hex}
      hex2={hex2}
      className="size-8 border-border-strong"
    />
  );
}

function opcionDeColor(c: OpcionDeColor, tomado: boolean): OpcionDelSelector {
  const notas = [
    tomado ? "ya cargado" : null,
    c.isActive ? null : "color inactivo",
  ].filter(Boolean);
  return {
    valor: c.id,
    etiqueta: c.name,
    nota: notas.length ? notas.join(", ") : undefined,
    deshabilitada: tomado,
    muestra: <MuestraChica hex={c.hexCode} />,
  };
}

function MuestraChica({ hex }: { hex: string | null }) {
  return hex ? (
    <EsferaDeColor hex={hex} className="size-4 border-border-strong" />
  ) : (
    <Palette aria-hidden className="size-4 shrink-0 text-ink-secondary" />
  );
}

/** Solo las variantes con fotos propias: §9.5 permite un solo salto. */
function Reutilizar({
  variante,
  variantes,
}: {
  variante: VarianteDelPanel;
  variantes: VarianteDelPanel[];
}) {
  const router = useRouter();
  const idBase = useId();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const candidatas = variantes.filter(
    (o) => o.id !== variante.id && o.imagesSourceId === null,
  );

  if (candidatas.length === 0) return null;

  // Solo aparece cuando puede hacer algo: sin fotos propias, o reutilizando.
  const reutilizando = variante.imagesSourceId !== null;
  const puede = variante.propias === 0 && variante.prestadaA === 0;

  if (!reutilizando && !puede) return null;

  const cambiar = (valor: string) => {
    setError(null);
    iniciar(async () => {
      const r = await reutilizarImagenes({
        id: variante.id,
        sourceId: valor === "" ? null : valor,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idBase}-fuente`}>Fotos</Label>
      {/* El ancho acá y no en el `Select`: el chevron se posiciona contra su
          envoltorio y quedaría lejos del campo. */}
      <div className="max-w-xs">
        <Select
          id={`${idBase}-fuente`}
          value={variante.imagesSourceId ?? ""}
          disabled={guardando}
          onChange={(e) => cambiar(e.target.value)}
        >
          <option value="">
            {reutilizando ? "Volver a las suyas" : "Las suyas"}
          </option>
          {candidatas.map((o) => (
            <option key={o.id} value={o.id}>
              Las mismas que {nombreDe(o)}
            </option>
          ))}
        </Select>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function Vacio({ alAgregar }: { alAgregar: () => void }) {
  return (
    <VacioDelPanel
      dentro
      icono={Palette}
      titulo="Todavía no cargaste ningún color."
      accion={
        /* Pizarra y no de marca: §6.3 admite una sola, y es «Guardar». */
        <Button variant="pizarra" size="sm" onClick={alAgregar}>
          <Plus aria-hidden />
          Cargar el primero
        </Button>
      }
    >
      Sin colores cargados no hay stock ni fotos, así que el producto no se
      puede vender.
    </VacioDelPanel>
  );
}

type Campo = "colorId" | "secondaryColorId" | "stockTotal";

const ENTERO = /^\d{1,7}$/;

function EdicionDeVariante({
  abierto,
  productId,
  productoActivo,
  variante,
  variantes,
  colores: delServidor,
  desdeElAlta,
  alAgregar,
  alCerrar,
}: {
  abierto: boolean;
  productId: string;
  productoActivo: boolean;
  /** `null` = alta. */
  variante: VarianteDelPanel | null;
  variantes: VarianteDelPanel[];
  colores: OpcionDeColor[];
  /** Recién creado el producto, todavía sin colores. */
  desdeElAlta: boolean;
  alAgregar: (id: string) => void;
  alCerrar: () => void;
}) {
  const idBase = useId();
  // Sin esto, al cerrarse el drawer devolvería el foco a «Agregar color» y la
  // página saltaría hasta ahí antes de bajar a la tarjeta nueva.
  const focoALasFotos = useRef(false);
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);
  const [color, setColor] = useState(() => colorInicial(variante));
  const [color2, setColor2] = useState(
    variante?.secondaryColorId ?? SIN_SEGUNDO,
  );
  const [stock, setStock] = useState(String(variante?.stockTotal ?? 0));
  const [activa, setActiva] = useState(variante?.isActive ?? true);

  /** Un paso adentro del drawer, no otro encima. `para`: qué selector. */
  const [creando, setCreando] = useState<{
    nombre: string;
    para: "color" | "color2";
  } | null>(null);
  // Guardar el color no repinta esta pantalla.
  const [creados, setCreados] = useState<OpcionDeColor[]>([]);
  const colores = creados.length
    ? [
        ...creados.filter((c) => !delServidor.some((o) => o.id === c.id)),
        ...delServidor,
      ]
    : delServidor;

  // Al abrir, arranca de nuevo. Durante el render y no en un efecto, que
  // pintaría primero los valores de la vez anterior.
  const [visto, setVisto] = useState({ abierto, variante });
  if (visto.abierto !== abierto || visto.variante !== variante) {
    setVisto({ abierto, variante });
    if (abierto) {
      setErrores(NO_ERRORS);
      setColor(colorInicial(variante));
      setColor2(variante?.secondaryColorId ?? SIN_SEGUNDO);
      setStock(String(variante?.stockTotal ?? 0));
      setActiva(variante?.isActive ?? true);
      setCreando(null);
    }
  }

  const ofrecerCrear = (para: "color" | "color2") => ({
    nueva: "Crear un color",
    con: (n: string) => `Crear el color «${n}»`,
    alCrear: (n: string) => setCreando({ nombre: n, para }),
  });

  const volverDeCrear = () => {
    const para = creando?.para ?? "color";
    setCreando(null);
    // El selector vuelve a existir recién en el próximo pintado.
    requestAnimationFrame(() =>
      document.getElementById(`${idBase}-${para}`)?.focus(),
    );
  };

  // «Negro» y «Negro/Rojo» conviven: son dos variantes distintas.
  const tomadas = new Set(
    variantes
      .filter((v) => v.id !== variante?.id)
      .map((v) => combinacion(v.colorId, v.secondaryColorId)),
  );
  const segundo = color2 || null;
  const conColor = !!color && color !== UNICO;

  // Los activos, más los que ya tiene: si no, guardar se los cambiaría.
  const ofrecidos = colores.filter(
    (c) =>
      c.isActive ||
      c.id === variante?.colorId ||
      c.id === variante?.secondaryColorId,
  );

  const hayColores = colores.some(
    (c) => c.isActive || c.id === variante?.colorId,
  );

  const stockValido = ENTERO.test(stock.trim());

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(NO_ERRORS);

    if (!color) {
      setErrores({
        ...NO_ERRORS,
        fields: {
          colorId: "Elegí un color, o «Único» si no se vende por color.",
        },
      });
      return;
    }

    if (!stockValido) {
      setErrores({
        ...NO_ERRORS,
        fields: {
          stockTotal: "Poné cuántas unidades hay, en números enteros.",
        },
      });
      return;
    }

    const datos = {
      colorId: color === UNICO ? null : color,
      // El segundo puede haber quedado elegido de antes de pasar a «Único».
      secondaryColorId: conColor ? segundo : null,
      // `Number.parseInt`: la regla de lint prohíbe `Number` por los montos.
      stockTotal: Number.parseInt(stock.trim(), 10),
      isActive: activa,
    };

    iniciar(async () => {
      const r = variante
        ? await editarUnaVariante({ id: variante.id, ...datos })
        : await agregarUnaVariante({ productId, ...datos });

      if (!r.ok) {
        setErrores(readErrors<Campo>(r));
        return;
      }

      // Avisa el drawer y no `alCerrar`, que también es «Cancelar».
      const nombre = (id: string | null) =>
        colores.find((c) => c.id === id)?.name ?? "el color";
      const comoSeLlama =
        color === UNICO
          ? "Único"
          : datos.secondaryColorId
            ? `${nombre(color)}/${nombre(datos.secondaryColorId)}`
            : nombre(color);
      avisar(
        variante
          ? `«${comoSeLlama}» quedó con ${unidades(datos.stockTotal)} en total.`
          : `Agregaste «${comoSeLlama}» con ${unidades(datos.stockTotal)}.`,
      );
      if (!variante && "id" in r.data) {
        focoALasFotos.current = true;
        alAgregar(r.data.id);
      }
      alCerrar();
    });
  };

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent
        onCloseAutoFocus={(e) => {
          if (!focoALasFotos.current) return;
          focoALasFotos.current = false;
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Escape al crear vuelve a la variante, sin perder lo cargado.
          if (creando) {
            e.preventDefault();
            volverDeCrear();
          }
        }}
      >
        {creando ? (
          <EdicionDeItem
            tipo="color"
            item={null}
            abierto
            incrustado
            nombreInicial={creando.nombre}
            alCerrar={volverDeCrear}
            alCrear={({ id, name, hexCode }) => {
              setCreados((antes) => [
                { id, name, hexCode, isActive: true },
                ...antes,
              ]);
              if (creando.para === "color") {
                setColor(id);
              } else {
                setColor2(id);
              }
            }}
          />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {variante
                  ? `Editar «${nombreDe(variante)}»`
                  : "Agregar un color"}
              </SheetTitle>
              {/* Recién creado el producto, confirma el alta. */}
              <SheetDescription>
                {variante
                  ? "Las fotos se cambian en la tarjeta del color."
                  : desdeElAlta
                    ? "Creaste el producto. Cargale un color para poder venderlo, y después te llevamos a sus fotos."
                    : "Al agregarlo te llevamos a su tarjeta, para que le sumes las fotos."}
              </SheetDescription>
            </SheetHeader>

            <SheetForm onSubmit={enviar} noValidate>
              <SheetBody>
                {/* Dos secciones, por la regla del aire. */}
                <Secciones>
                  <Seccion>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${idBase}-color`}>Color</Label>
                      <SelectorConBuscador
                        id={`${idBase}-color`}
                        valor={color}
                        alCambiar={(v) => {
                          setColor(v);
                          // El segundo no puede repetir al primero.
                          if (v === color2) setColor2(SIN_SEGUNDO);
                        }}
                        aria-invalid={!!errores.fields.colorId || undefined}
                        aria-describedby={
                          errores.fields.colorId
                            ? `${idBase}-e-color`
                            : `${idBase}-ayuda-color`
                        }
                        opciones={[
                          {
                            valor: UNICO,
                            etiqueta: "Único — no se vende por color",
                            nota: tomadas.has(UNICO) ? "ya cargado" : undefined,
                            deshabilitada: tomadas.has(UNICO),
                            muestra: <MuestraChica hex={null} />,
                          },
                          ...ofrecidos.map((c) =>
                            opcionDeColor(
                              c,
                              tomadas.has(combinacion(c.id, segundo)),
                            ),
                          ),
                        ]}
                        marcador="Elegí un color"
                        buscar="Buscar un color…"
                        sinResultados="No hay ningún color con ese nombre."
                        crear={ofrecerCrear("color")}
                      />
                      {errores.fields.colorId ? (
                        <FieldError id={`${idBase}-e-color`}>
                          {errores.fields.colorId}
                        </FieldError>
                      ) : (
                        <FieldHint id={`${idBase}-ayuda-color`}>
                          {/* Sin colores, dice que igual se puede seguir. */}
                          {!hayColores
                            ? "Podés venderlo sin colores, o crear uno desde la lista."
                            : color === UNICO
                              ? // Corta a propósito: «Único» saca del filtro.
                                "Solo si el color no importa, como en una memoria RAM."
                              : "Si no está, escribilo y crealo desde la lista."}
                        </FieldHint>
                      )}
                    </div>

                    {conColor && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${idBase}-color2`}>
                          Segundo color{" "}
                          <span className="font-normal text-ink-secondary">
                            (opcional)
                          </span>
                        </Label>
                        <SelectorConBuscador
                          id={`${idBase}-color2`}
                          valor={color2}
                          alCambiar={setColor2}
                          aria-invalid={
                            !!errores.fields.secondaryColorId || undefined
                          }
                          aria-describedby={
                            errores.fields.secondaryColorId
                              ? `${idBase}-e-color2`
                              : `${idBase}-ayuda-color2`
                          }
                          opciones={[
                            {
                              valor: SIN_SEGUNDO,
                              etiqueta: "Ninguno — es de un solo color",
                              nota: tomadas.has(combinacion(color, null))
                                ? "ya cargado"
                                : undefined,
                              deshabilitada: tomadas.has(
                                combinacion(color, null),
                              ),
                            },
                            ...ofrecidos
                              .filter((c) => c.id !== color)
                              .map((c) =>
                                opcionDeColor(
                                  c,
                                  tomadas.has(combinacion(color, c.id)),
                                ),
                              ),
                          ]}
                          marcador="Ninguno — es de un solo color"
                          buscar="Buscar un color…"
                          sinResultados="No hay ningún color con ese nombre."
                          crear={ofrecerCrear("color2")}
                        />
                        {errores.fields.secondaryColorId ? (
                          <FieldError id={`${idBase}-e-color2`}>
                            {errores.fields.secondaryColorId}
                          </FieldError>
                        ) : (
                          <FieldHint id={`${idBase}-ayuda-color2`}>
                            Para productos de dos colores, como negro con rojo.
                          </FieldHint>
                        )}
                      </div>
                    )}
                  </Seccion>

                  <Seccion>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${idBase}-stock`}>Stock</Label>
                      <Input
                        id={`${idBase}-stock`}
                        // No `type="number"`: la rueda cambiaría el stock.
                        inputMode="numeric"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="tabular-nums"
                        aria-invalid={!!errores.fields.stockTotal || undefined}
                        aria-describedby={
                          errores.fields.stockTotal
                            ? `${idBase}-e-stock`
                            : `${idBase}-ayuda-stock`
                        }
                      />
                      {errores.fields.stockTotal ? (
                        <FieldError id={`${idBase}-e-stock`}>
                          {errores.fields.stockTotal}
                        </FieldError>
                      ) : (
                        <FieldHint id={`${idBase}-ayuda-stock`}>
                          Las unidades que hay. Cada cambio queda registrado
                          como un ajuste.
                          {variante && variante.reservedStock > 0
                            ? variante.reservedStock === 1
                              ? " Hay 1 reservada, así que no puede bajar de ese número."
                              : ` Hay ${variante.reservedStock} reservadas, así que no puede bajar de ese número.`
                            : ""}
                        </FieldHint>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`${idBase}-activa`}
                          checked={activa}
                          onCheckedChange={(v) => setActiva(v === true)}
                          aria-describedby={`${idBase}-ayuda-activa`}
                        />
                        <Label htmlFor={`${idBase}-activa`}>
                          Se ofrece en la tienda
                        </Label>
                      </div>
                      <FieldHint id={`${idBase}-ayuda-activa`}>
                        {productoActivo
                          ? "Si la desactivás, el color deja de aparecer en la ficha y el resto sigue igual."
                          : "El producto está inactivo, así que por ahora no se ve ningún color."}
                      </FieldHint>
                    </div>
                  </Seccion>
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
                  loadingLabel="Guardando"
                >
                  {variante ? "Guardar" : "Agregar"}
                </Button>
              </SheetFooter>
            </SheetForm>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Avisa y no bloquea; enlaza a su pantalla, que es donde se cambia. */
function AvisoDeMarcaDeAgua({ activa }: { activa: boolean }) {
  return (
    <Link
      href="/admin/configuracion/marca-de-agua"
      className="rounded-pill outline-none focus-visible:shadow-focus"
    >
      <Badge
        tone={activa ? "success" : "danger"}
        className="underline-offset-2 hover:underline"
      >
        {activa ? <Droplets aria-hidden /> : <DropletOff aria-hidden />}
        {activa ? "Marca de agua activada" : "Marca de agua desactivada"}
      </Badge>
    </Link>
  );
}
