/**
 * El ícono de WhatsApp — F3.6, DESIGN-REFERENCE §6.3.
 *
 * **Está dibujado a mano y no sale de `lucide-react`**, que es el juego de
 * íconos del proyecto: lucide sacó las marcas de su librería justamente
 * porque un logo ajeno no es un ícono de interfaz —no se puede reescalar el
 * trazo ni recolorear a gusto sin dejar de ser el logo—. Traer una segunda
 * librería de íconos para una sola forma sería un paquete entero por 400
 * bytes de trazado.
 *
 * `currentColor` y no el verde de la marca: §11 mantiene la interfaz
 * acromática y el único color saturado es el burdeos. El verde de WhatsApp
 * acá abriría un segundo acento en la pantalla donde más importa que el
 * precio sea lo único con color.
 *
 * `aria-hidden` fijo: nunca es la única señal de nada — el botón que lo lleva
 * dice «por WhatsApp» con todas las letras.
 */
export function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.98-.14.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07s.89 2.4 1.02 2.57c.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.19.2-.58.2-1.08.14-1.19-.06-.1-.22-.17-.47-.29Z" />
    </svg>
  );
}
