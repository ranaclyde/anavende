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
 * Guardar en favoritos (RF-10): corazón solo en la tarjeta, botón «Guardar»
 * en la ficha. Sin sesión es un enlace a ingresar que anota qué se quería
 * guardar y lo guarda al volver (RF-05).
 */

type Forma = "corazon" | "guardar";

type Props = {
  productId: string;
  nombre: string;
  marcado: boolean;
  conSesion: boolean;
  /** A dónde volver después de ingresar, relativa. */
  volver: string;
  forma: Forma;
};

export function BotonFavorito({ conSesion, ...props }: Props) {
  return conSesion ? (
    <Alternar {...props} />
  ) : (
    <IngresarParaGuardar {...props} />
  );
}

/**
 * Cada latido cambia la `key` y reinicia el pulso; en cero no late, así no se
 * mueve al cargar. Late el envoltorio: un `transform` sobre el `<svg>` no
 * siempre se acelera por hardware.
 */
function Corazon({
  marcado,
  latidos = 0,
  className,
}: {
  marcado: boolean;
  latidos?: number;
  className?: string;
}) {
  return (
    <span
      key={latidos}
      aria-hidden
      className={cn("inline-flex", latidos > 0 && "motion-safe:animate-latido")}
    >
      <Heart
        className={cn(
          "transition-colors duration-150",
          marcado ? "fill-brand text-brand" : "",
          className,
        )}
      />
    </span>
  );
}

/** 36px a la vista y 44 de área táctil (`AREA`). */
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
  // Con la baja pedida se ve el estado, pero no se cambia.
  const pausa = propsDePausa(useCuentaEnPausa());

  // El estado propio manda y sigue al del servidor solo cuando ése cambia:
  // guardar no refresca, pero retomar un pendiente sí. Al pintar y no con un
  // efecto, que dibujaría un cuadro con el valor viejo.
  const [delServidor, setDelServidor] = useState(marcado);
  const [actual, setActual] = useState(marcado);
  if (marcado !== delServidor) {
    setDelServidor(marcado);
    setActual(marcado);
  }

  const [anuncio, setAnuncio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latidos, setLatidos] = useState(0);

  // Optimista: si el servidor lo rechaza, vuelve y el motivo queda escrito.
  // Late solo al marcar, para que el movimiento diga cuál de las dos pasó.
  function alternar() {
    const nuevo = !actual;
    setActual(nuevo);
    if (nuevo) setLatidos((n) => n + 1);
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={alternar}
              className={AREA}
              {...pausa}
            >
              <span className={CIRCULO}>
                <Corazon
                  marcado={actual}
                  latidos={latidos}
                  className="size-5"
                />
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
          <Corazon marcado={actual} latidos={latidos} />
          {/*
            El nombre accesible empieza por el texto a la vista, para quien
            maneja con la voz.
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

      {/* Siempre montada: el lector solo anuncia cambios de una región que ya estaba. */}
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
 * La anotación no se espera: la navegación es blanda y la cookie llega antes
 * de que alguien termine de escribir la contraseña.
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
        <span className="sr-only">
          : iniciá sesión para guardarlo en favoritos
        </span>
      </Link>
    </Button>
  );
}

/**
 * Retoma el favorito anotado antes de ingresar (RF-05); lo monta el layout
 * solo cuando hay uno. Si falla no dice nada: el corazón vacío ya es la verdad.
 */
export function RetomarFavorito() {
  const yaSePidio = useRef(false);

  useEffect(() => {
    // En desarrollo React monta dos veces, y dos llamadas leerían la misma cookie.
    if (yaSePidio.current) return;
    yaSePidio.current = true;
    void retomarFavoritoPendiente({});
  }, []);

  return null;
}
