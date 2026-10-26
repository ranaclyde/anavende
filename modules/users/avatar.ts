import "server-only";

import { blobatarUri } from "blobatar/uri";

import { urlDeFotoDePerfil } from "@/modules/media/subir";

/**
 * Qué cara mostrar de una cuenta — F5.9.
 *
 * La foto, si subió una; si no, un **blobatar**: un bicho geométrico que sale
 * del `id` de la cuenta. No es aleatorio sino determinístico —el mismo id da
 * siempre el mismo dibujo—, así que no cambia entre una carga y otra ni hay
 * que guardarlo.
 *
 * **Del `id` y no del nombre ni del email**: los dos se editan, y la cara de
 * alguien no tiene que cambiar porque corrigió un apellido. Con el id además
 * no viaja ningún dato personal adentro del dibujo.
 *
 * **Con los colores que elige la biblioteca** (pedido tuyo del 2026-10-26):
 * el fondo `square` es un tono claro del color del cuerpo, y el círculo lo
 * pone el componente. Pasarle la paleta de la marca apagaría la garantía de
 * contraste de los ojos, que es de la biblioteca.
 *
 * **Se calcula acá, en el servidor**, y al navegador le llega solo la cadena:
 * el encabezado y el menú del panel son componentes de cliente, y generarlo
 * ahí sumaría la biblioteca al JavaScript de todas las páginas para dibujar
 * algo que no cambia. Un `data:` de unos 700 bytes no hace pedido aparte.
 *
 * **Esta es la cara quieta**: el panel y el saludo de «Mi cuenta». La que se
 * mueve al pasar el mouse —el encabezado y «Mis datos»— no puede ser una
 * imagen y la arma `components/shop/cara-animada.tsx`.
 */
export function caraDe(cuenta: {
  id: string;
  avatarKey: string | null;
}): string {
  return (
    urlDeFotoDePerfil(cuenta.avatarKey) ??
    blobatarUri(cuenta.id, { background: "square" })
  );
}
