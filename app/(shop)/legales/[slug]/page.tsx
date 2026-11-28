import { Mail, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BloquesDeTexto } from "@/components/shop/texto-con-formato";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { longDate } from "@/lib/dates";
import { OPEN_GRAPH_BASE, metaDescription } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { leerTextoLegal } from "@/modules/content/legales";
import { nodosDeMarkdown } from "@/modules/content/markdown";
import { PAGINAS_LEGALES, paginaLegal } from "@/modules/content/paginas";
import { leerLaConfiguracion } from "@/modules/settings/queries";

type Props = { params: Promise<{ slug: string }> };

// El contacto y el botón de arrepentimiento no van en el Markdown a propósito:
// el contacto sale de la configuración, y un enlace no sobrevive al Markdown
// acotado.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pagina = paginaLegal(slug);
  if (!pagina) return { title: "Página no encontrada" };

  const texto = await leerTextoLegal(pagina.slug);
  const ruta = `/legales/${pagina.slug}`;
  const descripcion = texto
    ? metaDescription(textoPlano(texto.contenido))
    : undefined;

  return {
    title: pagina.titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      url: ruta,
      title: pagina.titulo,
      description: descripcion,
    },
  };
}

export default async function PaginaLegal({ params }: Props) {
  const { slug } = await params;
  const pagina = paginaLegal(slug);
  if (!pagina) notFound();

  const [texto, configuracion] = await Promise.all([
    leerTextoLegal(pagina.slug),
    leerLaConfiguracion(),
  ]);
  if (!texto) notFound();

  const nodos = nodosDeMarkdown(texto.contenido);

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
        <article
          aria-labelledby="titulo"
          className="flex min-w-0 max-w-prose flex-1 flex-col gap-8"
        >
          <header className="flex flex-col gap-2">
            <h1 id="titulo" className="text-title text-ink">
              {pagina.titulo}
            </h1>
            <p className="text-body-sm text-ink-secondary">
              Actualizada el{" "}
              <time dateTime={texto.actualizada.toISOString()}>
                {longDate(texto.actualizada)}
              </time>
            </p>
          </header>

          {pagina.slug === "garantias" ? <Arrepentimiento /> : null}

          {/* 18px: se lee de corrido, y en el teléfono 16px de gris cansa (DR §3.3). */}
          <div className="flex flex-col gap-5 text-body-lg text-ink-secondary">
            <BloquesDeTexto
              nodos={nodos}
              subtitulo={{
                nivel: "h2",
                className: "mt-5 text-heading text-ink first:mt-0",
              }}
            />
          </div>

          {configuracion ? (
            <Contacto
              titulo={pagina.titulo}
              whatsapp={configuracion.whatsappNumber}
              email={configuracion.adminNotificationEmail}
            />
          ) : null}
        </article>

        <OtrasPaginas actual={pagina.slug} />
      </div>
    </div>
  );
}

/**
 * Va arriba y no al final: quien llega para arrepentirse no tiene que leer la
 * garantía entera para encontrarlo.
 */
function Arrepentimiento() {
  return (
    <section
      aria-labelledby="arrepentimiento"
      className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="arrepentimiento" className="text-body font-medium text-ink">
          ¿Te arrepentiste de una compra?
        </h2>
        <p className="text-body-sm text-ink-secondary">
          Si el pedido sigue activo, lo cancelás desde Mis compras.
        </p>
      </div>
      <Button asChild variant="secondary" className="shrink-0">
        <Link href="/mi-cuenta/compras">
          <Undo2 aria-hidden />
          Ir a Mis compras
        </Link>
      </Button>
    </section>
  );
}

function Contacto({
  titulo,
  whatsapp,
  email,
}: {
  titulo: string;
  whatsapp: string;
  email: string;
}) {
  return (
    <section
      aria-labelledby="contacto"
      className="flex flex-col gap-4 border-t border-border pt-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="contacto" className="text-heading text-ink">
          ¿Te quedó una duda?
        </h2>
        <p className="text-body text-ink-secondary">
          Escribinos por WhatsApp o por email y te respondemos nosotros.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild variant="secondary">
          <a
            href={whatsappLink(
              whatsapp,
              `Hola, tengo una consulta sobre «${titulo}».`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconoWhatsApp aria-hidden />
            Escribir por WhatsApp
          </a>
        </Button>
        <Button asChild variant="secondary" className="min-w-0">
          <a href={`mailto:${email}`}>
            <Mail aria-hidden />
            <span className="truncate">{email}</span>
          </a>
        </Button>
      </div>
    </section>
  );
}

function OtrasPaginas({ actual }: { actual: string }) {
  return (
    <nav aria-label="Información" className="lg:w-60 lg:shrink-0">
      <h2 className="text-caption tracking-wide text-ink-secondary uppercase">
        Información
      </h2>
      <ul className="mt-3 flex flex-col">
        {PAGINAS_LEGALES.map((p) => {
          const esLaActual = p.slug === actual;
          return (
            <li key={p.slug}>
              <Link
                href={`/legales/${p.slug}`}
                aria-current={esLaActual ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-l-2 pl-3 text-body-sm transition-colors duration-150 lg:min-h-9",
                  esLaActual
                    ? "border-brand font-medium text-ink"
                    : "border-border text-ink-secondary hover:border-border-strong hover:text-ink",
                )}
              >
                {p.titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function textoPlano(markdown: string): string {
  return markdown.replace(/[*#_]/g, "").replace(/^- /gm, "");
}
