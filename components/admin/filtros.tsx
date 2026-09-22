"use client";

import { Search, X } from "lucide-react";
import { useId, useRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Las tres piezas que comparten las barras de filtros del panel — órdenes,
 * usuarios, productos y devoluciones.
 *
 * Estaban copiadas: el buscador tres veces, el rango de fechas dos y el
 * contador cuatro. Cada copia era correcta; el problema es que ninguna sabía
 * de las otras, así que un arreglo hecho en una se quedaba ahí — y la próxima
 * pantalla con filtros iba a nacer sin ninguno.
 */

/**
 * El campo de búsqueda de los listados del panel — DR §6.2 y §6.9.
 *
 * Estaba **copiado literal en las tres barras de filtros** —órdenes, usuarios
 * y productos—, unas cuarenta líneas cada una, con los dos manejadores
 * (`buscar` y `limpiarBusqueda`) idénticos carácter por carácter. Lo único que
 * cambiaba era el rótulo y el marcador. Lo peor de tenerlo copiado no era el
 * largo: era que **las tres copias cargan tres arreglos que no se ven**, y que
 * la próxima pantalla con buscador iba a nacer sin alguno de ellos.
 *
 * Los tres arreglos, que ahora viven acá una sola vez:
 *
 * 1. **`admin:pl-9` además de `pl-9`.** `Input` trae su propio `admin:px-3`,
 *    que le gana a un `pl-*` suelto —misma especificidad, y las variantes van
 *    después—, así que sin repetirlo en la escala del panel **la lupa se
 *    apoya sobre la primera letra**.
 * 2. **La cruz del navegador se retira.** `type="search"` dibuja la suya, que
 *    no se puede enfocar con el teclado ni tiene nombre accesible; acá la
 *    limpieza es un botón propio.
 * 3. **`role="search"` envuelve la búsqueda y nada más.** Alrededor de toda
 *    la barra anunciaría los filtros como parte del buscador, que es
 *    justamente lo que no son.
 *
 * **El texto lo gobierna quien lo usa**, y no este componente: es parte del
 * estado de la barra —«Limpiar todo» también lo borra— y esconderlo acá
 * adentro dejaría ese botón sin forma de vaciar el campo.
 */
export function BuscadorDelPanel({
  etiqueta,
  marcador,
  texto,
  alEscribir,
  alBuscar,
}: {
  /** Lo que lee un lector de pantalla. Dice por qué campos busca. */
  etiqueta: string;
  /** El marcador visible. Termina en «…» porque la frase sigue al escribir. */
  marcador: string;
  texto: string;
  alEscribir: (texto: string) => void;
  /**
   * Con lo que hay que buscar, ya recortado. Se llama al enviar y también al
   * limpiar, con la cadena vacía: para la barra son la misma operación.
   */
  alBuscar: (texto: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        alBuscar(texto.trim());
      }}
      className="relative min-w-0 flex-1 md:min-w-64"
    >
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>

      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
      />

      <Input
        id={id}
        ref={campo}
        type="search"
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        placeholder={marcador}
        className={cn(
          "pl-9 admin:pl-9",
          texto ? "pr-10 admin:pr-10" : "",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {texto === "" ? null : (
        <button
          type="button"
          onClick={() => {
            alEscribir("");
            // El foco vuelve al campo: quien limpió va a escribir otra cosa,
            // y el botón que acaba de tocar dejó de existir — sin esto el
            // foco se cae al `<body>`.
            campo.current?.focus();
            alBuscar("");
          }}
          className={cn(
            "absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center",
            "rounded-panel-control text-ink-tertiary transition-colors duration-150",
            "hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Limpiar la búsqueda</span>
        </button>
      )}

      {/* Enter alcanza; el botón existe para que el formulario tenga un envío
          explícito y el lector de pantalla sepa cómo se manda. */}
      <button type="submit" className="sr-only">
        Buscar
      </button>
    </form>
  );
}

/**
 * El rango de fechas de los listados — copiado idéntico en órdenes y en
 * devoluciones.
 *
 * **Se apilan en el teléfono, y no es un gusto:** un campo de fecha nativo no
 * baja de unos 130px, y dos con sus rótulos en una línea de 390px desbordaban
 * la pantalla 156px hacia la derecha. Lo encontró el repaso de F7.1.
 *
 * **No hay botón de limpiar:** el navegador manda `""` al borrar la fecha, que
 * es exactamente el valor de «sin filtro».
 */
export function RangoDeFechas({
  desde,
  hasta,
  alCambiar,
  porQueFecha,
}: {
  desde: string;
  hasta: string;
  alCambiar: (cambio: { desde: string } | { hasta: string }) => void;
  /**
   * Qué fecha se está recortando, cuando depende de dónde se esté parado. En
   * órdenes cambia con la solapa (F7.8): en «Finalizadas» el rango mira cuándo
   * se entregó y no cuándo se cargó. Sin decirlo, la misma pareja de campos da
   * resultados distintos y nadie sabe por qué (§8). Devoluciones no lo pasa
   * porque ahí hay una sola fecha posible.
   */
  porQueFecha?: string;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Campo
        id={`${id}-desde`}
        etiqueta="Desde"
        ayuda={porQueFecha}
        valor={desde}
        alCambiar={(v) => alCambiar({ desde: v })}
      />
      <Campo
        id={`${id}-hasta`}
        etiqueta="Hasta"
        valor={hasta}
        alCambiar={(v) => alCambiar({ hasta: v })}
      />

      {porQueFecha ? (
        <p className="text-caption text-ink-secondary sm:ml-1">
          Por {porQueFecha}
        </p>
      ) : null}
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor={id}
        title={ayuda ? `Por ${ayuda}` : undefined}
        className="shrink-0 text-body-sm text-ink-secondary"
      >
        {etiqueta}
      </label>
      <Input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="min-w-0 flex-1 sm:w-40 sm:flex-none"
      />
    </div>
  );
}

/**
 * Cuántos quedaron — el renglón de abajo de las cuatro barras.
 *
 * **Se anuncia** (`aria-live`): quien no ve la lista tiene que enterarse igual
 * de cuántos quedaron (§9). Mientras la navegación está en curso dice
 * «Buscando…» y se atenúa, porque el número de atrás ya no es el de ahora y
 * dejarlo firme sería mentir por un instante.
 */
export function ContadorDeResultados({
  pendiente,
  children,
}: {
  pendiente: boolean;
  /** El número ya redactado: «12 productos», «3 de 40». */
  children: React.ReactNode;
}) {
  return (
    <p
      aria-live="polite"
      // Sin `opacity` mientras busca (§3.1, 2026-09-22): apagar el texto lo
      // bajaba a 2,6:1 justo cuando dice algo. Que esté buscando ya lo dice
      // la palabra, que es lo que se anuncia además por `aria-live`.
      className="text-body-sm text-ink-secondary"
    >
      {pendiente ? "Buscando…" : children}
    </p>
  );
}
