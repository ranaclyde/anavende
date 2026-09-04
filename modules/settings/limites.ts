/**
 * Los números del umbral de stock bajo — RF-20, §10.3.
 *
 * Viven aparte de `schemas.ts` por el mismo motivo que los del texto con
 * formato (`modules/content/limites.ts`), aunque el motivo acá sea otro:
 * `schemas.ts` importa Zod, y el formulario necesita estos tres valores para
 * comprobar la forma del campo ANTES de enviar. Traerlos desde el esquema
 * arrastraría Zod entero al navegador por una constante de texto.
 *
 * Y son una constante y no dos mensajes parecidos: el esquema y el
 * formulario dicen la MISMA frase, así que escribir «tres» y escribir «0»
 * no pueden explicar la misma regla con dos redacciones.
 */

/**
 * Mínimo 1 y no 0: con 0 el aviso no se enciende nunca y «sin stock» ya
 * cubre ese caso, así que sería una forma escondida de apagar una función en
 * vez de configurarla.
 */
export const UMBRAL_MINIMO = 1;

/**
 * Máximo 100 porque el aviso sirve para separar lo que hay que reponer de lo
 * que no: un umbral que alcanza a todo el catálogo no señala nada.
 */
export const UMBRAL_MAXIMO = 100;

/** La regla entera, en una frase. Se deriva de los topes y no los repite. */
export const AYUDA_DEL_UMBRAL =
  `Escribí un número entero del ${UMBRAL_MINIMO} al ${UMBRAL_MAXIMO}: ` +
  "es a partir de cuántas unidades querés el aviso.";

/**
 * La forma que el esquema espera recibir: dígitos y nada más, hasta tres
 * cifras. Lo que no la cumpla no se manda —`Number.parseInt("3,5")` daría 3
 * y guardaría en silencio un número que nadie escribió—, y el 101 sí se
 * manda, para que el servidor conteste por qué no entra.
 */
export const ENTERO = /^\d{1,3}$/;
