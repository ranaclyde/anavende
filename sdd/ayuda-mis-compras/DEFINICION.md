# Ayuda guiada en «Mis compras» — definición

> **Estado:** definida el 2026-10-22, **sin fecha de implementación**. Es
> posterior al MVP: está en el backlog de `DEVELOPMENT-PLAN.md` §6. Cuando se
> tome, se baja a RF y tareas en las especificaciones, y lo que se decida
> distinto se anota en el historial de decisiones.

## 1. Qué es y dónde va

Una ayuda guiada, con [Driver.js](https://driverjs.com/): oscurece la página,
resalta un elemento y explica en un globo qué es. Se encadenan pocos pasos.

**Va sólo en «Mis compras»**, la sección de la cuenta. Es la que más hace falta
explicar porque ahí se **cancela un pedido**, que es el derecho de
arrepentimiento (RF-23, RF-34), y porque el estado de un pedido («En preparación»,
«Entregada», «Cancelada») no se entiende solo.

**No va en el catálogo, la ficha ni el checkout.** Se decidió que se entienden
sin ayuda (2026-10-22). Si más adelante hace falta, esta misma pieza se reusa.

## 2. Cuándo aparece

- **La primera vez que la persona entra a la pantalla**, sola, sin que la
  pida. Es la ayuda «cuando hacen clic en esa sección».
- **Una vez por pantalla y por cuenta.** Lo visto se guarda **en la base**, en
  el perfil: así no reaparece en otro dispositivo ni al borrar las cookies.
- **Cuenta como vista al cerrarla o al terminarla**, de cualquier forma: «Listo»,
  la cruz, Esc o un clic afuera. Quien la cierra en el primer paso no quiere
  verla de nuevo.
- **Sólo se marca si se mostró.** Si la pantalla no tenía qué explicar (ver
  abajo), queda pendiente para la próxima.
- **Se puede volver a ver** con un botón «¿Cómo funciona?» en el encabezado de
  cada pantalla. Es la única forma de reabrirla, y por eso no puede faltar.

## 3. Los dos recorridos

Son dos pantallas y por lo tanto **dos recorridos cortos e independientes**, no
uno que salta de página. Cada uno se muestra la primera vez que se entra a su
pantalla.

### Listado (`/mi-cuenta/compras`)

Sólo si hay al menos una compra. Sin compras no aparece: el estado vacío ya
explica qué va a haber ahí.

| # | Resalta | Texto (borrador) |
|---|---|---|
| 1 | La primera compra | **Tus pedidos.** Acá están todos, del más nuevo al más viejo, con el precio del día que los hiciste. Tocá uno para ver el detalle. |
| 2 | Su estado | **El estado.** *En preparación*: el stock está apartado y falta coordinar el pago y la entrega por WhatsApp. *Entregada*: ya la tenés. *Cancelada*: no se cobró nada. |
| 3 | La primera compra, de nuevo | **Cancelar.** Mientras un pedido está en preparación podés cancelarlo desde su detalle, sin dar explicaciones. |

### Detalle de un pedido (`/mi-cuenta/compras/[numero]`)

**Sólo si el pedido está en preparación** (`activa` en la base), porque es
cuando existen las dos acciones. Si la persona entra primero a uno entregado o
cancelado, el recorrido espera al primer pedido en preparación que abra.

| # | Resalta | Texto (borrador) |
|---|---|---|
| 1 | El estado | **Tu pedido está en preparación.** Te guardamos el stock; todavía no se cobró nada. |
| 2 | «Escribir por WhatsApp» | **Seguí por WhatsApp.** Ahí se arregla el pago y la entrega. El mensaje ya va con tu pedido. |
| 3 | «Cancelar el pedido» | **Si te arrepentiste**, cancelalo acá. Se libera el stock y no se te cobra nada. |

Si el sitio no tiene WhatsApp configurado, el botón no existe y el paso 2 se
saltea. **Ningún paso cuenta con un elemento que puede faltar**: si no está,
el paso no se arma.

## 4. Lo que se probó de Driver.js

Probado el 2026-10-22 con la versión **1.9.0**, con Playwright y axe, en una
página de prueba con un listado y un botón de cancelar.

**Lo que trae bien:**
- El globo es un `role="dialog"` con título y descripción asociados
  (`aria-labelledby`, `aria-describedby`).
- El foco entra al globo al abrir y **queda atrapado** con Tab: recorre el
  globo y el elemento resaltado.
- Las flechas pasan de paso, Esc cierra, y en el móvil se maneja con toques.
- axe no encontró violaciones (WCAG 2.2 AA) con el globo abierto a 390px.

**Lo que hay que corregir con configuración** (probado: con esto queda bien):

| Problema | Corrección |
|---|---|
| Al cerrar, el foco va al último elemento resaltado, no a quien abrió la ayuda | En `onDestroyed`, devolver el foco al botón «¿Cómo funciona?» (o al título de la pantalla si se abrió sola). Hay que diferirlo (`setTimeout`), porque la librería mueve el foco después del gancho |
| Al abrir, el foco cae en la cruz de cerrar | Llevarlo a «Siguiente» en `onPopoverRender`, también diferido |
| No marca el diálogo como modal y el fondo no queda inerte | `aria-modal="true"` en `onPopoverRender` |
| **No respeta `prefers-reduced-motion`**: el fundido de 0,4 s y el desplazamiento suave siguen | `animate: false` y `smoothScroll: false` cuando el usuario pidió menos movimiento, más una regla CSS que anule las animaciones del globo y del fondo |
| Los textos vienen en inglés («Close», «Next», «{{current}} of {{total}}») | `closeBtnLabel: "Cerrar la ayuda"`, «Anterior», «Siguiente», «Listo», `"{{current}} de {{total}}"` |
| **Los botones miden 24 a 28px de alto**: pasan WCAG pero no los 44px de `DESIGN.md` | Estilo propio (`popoverClass`) con las variantes de `Button` de la tienda |

## 5. Cómo se ve

- **El estilo de la librería no se usa tal cual**: el globo se dibuja con los
  tokens de `DESIGN.md`. Superficie, tipografía, radio y sombra de la tienda;
  botones píldora de la tienda, con área táctil de 44px; anillo de foco global;
  modo claro y oscuro.
- **«Siguiente» es el botón principal** y «Anterior» el terciario. En el
  primer paso «Anterior» no se muestra, en vez de dibujarse apagado.
- **El fondo oscurece sin tapar**: el elemento resaltado se tiene que leer.
- **En el celular** el globo va arriba o abajo del elemento, nunca al costado,
  y el resaltado se desplaza a la vista antes de mostrarse.
- Pasa por las skills de diseño (`impeccable`, `ui-ux-pro-max`) antes del
  primer componente, como cualquier pantalla.

## 6. Notas técnicas

- **Dependencia:** `driver.js`, con versión fija. Al tocar `package-lock.json`
  se usa `npx -y npm@11`. Es MIT y pesa unos 5 kB comprimida, sin dependencias.
- **Carga diferida:** se importa con `import()` sólo cuando el recorrido se va
  a mostrar o cuando se toca «¿Cómo funciona?». Quien ya lo vio no la descarga.
- **Un componente cliente** recibe del servidor si la ayuda de esa pantalla ya
  se vio; la página sigue siendo de servidor. Lo visto se marca con una
  *server action*.
- **Datos:** en el perfil, una lista de las ayudas vistas (por ejemplo
  `ayudas_vistas text[]`, con `'mis-compras'` y `'detalle-compra'`). Una
  lista y no dos booleanos, para sumar ayudas sin migrar cada vez.
- **Una cuenta de solo lectura** (baja pedida, RF-34) ve la ayuda igual, pero
  marcarla como vista no puede fallar por eso: es una escritura de interfaz,
  no un cambio de datos de la cuenta.
- **Tests:**
  - e2e: aparece la primera vez y no la segunda; «¿Cómo funciona?» la reabre;
    Esc la cierra y el foco vuelve a donde corresponde.
  - `tests/e2e/accesibilidad.spec.ts` corre también con la ayuda abierta.
- **Documentación:** `docs/FUNCIONAMIENTO.md` lo menciona en la cuenta.
