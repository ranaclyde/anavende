"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  propsDePausa,
  useCuentaEnPausa,
} from "@/components/shop/cuenta-en-pausa";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  cambiarFavorito,
  recordarFavoritoPendiente,
  retomarFavoritoPendiente,
} from "@/modules/users/favoritos/actions";

/**
 * Guardar en favoritos — F5.4, RF-10, DESIGN-REFERENCE §6.1, §7.3.
 *
 * **La misma acción, dibujada distinto a propósito** (§7.3): en la tarjeta es
 * el corazón solo, arriba a la derecha de la imagen, porque en una grilla es
 * lo único que entra; en la ficha es el botón «Guardar», al lado de
 * «Compartir», porque ahí hay lugar para la palabra. En las dos: contorno sin
 * marcar y relleno `--brand` marcado —el burdeos y no un rosa: §1.2 decidió
 * un solo color saturado—.
 *
 * **El estado no se dice solo con el relleno** (RF-10, §9): la etiqueta dice
 * qué va a pasar al tocarlo —«Guardar…» o «Quitar…»— y una región viva
 * anuncia lo que pasó.
 *
 * **Sin sesión es un enlace a ingresar**, como «Iniciá sesión para comprar»
 * (F5.7): anota qué se quería guardar y, al volver, queda guardado (RF-05).
 */

type Forma = "corazon" | "guardar";

type Props = {
  productId: string;
  /** Para la etiqueta: «Guardar Teclado K120 en favoritos». */
  nombre: string;
  marcado: boolean;
  conSesion: boolean;
  /** A dónde volver después de ingresar, relativa (RF-10: sin perder la navegación). */
  volver: string;
  forma: Forma;
};

export function BotonFavorito({ conSesion, ...props }: Props) {
  return conSesion ? <Alternar {...props} /> : <IngresarParaGuardar {...props} />;
}

function Corazon({ marcado, className }: { marcado: boolean; className?: string }) {
  return (
    <Heart
      aria-hidden
      className={cn(
        "transition-colors duration-150",
        marcado ? "fill-brand text-brand" : "",
        className,
      )}
    />
  );
}

/**
 * El círculo de la tarjeta: 36px a la vista y 44 de área táctil (§6.1, §9),
 * con la superficie al 92% detrás, porque la foto de abajo puede ser de
 * cualquier color.
 */
const CIRCULO =
  "grid size-9 place-items-center rounded-full bg-surface/92 text-ink shadow-sm group-focus-visible/favorito:shadow-focus motion-safe:transition-transform motion-safe:group-active/favorito:scale-90";

const AREA =
  "group/favorito grid size-11 place-items-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50";

function Alternar({
  productId,
  nombre,
  marcado,
  forma,
}: Omit<Props, "conSesion">) {
  const [, iniciar] = useTransition();
  // Con la baja pedida (F5.8) se ve el estado, pero no se cambia.
  const pausa = propsDePausa(useCuentaEnPausa());

  /*
   * El estado propio manda, y sigue al del servidor solo cuando ése cambia.
   * Guardar no refresca la pantalla (ver `modules/users/favoritos/actions`),
   * así que el servidor no se entera de cada toque; pero al retomar un
   * favorito pendiente sí refresca, y ahí el corazón tiene que llenarse. Se
   * resuelve al pintar y no con un efecto, que dibujaría un cuadro con el
   * valor viejo.
   */
  const [delServidor, setDelServidor] = useState(marcado);
  const [actual, setActual] = useState(marcado);
  if (marcado !== delServidor) {
    setDelServidor(marcado);
    setActual(marcado);
  }

  const [anuncio, setAnuncio] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Optimista: el corazón se llena al tocarlo, no cuando vuelve el servidor.
  // Si el servidor lo rechaza, vuelve a como estaba y el motivo queda escrito.
  function alternar() {
    const nuevo = !actual;
    setActual(nuevo);
    setError(null);
    setAnuncio("");

    iniciar(async () => {
      const r = await cambiarFavorito({ productId, marcado: nuevo });
      if (r.ok) {
        setAnuncio(nuevo ? "Guardado en favoritos" : "Quitado de favoritos");
      } else {
        setActual(!nuevo);
        setError(r.message);
      }
    });
  }

  return (
    <div className={cn("relative", forma === "guardar" && "flex flex-1")}>
      {forma === "corazon" ? (
        // El ícono solo no dice qué hace: el tooltip lo dice para quien ve,
        // y la etiqueta con el nombre del producto, para quien escucha.
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={alternar} className={AREA} {...pausa}>
              <span className={CIRCULO}>
                <Corazon marcado={actual} className="size-5" />
              </span>
              <span className="sr-only">
                {actual
                  ? `Quitar ${nombre} de favoritos`
                  : `Guardar ${nombre} en favoritos`}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {actual ? "Quitar de favoritos" : "Guardar en favoritos"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="secondary"
          size="md"
          onClick={alternar}
          className="flex-1"
          {...pausa}
        >
          <Corazon marcado={actual} />
          {/*
            Lo que se ve es el estado —«Guardado»— y lo que se oye además dice
            qué pasa al tocarlo. El nombre accesible empieza por el texto a la
            vista, así quien maneja la voz puede decir «Guardado» y acertar.
          */}
          {actual ? (
            <>
              Guardado
              <span className="sr-only">: tocá para quitarlo de favoritos</span>
            </>
          ) : (
            <>
              Guardar<span className="sr-only"> en favoritos</span>
            </>
          )}
        </Button>
      )}

      {/*
        La región viva existe SIEMPRE, vacía hasta que haya algo que decir: un
        lector de pantalla solo anuncia cambios de una región que ya estaba.
      */}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {error === null ? null : (
        <p
          role="alert"
          className="absolute top-full right-0 z-20 mt-1 w-max max-w-48 rounded-card bg-surface px-3 py-1.5 text-caption text-danger shadow-md"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Sin sesión: un enlace a ingresar que, al pasar, deja anotado qué se quería
 * guardar. La llamada no se espera, por lo mismo que en «Iniciá sesión para
 * comprar» (`components/shop/ficha/compra.tsx`): la navegación es blanda y la
 * cookie llega mucho antes de que alguien termine de escribir la contraseña.
 */
function IngresarParaGuardar({
  productId,
  nombre,
  volver,
  forma,
}: Omit<Props, "conSesion" | "marcado">) {
  const href = `/ingresar?volver=${encodeURIComponent(volver)}`;
  const anotar = () => {
    void recordarFavoritoPendiente({ productId });
  };

  if (forma === "corazon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} onClick={anotar} className={AREA}>
            <span className={CIRCULO}>
              <Corazon marcado={false} className="size-5" />
            </span>
            <span className="sr-only">
              Iniciá sesión para guardar {nombre} en favoritos
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>Guardar en favoritos</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button asChild variant="secondary" size="md" className="flex-1">
      <Link href={href} onClick={anotar}>
        <Corazon marcado={false} />
        Guardar
        <span className="sr-only">: iniciá sesión para guardarlo en favoritos</span>
      </Link>
    </Button>
  );
}

/**
 * Retoma el favorito anotado antes de ingresar (RF-05). Lo monta el layout de
 * la tienda solo cuando hay uno, así que funciona en la pantalla a la que se
 * vuelva: el catálogo, con sus filtros, o la ficha.
 *
 * **Si falla, no dice nada.** Lo único que puede salir mal es que el producto
 * se haya desactivado mientras la persona ingresaba; el corazón queda vacío,
 * que es la verdad, y no hay otra cosa que ofrecerle. El carrito sí lo cuenta
 * (F5.7) porque ahí se pierde una compra, y acá no se pierde nada.
 */
export function RetomarFavorito() {
  const yaSePidio = useRef(false);

  useEffect(() => {
    // Un `ref`: en desarrollo React monta dos veces, y dos llamadas a la vez
    // alcanzan a leer la misma cookie antes de que la primera la borre.
    if (yaSePidio.current) return;
    yaSePidio.current = true;
    void retomarFavoritoPendiente({});
  }, []);

  return null;
}
