"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Palette, Pencil, Plus, Trash2 } from "lucide-react";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { VacioDelPanel } from "@/components/admin/vacio";
import { dondeEsta } from "@/components/admin/productos/donde-esta";
import { ImagenesDeVariante } from "@/components/admin/productos/imagenes";
import { avisar } from "@/components/ui/aviso";
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
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

/** «1 unidad» y no «1 unidades», que es lo que se lee en los avisos. */
function unidades(n: number): string {
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

/** Cómo se llama una variante en un cartel. */
function nombreDe(v: { colorName: string | null }): string {
  return v.colorName ?? "Único";
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
  // React reusaría esta instancia y el diálogo no se abriría: el valor
  // inicial de un `useState` se lee una sola vez.
  useEffect(() => {
    if (abrirAlta) setAgregando(true);
  }, [abrirAlta]);

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
      avisar(
        r.data.resultado === "borrado"
          ? `Sacamos «${nombreDe(v)}».`
          : `«${nombreDe(v)}» está en ${dondeEsta(r.data.ordenes, r.data.carritos)}, así que no se puede sacar: la desactivamos y ya no se ofrece en la tienda.`,
      );
      router.refresh();
    });
  };

  const cerrarDialogo = () => {
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
                  <Muestra hex={v.colorHex} />
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

      <DialogoDeVariante
        abierto={agregando || enEdicion !== null}
        productId={productId}
        productoActivo={productoActivo}
        variante={enEdicion}
        variantes={variantes}
        colores={colores}
        alCerrar={cerrarDialogo}
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
    <span className="flex flex-wrap items-center gap-x-1.5 text-caption tabular-nums text-ink-secondary">
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
function Muestra({ hex }: { hex: string | null }) {
  if (!hex) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-pill border border-border-strong bg-surface text-ink-secondary">
        <Palette aria-hidden className="size-4" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      // El borde no es decorativo, y va en `border-strong` por los DOS lados
      // del problema: un color claro desaparece sobre la superficie clara del
      // panel (§6.5), y uno oscuro —que es la mitad del catálogo de
      // periféricos— desaparece sobre la del modo oscuro.
      className="size-8 shrink-0 rounded-pill border border-border-strong"
      style={{ backgroundColor: hex }}
    />
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

type Campo = "colorId" | "stockTotal";

/** Enteros y nada más: no se venden dos unidades y media de un teclado. */
const ENTERO = /^\d{1,7}$/;

function DialogoDeVariante({
  abierto,
  productId,
  productoActivo,
  variante,
  variantes,
  colores,
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
  const [color, setColor] = useState("");
  const [stock, setStock] = useState("0");
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    if (!abierto) return;
    setErrores(SIN_ERRORES);
    setColor(variante ? (variante.colorId ?? UNICO) : "");
    setStock(String(variante?.stockTotal ?? 0));
    setActiva(variante?.isActive ?? true);
  }, [abierto, variante]);

  /** Los colores que otra variante de este producto ya se llevó. */
  const tomados = new Set(
    variantes
      .filter((v) => v.id !== variante?.id)
      .map((v) => v.colorId ?? UNICO),
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

      // Avisa el diálogo y no quien lo cierra: `alCerrar` es también lo que
      // llama «Cancelar», y cancelar no confirma nada. Acá adentro se sabe
      // además si fue alta o edición, y con qué color.
      const comoSeLlama =
        color === UNICO
          ? "Único"
          : (colores.find((c) => c.id === color)?.name ?? "el color");
      avisar(
        variante
          ? `«${comoSeLlama}» quedó con ${unidades(datos.stockTotal)} en total.`
          : `Agregaste «${comoSeLlama}» con ${unidades(datos.stockTotal)}.`,
      );
      alCerrar();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => (v ? null : alCerrar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {variante ? `Editar «${nombreDe(variante)}»` : "Agregar un color"}
          </DialogTitle>
          <DialogDescription>
            Las fotos se cargan después, en la tarjeta del color.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idBase}-color`}>Color</Label>
            <Select
              id={`${idBase}-color`}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!!errores.campos.colorId || undefined}
              aria-describedby={
                errores.campos.colorId
                  ? `${idBase}-e-color`
                  : `${idBase}-ayuda-color`
              }
            >
              <option value="">Elegí un color</option>
              <option value={UNICO} disabled={tomados.has(UNICO)}>
                Único — no se vende por color
              </option>
              {colores
                // Los inactivos no se ofrecen, salvo el que la variante ya
                // tiene puesto: si desapareciera del selector, guardar se lo
                // cambiaría sin que nadie lo hubiera pedido.
                .filter((c) => c.isActive || c.id === variante?.colorId)
                .map((c) => (
                  <option key={c.id} value={c.id} disabled={tomados.has(c.id)}>
                    {c.name}
                    {tomados.has(c.id) ? " (ya cargado)" : ""}
                    {c.isActive ? "" : " (color inactivo)"}
                  </option>
                ))}
            </Select>
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
                  ? "Los colores se cargan en Catálogo. Un color por producto."
                  : "Todavía no cargaste ningún color. Podés vender este producto sin colores, o cargarlos en Catálogo → Colores y volver."}
              </FieldHint>
            )}
          </div>

          <div className="flex flex-col gap-2">
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
                Las unidades que hay. Cada cambio queda registrado como un
                ajuste.
                {variante && variante.reservedStock > 0
                  ? ` Hay ${variante.reservedStock} reservadas, así que no puede bajar de ese número.`
                  : ""}
              </FieldHint>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idBase}-activa`}
                checked={activa}
                onCheckedChange={(v) => setActiva(v === true)}
                aria-describedby={`${idBase}-ayuda-activa`}
              />
              <Label htmlFor={`${idBase}-activa`}>Se ofrece en la tienda</Label>
            </div>
            <FieldHint id={`${idBase}-ayuda-activa`}>
              {productoActivo
                ? "Si la desactivás, el color deja de aparecer en la ficha y el resto sigue igual."
                : "El producto está inactivo, así que por ahora no se ve ningún color."}
            </FieldHint>
          </div>

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
              {variante ? "Guardar" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
