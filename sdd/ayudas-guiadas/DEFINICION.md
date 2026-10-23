# Guías de uso — definición

> **Estado:** en el MVP como **F6.6** (la tienda, `FUNCTIONAL-SPEC.md`
> **RF-36**) y **F6.7** (el panel, **RF-37**, §7 de este documento). Este
> documento guarda el detalle: los textos, lo que se probó de la librería y el
> porqué de cada decisión.
>
> **Historia corta.** La primera versión, del 2026-10-22, la dejaba solo en
> «Mis compras» y fuera del MVP. Se corrigió el mismo día: el pedido era
> sumar «Mis compras» a la ficha y la compra, y la guía es parte del MVP.

## 1. Qué es y dónde va

Una guía corta hecha con [Driver.js](https://driverjs.com/): oscurece la
página, resalta un elemento y explica en un globo qué es. Se encadenan de 2 a
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
(F6.3). **Decisión tuya del 2026-10-22: no lleva guía.**

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

**Cómo están escritos** (revisados el 2026-10-22, a pedido tuyo: más
amistosos y sin repetir). Cada paso dice algo que la pantalla **no** dice al
lado de lo que señala. Ejemplos: el encabezado del checkout ya avisa que no se
cobra nada, así que ningún paso lo repite; la bajada de «Mis compras» ya
explica el orden y los precios; la frase debajo del estado del detalle ya
explica qué quiere decir. Hablan de vos, usan la primera persona del plural
cuando es la tienda la que hace algo, y no repiten el título de la sección
que señalan.

### Ficha (`/productos/[slug]`) — id `ficha`

Arranca **solo con stock**: el paso del carrito es obligatorio, y sin stock
la única salida es WhatsApp, que se explica sola.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | Selector de color (opcional: solo con más de un color) | Elegí tu color | Cada color tiene sus propias fotos y su stock, así ves exactamente lo que te llevás. |
| 2 | Botón del carrito, con sesión | Sumalo al carrito | Juntá todo lo que quieras y, cuando confirmes el pedido, te lo guardamos. |
| 2 | El mismo botón, sin sesión | Comprá con tu cuenta | Ingresá o creá tu cuenta y este producto te espera en el carrito. Además, vas a poder seguir tus pedidos. |
| 3 | «Comprá ya por WhatsApp» (opcional) | ¿Preferís escribirnos? | Comprá directo por WhatsApp, sin cuenta. El mensaje sale armado con el producto, el color y la cantidad. |
| 4 | «¿Cómo sigue después de comprar?» | Acá no se paga nada | Pagás recién cuando hablemos por WhatsApp. En este recuadro te contamos cómo sigue todo. |

### Checkout (`/checkout`) — id `checkout`

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | Las dos opciones de entrega | ¿Envío o retiro? | Te lo llevamos o pasás a buscarlo, como te quede mejor. El costo del envío lo charlamos por WhatsApp. |
| 2 | Medios de pago (opcional) | ¿Con qué pagás? | Para que vayas viendo cuál te queda más cómodo. Lo elegís cuando coordinamos. |
| 3 | «Confirmar pedido» | Último paso | Al confirmar te guardamos lo que elegiste y le avisamos a la vendedora. Después seguimos por WhatsApp. |

El paso 1 señala las opciones y no la sección entera: con el envío elegido, la
sección trae el formulario de la dirección y en el teléfono mide más que la
pantalla.

### «Mis compras» (`/mi-cuenta/compras`) — id `mis-compras`

Solo con al menos una compra: el estado vacío ya explica qué va a haber.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | La primera compra | Todo lo que pediste | Tocá un pedido para escribirnos sobre él o, si cambiaste de idea, cancelarlo. |
| 2 | Su estado | ¿En qué anda? | «En preparación» quiere decir que te lo estamos guardando mientras coordinamos. Cuando lo recibís, pasa a «Entregada». |

Eran tres pasos; el tercero señalaba otra vez la primera compra para decir
dónde se cancela, y eso entró en el primero.

### Detalle (`/mi-cuenta/compras/[numero]`) — id `detalle-compra`

**Solo con el pedido en preparación** (`activa` en la base), que es cuando
existen las dos acciones. El botón «Ver la guía» tampoco se dibuja en los
demás estados.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | «Escribir por WhatsApp» (opcional) | Seguimos por WhatsApp | Escribinos desde acá: el mensaje ya lleva tu pedido, así no tenés que explicar nada. |
| 2 | «Cancelar el pedido» | ¿Cambiaste de idea? | Mientras esté en preparación lo podés cancelar, sin dar explicaciones. No se te cobra nada. |

El paso del estado se sacó: la frase debajo de la etiqueta ya dice que el
stock está guardado hasta coordinar.

## 4. Lo que se probó de Driver.js

Versión **1.9.0**, fija en `package.json`. La 1.10.2 era la última, pero
había salido cuatro días antes.

**Lo que trae bien:**
- El globo es un `role="dialog"` con título y descripción asociados.
- El foco queda atrapado en el globo y el elemento resaltado.
- Las flechas pasan de paso y Esc cierra.

**Lo que hubo que corregir**, todo en `components/ui/ayuda-guiada.tsx`:

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

## 7. El panel (F6.7)

Pedido del 2026-10-23: las cuatro pantallas de abajo, **en el MVP como F6.7**,
y **lo visto se anota en el navegador**, igual que en la tienda (las dos
decisiones son tuyas, del mismo día). Se evaluó guardarlo en la base: en el
panel siempre hay sesión, y la guía no se repetiría en otro dispositivo. No
vale una columna, una acción del servidor y un segundo mecanismo, por una
guía que se ve una vez más en el teléfono.

### 7.1 Dónde va y dónde no

Cada una va donde **una acción mueve el stock o no se puede deshacer**. El
panel lo usa una sola persona que ya lo conoce, así que la guía es sobre todo
para una segunda cuenta de administradora (RF-26) y para lo que se hace poco.

- **Detalle de una orden activa:** cómo se ajusta, cómo se le avisa al
  comprador y qué cambia al resolverla.
- **Nueva orden manual:** qué pasa si se vendió más de lo que figura y cuándo
  dejarla activa.
- **Edición de un producto:** cuál de los tres números de stock manda y qué
  se escribe al corregirlo.
- **Devoluciones:** de dónde salen, qué cambia entre las que vuelven al stock
  y las que no, y qué se hace con una mal cargada.

**No va en el inicio ni en reportes**, que son para mirar. **Tampoco en
categorías, marcas, colores, medios de pago, legales, configuración ni
usuarios**: son altas y bajas que se entienden solas. **Tampoco en «Nuevo
producto»**: es un formulario de datos y precio, y su bajada ya dice que los
colores, el stock y las fotos vienen después.

### 7.2 Cómo están escritos

Valen las reglas de §3, con un cambio: **en el panel nadie habla como
«nosotros»**. En la tienda «nosotros» es la tienda y le habla al comprador;
acá quien lee es la tienda. La guía le habla de vos a la vendedora, y lo que
hace el sistema se dice en impersonal.

**Lo que ya dice cada pantalla, y por eso la guía no repite:**
- **El detalle de una orden activa** tiene un párrafo arriba que explica que
  se ajusta desde la tabla, que lo quitado vuelve al stock, que finalizar
  descuenta y que ni finalizar ni cancelar tienen vuelta atrás.
- **El alta manual** tiene la bajada, el aviso de que el precio se puede
  cambiar y la explicación de «Finalizada» y «Activa».
- **El editor de producto** explica las fotos, cómo se elige la principal y
  qué hacen «Activo» y «Destacado».
- **Cada diálogo** muestra el stock que se mueve antes de confirmar.

### 7.3 Los recorridos

**Detalle de una orden (`/admin/ordenes/[numero]`) — id `panel-orden`.**
Arranca **solo con la orden activa**, que es cuando existen las acciones. En
los otros estados el botón «Ver la guía» no se dibuja, como en el detalle de
la tienda.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | Los botones del primer renglón (subir, bajar, quitar) | Ajustá cada producto | Con + y − cambiás la cantidad, y con el tacho lo sacás de la orden. Antes de confirmar vas a ver cuánto stock se mueve. |
| 2 | «Agregar un producto» | ¿Te pidió algo más? | Buscalo y sumalo. Un producto nuevo entra al precio de hoy; si ya estaba en la orden, se suma a su renglón con el precio que tenía. |
| 3 | «Escribirle por WhatsApp» | Avisale los cambios | Al comprador no le llega ningún aviso cuando tocás la orden. Escribile desde acá: el mensaje ya sale con el número de la orden. |
| 4 | «Finalizar» y «Cancelar la orden», juntos | Cuando se resuelve | Solo las finalizadas cuentan como ventas en Reportes. Si cancelás, el motivo que escribas lo puede leer el comprador. |

El paso 1 señala los botones y no el renglón entero: en el teléfono el
renglón es una tarjeta, y los botones son lo que no tiene nombre a la vista.

**Nueva orden (`/admin/ordenes/nueva`) — id `panel-orden-nueva`.** Arranca
siempre: los dos elementos están desde que se abre la pantalla. El texto del
paso 1 se corrigió al implementarlo: decía que se podía cargar más de lo que
hay sin aclarar que es solo como finalizada, y como activa el renglón lo
impide.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | «Agregar productos», que abre el buscador | Lo que vendiste | Buscalo por nombre o marca. Si vendiste más de lo que figura en stock, igual la podés cargar como finalizada. |
| 2 | «Cómo queda la orden» | ¿Ya la entregaste? | Si falta entregar, cobrar o cerrar el precio, dejala activa: así la podés ajustar. Una finalizada ya no se edita. |

Son dos pasos porque el resto del formulario ya se explica solo (§7.2).

**Edición de un producto (`/admin/productos/[id]`) — id `panel-producto`.**
Arranca **solo con al menos un color**: sin colores la pantalla muestra el
estado vacío, que ya dice qué hacer.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | El stock del primer color («en total · reservadas · disponibles») | ¿Cuánto podés vender? | Lo que manda es «disponibles»: el total menos lo guardado para órdenes activas. Las reservadas salen del total cuando finalizás la orden. |
| 2 | El lápiz del primer color | Acá corregís el stock | Cuando entra mercadería o contás de nuevo, poné el total que tenés en la mano, con lo reservado incluido. Las reservas se descuentan solas. |

El paso 2 es el que más ahorra: escribir el total ya sin lo reservado es el
error que deja el stock por debajo de la realidad (objetivo O2).

**Devoluciones (`/admin/devoluciones`) — id `panel-devoluciones`.** Arranca
**solo con al menos una devolución**: el estado vacío ya dice dónde se cargan.

| # | Señala | Título | Texto |
|---|---|---|---|
| 1 | «Orden #…» de la primera tarjeta | Cada una con su orden | Se cargan desde la orden finalizada, con «Registrar devolución». Tocá el número para ir a ella. |
| 2 | La insignia del primer renglón | ¿Volvió o no? | Las dos se descuentan de las ventas en Reportes. La diferencia es solo el stock. |
| 3 | «Anular» de la primera devolución vigente (opcional) | ¿Te equivocaste? | Una devolución no se edita: anulala y cargala de nuevo desde la orden. |

El paso 3 es opcional porque una anulada no tiene el botón, y puede pasar
que no quede ninguna vigente en la página.

### 7.4 Lo que cambia respecto de la tienda

- **El componente se comparte.** Pasó de `components/shop/` a
  `components/ui/ayuda-guiada.tsx`, y la tienda y el panel lo importan de
  ahí. La clave de `localStorage` es la misma: los ids del panel empiezan con
  `panel-` y no se pisan con los de la tienda.
- **El modo oscuro llegó solo.** El globo se dibuja con las variables de
  color, que `[data-theme="dark"]` redefine en `<html>`. Revisado a ojo en
  los dos temas, y axe sin hallazgos en oscuro.
- **La escala.** Driver.js pone el globo en el `<body>`, fuera del
  contenedor con `data-scale="admin"`. Sin ese atributo, el globo y sus
  botones tomaban las medidas de la tienda. El componente lee la escala con
  `useDataScale()`, como los diálogos, y se la pone al globo. Con ella, el
  globo toma el radio de los diálogos del panel (8px) y lo resaltado, 12px.
- **«Ver la guía»** va en las acciones de `EncabezadoDePanel`, como botón
  terciario `sm` y al final, después de las acciones de la pantalla.
- **Cada paso señala el primer elemento visible** con su `data-ayuda`. En el
  panel el atributo va en todas las copias —cada renglón, cada color, cada
  devolución—, y la orden se dibuja dos veces: tabla en escritorio y lista en
  el teléfono. La tienda solo buscaba el primero, y en el teléfono ese era el
  de la tabla, oculta.
- **Lo resaltado tiene que medir lo que su contenido.** Los botones de un
  renglón de la orden y «Anular» iban en una fila a todo el ancho, y la guía
  resaltaba un recuadro vacío a su izquierda. Se angostaron con `w-fit` y
  `self-end`, sin cambiar dónde se ven.

### 7.5 Pruebas

- **`tests/e2e/ayudas.spec.ts`** suma el panel:
  - Que aparece la primera vez y no la segunda.
  - Que la de la orden se recorre con el teclado y el foco vuelve a «Ver la
    guía» al cerrarla.
  - Que tiene axe sin hallazgos con el globo abierto, en claro y en oscuro,
    y que el globo lleva `data-scale="admin"`.
  - La devolución que necesita se arma por SQL, sobre una orden finalizada,
    y se borra antes de desarmar: traba el borrado de su orden.
- **Con la flecha a la derecha, un paso puede no avanzar** si la tecla llega
  mientras el anterior se está armando. Por eso el test espera el foco en
  «Siguiente» y avanza con Enter, como el de la ficha.
- **`tests/e2e/apoyo/test.ts`** suma los ids nuevos a las guías vistas, para
  que los E2E del panel no tengan que cerrar el globo.
- **Revisado con Playwright a 390 y a 1280** en las cuatro pantallas y en
  los dos temas.
