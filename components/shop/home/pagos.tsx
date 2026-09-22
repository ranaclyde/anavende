import Image from "next/image";

import type { MedioDePagoDeLaHome } from "@/modules/catalog/products/home";

/**
 * La hilera de medios de pago de la home — RF-01, RF-19 · §7.1. Tarea F3.7.
 *
 * **Gira, y con `prefers-reduced-motion` se queda quieta.** No hace falta
 * pedirlo acá: la regla global de `globals.css` deja las animaciones en
 * 0,01ms con una sola vuelta, así que el que pidió menos movimiento ve la
 * hilera detenida en vez de detenida a los tirones.
 *
 * **La lista va duplicada**, y la segunda copia es `aria-hidden`: sin ella el
 * bucle muestra un hueco del ancho de la pantalla cada vez que reinicia. Lo
 * que se duplica es el dibujo, no la información — un lector de pantalla lee
 * los medios una vez.
 *
 * **Cada logo va sobre `--logo-chip`, un fondo claro que no se invierte**
 * (§6.10): un logo ajeno llega casi siempre como trazo oscuro sobre
 * transparente, y acá no se lo puede repintar.
 *
 * **Sólo entran los que tienen logo**, y esa decisión es de la consulta: un
 * nombre suelto en una fila de imágenes se lee como una que no cargó. Los que
 * no tienen siguen estando donde importan, que es la ficha (§7.3).
 */
export function HileraDePagos({ medios }: { medios: MedioDePagoDeLaHome[] }) {
  if (medios.length === 0) return null;

  const vuelta = [...medios, ...medios];

  return (
    <section aria-labelledby="medios-de-pago" className="flex flex-col gap-4">
      <h2
        id="medios-de-pago"
        className="text-caption font-medium tracking-wide text-ink-secondary uppercase"
      >
        Medios de pago
      </h2>

      {/* El degradado de los bordes evita que los logos aparezcan y
          desaparezcan de golpe contra el borde de la pantalla. */}
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)]">
        <ul className="flex w-max animate-hilera items-center gap-3">
          {vuelta.map((medio, i) => {
            const repetido = i >= medios.length;
            return (
              <li
                key={`${medio.id}-${i}`}
                aria-hidden={repetido || undefined}
                // `bg-surface` y borde, no `--logo-chip`: ese token vale
                // #f2f4f5, que es el mismo color del lienzo de la tienda, así
                // que la píldora no se veía y los logos flotaban sueltos.
                className="grid h-16 w-32 shrink-0 place-items-center rounded-image border border-border bg-surface px-4"
              >
                <Image
                  src={medio.logoUrl}
                  alt={repetido ? "" : medio.nombre}
                  width={96}
                  height={48}
                  className="h-10 w-full object-contain"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
