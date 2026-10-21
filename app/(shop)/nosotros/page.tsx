import {
  HandCoins,
  House,
  type LucideIcon,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { OPEN_GRAPH_BASE } from "@/lib/seo";
import { enlaceDeWhatsApp, mensajeDesdeNosotros } from "@/lib/whatsapp";
import { leerLaConfiguracion } from "@/modules/settings/queries";

const DESCRIPCION =
  "AnaVende es el emprendimiento de Ana: empezó en 2020 y hoy vende tecnología nueva, con entrega en Viedma, Carmen de Patagones y alrededores.";

export const metadata: Metadata = {
  title: "Nosotros",
  description: DESCRIPCION,
  alternates: { canonical: "/nosotros" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/nosotros",
    title: "Nosotros",
    description: DESCRIPCION,
  },
};

/**
 * La imagen de Ana. **Hoy es una ilustración provisoria** (2026-10-21): una
 * foto inventada de una persona presentada como «Ana» le mentiría a quien
 * compra si quedara publicada. Para cambiarla, se deja la foto en
 * `public/nosotros/` y se cambia `src` y `alt` acá (4:5, unos 960×1200). Para
 * quitarla, `null`: el texto pasa a ocupar el ancho entero.
 */
const FOTO_DE_ANA: { src: string; alt: string } | null = {
  src: "/nosotros/ana.svg",
  alt: "Ilustración de Ana",
};

/**
 * Cómo empezó, en tres momentos. Lo que está acá lo contó la dueña: arrancó
 * en la pandemia revendiendo de todo y terminó enfocada en tecnología. Lo que
 * no se sabe —el año del cambio, cuántos clientes— no se inventa.
 */
const HISTORIA = [
  {
    cuando: "2020",
    titulo: "Empecé revendiendo un poco de todo",
    texto:
      "En plena pandemia arranqué vendiendo artículos de lo más variados. Fue mi forma de ponerme en marcha, y de aprender qué necesitaba la gente de acá.",
  },
  {
    cuando: "Después",
    titulo: "Me quedé con la tecnología",
    texto:
      "Con el tiempo me fui enfocando en lo que más me pedían: teclados, mouses, auriculares, cables y todo lo que hace falta para trabajar, estudiar y jugar.",
  },
  {
    cuando: "Hoy",
    titulo: "La tienda, también en la web",
    texto:
      "Acá podés ver todo lo que tengo, con el precio y el stock al día, y armar tu pedido a cualquier hora. Del otro lado sigo estando yo.",
  },
];

/**
 * Cómo se trabaja, sacado de lo que la tienda ya promete en otras páginas
 * (RN-10, RF-19, Garantías). **El retiro no dice dónde**: es una casa de
 * familia, y la dirección se pasa sólo a quien ya decidió comprar.
 */
const COMO_TRABAJO: {
  Icono: LucideIcon;
  titulo: string;
  texto: React.ReactNode;
}[] = [
  {
    Icono: PackageCheck,
    titulo: "Todo nuevo, en su caja",
    texto:
      "Lo que vendo es nuevo y viene en su caja original. Elijo cada producto antes de sumarlo a la tienda.",
  },
  {
    Icono: Truck,
    titulo: "Te lo llevo",
    texto:
      "Entrego a domicilio en Viedma, Carmen de Patagones y alrededores. El envío lo coordinamos por WhatsApp.",
  },
  {
    Icono: House,
    titulo: "O pasás a buscarlo",
    texto:
      "Si preferís retirarlo, acordamos día y horario, y te paso la dirección cuando confirmamos la compra.",
  },
  {
    Icono: HandCoins,
    titulo: "El pago, a tu manera",
    texto:
      "La web no cobra: cuando armás tu pedido, coordinamos el pago por WhatsApp con el medio que te quede más cómodo.",
  },
  {
    Icono: ShieldCheck,
    titulo: "Con garantía",
    texto: (
      <>
        Si algo viene con falla de fábrica, lo resolvemos. Está todo en{" "}
        <Link
          href="/legales/garantias"
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Garantías y devoluciones
        </Link>
        .
      </>
    ),
  },
];

/**
 * Nosotros (2026-10-21) — quién está detrás de la tienda, en primera persona.
 *
 * **Habla Ana, y no «la empresa»**: el trato con una persona es lo que la
 * tienda ofrece (PRODUCT.md) y el nombre y el eslogan ya la presentan. Una
 * página impersonal desmentiría las dos cosas.
 *
 * Por ahora el texto está en el código. Si Ana lo quiere cambiar seguido,
 * pasa a editarse desde el panel como las páginas legales (RF-29).
 */
export default async function Nosotros() {
  // Si la base no contesta, la página sale igual y el cierre lleva a
  // Contacto en vez de al WhatsApp.
  const whatsapp = await leerLaConfiguracion()
    .then((c) => c?.whatsappNumber ?? null)
    .catch(() => null);

  return (
    <div className="mx-auto flex w-full max-w-shop flex-col gap-20 px-4 py-10 sm:gap-28 sm:px-6 sm:py-16 lg:px-8">
      <Presentacion />
      <Historia />
      <ComoTrabajo />
      <Cierre whatsapp={whatsapp} />
    </div>
  );
}

function Presentacion() {
  return (
    <section
      aria-labelledby="hola"
      className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-20"
    >
      <div className="flex flex-col gap-6">
        <h1
          id="hola"
          className="text-display text-balance text-ink lg:text-[3.25rem] lg:leading-[1.05]"
        >
          Hola, soy <span className="text-brand">Ana</span>
        </h1>
        <div className="flex max-w-prose flex-col gap-4 text-body-lg text-ink-secondary">
          <p>
            AnaVende es mi emprendimiento. Lo empecé en 2020, en plena pandemia,
            y desde entonces cada producto que ves acá lo elijo yo, y cada
            consulta la respondo yo.
          </p>
          <p>
            Vendo tecnología nueva en Viedma, Carmen de Patagones y alrededores:
            lo que hace falta para trabajar, estudiar y jugar, con la
            tranquilidad de comprarle a alguien que te conoce el nombre.
          </p>
        </div>
      </div>

      {FOTO_DE_ANA ? (
        // La foto inclinada apenas, con el sello encima: el único gesto
        // decorativo de la página, y en la imagen que más tiene que decir.
        <figure className="relative mx-auto w-full max-w-80 lg:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden rounded-card shadow-lg motion-safe:transition-transform motion-safe:duration-300 lg:-rotate-2 lg:hover:rotate-0">
            <Image
              src={FOTO_DE_ANA.src}
              alt={FOTO_DE_ANA.alt}
              fill
              priority
              sizes="(min-width: 1024px) 24rem, 20rem"
              className="object-cover"
            />
          </div>
          <SelloDesde2020 />
        </figure>
      ) : null}
    </section>
  );
}

/** El sello que se apoya en la esquina de la foto. Es texto, no imagen. */
function SelloDesde2020() {
  return (
    <p className="absolute -bottom-5 -left-3 grid size-24 rotate-[-8deg] place-items-center rounded-pill bg-brand text-center text-ink-inverse shadow-brand sm:-left-6 sm:size-28">
      <span className="flex flex-col leading-none">
        <span className="text-caption font-medium tracking-wide uppercase">
          Desde
        </span>
        <span className="text-title tabular-nums">2020</span>
      </span>
    </p>
  );
}

/**
 * Los tres momentos sobre una línea: vertical en el teléfono, horizontal
 * desde `lg`. El punto del último va relleno, porque es donde se está.
 */
function Historia() {
  return (
    <section aria-labelledby="historia" className="flex flex-col gap-10">
      <h2 id="historia" className="text-title text-ink">
        Cómo empezó
      </h2>
      <ol className="relative grid gap-10 lg:grid-cols-3 lg:gap-8">
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-brand-tint-border lg:top-[7px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-0.5 lg:w-auto"
        />
        {HISTORIA.map((h, i) => (
          <li
            key={h.cuando}
            className="relative flex flex-col gap-2 pl-10 lg:pt-10 lg:pl-0"
          >
            <span
              aria-hidden
              className={
                i === HISTORIA.length - 1
                  ? "absolute top-0 left-0 size-4 rounded-pill bg-brand ring-4 ring-brand-tint"
                  : "absolute top-0 left-0 size-4 rounded-pill border-2 border-brand bg-surface"
              }
            />
            <span className="text-body-sm font-semibold text-brand">
              {h.cuando}
            </span>
            <h3 className="text-heading text-ink">{h.titulo}</h3>
            <p className="max-w-prose text-body text-ink-secondary">
              {h.texto}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ComoTrabajo() {
  return (
    <section aria-labelledby="como-trabajo" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="como-trabajo" className="text-title text-ink">
          Cómo trabajo
        </h2>
        <p className="max-w-prose text-body text-ink-secondary">
          Una tienda chica, con las reglas claras desde el principio.
        </p>
      </div>
      {/* Renglones y no tarjetas: son cinco datos para leer de corrido, no
          cinco cosas para elegir. */}
      <ul className="grid gap-x-12 rounded-card bg-surface px-6 shadow-md sm:px-8 md:grid-cols-2">
        {COMO_TRABAJO.map(({ Icono, titulo, texto }) => (
          <li
            key={titulo}
            className="flex gap-4 border-b border-border py-6 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-brand-tint text-brand">
              <Icono aria-hidden className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-body font-medium text-ink">{titulo}</span>
              <span className="text-body-sm text-ink-secondary">{texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * El cierre: el eslogan en su forma canónica (DR §2.4), que es la página
 * donde más sentido tiene, y la invitación a escribir. Sin número cargado no
 * hay botón de WhatsApp (RF-04): queda Contacto.
 */
function Cierre({ whatsapp }: { whatsapp: string | null }) {
  return (
    <section
      aria-labelledby="cierre"
      className="flex flex-col items-center gap-6 rounded-card bg-brand-tint px-6 py-12 text-center sm:px-12 sm:py-16"
    >
      <h2 id="cierre" className="max-w-2xl text-display text-balance text-ink">
        Ana vende, <span className="text-brand">vos elegís</span> la tecnología.
      </h2>
      <p className="max-w-prose text-body-lg text-ink-secondary">
        ¿Te quedó alguna duda, o buscás algo que no está en la tienda? Escribime
        y lo charlamos.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {whatsapp ? (
          <Button asChild variant="secondary" size="lg">
            <a
              href={enlaceDeWhatsApp(whatsapp, mensajeDesdeNosotros())}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconoWhatsApp />
              Escribime por WhatsApp
            </a>
          </Button>
        ) : (
          <Button asChild variant="secondary" size="lg">
            <Link href="/contacto">Escribime</Link>
          </Button>
        )}
        <Button asChild variant="tertiary" size="lg">
          <Link href="/productos">Ver el catálogo</Link>
        </Button>
      </div>
    </section>
  );
}
