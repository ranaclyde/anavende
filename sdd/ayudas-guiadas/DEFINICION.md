# Guías de uso — definición

> **Estado:** en el MVP como **F6.6**, con su requisito en
> `FUNCTIONAL-SPEC.md` **RF-36**. Este documento guarda el detalle: los textos,
> lo que se probó de la librería y el porqué de cada decisión.
>
> **Historia corta.** La primera versión, del 2026-10-22, la dejaba solo en
> «Mis compras» y fuera del MVP. Se corrigió el mismo día: el pedido era
> sumar «Mis compras» a la ficha y la compra, y la guía es parte del MVP.

## 1. Qué es y dónde va

Una guía corta hecha con [Driver.js](https://driverjs.com/): oscurece la
página, resalta un elemento y explica en un globo qué es. Se encadenan de 3 a
4 pasos. Es para quien llega por primera vez a una tienda que **no cobra
online**: lo que más confunde no es el catálogo sino cómo se compra.

Va en cuatro pantallas:

- **Ficha de producto:** las dos formas de comprar y que acá no se paga.
- **Checkout:** cómo se recibe, cómo se paga y qué hace confirmar.
- **«Mis compras»:** qué dice el estado de un pedido y dónde se cancela.
- **Detalle de un pedido en preparación:** cómo sigue y dónde arrepentirse.

**No va en el catálogo, la home ni el carrito**: un catálogo con buscador y
filtros lo entiende cualquiera, y una guía ahí es la que todos saltean.

**La confirmación del pedido** (`/orden/[numero]`) tampoco tiene. Su texto ya
dice que se le avisó a la vendedora, que el stock quedó guardado y para qué es
WhatsApp, y es una pantalla que se ve una sola vez y con el sello animado
(F6.3). **Queda a confirmar** si «la compra» la incluía.

## 2. Cuándo aparece

- **La primera vez que se entra a la pantalla**, sola.
- **Una vez por pantalla y por navegador.** Lo visto se anota en
  `localStorage` (`anavende:ayudas:v1`, una lista de ids) y **no en la base**:
  la ficha la mira sobre todo quien no tiene cuenta, y un solo mecanismo para
  todos vale más que no repetirla en un segundo dispositivo. La definición del
  primer día decía «en el perfil»; se cambió al sumar la ficha.
- **Mostrada es vista.** Se anota al abrirse y no al cerrarse: quien la cierra
  en el primer paso no quiere verla de nuevo. Además, Driver.js no avisa el
  cierre si llega durante el fundido de entrada (ver §4).
- **Sin almacenamiento no se abre sola** (navegación privada, almacenamiento
  bloqueado): sin poder anotarla aparecería en cada visita.
- **Si falta un paso obligatorio, no arranca ni se anota**, y espera a una
  visita en la que esté.
- **Se reabre** con «Ver la guía», un botón terciario en el encabezado de cada
  pantalla. En la ficha está en el recuadro «¿Cómo sigue después de comprar?».

## 3. Los recorridos

Los pasos señalan elementos con `data-ayuda="…"`. «Opcional» quiere decir que
si el elemento no está se saltea.

### Ficha (`/productos/[slug]`) — id `ficha`

Arranca **solo con stock**: el paso del carrito es obligatorio, y sin stock
la única salida es WhatsApp, que se explica sola.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | Selector de color (opcional: solo con más de un color) | Elegí el color | Cada color tiene sus fotos y su stock. Al cambiarlo, la página se actualiza sola. |
| 2 | Botón del carrito, con sesión | Agregalo al carrito | Queda guardado en tu cuenta. Cuando confirmes el pedido, te apartamos el stock hasta coordinar el pago. |
| 2 | El mismo botón, sin sesión | Comprá con tu cuenta | Con una cuenta armás el carrito y seguís tus pedidos. Al ingresar, el producto queda agregado. |
| 3 | «Comprá ya por WhatsApp» (opcional) | O escribinos por WhatsApp | Sin cuenta ni carrito: el mensaje ya va con el producto, el color y la cantidad. |
| 4 | «¿Cómo sigue después de comprar?» | Acá no se paga | El pago y la entrega se arreglan por WhatsApp, cuando te confirmamos el stock y el precio. |

### Checkout (`/checkout`) — id `checkout`

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | Las dos opciones de entrega | Cómo lo recibís | Elegí si te lo enviamos o pasás a retirarlo. El envío no se cobra acá: se coordina aparte. |
| 2 | Medios de pago (opcional) | Con qué podés pagar | Son los medios que aceptamos, para que lo sepas de antemano. El pago se hace después, por WhatsApp. |
| 3 | «Confirmar pedido» | Confirmá el pedido | Te guardamos el stock y le avisamos a la vendedora. Todavía no se cobra nada. |

El paso 1 señala las opciones y no la sección entera: con el envío elegido, la
sección trae el formulario de la dirección y en el teléfono mide más que la
pantalla.

### «Mis compras» (`/mi-cuenta/compras`) — id `mis-compras`

Solo con al menos una compra: el estado vacío ya explica qué va a haber.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | La primera compra | Tus pedidos | Están todos, del más nuevo al más viejo, con el precio del día que los hiciste. Tocá uno para ver el detalle. |
| 2 | Su estado | Su estado | En preparación: te guardamos el stock y falta coordinar el pago y la entrega por WhatsApp. Entregada: ya lo tenés. Cancelada: no se cobró nada. |
| 3 | La primera compra, otra vez | Si te arrepentiste | Mientras un pedido está en preparación, lo cancelás desde su detalle. |

### Detalle (`/mi-cuenta/compras/[numero]`) — id `detalle-compra`

**Solo con el pedido en preparación** (`activa` en la base), que es cuando
existen las dos acciones. El botón «Ver la guía» tampoco se dibuja en los
demás estados.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | El estado | Tu pedido está en preparación | Te guardamos el stock. Todavía no se cobró nada. |
| 2 | «Escribir por WhatsApp» (opcional) | Seguí por WhatsApp | Ahí se arreglan el pago y la entrega. El mensaje ya va con tu pedido. |
| 3 | «Cancelar el pedido» | Si te arrepentiste | Cancelalo acá, sin dar explicaciones. Se libera el stock y no se te cobra nada. |

## 4. Lo que se probó de Driver.js

Versión **1.9.0**, fija en `package.json`. La 1.10.2 era la última, pero
había salido cuatro días antes.

**Lo que trae bien:**
- El globo es un `role="dialog"` con título y descripción asociados.
- El foco queda atrapado en el globo y el elemento resaltado.
- Las flechas pasan de paso y Esc cierra.

**Lo que hubo que corregir**, todo en `components/shop/ayuda-guiada.tsx`:

| Problema | Corrección |
|---|---|
| Al cerrar, el foco quedaba en el último elemento resaltado | En `onDestroyed` vuelve a «Ver la guía», diferido: la librería mueve el foco después del gancho |
| Al abrir, el foco caía en la cruz | Va a «Siguiente», también diferido |
| No se marcaba como modal | `aria-modal="true"` |
| El título y el pie son `<header>` y `<footer>`, y se anunciaban como regiones «banner» y «contentinfo» de la página | `role="heading"` con nivel 2 en el título, `role="none"` en el pie |
| Textos en inglés | En español, con «1 de 4» como progreso |
| Botones de 24 a 28px | Con `buttonVariants` de la tienda: «Siguiente» de marca, «Anterior» y la cruz terciarios, con el área táctil de la variante |
| No respeta `prefers-reduced-motion` | `animate: false` con movimiento reducido; el fundido lo corta además la regla global de `globals.css` |
| **El desplazamiento suave dejaba el globo lejos de su elemento**: lo ubica antes de terminar de desplazarse, y en el teléfono un paso fuera de pantalla quedaba pegado al borde de abajo | `smoothScroll: false` siempre, no solo con movimiento reducido |
| **Cerrar durante el fundido de entrada no llama a `onDestroyed`** (Esc a los pocos milisegundos de abrirse) | La guía se anota como vista al abrirse (§2) |

**El CSS de la librería no se importa.** `driver.css` no está en ninguna capa,
así que les ganaría a las utilidades de Tailwind con las que se visten los
botones. Lo que hace funcionar la guía (quién recibe el puntero) y el dibujo
del globo están en `globals.css`, en `@layer components`.

## 5. Cómo se ve

El globo es un diálogo de la tienda:
- **Superficie y forma:** superficie blanca, radio de modal (20px) y `shadow-lg`.
- **Texto:** título en 18px peso 500, texto en 14px secundario, progreso en caption.
- **Botones:** «Siguiente» es el de marca. «Anterior» no se dibuja en el primer paso, en lugar de aparecer apagado.
- **Ancho:** hasta 22rem, y nunca más que la pantalla menos 2rem.
- **Fondo:** se oscurece con la tinta al 55%. El elemento resaltado lleva 8px de aire y 20px de radio.

La tienda no tiene modo oscuro, así que el globo tampoco.

## 6. Pruebas

- **`tests/e2e/ayudas.spec.ts`:**
  - Que aparece la primera vez y no la segunda.
  - Que se recorre con teclado, que Esc la cierra y el foco vuelve a «Ver la guía», y que ese botón la reabre.
  - Que entra a 320px.
  - Que tiene axe sin hallazgos con el globo abierto, medido después del fundido: a mitad, el globo es semitransparente y axe mide contra lo que se ve a través.
- **El resto de los E2E arrancan con las guías vistas** (`tests/e2e/apoyo/test.ts`). Si no, cada recorrido que pasa por esas pantallas tendría que cerrar un globo primero. La opción es del worker y no del test, porque la fixture `context` de Playwright también nace de `browser.newContext`.
