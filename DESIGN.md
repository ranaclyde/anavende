---
name: AnaVende
description: Acromático con dos voces de igual peso — el burdeos y el pizarra son dos formas de comprar, y el color de estado es de los semánticos.
colors:
  malbec: "#832833"
  malbec-hover: "#9d3040"
  malbec-active: "#6b202a"
  malbec-tint: "#f7edef"
  malbec-tint-border: "#f2dcdf"
  pizarra: "#2f4a6d"
  pizarra-hover: "#3c5d87"
  pizarra-active: "#24394f"
  canvas: "#f2f4f5"
  surface: "#ffffff"
  surface-sunken: "#fafbfb"
  logo-chip: "#f2f4f5"
  logo-chip-ink: "#716e6d"
  ink: "#111010"
  ink-secondary: "#716e6d"
  ink-tertiary: "#8f8b8a"
  ink-inverse: "#ffffff"
  border: "#ebebeb"
  border-strong: "#d3d7d9"
  success: "#15803d"
  success-tint: "#f0fdf4"
  warning: "#b45309"
  warning-tint: "#fffbeb"
  danger: "#dc2626"
  danger-tint: "#fef2f2"
  info: "#0369a1"
  info-tint: "#f0f9ff"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body-lg:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  body-sm:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.006em"
  caption:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  card: "28px"
  image: "20px"
  modal: "20px"
  panel-card: "12px"
  panel-image: "8px"
  panel-control: "8px"
  pill: "9999px"
spacing:
  base: "4px"
components:
  button-brand:
    backgroundColor: "{colors.malbec}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-brand-hover:
    backgroundColor: "{colors.malbec-hover}"
    textColor: "{colors.ink-inverse}"
  button-brand-active:
    backgroundColor: "{colors.malbec-active}"
    textColor: "{colors.ink-inverse}"
  button-alterna:
    backgroundColor: "{colors.pizarra}"
    textColor: "{colors.ink-inverse}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-alterna-hover:
    backgroundColor: "{colors.pizarra-hover}"
    textColor: "{colors.ink-inverse}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  input-shop:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  input-admin:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.panel-control}"
    padding: "0 12px"
    height: "40px"
  badge-neutral:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-brand:
    backgroundColor: "{colors.malbec-tint}"
    textColor: "{colors.malbec}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card-shop:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px"
  card-admin:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel-card}"
    padding: "16px"
---

# Design System: AnaVende

> Extraído del código que está en producción (`app/globals.css`, `components/ui/`,
> `components/shop/`). La autoridad narrativa sigue siendo
> `sdd/mvp/DESIGN-REFERENCE.md`, que explica el porqué de cada decisión con mucho
> más detalle; este archivo es la versión que lee una herramienta.

## Overview

**Creative North Star: "El mostrador de Ana"**

Todo el sistema es acromático —un canvas gris frío, superficies blancas, una
familia de grises cálidos para el texto— salvo por un solo color: un burdeos
profundo que es el de ella. Esa asimetría es la idea entera. Donde aparece el
Malbec, hay algo que hacer o alguien que responde; en todo lo demás, el color
se lo lleva la foto del producto. Una pantalla donde el burdeos decora es una
pantalla que perdió el hilo.

La excepción es exacta y tiene una sola razón: en la ficha hay **dos formas de
comprar**, el carrito y el WhatsApp, y ninguna es el plan B de la otra. El azul
pizarra existe para eso y pesa deliberadamente lo mismo que el burdeos —9,05:1
contra 9,07:1— para que la persona elija por lo que dicen los botones y no por
cuál se ve más fuerte. Aparte de eso, el color de un **estado** no sale de la
identidad: sale de los semánticos. Un resultado que salió bien es verde, no
burdeos.

La densidad es generosa donde se mira y apretada donde se opera. La tienda
respira: radios de 28px, tarjetas que flotan sobre sombra de dos capas, 64 a
80px entre secciones, y una foto cuadrada con marco blanco alrededor que separa
el producto del borde de la tarjeta. El panel corre a 14px de base, 12px de
radio y 24 a 32px entre bloques, porque ahí no se descubre nada: se busca la
orden 1043 lo más rápido posible. Una paleta, una tipografía, dos escalas.

La calidez es deliberada y está medida. El burdeos es cálido, el canvas es gris
frío, y esa tensión es lo que le da presencia a una acción sin subir el volumen
de nada. El sistema **no busca la urgencia del e-commerce** —no hay contadores,
ni «últimas unidades», ni porcentajes gigantes— **ni la frialdad corporativa**:
nada de azul institucional ni esquinas duras. Lo que se promete es un mostrador
atendido, no una plataforma.

**Key Characteristics:**

- Acromático con una sola voz cálida, el Malbec, reservada para acción e identidad.
- Dos escalas de densidad sobre una sola paleta y una sola tipografía.
- La píldora como firma de la tienda; 8px de radio como firma del panel.
- Tracking negativo que crece con el tamaño: lo grande se comprime.
- Separación por sombra, nunca por borde.
- Modo oscuro sólo en el panel; la tienda es siempre clara.

## Colors

Un acento cálido contra una familia de grises cálidos sobre un canvas frío, más
cuatro semánticos que sólo hablan cuando hay algo que decir.

### Primary

- **Malbec** (`#832833`): la acción principal y la identidad, y nada más. Botón de
  envío del buscador, acciones primarias («Agregar al carrito», «Confirmar
  pedido», «Guardar»), precio final cuando hay descuento, estado activo de
  navegación y filtros, anillo de foco, logo. Da 9,07:1 sobre blanco y 8,22:1
  sobre el canvas, así que sirve como relleno **y como texto**. Es oscuro: por eso
  el hover **aclara** (`malbec-hover`) en vez de oscurecer, al revés de lo
  habitual.
- **Malbec Tinte** (`malbec-tint`): fondo de etiquetas de identidad y estados
  suaves, y la capa exterior del anillo de foco.

### Secondary

- **Azul Pizarra** (`pizarra`): la **otra acción de compra** y **lo elegido**.
  Hoy son dos lugares: el botón «Comprá ya por WhatsApp» de la ficha y el
  checkbox marcado. Da 9,05:1 sobre blanco contra los 9,07:1 del Malbec: **0,02
  de diferencia**, que es la cifra por la que se eligió. No es un escalón debajo
  del Malbec, es su par.

### Neutral

- **Tinta** (`ink`): texto primario. Casi negro y **cálido**, no negro puro.
- **Tinta Secundaria** (`ink-secondary`): texto secundario y etiquetas.
- **Tinta Terciaria** (`ink-tertiary`): metadatos y marcadores de posición.
- **Canvas** (`canvas`): fondo de página. Gris frío, y esa frialdad es lo que hace
  resaltar al Malbec.
- **Superficie** (`surface`): tarjetas, campos, encabezado.
- **Superficie Hundida** (`surface-sunken`): filas alternadas y bloques embebidos.
- **Línea** (`border`) y **Línea Marcada** (`border-strong`): divisorias y contorno
  de campo; la segunda marca el foco del campo y los separadores fuertes.

### Named Rules

**La regla de una sola voz.** El Malbec señala acción o identidad. **Nunca**
aparece en fondos de sección, bordes decorativos, íconos generales, texto de
párrafo ni cabeceras de tabla. Si una pantalla tiene dos cosas en burdeos que no
son la acción principal, una de las dos está mal.

**La regla de la forma, no el color.** El burdeos de marca (352,7°) y el rojo de
peligro (0°) están a siete grados de matiz: son el mismo tono para cualquiera que
no los vea uno al lado del otro. Lo destructivo se separa **por forma** —contorno
rojo sobre fondo transparente, con ícono—, nunca por color. El relleno rojo existe
sólo dentro del diálogo de confirmación, donde no hay un botón de marca al lado.

**La regla del par.** El pizarra no es «el color secundario» en el sentido de
más débil: pesa lo mismo que el burdeos a propósito. Se usa **sólo** cuando hay
dos caminos igual de válidos para lo mismo. Si uno de los dos es claramente el
principal, el otro no es pizarra: es contorno.

**La regla del estado.** El color de un resultado sale de los semánticos, nunca
de la identidad. Éxito es verde, error es rojo, aviso es ámbar. El burdeos está
a 7° del rojo de error, así que un «salió bien» en burdeos se lee como problema
durante el segundo que importa.

**La regla del logo ajeno.** `logo-chip` no cambia con el tema, y es la única razón
por la que existe como token. El logo de una marca de tercero llega como trazo
oscuro sobre transparente y desaparece sobre superficie oscura; no se lo puede
repintar como al propio.

## Typography

**Familia única:** Inter (con `system-ui`, `-apple-system`, `Segoe UI` de respaldo).
Pesos 400, 500 y 600. No hay segunda familia, ni display, ni monoespaciada.

**Carácter:** neutral y compacta. La personalidad no la pone la familia sino el
**tracking negativo que crece con el tamaño**: el cuerpo apenas se ajusta
(-0.011em) y el display se comprime fuerte (-0.035em). Los títulos se leen
apretados y sólidos sin necesidad de un peso más alto.

### Hierarchy

- **Display** (600, 2.25rem/36px, 1.1): el hero de la portada, y sólo ahí.
- **Title** (600, 1.5rem/24px, 1.2): nombre del producto en la ficha, títulos de pantalla.
- **Heading** (600, 1.25rem/20px, 1.25): encabezados de sección.
- **Body Large** (400, 1.125rem/18px, 1.45): descripción de producto y texto legal.
- **Body** (400, 1rem/16px, 1.5): base de la tienda.
- **Body Small** (400, 0.875rem/14px, 1.45): base del panel; etiquetas y celdas.
- **Caption** (500, 0.75rem/12px, 1.35): metadatos. Sube a peso 500 porque a ese
  tamaño el 400 se desarma.

### Named Rules

**La regla del piso de 12px.** El caption es el piso absoluto. Ningún texto baja de
ahí, en ninguna escala, por ninguna razón.

**La regla de la columna alineada.** Todo precio y toda columna de números lleva
`font-variant-numeric: tabular-nums` (atributo `data-numeric="tabular"`). Los
dígitos de ancho variable hacen bailar una columna de precios.

## Layout

La tienda se centra en un ancho máximo de **1200px** y separa sus secciones con 64
a 80px. El panel ocupa el ancho completo menos el menú lateral, separa bloques con
24 a 32px y corre sus filas de tabla a 44px de alto. La escala de espaciado es de
base 4px.

El móvil es prioridad de diseño en la tienda, no una adaptación: el área táctil
mínima es de 44px y está resuelta **en la variante del componente**, no en cada
llamada —el botón de tamaño medio sube a `h-11` por debajo de `md` porque sus 40px
quedaban cuatro por debajo del mínimo—.

### Named Rules

**La regla de las dos escalas.** Una sola paleta, una sola tipografía, dos
densidades. La escala no es una prop de componente: el panel marca
`data-scale="admin"` en su raíz y los componentes compartidos se adaptan solos con
la variante `admin:`. No existen dos botones ni dos campos.

**La regla del portal.** Lo que se pinta fuera del árbol —diálogos, menús,
globos— se lleva la escala puesta explícitamente (`components/ui/escala.tsx`).
Arriba de `document.body` ya no hay `data-scale`, y un diálogo abierto desde el
panel se pintaría con la escala de la tienda aunque tenga sus clases `admin:`.

**La regla del buscador único.** El buscador del encabezado se esconde por CSS
cuando la página ya trae el suyo a la vista, y vuelve cuando ese se va de pantalla.
Es CSS y no estado de React a propósito: con estado, el encabezado se pinta con su
buscador y recién después se entera de que sobra, y aparece un parpadeo.

## Elevation & Depth

El sistema es **elevado, no plano**, y la elevación es lo único que separa una
tarjeta del fondo. Hay cinco sombras y cada una tiene un solo trabajo. Todas se
tiñen con el color de la tinta (`rgb(17 16 16 / …)`), **nunca con negro**: una
sombra azulada debajo de una tarjeta cálida se nota aunque nadie sepa decir por
qué.

### Shadow Vocabulary

- **`sm`** (`0 2px 8px rgb(17 16 16 / 0.06)`): chips, píldoras de categoría, botones secundarios.
- **`md`** (`0 4px 6px -1px rgb(17 16 16 / 0.1), 0 2px 4px -2px rgb(17 16 16 / 0.1)`): tarjetas de producto. Es la sombra de dos capas que da el volumen del sistema.
- **`lg`** (`0 4px 24px rgb(17 16 16 / 0.12)`): modales, menús desplegables, encabezado al hacer scroll, y la tarjeta al pasar el puntero.
- **`brand`** (`0 4px 24px var(--brand-shadow)`): sólo el botón de envío del buscador y el principal del hero. La elevación tiene el color de la marca.
- **`focus`** (`0 0 0 3px <tinte>, 0 0 0 1px <malbec>`): el anillo de foco de teclado, igual en todo elemento interactivo.

### Named Rules

**La regla de sombra o borde, nunca los dos.** La tienda separa por sombra; el
panel, por borde. El panel tiene modo oscuro y ahí la sombra no existe: sobre el
canvas `#141416`, `--shadow-sm` mueve el píxel 0,18 sobre 255, y la superficie
contra el canvas da 1,11:1. Sombra y borde juntos ensucian y aplanan la
elevación.

**La regla del foco que sobrevive.** El anillo de foco se muestra sólo ante teclado
(`:focus-visible`) y viaja con un `outline` transparente de 2px. No es decorativo:
en el modo de alto contraste de Windows las sombras no se pintan y el outline es lo
único que queda. Un componente con sombra propia vuelve a pedir el anillo en
`focus-visible`, o la suya lo tapa.

## Shapes

La **píldora es la firma de la tienda**: botón, campo, buscador, chip y etiqueta de
estado son todos `9999px`. Las superficies grandes llevan radios generosos —28px la
tarjeta de producto, 20px el modal y la imagen suelta—. El panel baja todo a 12px
la tarjeta y 8px el control, porque la píldora estorba en una barra densa; lo único
que conserva la píldora en las dos escalas es el buscador y la etiqueta de estado.

El área de texto multilínea es la excepción deliberada al pill: usa el radio de
imagen (20px), porque una píldora no tiene sentido en una caja que crece.

### Named Rules

**La regla del marco blanco.** La imagen interior siempre lleva ~8px **menos** de
radio que su contenedor (20px dentro de una tarjeta de 28px). Ese borde blanco
visible es lo que separa el producto del borde de la tarjeta; recortar la imagen
exactamente a la forma del contenedor rompe el efecto y hace que los productos de
fondo blanco se fundan con la página.

## Components

### Buttons

- **Shape:** píldora en la tienda (`9999px`), 8px en el panel. Alturas 32 / 40 / 48px, y el ícono suelto es cuadrado de 44px en móvil.
- **Brand:** relleno Malbec, texto blanco. **Una sola por pantalla.** El hover aclara (`malbec-hover`) y el activo oscurece (`malbec-active`).
- **Alterna:** relleno pizarra, texto inverso. La otra forma de hacer lo mismo, a la par de la marca. En la ficha es «Comprá ya por WhatsApp» debajo del carrito.
- **Secondary:** superficie blanca con borde; el hover hunde el fondo y marca el borde. Es para acciones de apoyo entre pares —«Guardar», «Compartir»— y para el «Cancelar» de un diálogo destructivo, donde la salida segura tiene que pesar igual que el botón que borra.
- **Tertiary (ghost):** sin caja en reposo; al pasar el puntero aparece el plato de `canvas` y la tinta sube a plena. Es el «Cancelar» y el «Volver». En táctil no hay hover, así que el texto tiene que alcanzar solo: nunca un ícono sin rótulo.
- **Destructive:** contorno rojo sobre transparente, con ícono. **Destructive solid:** relleno rojo, exclusivo del diálogo de confirmación.
- **Disabled:** 40% de opacidad **sin cambiar de color**. No hay un gris de deshabilitado.
- **Loading:** el contenido se queda en el flujo e invisible y el indicador se superpone, para que el botón conserve el ancho y la interfaz no salte. El indicador anuncia qué se está haciendo al lector de pantalla.
- **Emphasis `glow`:** `shadow-brand`, y sólo lo llevan el envío del buscador y el principal del hero.

### Inputs / Fields

- **Style:** 48px de alto en la tienda con forma de píldora, 40px y 8px de radio en el panel. Fondo de superficie, borde de línea, marcador de posición en tinta terciaria.
- **Focus:** el borde pasa a línea marcada, más el anillo de foco global.
- **Error:** se marca con `aria-invalid`, que pinta el borde en peligro **y** lo anuncia al lector de pantalla. El atributo es el mecanismo, no una clase.
- **Textarea:** mismo contrato, radio de imagen en vez de píldora, y crece con el contenido (`field-sizing-content`).

### Chips / Etiquetas de estado

- **Style:** píldora, caption de 12px peso 500, fondo de tinte y texto del color semántico.
- **Tones:** info (orden activa), success (finalizada), warning (manual, stock bajo), danger (sin stock, bloqueado), neutral (cancelada, inactivo, dado de baja), brand (destacado, oferta).

### Cards / Containers

- **Corner:** 28px en la tienda, 12px en el panel.
- **Background:** superficie blanca. **Shadow:** `md` en la tienda; el panel no lleva sombra.
- **Border:** ninguno en la tienda; `--border` en el panel. Ver la regla de sombra o borde.
- **Padding:** 20px de cabecera en la tienda, 16px en el panel.

### Navigation

Encabezado sobre superficie blanca que toma `shadow-lg` al hacer scroll. El estado
activo se marca en Malbec. El buscador vive en el encabezado y se retira cuando la
página trae el suyo.

### Tarjeta de producto (signature)

El componente que define la tienda. Tarjeta de 28px con 12px de padding; adentro,
la foto en un contenedor de 20px con relación de aspecto cuadrada **reservada**, de
modo que la grilla no salta mientras cargan las imágenes. Al pasar el puntero la
tarjeta sube media unidad y pasa a `shadow-lg` mientras la foto escala un 3%, las
dos cosas bajo `motion-safe`. El foco del enlace interior enciende el anillo en
toda la tarjeta (`has-[a:focus-visible]`). La marca va arriba en caption
mayúsculo, el nombre en cuerpo pequeño a dos líneas con alto mínimo reservado, y
los puntos de color de las variantes abajo a la derecha.

### Buscador (signature)

Píldora de 48px con el botón de envío circular en Malbec dentro del campo, llevando
`shadow-brand`: es el único lugar de la tienda donde la elevación tiene color. Trae
botón de limpiar cuando hay texto, y su etiqueta vive en `sr-only`.

## Do's and Don'ts

### Do:

- **Do** reservar el Malbec para la acción principal y la identidad, y dejar que el color de la pantalla lo ponga la foto del producto.
- **Do** separar lo destructivo por forma —contorno rojo con ícono—, nunca por color.
- **Do** aclarar el burdeos en hover, no oscurecerlo: el color base ya es oscuro.
- **Do** dar a la imagen ~8px menos de radio que su contenedor, siempre.
- **Do** separar las superficies por sombra y elegir la sombra por su trabajo, no por su tamaño.
- **Do** teñir toda sombra con `rgb(17 16 16 / …)`, la tinta cálida, nunca con negro.
- **Do** resolver el área táctil de 44px en la variante del componente, no en la llamada.
- **Do** acompañar todo estado con texto: una etiqueta nunca comunica sólo por color.
- **Do** poner `data-numeric="tabular"` en precios y columnas de números.
- **Do** pintar los estados con los semánticos: un resultado exitoso es verde, aunque el burdeos esté a mano.
- **Do** reservar el pizarra para cuando hay dos caminos igual de válidos; si hay un principal claro, el otro va en contorno.
- **Do** usar la variante `admin:` para la densidad del panel, y marcar la escala a mano en lo que se pinta por portal.

### Don't:

- **Don't** usar el Malbec en fondos de sección, bordes decorativos, íconos generales, texto de párrafo ni cabeceras de tabla.
- **Don't** poner dos botones de marca en la misma pantalla.
- **Don't** usar el burdeos para decir «salió bien»: está a 7° del rojo de error y se lee como problema.
- **Don't** usar el pizarra como un escalón más débil que el burdeos. Pesa igual a propósito; si necesitás algo más liviano, es contorno o ghost.
- **Don't** combinar sombra y borde en la misma superficie.
- **Don't** bajar ningún texto de 12px.
- **Don't** introducir una segunda familia tipográfica: Inter es la única, en 400, 500 y 600.
- **Don't** meter urgencia de e-commerce: ni contadores regresivos, ni «últimas unidades», ni banners de oferta parpadeando, ni porcentajes de descuento gigantes. La oferta se comunica con el precio tachado y el final, y nada más (RN-04c).
- **Don't** derivar hacia lo corporativo frío: ni azul institucional, ni esquinas duras, ni densidad de dashboard dentro de la tienda.
- **Don't** llevar el modo oscuro a la tienda. Existe sólo en el panel, sobre `data-theme` en `<html>`.
- **Don't** recortar la imagen exactamente a la forma de su contenedor.
- **Don't** confiar en `:focus` para el anillo de foco: es `:focus-visible`, y el outline transparente va con él.
