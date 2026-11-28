"use client";

import { unstable_isUnrecognizedActionError, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { LexicalEditor } from "lexical";

import {
  EditorDeDescripcion,
  escribirMarkdown,
  leerMarkdown,
} from "@/components/admin/productos/editor";
import { useAvisoAlSalir } from "@/components/admin/aviso-al-salir";
import { useBorrador } from "@/components/admin/borrador";
import { EdicionDeItem } from "@/components/admin/catalogo/edicion";
import { EstadoDeGuardado } from "@/components/admin/estado-de-guardado";
import {
  Apartado,
  PieDeGuardado,
  TarjetaDeSeccion,
} from "@/components/admin/tarjeta";
import { avisar, avisarVersionNueva } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import {
  SelectorConBuscador,
  type OpcionDelSelector,
} from "@/components/ui/selector-con-buscador";
import {
  normalizeAmount,
  compare,
  formatMoney,
  isMoney,
  toEditable,
  subtract,
} from "@/lib/money";
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import { slugify } from "@/lib/slug";
import {
  crearUnProducto,
  editarUnProducto,
} from "@/modules/catalog/products/actions";
import type {
  OpcionDeCatalogo,
  ProductoParaEditar,
} from "@/modules/catalog/products/queries";

/** En el orden en que se ven: el foco va al primero con error. */
const CAMPOS = [
  "name",
  "sku",
  "brandId",
  "categoryId",
  "price",
  "discount",
  "description",
] as const;

type Campo = (typeof CAMPOS)[number];

type Borrador = {
  nombre: string;
  sku: string;
  marcaId: string;
  categoriaId: string;
  precio: string;
  descuento: string;
  destacado: boolean;
  activo: boolean;
  /** `null` si no se tocó. */
  descripcion: string | null;
};

/** En la base es la columna generada `final_price`; acá todavía no hay fila. */
type Vista =
  | { estado: "incompleto" }
  | { estado: "sin-oferta"; precio: string }
  | { estado: "oferta"; precio: string; final: string }
  | { estado: "descuento-invalido" };

function CampoDePesos({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body-sm text-ink-secondary"
      >
        $
      </span>
      {children}
    </div>
  );
}

function calcularVista(precio: string, descuento: string): Vista {
  const p = normalizeAmount(precio);
  const d = normalizeAmount(descuento.trim() || "0");

  if (!isMoney(p) || compare(p, "0.00") <= 0) return { estado: "incompleto" };
  if (!isMoney(d)) return { estado: "incompleto" };
  if (compare(d, "0.00") === 0) return { estado: "sin-oferta", precio: p };
  if (compare(d, p) >= 0) return { estado: "descuento-invalido" };

  return {
    estado: "oferta",
    precio: p,
    final: subtract(p, d),
  };
}

/**
 * Las activas más la elegida aunque esté inactiva: sin ella, guardar le
 * cambiaría la marca a un producto de marca inactiva (RN-11b).
 */
function opcionesDelSelector(
  todas: OpcionDeCatalogo[],
  elegida: string,
): OpcionDelSelector[] {
  return todas
    .filter((o) => o.isActive || o.id === elegida)
    .map((o) => ({
      valor: o.id,
      etiqueta: o.name,
      nota: o.isActive ? undefined : "inactiva",
    }));
}

export function FormularioDeProducto({
  producto,
  marcas,
  categorias,
}: {
  /** `null` = alta. */
  producto: ProductoParaEditar | null;
  marcas: OpcionDeCatalogo[];
  categorias: OpcionDeCatalogo[];
}) {
  const router = useRouter();
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);

  const [nombre, setNombre] = useState(producto?.name ?? "");
  const [sku, setSku] = useState(producto?.sku ?? "");
  const [marcaId, setMarcaId] = useState(producto?.brandId ?? "");
  const [categoriaId, setCategoriaId] = useState(producto?.categoryId ?? "");
  // «89900» y no «89900.00», que en es-AR se lee como error de tipeo.
  const [precio, setPrecio] = useState(
    producto ? toEditable(producto.price) : "",
  );
  const [descuento, setDescuento] = useState(
    producto && compare(producto.discount, "0.00") > 0
      ? toEditable(producto.discount)
      : "",
  );
  const [destacado, setDestacado] = useState(producto?.isFeatured ?? false);
  const [activo, setActivo] = useState(producto?.isActive ?? true);
  const [descripcionTocada, setDescripcionTocada] = useState(false);
  const tocarDescripcion = useCallback(() => setDescripcionTocada(true), []);

  const sinCambios =
    producto !== null &&
    !descripcionTocada &&
    nombre === producto.name &&
    sku === (producto.sku ?? "") &&
    marcaId === producto.brandId &&
    categoriaId === producto.categoryId &&
    precio === toEditable(producto.price) &&
    descuento ===
      (compare(producto.discount, "0.00") > 0
        ? toEditable(producto.discount)
        : "") &&
    destacado === producto.isFeatured &&
    activo === producto.isActive;
  const algoEscrito =
    nombre.trim() !== "" ||
    sku.trim() !== "" ||
    precio.trim() !== "" ||
    descuento.trim() !== "" ||
    descripcionTocada;
  const hayCambios = producto ? !sinCambios : algoEscrito;
  useAvisoAlSalir(!enviando && hayCambios);

  // Lo creado acá se suma a las opciones: guardarlo no repinta esta pantalla.
  const [creando, setCreando] = useState<{
    tipo: "marca" | "categoria";
    nombre: string;
  } | null>(null);
  const [creadas, setCreadas] = useState<{
    marca: OpcionDeCatalogo[];
    categoria: OpcionDeCatalogo[];
  }>({ marca: [], categoria: [] });

  // La descripción no es estado de React: se lee del editor al enviar.
  const editor = useRef<LexicalEditor | null>(null);

  const borrador = useBorrador<Borrador>({
    clave: `producto:${producto?.id ?? "nuevo"}`,
    hayCambios,
    leer: () => ({
      nombre,
      sku,
      marcaId,
      categoriaId,
      precio,
      descuento,
      destacado,
      activo,
      descripcion: descripcionTocada ? leerMarkdown(editor.current) : null,
    }),
    reponer: (b) => {
      setNombre(b.nombre);
      setSku(b.sku);
      setMarcaId(b.marcaId);
      setCategoriaId(b.categoriaId);
      setPrecio(b.precio);
      setDescuento(b.descuento);
      setDestacado(b.destacado);
      setActivo(b.activo);
      if (b.descripcion !== null)
        escribirMarkdown(editor.current, b.descripcion);
    },
  });

  const errorGeneral = useRef<HTMLDivElement | null>(null);

  function irAlPrimerError(nuevos: FormErrors<Campo>) {
    const primero = CAMPOS.find((c) => nuevos.fields[c]);

    if (primero) {
      document.getElementById(`${idBase}-${primero}`)?.focus();
      return;
    }
    // Sin campo señalado, el foco va al mensaje general.
    errorGeneral.current?.focus();
  }

  const vista = useMemo(
    () => calcularVista(precio, descuento),
    [precio, descuento],
  );

  const campo = (nombreDelCampo: Campo) => ({
    id: `${idBase}-${nombreDelCampo}`,
    "aria-invalid": Boolean(errores.fields[nombreDelCampo]) || undefined,
    "aria-describedby": errores.fields[nombreDelCampo]
      ? `${idBase}-${nombreDelCampo}-error`
      : undefined,
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(NO_ERRORS);

    const datos = {
      name: nombre,
      sku,
      description: leerMarkdown(editor.current),
      brandId: marcaId,
      categoryId: categoriaId,
      price: precio,
      discount: descuento.trim() || "0",
      isFeatured: destacado,
      isActive: activo,
    };

    iniciar(async () => {
      let resultado;
      try {
        resultado = producto
          ? await editarUnProducto({ id: producto.id, ...datos })
          : await crearUnProducto(datos);
      } catch (error) {
        // Un despliegue con el formulario abierto deja acciones del build
        // anterior. Se ataja acá y no en la pantalla de error, que reemplaza
        // al formulario y se llevaría lo escrito.
        if (unstable_isUnrecognizedActionError(error)) {
          avisarVersionNueva();
          return;
        }
        throw error;
      }

      if (!resultado.ok) {
        const nuevos = readErrors<Campo>(resultado);
        setErrores(nuevos);
        irAlPrimerError(nuevos);
        return;
      }

      borrador.descartar();

      // Al editar avisa: el listado no distingue lo guardado. Al crear no: lo
      // confirma el drawer del primer color, y el aviso le taparía «Agregar».
      if (producto) avisar(`Guardaste los cambios de «${nombre.trim()}».`);

      router.push(
        producto
          ? "/admin/productos"
          : `/admin/productos/${resultado.data.id}?agregar=color`,
      );
      router.refresh();
    });
  }

  /** Las recién creadas van arriba. */
  const conCreadas = (
    todas: OpcionDeCatalogo[],
    tipo: "marca" | "categoria",
  ) =>
    creadas[tipo].length
      ? [
          ...creadas[tipo].filter((c) => !todas.some((o) => o.id === c.id)),
          ...todas,
        ]
      : todas;

  const ofrecerCrear = (tipo: "marca" | "categoria") => ({
    nueva: tipo === "marca" ? "Crear una marca" : "Crear una categoría",
    con: (n: string) =>
      tipo === "marca" ? `Crear la marca «${n}»` : `Crear la categoría «${n}»`,
    alCrear: (n: string) => setCreando({ tipo, nombre: n }),
  });

  return (
    <>
      {/* Una sola tarjeta con «Guardar» al pie (DESIGN.md). */}
      <form onSubmit={enviar} noValidate className="min-w-0">
        {/* En su lugar y no flotante: sigue a la vista mientras se revisa. */}
        {borrador.recuperado ? (
          <p
            role="status"
            className="mb-4 rounded-panel-control bg-warning-tint px-3 py-2 text-body-sm text-ink"
          >
            Recuperamos lo que estabas cargando antes de que se recargara la
            página. Todavía no está guardado: revisalo y guardá.
          </p>
        ) : null}

        {/* Qué es. */}
        <TarjetaDeSeccion id="datos" titulo="Datos del producto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("name").id}>Nombre</Label>
            <Input
              {...campo("name")}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              autoComplete="off"
            />
            <FieldError id={`${idBase}-name-error`}>
              {errores.fields.name}
            </FieldError>

            {/* La dirección se lee, no se completa: «slug» es jerga. */}
            {producto ? (
              <FieldHint>
                Enlace:{" "}
                <span className="text-ink">/productos/{producto.slug}</span>. No
                cambia al renombrar.
              </FieldHint>
            ) : nombre.trim() ? (
              <FieldHint>
                Enlace:{" "}
                <span className="text-ink">/productos/{slugify(nombre)}</span>
              </FieldHint>
            ) : (
              // Acá y no como marcador: adentro parecía un nombre ya cargado.
              <FieldHint>
                Por ejemplo: «Teclado mecánico K120 retroiluminado».
              </FieldHint>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("sku").id}>
              SKU{" "}
              <span className="font-normal text-ink-secondary">(opcional)</span>
            </Label>
            <Input
              {...campo("sku")}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              maxLength={120}
              autoComplete="off"
            />
            <FieldError id={`${idBase}-sku-error`}>
              {errores.fields.sku}
            </FieldError>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={campo("brandId").id}>Marca</Label>
              <SelectorConBuscador
                {...campo("brandId")}
                valor={marcaId}
                alCambiar={setMarcaId}
                opciones={opcionesDelSelector(
                  conCreadas(marcas, "marca"),
                  marcaId,
                )}
                marcador="Elegí una marca"
                buscar="Buscar una marca…"
                sinResultados="No hay ninguna marca con ese nombre."
                crear={ofrecerCrear("marca")}
              />
              <FieldError id={`${idBase}-brandId-error`}>
                {errores.fields.brandId}
              </FieldError>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={campo("categoryId").id}>Categoría</Label>
              <SelectorConBuscador
                {...campo("categoryId")}
                valor={categoriaId}
                alCambiar={setCategoriaId}
                opciones={opcionesDelSelector(
                  conCreadas(categorias, "categoria"),
                  categoriaId,
                )}
                marcador="Elegí una categoría"
                buscar="Buscar una categoría…"
                sinResultados="No hay ninguna categoría con ese nombre."
                crear={ofrecerCrear("categoria")}
              />
              <FieldError id={`${idBase}-categoryId-error`}>
                {errores.fields.categoryId}
              </FieldError>
            </div>
          </div>

          {/* Cuánto sale. */}
          <Apartado id="precio" titulo="Precio y oferta">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={campo("price").id}>Precio</Label>
                <CampoDePesos>
                  <Input
                    {...campo("price")}
                    // No `type="number"`: la rueda del mouse cambia el valor,
                    // y en castellano el punto es separador de miles.
                    inputMode="decimal"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    className="pl-7 tabular-nums admin:pl-7"
                  />
                </CampoDePesos>
                <FieldError id={`${idBase}-price-error`}>
                  {errores.fields.price}
                </FieldError>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={campo("discount").id}>
                  Descuento{" "}
                  <span className="font-normal text-ink-secondary">
                    (opcional)
                  </span>
                </Label>
                <CampoDePesos>
                  <Input
                    {...campo("discount")}
                    inputMode="decimal"
                    value={descuento}
                    onChange={(e) => setDescuento(e.target.value)}
                    className="pl-7 tabular-nums admin:pl-7"
                  />
                </CampoDePesos>
                <FieldError id={`${idBase}-discount-error`}>
                  {errores.fields.discount}
                </FieldError>
                <FieldHint>Dejalo vacío si no hay oferta.</FieldHint>
              </div>
            </div>

            <ResumenDePrecio vista={vista} />
          </Apartado>

          {/* Cómo se cuenta. */}
          <Apartado
            id="descripcion"
            titulo="Descripción"
            ayuda="Podés usar negrita, cursiva, listas y un subtítulo."
          >
            <EditorDeDescripcion
              id={`${idBase}-description`}
              valorInicial={producto?.description ?? ""}
              refEditor={editor}
              alCambiar={tocarDescripcion}
              invalido={Boolean(errores.fields.description)}
              describedBy={
                errores.fields.description
                  ? `${idBase}-description-error`
                  : undefined
              }
            />
            <FieldError id={`${idBase}-description-error`}>
              {errores.fields.description}
            </FieldError>
          </Apartado>

          {/* Dónde se ve. */}
          <Apartado id="publicacion" titulo="Publicación">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={activo}
                onCheckedChange={(v) => setActivo(v === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm font-medium text-ink">
                  Activo en la tienda
                </span>
                <span className="text-caption text-ink-secondary">
                  Si lo desactivás desaparece del sitio al instante, pero sigue
                  acá y en las órdenes que ya lo incluyen.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3">
              <Checkbox
                checked={destacado}
                onCheckedChange={(v) => setDestacado(v === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm font-medium text-ink">
                  Destacado
                </span>
                <span className="text-caption text-ink-secondary">
                  Se adelanta en la portada y en el catálogo. Destacar no
                  publica: si está inactivo, sigue sin aparecer.
                </span>
              </span>
            </label>
          </Apartado>

          <div ref={errorGeneral} tabIndex={-1} className="outline-none">
            <FieldError>{errores.general}</FieldError>
          </div>

          {/* «Cancelar» es un enlace: no hace nada, va a otro lado. */}
          <PieDeGuardado>
            {/* En el teléfono, en su propio renglón; vacía, en el alta, no
              deja uno en blanco. */}
            <EstadoDeGuardado
              estado={
                producto === null
                  ? null
                  : sinCambios
                    ? "guardado"
                    : "sin-guardar"
              }
              className="max-sm:basis-full max-sm:empty:hidden"
            />
            <Button asChild variant="tertiary">
              <Link href="/admin/productos">Cancelar</Link>
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={enviando}
              loadingLabel="Guardando"
              disabled={sinCambios}
            >
              {producto ? "Guardar cambios" : "Crear producto"}
            </Button>
          </PieDeGuardado>
        </TarjetaDeSeccion>
      </form>

      {/* Afuera del `<form>` aunque vaya por portal: en React los eventos
        suben por el árbol de componentes, y «Crear» enviaría el producto. */}
      {creando ? (
        <EdicionDeItem
          tipo={creando.tipo}
          item={null}
          abierto
          nombreInicial={creando.nombre}
          alCerrar={() => {
            const tipo = creando.tipo;
            setCreando(null);
            // El foco vuelve al selector del que salió.
            requestAnimationFrame(() =>
              document
                .getElementById(
                  `${idBase}-${tipo === "marca" ? "brandId" : "categoryId"}`,
                )
                ?.focus(),
            );
          }}
          alCrear={({ id, name }) => {
            const tipo = creando.tipo;
            setCreadas((antes) => ({
              ...antes,
              [tipo]: [{ id, name, isActive: true }, ...antes[tipo]],
            }));
            if (tipo === "marca") setMarcaId(id);
            else setCategoriaId(id);
          }}
        />
      ) : null}
    </>
  );
}

/** Siempre del mismo alto, para que los campos de abajo no salten. */
function ResumenDePrecio({ vista }: { vista: Vista }) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-14 flex-col justify-center rounded-panel-control bg-surface-sunken px-3 py-2"
    >
      {vista.estado === "incompleto" ? (
        <p className="text-body-sm text-ink-secondary">
          Poné el precio y acá vas a ver cómo queda.
        </p>
      ) : vista.estado === "descuento-invalido" ? (
        <p className="text-body-sm text-danger">
          El descuento tiene que ser menor que el precio.
        </p>
      ) : vista.estado === "sin-oferta" ? (
        <p className="text-body-sm text-ink">
          Se muestra{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(vista.precio)}
          </span>
          , sin oferta.
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-body-sm text-ink">Se muestra</span>
          <span className="text-heading font-semibold tabular-nums text-brand">
            {formatMoney(vista.final)}
          </span>
          <span className="text-body-sm tabular-nums text-ink-secondary line-through">
            {formatMoney(vista.precio)}
          </span>
          {/* Sin «Ahorrás $ X»: la tienda no lo muestra (RN-04c). */}
        </div>
      )}
    </div>
  );
}
