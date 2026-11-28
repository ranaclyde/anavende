import "server-only";

import { blobatarUri } from "blobatar/uri";

import { urlDeFotoDePerfil } from "@/modules/media/subir";

/**
 * La foto, o un blobatar determinístico del `id` (TECHNICAL-SPEC §5.3). Se
 * calcula en el servidor para que la biblioteca no llegue al navegador; con
 * sus colores y no los de la marca, que apagarían su garantía de contraste.
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
