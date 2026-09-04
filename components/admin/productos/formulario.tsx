"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import type { LexicalEditor } from "lexical";

import {
  EditorDeDescripcion,
  leerMarkdown,
} from "@/components/admin/productos/editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { compare, formatMoney, isMoney, subtract } from "@/lib/money";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { slugificar } from "@/lib/slug";
import {
  crearUnProducto,
  editarUnProducto,
} from "@/modules/catalog/products/actions";
import type {
  OpcionDeCatalogo,
  ProductoParaEditar,
} from "@/modules/catalog/products/queries";

/**
 * En el ORDEN EN QUE SE VEN. No es cosmético: al fallar el envío el foco va
 * al primero de esta lista que tenga error, y «el primero» tiene que ser el
 * que está más arriba en la pantalla, no el que quedó primero en el tipo.
 */
const CAMPOS = [
  "name",
  "brandId",
  "categoryId",
  "price",
  "discount",
  "description",
] as const;

type Campo = (typeof CAMPOS)[number];

/**
 * El precio final que se muestra mientras se escribe (RF-15, RN-04b).
 *
 * En la base esto es la columna generada `final_price` y no se recalcula
 * nunca (§7.1). Acá se calcula porque todavía no hay fila que consultar, y se
 * devuelve **el estado completo** —no solo el número— porque el formulario
 * necesita distinguir tres situaciones: no hay datos, hay oferta, y el
 * descuento no entra.
 */
type Vista =
  | { estado: "incompleto" }
  | { estado: "sin-oferta"; precio: string }
  | { estado: "oferta"; precio: string; final: string; ahorro: string }
  | { estado: "descuento-invalido" };

function calcularVista(precio: string, descuento: string): Vista {
  const p = precio.trim().replace(",", ".");
  const d = (descuento.trim() || "0").replace(",", ".");

  if (!isMoney(p) || compare(p, "0.00") <= 0) return { estado: "incompleto" };
  if (!isMoney(d)) return { estado: "incompleto" };
  if (compare(d, "0.00") === 0) return { estado: "sin-oferta", precio: p };
  if (compare(d, p) >= 0) return { estado: "descuento-invalido" };

  return {
    estado: "oferta",
    precio: p,
    final: subtract(p, d),
    ahorro: d,
  };
}

/**
 * Las opciones del selector — RN-11b.
 *
 * Se ofrecen las ACTIVAS, más la que el producto ya tenga puesta aunque esté
 * inactiva. Sin esa excepción, abrir un producto inactivo de marca inactiva
 * mostraría el selector en otra marca y guardar se la cambiaría sin que nadie
 * lo hubiera pedido.
 */
function opcionesVisibles(
  todas: OpcionDeCatalogo[],
  elegida: string,
): OpcionDeCatalogo[] {
  return todas.filter((o) => o.isActive || o.id === elegida);
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
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  const [nombre, setNombre] = useState(producto?.name ?? "");
  const [marcaId, setMarcaId] = useState(producto?.brandId ?? "");
  const [categoriaId, setCategoriaId] = useState(producto?.categoryId ?? "");
  const [precio, setPrecio] = useState(producto?.price ?? "");
  const [descuento, setDescuento] = useState(
    producto && compare(producto.discount, "0.00") > 0 ? producto.discount : "",
  );
  const [destacado, setDestacado] = useState(producto?.isFeatured ?? false);
  const [activo, setActivo] = useState(producto?.isActive ?? true);

  /**
   * La descripción NO es estado de React: vive adentro del editor y se lee al
   * enviar. Guardarla acá obligaría a repintar el formulario entero con cada
   * tecla, para un valor que nadie mira hasta que se guarda.
   */
  const editor = useRef<LexicalEditor | null>(null);

  /**
   * Adónde va el foco cuando el envío falla. Sin esto queda en el botón de
   * guardar, que no dice nada: quien navega por teclado o con lector de
   * pantalla se entera de que algo salió mal y no de dónde. El mensaje se
   * anuncia igual —cada `FieldError` es `role="alert"`—, pero anunciar no es
   * llevar hasta el problema.
   */
  const errorGeneral = useRef<HTMLDivElement | null>(null);

  function irAlPrimerError(nuevos: ErroresDeFormulario<Campo>) {
    const primero = CAMPOS.find((c) => nuevos.campos[c]);

    if (primero) {
      document.getElementById(`${idBase}-${primero}`)?.focus();
      return;
    }
    // Sin campo señalado —RN-11b, un nombre repetido que el servidor no pudo
    // atribuir— el foco va al mensaje, que es lo único que explica qué pasó.
    errorGeneral.current?.focus();
  }

  const vista = useMemo(
    () => calcularVista(precio, descuento),
    [precio, descuento],
  );

  const campo = (nombreDelCampo: Campo) => ({
    id: `${idBase}-${nombreDelCampo}`,
    "aria-invalid": Boolean(errores.campos[nombreDelCampo]) || undefined,
    "aria-describedby": errores.campos[nombreDelCampo]
      ? `${idBase}-${nombreDelCampo}-error`
      : undefined,
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(SIN_ERRORES);

    const datos = {
      name: nombre,
      description: leerMarkdown(editor.current),
      brandId: marcaId,
      categoryId: categoriaId,
      price: precio,
      discount: descuento.trim() || "0",
      isFeatured: destacado,
      isActive: activo,
    };

    iniciar(async () => {
      const resultado = producto
        ? await editarUnProducto({ id: producto.id, ...datos })
        : await crearUnProducto(datos);

      if (!resultado.ok) {
        const nuevos = leerErrores<Campo>(resultado);
        setErrores(nuevos);
        irAlPrimerError(nuevos);
        return;
      }

      // Al EDITAR vuelve al listado: guardar y quedarse en el formulario deja
      // la duda de si se guardó. Al CREAR sigue en la pantalla del producto
      // recién hecho, que es donde están los colores, el stock y las fotos
      // (F2.4): un producto sin variantes no se puede vender, así que mandar
      // al listado sería cortar el trabajo justo antes de la mitad.
      router.push(producto ? "/admin/productos" : `/admin/productos/${resultado.data.id}`);
      router.refresh();
    });
  }

  const marcasVisibles = opcionesVisibles(marcas, marcaId);
  const categoriasVisibles = opcionesVisibles(categorias, categoriaId);

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      {/* ── Qué es ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-heading text-ink">Datos del producto</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo("name").id}>Nombre</Label>
          <Input
            {...campo("name")}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={120}
            autoComplete="off"
            placeholder="Teclado mecánico K120 retroiluminado"
          />
          <FieldError id={`${idBase}-name-error`}>
            {errores.campos.name}
          </FieldError>

          {/* La dirección se muestra para leer, no para completar: «slug» es
              jerga (§10). Al renombrar no cambia, y el aviso lo dice acá en
              vez de dejar que se descubra después. */}
          {producto ? (
            <FieldHint>
              Dirección:{" "}
              <span className="text-ink">/productos/{producto.slug}</span>. No
              cambia al renombrar, para no romper los enlaces que ya
              compartiste.
            </FieldHint>
          ) : nombre.trim() ? (
            <FieldHint>
              Dirección:{" "}
              <span className="text-ink">/productos/{slugificar(nombre)}</span>
            </FieldHint>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("brandId").id}>Marca</Label>
            <Select
              {...campo("brandId")}
              value={marcaId}
              onChange={(e) => setMarcaId(e.target.value)}
            >
              <option value="">Elegí una marca</option>
              {marcasVisibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.isActive ? m.name : `${m.name} (inactiva)`}
                </option>
              ))}
            </Select>
            <FieldError id={`${idBase}-brandId-error`}>
              {errores.campos.brandId}
            </FieldError>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("categoryId").id}>Categoría</Label>
            <Select
              {...campo("categoryId")}
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              <option value="">Elegí una categoría</option>
              {categoriasVisibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isActive ? c.name : `${c.name} (inactiva)`}
                </option>
              ))}
            </Select>
            <FieldError id={`${idBase}-categoryId-error`}>
              {errores.campos.categoryId}
            </FieldError>
          </div>
        </div>
      </section>

      {/* ── Cuánto sale ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-heading text-ink">Precio</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("price").id}>Precio</Label>
            <Input
              {...campo("price")}
              // `inputMode` y no `type="number"`: el número del navegador
              // sube y baja con la rueda del mouse sobre un precio, y en
              // castellano acepta el punto como separador de miles.
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="24500"
              className="tabular-nums"
            />
            <FieldError id={`${idBase}-price-error`}>
              {errores.campos.price}
            </FieldError>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("discount").id}>
              Descuento{" "}
              <span className="font-normal text-ink-secondary">(opcional)</span>
            </Label>
            <Input
              {...campo("discount")}
              inputMode="decimal"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              placeholder="0"
              className="tabular-nums"
            />
            <FieldError id={`${idBase}-discount-error`}>
              {errores.campos.discount}
            </FieldError>
            <FieldHint>
              Es un monto en pesos, no un porcentaje. Dejalo vacío si no hay
              oferta.
            </FieldHint>
          </div>
        </div>

        <ResumenDePrecio vista={vista} />
      </section>

      {/* ── Cómo se cuenta ────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading text-ink">Descripción</h2>
          <p className="text-body-sm text-ink-secondary">
            Se ve en la ficha del producto. Podés usar negrita, cursiva, listas
            y un subtítulo.
          </p>
        </div>

        <EditorDeDescripcion
          id={`${idBase}-description`}
          valorInicial={producto?.description ?? ""}
          refEditor={editor}
          invalido={Boolean(errores.campos.description)}
          describedBy={
            errores.campos.description
              ? `${idBase}-description-error`
              : undefined
          }
        />
        <FieldError id={`${idBase}-description-error`}>
          {errores.campos.description}
        </FieldError>
      </section>

      {/* ── Dónde se ve ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-heading text-ink">Publicación</h2>

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
              Si lo desactivás desaparece del sitio al instante, pero sigue acá
              y en las órdenes que ya lo incluyen.
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
            <span className="text-body-sm font-medium text-ink">Destacado</span>
            <span className="text-caption text-ink-secondary">
              Se adelanta en la portada y en el catálogo. Destacar no publica:
              si está inactivo, sigue sin aparecer.
            </span>
          </span>
        </label>
      </section>

      <div ref={errorGeneral} tabIndex={-1} className="outline-none">
        <FieldError>{errores.general}</FieldError>
      </div>

      {/* En el panel la acción principal va a la derecha, y el escape queda a
          mano: cancelar es un enlace y no un botón, porque no hace nada, va a
          otro lado. */}
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="tertiary">
          <Link href="/admin/productos">Cancelar</Link>
        </Button>
        <Button
          type="submit"
          variant="brand"
          loading={enviando}
          loadingLabel="Guardando"
        >
          {producto ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}

/**
 * El precio final, en vivo (RF-15).
 *
 * Ocupa siempre el mismo alto: si apareciera y desapareciera, los campos de
 * abajo saltarían mientras se escribe.
 */
function ResumenDePrecio({ vista }: { vista: Vista }) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-14 flex-col justify-center rounded-panel-control bg-surface-sunken px-3 py-2"
    >
      {vista.estado === "incompleto" ? (
        <p className="text-body-sm text-ink-tertiary">
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
          <span className="text-body-sm tabular-nums text-ink-tertiary line-through">
            {formatMoney(vista.precio)}
          </span>
          <span className="text-body-sm tabular-nums text-ink-secondary">
            Ahorrás {formatMoney(vista.ahorro)}
          </span>
        </div>
      )}
    </div>
  );
}
