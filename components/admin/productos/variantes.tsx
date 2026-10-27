"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Palette, Pencil, Plus, Trash2 } from "lucide-react";

import { EdicionDeItem } from "@/components/admin/catalogo/edicion";
import { Seccion, Secciones } from "@/components/admin/formulario";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { VacioDelPanel } from "@/components/admin/vacio";
import { dondeEsta } from "@/components/admin/productos/donde-esta";
import { ImagenesDeVariante } from "@/components/admin/productos/imagenes";
import { avisar, avisarConPero } from "@/components/ui/aviso";
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
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
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

/**
 * Variantes de color — RF-16, RF-17, §9.5.
 *
 * Una variante es LA UNIDAD CON STOCK E IMÁGENES: es lo que se reserva, lo
 * que se vende y lo que se fotografía. Por eso la pantalla la muestra entera
 * —color, stock y galería— en una sola tarjeta, en vez de repartirla en dos
 * pestañas que obligarían a recordar en cuál estaba cada cosa.
 *
 * **Vive en la pantalla de edición y no en la de alta**, y no por comodidad:
 * una imagen se guarda en `productos/{productId}/{variantId}/…` (§9.2), así
 * que antes de que exista el producto no hay dónde ponerla. El alta termina
 * acá: crear un producto lleva a su pantalla de edición, que es donde sigue
 * el trabajo.
 */

/** El valor del `<select>` para la variante sin color (RF-16). */
const UNICO = "unico";

/** El valor del segundo `<select>` cuando la variante es de un solo color. */
const SIN_SEGUNDO = "";

/**
 * La combinación de colores, sin orden: «Negro/Rojo» y «Rojo/Negro» son la
 * misma variante (es lo que dice `variant_product_color_key`). Sirve para
 * saber qué combinaciones ya se llevó otra variante del producto.
 */
function combinacion(primero: string | null, segundo: string | null): string {
  if (!primero) return UNICO;
  return segundo ? [primero, segundo].sort().join("+") : primero;
}

/** «1 unidad» y no «1 unidades», que es lo que se lee en los avisos. */
function unidades(n: number): string {
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

/** Cómo se llama una variante en un cartel. */
function nombreDe(v: { colorName: string | null }): string {
  return v.colorName ?? "Único";
}

/** El color con que arranca el drawer: el de la variante, o nada en un alta. */
function colorInicial(v: VarianteDelPanel | null): string {
  return v ? (v.colorId ?? UNICO) : "";
}

export function VariantesDelProducto({
  productId,
  productoActivo,
  variantes,
  colores,
  abrirAlta = false,
}: {
  productId: string;
  productoActivo: boolean;
  variantes: VarianteDelPanel[];
  colores: OpcionDeColor[];
  /** Llegó `?agregar=color`: el alta termina acá y sigue sola. */
  abrirAlta?: boolean;
}) {
  const [enEdicion, setEnEdicion] = useState<VarianteDelPanel | null>(null);
  const [agregando, setAgregando] = useState(abrirAlta);
  const [porBorrar, setPorBorrar] = useState<VarianteDelPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  // El estado arranca con lo que diga la dirección, y además la sigue. Con
  // sólo el valor inicial alcanza HOY, porque se llega desde `/nuevo`, que es
  // otro segmento y monta este componente de cero. Pero el día que algo
  // enlace a `?agregar=color` desde la ficha misma —el listado, por ejemplo—
  // React reusaría esta instancia y el drawer no se abriría: el valor
  // inicial de un `useState` se lee una sola vez. Se sigue durante el render,
  // cuando cambia, y no en un efecto: un efecto pintaría primero la ficha
  // sin el drawer.
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
      // La tarjeta del color desapareció: no queda dónde poner la respuesta
      // en su lugar (DR §6.15). El error sí se queda acá arriba, que es
      // donde estuvo la acción.
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

    // Con `?agregar=color` puesto, cerrar navega a la dirección sin él: si se
    // quedara, recargar la pantalla volvería a abrir el alta sobre un color
    // que ya se cargó. Es una navegación y no un `refresh`, así que trae los
    // datos nuevos igual; llamar a los dos sería pedir la misma página dos
    // veces.
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
      ayuda="Cada color lleva su stock y sus fotos. Si el producto no se vende por color, alcanza con uno solo."
      acciones={
        variantes.length === 0 ? null : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAgregando(true)}
          >
            <Plus aria-hidden />
            Agregar color
          </Button>
        )
      }
    >
      {/* Las reglas de las fotos, dichas una vez para toda la sección: en cada
          tarjeta serían dos renglones repetidos por color. Van de ancho
          completo y no apretadas contra el botón. */}
      {variantes.length === 0 ? null : (
        <p className="text-caption text-ink-secondary">
          Hasta 5 fotos por color. Arrastralas desde tu computadora a la fila
          del color, o tocá «Agregar»: JPG, PNG o WEBP de hasta 10 MB, que se
          guardan optimizadas. La primera es la que se ve en el catálogo, y se
          cambia arrastrando o desde el menú de cada foto.
        </p>
      )}

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {variantes.length === 0 ? (
        <Vacio alAgregar={() => setAgregando(true)} />
      ) : (
        <ul className="flex flex-col gap-3">
          {variantes.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface-sunken p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Muestra hex={v.colorHex} hex2={v.colorHex2} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-ink">
                      {nombreDe(v)}
                    </span>
                    <Stock variante={v} />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {v.isActive ? null : <Badge tone="neutral">Inactiva</Badge>}
                  {v.colorIsActive === false ? (
                    <Badge tone="warning">Color inactivo</Badge>
                  ) : null}
                  <Button
                    variant="tertiary"
                    size="icon"
                    onClick={() => setEnEdicion(v)}
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
                    onClick={() => setPorBorrar(v)}
                    disabled={enCurso}
                    title="Sacar"
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Sacar {nombreDe(v)}</span>
                  </Button>
                </div>
              </div>

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
                ? "Este color está en órdenes ya hechas, así que no se borra: lo desactivamos para que dejen de leerse enteras."
                : porBorrar?.carritos
                  ? "Este color está en el carrito de alguien, así que no se borra: lo desactivamos, y quien lo tenía lo ve como «Ya no disponible»."
                  : "Se van sus fotos y su stock, y no hay vuelta atrás."}
              {porBorrar?.prestadaA
                ? ` Además, ${porBorrar.prestadaA === 1 ? "otro color reutiliza" : `${porBorrar.prestadaA} colores reutilizan`} sus fotos y ${porBorrar.prestadaA === 1 ? "va a quedarse" : "van a quedarse"} sin ninguna.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setPorBorrar(null)}>
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

/**
 * Los tres números que RF-16 pide siempre a la vista.
 *
 * El cero disponible se destaca porque es la diferencia entre «tengo diez» y
 * «tengo diez y las diez están comprometidas»: el total solo no la cuenta. Un
 * total NEGATIVO también, y por otro motivo — es la señal de discrepancia de
 * §5.4, que se corrige con un ajuste.
 */
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
        className={disponible <= 0 ? "font-medium text-warning" : "text-ink"}
      >
        {disponible} disponibles
      </span>
    </span>
  );
}

/** La muestra de color de §6.5, en chico. Sin color, un ícono. */
function Muestra({ hex, hex2 }: { hex: string | null; hex2: string | null }) {
  if (!hex) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-pill border border-border-strong bg-surface text-ink-secondary">
        <Palette aria-hidden className="size-4" />
      </span>
    );
  }

  return (
    // El borde no es decorativo, y va en `border-strong` por los DOS lados
    // del problema: un color claro desaparece sobre la superficie clara del
    // panel (§6.5), y uno oscuro —que es la mitad del catálogo de
    // periféricos— desaparece sobre la del modo oscuro.
    <EsferaDeColor
      hex={hex}
      hex2={hex2}
      className="size-8 border-border-strong"
    />
  );
}

/**
 * Un color como opción del selector, con su esfera. Las dos notas pueden ir
 * juntas: un color inactivo que además ya está cargado en otra variante.
 */
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

/** La muestra del renglón del selector: la del texto, no la de la tarjeta. */
function MuestraChica({ hex }: { hex: string | null }) {
  return hex ? (
    <EsferaDeColor hex={hex} className="size-4 border-border-strong" />
  ) : (
    <Palette aria-hidden className="size-4 shrink-0 text-ink-secondary" />
  );
}

/**
 * Reutilizar las imágenes de otra variante — RF-16, §9.5.
 *
 * Es un `<select>` y no un interruptor porque la pregunta no es «sí o no»
 * sino «las de cuál». Solo se ofrecen las variantes que tienen imágenes
 * PROPIAS: elegir una que a su vez reutiliza armaría una cadena, y §9.5 dice
 * un solo salto.
 */
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

  /**
   * **El control aparece solo cuando puede hacer algo**, y eso es una
   * decisión de jerarquía, no una comodidad.
   *
   * Reutilizar las fotos de otro color es una configuración poco frecuente.
   * Dibujar el selector en todas las tarjetas lo dejaba deshabilitado en casi
   * todas, con un renglón de explicación abajo de por qué no se puede: dos
   * renglones por color, siempre, para algo que casi nunca se usa.
   *
   * Los dos momentos en que sirve son estos:
   *
   *   · el color todavía no tiene fotos propias —que es justo cuando la
   *     vendedora se pregunta si tiene que volver a subir las mismas—;
   *   · ya está reutilizando, y hay que poder deshacerlo.
   *
   * Un color con fotos propias no lo ve, y no pierde nada: para llegar a
   * reutilizar tendría que borrarlas primero, y ahí el selector aparece solo.
   */
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
      {/* El ancho se limita ACÁ y no en el `Select`: adentro, el chevron va
          posicionado contra el envoltorio, y achicar solo el campo lo dejaba
          flotando en el borde derecho de la tarjeta, lejos de su control. */}
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
        /* Secundario y no de marca: esta tarjeta convive con «Guardar
           cambios» del formulario de arriba, que es la principal de la
           pantalla, y §6.3 admite una sola. Los otros vacíos del panel sí
           usan la de marca porque su pantalla esconde la del encabezado
           mientras están vacíos; acá no se puede esconder el submit del
           formulario. Además el «Agregar color» de la cabecera de esta misma
           sección ya es secundario, así que el vacío pesa igual que su
           reemplazo. */
        <Button variant="secondary" size="sm" onClick={alAgregar}>
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

// ── Alta y edición ──────────────────────────────────────────────────────

type Campo = "colorId" | "secondaryColorId" | "stockTotal";

/** Enteros y nada más: no se venden dos unidades y media de un teclado. */
const ENTERO = /^\d{1,7}$/;

function EdicionDeVariante({
  abierto,
  productId,
  productoActivo,
  variante,
  variantes,
  colores: delServidor,
  alCerrar,
}: {
  abierto: boolean;
  productId: string;
  productoActivo: boolean;
  /** `null` = alta. */
  variante: VarianteDelPanel | null;
  variantes: VarianteDelPanel[];
  colores: OpcionDeColor[];
  alCerrar: () => void;
}) {
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [color, setColor] = useState(() => colorInicial(variante));
  const [color2, setColor2] = useState(
    variante?.secondaryColorId ?? SIN_SEGUNDO,
  );
  const [stock, setStock] = useState(String(variante?.stockTotal ?? 0));
  const [activa, setActiva] = useState(variante?.isActive ?? true);

  /**
   * Crear un color sin salir (F2.13). Es un paso adentro de este drawer y no
   * otro drawer encima (§6.14.2): reemplaza al formulario, que vuelve con lo
   * que tenía. `para` dice en cuál de los dos selectores queda elegido.
   */
  const [creando, setCreando] = useState<{
    nombre: string;
    para: "color" | "color2";
  } | null>(null);
  // Guardar el color no repinta esta pantalla: sin sumarlo acá, quedaría
  // elegido un color que el selector no conoce.
  const [creados, setCreados] = useState<OpcionDeColor[]>([]);
  const colores = creados.length
    ? [
        ...creados.filter((c) => !delServidor.some((o) => o.id === c.id)),
        ...delServidor,
      ]
    : delServidor;

  // Cada vez que se abre —o cambia la variante con el drawer abierto—, el
  // formulario arranca de nuevo con lo que hay guardado. Se ajusta durante el
  // render y no en un efecto: un efecto pintaría primero el drawer con los
  // valores de la vez anterior.
  const [visto, setVisto] = useState({ abierto, variante });
  if (visto.abierto !== abierto || visto.variante !== variante) {
    setVisto({ abierto, variante });
    if (abierto) {
      setErrores(SIN_ERRORES);
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

  /**
   * Las combinaciones que otra variante de este producto ya se llevó. Un
   * color suelto está tomado si ya hay una variante de ESE color solo:
   * «Negro» y «Negro/Rojo» conviven, son dos variantes distintas.
   */
  const tomadas = new Set(
    variantes
      .filter((v) => v.id !== variante?.id)
      .map((v) => combinacion(v.colorId, v.secondaryColorId)),
  );
  const segundo = color2 || null;
  const conColor = !!color && color !== UNICO;

  /** Los que se ofrecen: los activos, más los que esta variante ya tiene. */
  const ofrecidos = colores.filter(
    (c) =>
      c.isActive ||
      c.id === variante?.colorId ||
      c.id === variante?.secondaryColorId,
  );

  /**
   * Los colores que se pueden elegir de verdad. Se mira lo mismo que filtra
   * el selector: los activos, más el que esta variante ya tenga puesto.
   */
  const hayColores = colores.some(
    (c) => c.isActive || c.id === variante?.colorId,
  );

  const stockValido = ENTERO.test(stock.trim());

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    if (!color) {
      setErrores({
        ...SIN_ERRORES,
        campos: {
          colorId: "Elegí un color, o «Único» si no se vende por color.",
        },
      });
      return;
    }

    if (!stockValido) {
      setErrores({
        ...SIN_ERRORES,
        campos: {
          stockTotal: "Poné cuántas unidades hay, en números enteros.",
        },
      });
      return;
    }

    const datos = {
      colorId: color === UNICO ? null : color,
      // Sin primer color no hay segundo, aunque haya quedado elegido de antes
      // de pasar a «Único».
      secondaryColorId: conColor ? segundo : null,
      // `Number.parseInt` explícito, que es lo que pide la regla de lint de
      // §7.1: acá no hay un monto sino un conteo de unidades, y el patrón que
      // la regla persigue —convertir `numeric(12,2)` a flotante— no aplica.
      stockTotal: Number.parseInt(stock.trim(), 10),
      isActive: activa,
    };

    iniciar(async () => {
      const r = variante
        ? await editarUnaVariante({ id: variante.id, ...datos })
        : await agregarUnaVariante({ productId, ...datos });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      // Avisa el drawer y no quien lo cierra: `alCerrar` es también lo que
      // llama «Cancelar», y cancelar no confirma nada. Acá adentro se sabe
      // además si fue alta o edición, y con qué color.
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
      alCerrar();
    });
  };

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent
        onEscapeKeyDown={(e) => {
          // Escape en el paso de crear vuelve a la variante: cerrar todo
          // perdería el stock y lo demás que ya se había cargado.
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
              <SheetDescription>
                Las fotos se cargan después, en la tarjeta del color.
              </SheetDescription>
            </SheetHeader>

            <SheetForm onSubmit={enviar} noValidate>
              <SheetBody>
                {/* Dos secciones, por la regla del aire (§3.4.1): qué color es,
                y cuánto hay y si se ofrece. */}
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
                        aria-invalid={!!errores.campos.colorId || undefined}
                        aria-describedby={
                          errores.campos.colorId
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
                          // Los inactivos no se ofrecen, salvo el que la variante ya
                          // tiene puesto: si desapareciera del selector, guardar se lo
                          // cambiaría sin que nadie lo hubiera pedido.
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
                      {errores.campos.colorId ? (
                        <FieldError id={`${idBase}-e-color`}>
                          {errores.campos.colorId}
                        </FieldError>
                      ) : (
                        <FieldHint id={`${idBase}-ayuda-color`}>
                          {/* Con cero colores la ayuda tiene que decir otra cosa: que
                    igual se puede seguir. Si no, el selector ofrece «Único» y
                    una frase sobre dónde se cargan los colores, y parece que
                    falta un paso obligatorio que en realidad es opcional
                    (RF-16: una variante sin color es un producto que no se
                    vende por color). */}
                          {hayColores
                            ? "Cada color, o cada combinación, una sola vez por producto. Si no está, escribilo y crealo desde la lista."
                            : "Todavía no cargaste ningún color. Podés vender este producto sin colores, o crear uno desde la lista."}
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
                            !!errores.campos.secondaryColorId || undefined
                          }
                          aria-describedby={
                            errores.campos.secondaryColorId
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
                        {errores.campos.secondaryColorId ? (
                          <FieldError id={`${idBase}-e-color2`}>
                            {errores.campos.secondaryColorId}
                          </FieldError>
                        ) : (
                          <FieldHint id={`${idBase}-ayuda-color2`}>
                            Para los productos de dos colores, como negro con
                            rojo. En la tienda se ve la esfera partida en dos.
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
                        // `inputMode` y no `type="number"`: el número del navegador sube
                        // y baja con la rueda del mouse sobre el campo, y acá eso
                        // cambiaría el stock sin querer.
                        inputMode="numeric"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="tabular-nums"
                        aria-invalid={!!errores.campos.stockTotal || undefined}
                        aria-describedby={
                          errores.campos.stockTotal
                            ? `${idBase}-e-stock`
                            : `${idBase}-ayuda-stock`
                        }
                      />
                      {errores.campos.stockTotal ? (
                        <FieldError id={`${idBase}-e-stock`}>
                          {errores.campos.stockTotal}
                        </FieldError>
                      ) : (
                        <FieldHint id={`${idBase}-ayuda-stock`}>
                          Las unidades que hay. Cada cambio queda registrado
                          como un ajuste.
                          {variante && variante.reservedStock > 0
                            ? ` Hay ${variante.reservedStock} reservadas, así que no puede bajar de ese número.`
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
