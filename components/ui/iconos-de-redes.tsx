import { cn } from "@/lib/utils";

/**
 * Los íconos de Instagram y Facebook, para el pie de la tienda (2026-10-20).
 *
 * **Dibujados a mano, por lo mismo que el de WhatsApp** (`icono-whatsapp.tsx`):
 * lucide todavía los trae, pero marcados como deprecados y con fecha de salida
 * en su 1.0, porque un logo ajeno no es un ícono de interfaz.
 *
 * En `currentColor` y no en el color de cada marca: viven sobre el pie oscuro,
 * en el mismo blanco atenuado que los enlaces de al lado. El verde de WhatsApp
 * es la excepción porque es un botón de acción (§2.6); estos son señas.
 *
 * `aria-hidden` fijo: el enlace que los lleva dice a dónde va.
 */
export function IconoInstagram({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={cn(className)}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoFacebook({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(className)}
    >
      <path d="M9.1 23.69v-7.98H6.63v-3.67H9.1v-1.58c0-4.09 1.85-5.98 5.86-5.98.4 0 .96.04 1.47.1.39.04.77.11 1.14.2v3.32a8.6 8.6 0 0 0-.65-.03 27 27 0 0 0-.73-.01c-.71 0-1.26.1-1.68.31-.28.14-.51.36-.68.62-.26.42-.37 1-.37 1.75v1.3h3.92l-.39 2.1-.29 1.57h-3.24v8.24C19.4 23.24 24 18.18 24 12.04c0-6.62-5.37-12-12-12s-12 5.38-12 12c0 5.63 3.87 10.35 9.1 11.65Z" />
    </svg>
  );
}
