/**
 * Derivación de slugs — RF-18.
 *
 * El slug NO es un campo del formulario: «slug» es jerga y la vendedora no
 * tiene por qué saber qué es (DESIGN-REFERENCE §10). Se deriva del nombre y
 * se muestra como parte de la dirección, para leer, no para completar.
 *
 * Se quitan los acentos porque una dirección con `ñ` o `á` sobrevive mal al
 * copiar y pegar entre WhatsApp, el navegador y el correo.
 */
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
