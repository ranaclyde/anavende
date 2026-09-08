# AnaVende — Referencia de Diseño (MVP)

| Campo | Valor |
|---|---|
| Producto | AnaVende — e-commerce de reventa de productos informáticos |
| Versión | 1.0 (MVP) |
| Fecha | 2026-08-31 |
| Sistema de referencia | `sdd/DESIGN-SHOPAPP.md` (shop.app) |
| Documentos hermanos | `FUNCTIONAL-SPEC.md`, `TECHNICAL-SPEC.md`, `DEVELOPMENT-PLAN.md` |
| Color de marca | `#832833` — tomado del logo de AnaVende |

---

## 1. Qué es este documento

Define **cómo se ve y cómo se comporta visualmente** AnaVende. No decide qué hace el producto (eso es `FUNCTIONAL-SPEC.md`) ni cómo está construido (`TECHNICAL-SPEC.md`).

Toma el sistema de shop.app como referencia estructural —canvas claro, tarjetas muy redondeadas, un solo color saturado, sombras suaves, tipografía compacta con tracking negativo— y lo adapta a la identidad de AnaVende y a las necesidades de un panel de administración.

### 1.1 Lo que se conserva de la referencia

- **La foto del producto manda.** La interfaz es acromática para que el color lo pongan los productos.
- **Un solo color saturado.** No hay un segundo acento decorativo.
- **Redondeo generoso** como firma visual.
- **Separación por sombra**, no por bordes, en las superficies elevadas.
- **Jerarquía por grado y tracking**, no por negritas pesadas.

### 1.2 Lo que se cambia, y por qué

| Cambio | Motivo |
|---|---|
| **Acento burdeos `#832833`** en lugar del violeta de Shop | Es el color real de la marca. Además da 9,07:1 de contraste contra blanco (AAA), lo que permite usarlo también como color de texto |
| **Inter** en lugar de GT Standard | GT Standard es una tipografía paga. Inter es el sustituto que indica la propia referencia |
| **Piso tipográfico de 12px** (la referencia baja a 9px) | Accesibilidad (RNF-02). Además AnaVende no tiene reseñas ni contadores, que es para lo que Shop usaba los 9px |
| **Encabezado superior** en lugar del riel lateral de 64px | Un riel de íconos sin etiquetas obliga a adivinar. Una tienda chica necesita que sus categorías se lean |
| **Segunda escala, más densa, para el panel** | El lenguaje aéreo de la tienda vuelve ilegible una tabla de órdenes. Ver §4 |
| **Modo oscuro solo en el panel** | La tienda vive del blanco; el panel es donde se pasan horas |

### 1.3 Lo que cambió el canvas de F3.8

En F3.8 se aprobó un canvas de Claude Design (`Rediseño UI AnaVende`, siete pantallas: home, catálogo, categorías, ficha, carrito, orden enviada, panel) construido sobre esta misma referencia — <https://claude.ai/design/p/630d6d88-0a72-4ac6-b785-b1153d5e419b?file=AnaVende.dc.html>. **Confirmó las decisiones grandes de §1.2** —acento burdeos, encabezado superior con etiquetas, un solo color saturado— y ajustó tres cosas del detalle:

**El rediseño alcanza a la tienda y no al panel.** Se rehace lo que ve el comprador; el panel conserva la escala densa de §4, sus radios y su modo oscuro. La pantalla de panel que el canvas incluye está en la tabla de lo que no se toma, más abajo. Lo único compartido es la capa de tokens —una paleta, dos densidades (§4)—, así que los grises cálidos llegan al panel en modo claro por herencia, sin que ninguno de sus componentes cambie.

| Ajuste | De | A |
|---|---|---|
| Temperatura de los grises | Fría | **Cálida** (§3.1) |
| Radio de tarjeta / imagen | 24 / 16px | **28 / 20px** (§3.5) |
| Tinte de marca y de sombras | `#fdf2f3` / negro frío | `#f7edef` / `--ink` cálido |

**Lo que del canvas NO se tomó, y por qué:**

| Del canvas | Se conserva | Motivo |
|---|---|---|
| Archivo como tipografía | **Inter** | Archivo entró por herencia del sistema Modernist que el canvas importó, no por decisión de diseño |
| Textos de 10–11px | **Piso de 12px** | RNF-02. Es el mismo motivo por el que §1.2 ya había descartado los 9px de la referencia |
| Hover de marca que oscurece (`#6d2029`) | **Hover que aclara** (`#9d3040`) | §2.1: el color base ya es oscuro, y oscurecerlo lo acerca al negro y anula la señal |
| `#787574` como gris secundario | **`#716e6d`** | 4,14:1 sobre el canvas, por debajo del AA que pide RNF-02. Bajarle un 6% de luminosidad conserva la temperatura y llega a 4,58 |
| Panel de órdenes con el lenguaje aéreo de la tienda | **La escala densa de §4** | El motivo original no cambió: una tabla de órdenes en lenguaje de tienda es ilegible |
| «Admin» como enlace en la barra superior | **Nada** | En el canvas es una comodidad para saltar entre pantallas; el panel está detrás de autenticación |

El canvas tampoco resuelve el catálogo tal como se implementa: propone un panel de filtros desplegable sin paginación ni estado en la URL. Se toma **su aspecto** y se conserva **la arquitectura de §7.2 y §10.2** —filtros, orden y página en la dirección—, porque es lo que hace que el enlace filtrado se pueda compartir y que el botón atrás funcione. Un prototipo no necesita ninguna de las dos cosas; la tienda sí.

---

## 2. Identidad

### 2.1 El color de marca

`#832833` es un burdeos profundo. En el sistema cumple **un solo rol**: señalar la acción principal y la identidad. No decora.

| Propiedad | Valor | Consecuencia |
|---|---|---|
| Contraste sobre blanco | **9,07:1** | Nivel AAA. Sirve como relleno **y como texto** |
| Contraste sobre canvas `#f2f4f5` | 8,22:1 | Legible en cualquier superficie clara del sistema |
| Matiz / Luminosidad / Saturación | 352,7° / 33,5% / 53,2% | Es **oscuro**: el hover va hacia arriba, no hacia abajo |
| Temperatura | Cálido | Genera tensión con el canvas gris frío, lo que le da presencia |

**Dónde aparece, y en ningún otro lado:**

- Botón de envío del buscador
- Botones de acción principal («Agregar al carrito», «Confirmar pedido», «Guardar»)
- Precio final cuando hay descuento, y la etiqueta de ahorro
- Estado activo de navegación y filtros aplicados
- Anillo de foco
- Elementos de identidad: logo, isotipo

**Dónde no aparece nunca:** fondos de sección, bordes decorativos, íconos generales, texto de párrafo, cabeceras de tabla.

### 2.2 El problema del rojo, y cómo se resuelve

El burdeos de marca (352,7°) y un rojo destructivo estándar (0°) están a **7 grados de matiz**: son el mismo tono para cualquier persona que no los mire uno al lado del otro. Un botón relleno burdeos y un botón relleno rojo de «Eliminar» son indistinguibles en la práctica.

**Se separan por forma, no por color:**

| Tipo de acción | Forma | Ejemplo |
|---|---|---|
| **Principal (marca)** | Relleno burdeos, texto blanco | «Agregar al carrito», «Guardar producto» |
| **Destructiva** | **Contorno** rojo, texto rojo, fondo transparente, con ícono | «Eliminar producto», «Cancelar orden» |
| **Destructiva confirmada** | Relleno rojo, dentro del diálogo de confirmación | El botón «Sí, eliminar» del modal |

La tercera es segura porque dentro del diálogo **no hay ningún botón de marca al lado** con el cual confundirla. Toda acción destructiva pasa por confirmación de todos modos (RF-15, RF-23).

### 2.3 El logo

Una cuadrícula de cuatro celdas —**A**, un joystick, unos auriculares y una **V**— dibujada a trazo burdeos sobre transparente. Dice de qué es el negocio sin escribirlo, y el trazo abierto convive con los radios generosos del sistema.

> **Corregido en F2.1, al recibir el archivo.** Esta sección describía «un cuadrado de esquinas redondeadas, fondo burdeos, letras blancas», que era lo que había implementado como marcador de posición mientras no estaba el logo. El logo real es lo contrario: trazo burdeos sobre fondo transparente. El color medido en el archivo es `#822733`, a un punto por canal del `#832833` que §3.1 fija como token — se conserva el token, la diferencia no es visible.

| Uso | Tamaño | Tratamiento |
|---|---|---|
| Encabezado | 32px | Isotipo + palabra «AnaVende» a la derecha |
| Encabezado móvil | 32px | Solo isotipo |
| Favicon | 32 / 16px | Solo isotipo |
| Emails | 40px | Isotipo + palabra, centrado |
| Fondo oscuro | — | Versión de trazo **blanco**, mismo dibujo |

**La versión clara no es opcional.** El burdeos sobre la superficie oscura da 1,83:1 —el mismo motivo por el que §3.2 aclara `--brand` en modo oscuro—, así que el pie del sitio y el panel en modo oscuro usan el trazo blanco. Se deriva del original con `scripts/derivar-logo.mts` en vez de mantenerse a mano: si el logo cambia, las dos versiones cambian juntas.

**El original no es cuadrado** (1180×1128). Va siempre dentro de una caja cuadrada con `object-contain`, nunca estirado.

**A 16px la cuadrícula no se lee**: las cuatro celdas se funden. Es aceptable en el favicon, donde de todos modos se reconoce por color y silueta, pero **no** se usa el isotipo por debajo de 24px en ningún otro lado.

**Nunca:** deformar la proporción, cambiarle el color —salvo la versión clara de esta tabla—, ponerle sombra, rotarlo, ni apoyarlo sobre una foto sin una superficie sólida debajo.

### 2.4 El eslogan

> **Ana vende, vos elegís la tecnología.**

Es un juego con el nombre: «Ana **vende**» y del otro lado quien elige. Reparte los papeles en una sola línea —ella consigue, vos decidís— y dice para qué existe el negocio sin explicarlo.

**La última palabra rota.** «la tecnología» es la forma canónica, la que se usa cuando hay una sola oportunidad de decirlo: el pie del sitio, los emails, cualquier lugar donde aparezca solo. Pero está pensada para cambiar por la categoría concreta —«vos elegís **los joysticks**», «vos elegís **los auriculares**»— y ahí es donde funciona mejor: se lee distinto cada vez y **conversa con el isotipo**, que es exactamente esa cuadrícula (§2.3: una **A**, un joystick, unos auriculares y una **V**).

**Dónde rota y dónde no.** Rota donde hay contexto que la justifique: la portada de una categoría, una campaña, la cabecera de una sección del catálogo. **No** rota donde la persona lo ve una sola vez y necesita saber de qué se trata —emails, pie de página—: ahí va la forma canónica. Una frase que cambia sin motivo visible parece un error, no un gesto.

**Nunca:** cambiar el orden de las dos mitades, tutearlo («tú eliges»), ni sustituir la palabra final por una marca —«vos elegís Logitech» convierte la identidad en publicidad de un tercero—.

---

## 3. Tokens

### 3.1 Color — tienda y panel en claro

```css
:root {
  /* ── Marca ─────────────────────────────────────────── */
  --brand:            #832833;   /* acción principal, identidad, precio en oferta */
  --brand-hover:      #9d3040;   /* MÁS CLARO: el color base ya es oscuro */
  --brand-active:     #6b202a;
  --brand-tint:       #f7edef;   /* fondo de etiquetas y estados suaves */
  --brand-tint-border:#f2dcdf;
  --brand-shadow:     rgba(131, 40, 51, 0.34);

  /* ── Superficies ───────────────────────────────────── */
  --canvas:           #f2f4f5;   /* fondo de página */
  --surface:          #ffffff;   /* tarjetas, campos, encabezado */
  --surface-sunken:   #fafbfb;   /* filas alternadas, bloques embebidos */

  /* ── Texto ─────────────────────────────────────────── */
  --ink:              #111010;   /* primario */
  --ink-secondary:    #716e6d;   /* secundario, etiquetas */
  --ink-tertiary:     #8f8b8a;   /* metadatos, marcadores de posición */
  --ink-inverse:      #ffffff;

  /* ── Líneas ────────────────────────────────────────── */
  --border:           #ebebeb;   /* divisorias, contorno de campos */
  --border-strong:    #d3d7d9;   /* campo con foco, separadores marcados */

  /* ── Semánticos ────────────────────────────────────── */
  --success:          #15803d;   --success-tint: #f0fdf4;
  --warning:          #b45309;   --warning-tint: #fffbeb;
  --danger:           #dc2626;   --danger-tint:  #fef2f2;
  --info:             #0369a1;   --info-tint:    #f0f9ff;
}
```

> **`--ink` es `#111010`, no negro puro.** El negro absoluto sobre blanco produce un contraste duro que cansa en textos largos. Un casi-negro conserva 19,0:1 y se lee más cómodo.
>
> **La familia de grises es cálida, no fría.** Es el cambio que trajo el canvas de F3.8, y es de donde sale el aire de la referencia: `#f2f4f5` es un canvas frío, y los grises cálidos encima generan la misma tensión de temperatura que §2.1 le pide al burdeos. La familia fría anterior (`#16181a` / `#6b6f73` / `#9aa0a5`) se retiró entera — mezclar las dos deja los textos secundarios azulados sobre tarjetas cálidas.

**Verificación de contraste** (todos cumplen WCAG AA para texto normal):

| Combinación | Ratio | Nivel |
|---|---|---|
| `--ink` sobre `--surface` | 19,0:1 | AAA |
| `--ink-secondary` sobre `--surface` | 5,06:1 | AA |
| `--ink-secondary` sobre `--canvas` | **4,58:1** | AA — es el caso que manda (ver abajo) |
| `--ink-tertiary` sobre `--surface` | 3,37:1 | Solo texto ≥ 24px o elementos decorativos |
| `--brand` sobre `--surface` | **9,07:1** | AAA |
| `--ink-inverse` sobre `--brand` | **9,07:1** | AAA |
| `--danger` sobre `--surface` | 4,83:1 | AA |
| `--success` sobre `--surface` | 5,02:1 | AA |

### 3.2 Color — modo oscuro del panel

```css
[data-theme="dark"] {
  --brand:            #d4697a;   /* ACLARADO: #832833 da 1,83:1 en oscuro, ilegible */
  --brand-hover:      #e08a97;
  --brand-active:     #c04a5c;
  --brand-tint:       #2a1a1d;
  --brand-tint-border:#3d2429;
  --brand-shadow:     rgba(212, 105, 122, 0.20);

  --canvas:           #141416;
  --surface:          #1e1e21;
  --surface-sunken:   #18181b;

  --ink:              #ececee;
  --ink-secondary:    #a1a1a6;
  --ink-tertiary:     #6e6e73;
  --ink-inverse:      #141416;

  --border:           #2e2e33;
  --border-strong:    #43434a;

  --success: #4ade80;  --success-tint: #052e16;
  --warning: #fbbf24;  --warning-tint: #2a1d05;
  --danger:  #f87171;  --danger-tint:  #2a1213;
  --info:    #38bdf8;  --info-tint:    #05202e;
}
```

> **El acento cambia de valor, no de identidad.** `#832833` sobre fondo oscuro da 1,83:1 y es directamente ilegible; `#d4697a` da 4,83:1. Es el mismo matiz, aclarado. El modo oscuro **solo existe en `/admin`**: la tienda es siempre clara.

### 3.3 Tipografía

**Familia:** `Inter`, con respaldo `system-ui, -apple-system, "Segoe UI", sans-serif`.
Se cargan los pesos **400, 500 y 600**. No se usa 700 ni superior (§9).

La firma del sistema es el **tracking negativo**: el texto grande se comprime, el chico respira.

| Rol | Tamaño | Interlínea | Tracking | Peso | Uso |
|---|---|---|---|---|---|
| `display` | 36px | 1.10 | −0.035em | 600 | Título del hero. Solo en la home |
| `title` | 24px | 1.20 | −0.03em | 600 | Nombre del producto en la ficha, títulos de página |
| `heading` | 20px | 1.25 | −0.025em | 600 | Encabezados de sección |
| `body-lg` | 18px | 1.45 | −0.015em | 400 | Descripción del producto, texto legal |
| `body` | **16px** | 1.50 | −0.011em | 400 | **Base.** Párrafos, campos, botones |
| `body-sm` | 14px | 1.45 | −0.006em | 400/500 | Etiquetas, texto de apoyo, celdas de tabla |
| `caption` | **12px** | 1.35 | 0 | 500 | Metadatos, etiquetas de estado. **Piso absoluto** |

**Reglas:**

1. **Nunca por debajo de 12px.** La referencia baja a 9px para contadores de reseñas; AnaVende no los tiene y la accesibilidad manda (RNF-02).
2. **Los precios usan variantes tabulares** (`font-variant-numeric: tabular-nums`) para que las columnas de números se alineen.
3. **Una sola familia.** No hay tipografía secundaria.
4. **El peso 500 es para etiquetas**, el 600 para títulos. El 400 es todo lo demás.
5. **El castellano ocupa entre 15% y 25% más que el inglés.** Todo componente con texto debe probarse con la cadena más larga que va a recibir, no con la más corta.

### 3.4 Espaciado

Escala de base 4px:

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80
```

| Contexto | Valor |
|---|---|
| Interior de tarjeta (tienda) | 16 – 20px |
| Separación entre tarjetas de la grilla | 16px |
| Entre secciones mayores (tienda) | **64px** móvil · **80px** escritorio |
| Entre elementos de un formulario | 20px |
| Márgenes laterales de página | 16px móvil · 24px tablet · 32px escritorio |

### 3.5 Radios

| Elemento | Tienda | Panel | Motivo de la diferencia |
|---|---|---|---|
| Tarjeta de producto | **28px** | 12px | El panel muestra muchas más filas por pantalla |
| Imagen dentro de tarjeta | 20px | 8px | Siempre ~8px menos que su contenedor (§6.1) |
| Botón | **9999px** | 8px | En la tienda la píldora es la firma; en el panel estorba en barras densas |
| Campo de texto | 9999px | 8px | Ídem |
| Buscador | 9999px | 9999px | Es el mismo componente en ambos |
| Chip / etiqueta de estado | 9999px | 9999px | La píldora se conserva siempre |
| Modal | 20px | 16px | |
| Imagen suelta | 20px | 8px | |

> **Regla del marco blanco:** la imagen interior siempre lleva ~8px menos de radio que su contenedor. Eso deja un borde blanco visible que separa el producto del borde de la tarjeta. Recortar la imagen exactamente a la forma de la tarjeta rompe el efecto y hace que los productos de fondo blanco se fusionen con la página.

### 3.6 Sombras

```css
--shadow-sm:    0 2px 8px rgba(17, 16, 16, 0.06);
--shadow-md:    0 4px 6px -1px rgba(17, 16, 16, 0.10),
                0 2px 4px -2px rgba(17, 16, 16, 0.10);
--shadow-lg:    0 4px 24px rgba(17, 16, 16, 0.12);
--shadow-brand: 0 4px 24px var(--brand-shadow);
--shadow-focus: 0 0 0 3px var(--brand-tint), 0 0 0 1px var(--brand);
```

| Sombra | Se usa en |
|---|---|
| `sm` | Chips, píldoras de categoría, botones secundarios |
| `md` | **Tarjetas de producto.** Es la sombra de dos capas de la referencia |
| `lg` | Modales, menús desplegables, encabezado al hacer scroll |
| `brand` | Solo el botón de envío del buscador y el botón principal del hero |
| `focus` | Anillo de foco de teclado, en todo elemento interactivo |

**Las tarjetas se separan por sombra, no por borde.** Sombra y borde juntos ensucian y aplanan la elevación.

> **Las sombras se tiñen con `--ink`, no con negro.** Al pasar la familia de grises a cálida hubo que mover también el tinte de las tres sombras (`rgba(22,24,26)` → `rgba(17,16,16)`): una sombra azulada debajo de una tarjeta cálida se nota, aunque nadie sepa decir por qué.

---

## 4. Dos escalas: tienda y panel

El sistema tiene **una paleta y una tipografía**, pero **dos escalas de densidad**. Es la adaptación más importante respecto de la referencia.

|  | Tienda | Panel |
|---|---|---|
| Objetivo | Que el producto se vea | Ver mucho de un vistazo y operar rápido |
| Texto base | 16px | **14px** |
| Radio de tarjeta | 24px | 12px |
| Radio de botón | 9999px | 8px |
| Padding de tarjeta | 16 – 20px | 12 – 16px |
| Separación entre secciones | 64 – 80px | 24 – 32px |
| Alto de fila de tabla | — | 44px |
| Ancho máximo | 1200px | Ancho completo, menos el menú lateral |
| Modo oscuro | No | Sí |

**Por qué no son idénticas.** El lenguaje de la tienda —radios de 24px, 80px entre secciones, tarjetas flotantes— existe para que se luzcan cinco o seis productos por pantalla. Aplicado a una tabla de cuarenta órdenes produce una pantalla donde entran seis filas y hay que hacer scroll para todo. La vendedora no está descubriendo productos: está buscando la orden 1043 lo más rápido posible.

**Qué se comparte, y no es negociable:** la paleta, Inter, el rol del color de marca, el estilo del foco, la voz de los mensajes y todos los componentes de formulario.

---

## 5. Estructura de página

### 5.1 Tienda

```
┌──────────────────────────────────────────────────────────┐
│  [AV] AnaVende    ( Buscar productos...       (→) )      │  56px, blanco
│                              ♡ Favoritos  🛒 3   Ana ▾   │  sombra al scrollear
├──────────────────────────────────────────────────────────┤
│   Teclados · Mouses · Auriculares · Cables · Memorias    │  chips, scroll horiz.
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    [ contenido ]           canvas #f2f4f5│
│                    máx. 1200px                           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Zona de entrega y retiro · Medios de pago · Legales      │  pie oscuro
└──────────────────────────────────────────────────────────┘
```

- El encabezado es **fijo (sticky)** y gana `--shadow-lg` al hacer scroll.
- En móvil, el buscador colapsa a un ícono y las acciones pasan a un menú.
- La fila de categorías **desaparece en el panel del comprador y en el checkout**: ahí no se está explorando.

### 5.2 Panel de administración

```
┌────────────┬─────────────────────────────────────────────┐
│ [AV]       │  Órdenes                        [+ Nueva]   │
│            ├─────────────────────────────────────────────┤
│ Inicio     │  ( Buscar )  [Activas][Finaliz.][Cancel.]   │
│ Productos  ├─────────────────────────────────────────────┤
│ Órdenes  ● │  #1043  30/08  M. Gómez   3 ít.  $ 48.200   │  44px por fila
│ Devoluc.   │  #1042  30/08  L. Pérez   1 ít.  $ 12.500   │
│ Catálogo   │  #1041  29/08  A. Ruiz    5 ít.  $ 91.300   │
│ Usuarios   │                                             │
│ Reportes   │                                             │
│ Config.    │                                             │
│            │                                             │
│ 🌙  Ana ▾  │                                             │
└────────────┴─────────────────────────────────────────────┘
   240px
```

- Menú lateral de **240px con etiquetas visibles**, colapsable a 64px de solo íconos.
- En tablet arranca colapsado; en móvil se convierte en un panel deslizable.
- El interruptor de modo oscuro vive al pie del menú.

---

## 6. Componentes

### 6.1 Tarjeta de producto

El componente más importante del sistema. Aparece en catálogo, home, recomendados y favoritos, y es **siempre el mismo**.

```
┌─────────────────────────┐   radio 28px, superficie blanca
│  ┌───────────────────┐  │   sombra md, sin borde
│  │                   │  │
│  │   imagen 1:1      │  │   radio 20px (8 menos que la tarjeta)
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  LOGITECH               │   caption 12px/500, secundario, VERSALITAS
│  Teclado mecánico K120  │   body-sm 14px/500, ink, máx. 2 líneas
│                         │
│  $27.500,00 $24.500,00 ●●│  una línea: tachado y después final
│                     ♡   │   puntos de color a la derecha
└─────────────────────────┘
```

| Estado | Tratamiento |
|---|---|
| Reposo | `--shadow-md` |
| Hover | Elevación a `--shadow-lg`, la tarjeta sube 2px, la imagen escala a 1.03 dentro de su marco. Transición 200ms |
| Foco | `--shadow-focus` sobre toda la tarjeta |
| **Con descuento** | Precio tachado a la izquierda del final, en la misma línea. El final va en burdeos. **Sin píldora sobre la imagen** |
| **Sin stock** | Imagen al 55% de opacidad + píldora «Sin stock» centrada sobre ella, superficie blanca al 92%. **La tarjeta sigue siendo clicable** (RN-05) |
| **Favorito** | Corazón arriba a la derecha de la imagen, **siempre a la vista**. Contorno cuando no está marcado, **relleno `--brand`** cuando sí. Área táctil de 44px aunque el ícono mida 20. Fondo `--surface` al 92% detrás, porque la imagen de abajo puede ser de cualquier color |

**Sobre la marca en versalitas:** separa visualmente marca de producto sin sumar un color ni un peso. Es un recurso de la referencia y funciona bien con Inter.

**Sobre los dos números, y no cuatro.** La tarjeta llegó a mostrar la píldora «−$ 9.900» sobre la imagen, el precio final, el tachado y «Ahorrás $ 9.900»: la misma cifra dos veces y cuatro números para comunicar una sola oferta. Quedan los dos que dicen cosas distintas —cuánto valía y cuánto vale—, que es lo que ya dibujaba este esquema y lo que hace el canvas aprobado en F3.8. Desde el 2026-09-08 **la ficha hace lo mismo** (§6.7, RN-04c): la regla dejó de ser de la tarjeta y pasó a ser de la tienda.

**Sobre el corazón, que no espera al hover.** Revelarlo al pasar el mouse deja media tienda sin favoritos: en un teléfono no hay hover, y ahí el botón no existiría. Y va **encima** del enlace estirado —`z-10`, fuera del ancla— porque envolver la tarjeta entera en un `<a>` metería el corazón adentro del enlace: HTML inválido, e inalcanzable con teclado. El relleno no es la única señal de estado: el botón lo anuncia también para lectores de pantalla (§9), que no ven un contorno lleno.

**Sobre los puntos de color.** Hasta cuatro, y «+N» si hay más; un producto con nueve colores llenaría media tarjeta de puntos y empujaría el precio. **No son seleccionables**: elegir color es de la ficha (§6.5), y hacerlos clicables metería un segundo destino dentro de una tarjeta que ya es un enlace entero. Llevan borde: un punto blanco sobre superficie blanca, sin contorno, no existe.

### 6.2 Buscador

El componente firmado del sistema, heredado directamente de la referencia.

```
╭────────────────────────────────────────────╮
│  Buscar productos...                  ╭──╮ │   píldora, blanco
│                                       │ →│ │   borde --border 1px
╰───────────────────────────────────────╰──╯─╯   botón 40px burdeos
                                                 con --shadow-brand
```

- Alto 48px, padding 20px a la izquierda, 52px reservados a la derecha.
- El botón circular burdeos lleva `--shadow-brand`: **la elevación tiene el color de la marca**, que es el detalle que la referencia identifica como su firma.
- Al enfocar, el borde pasa a `--border-strong` y aparece el anillo de foco.
- Con texto escrito aparece una «×» para limpiar, antes del botón de envío.

### 6.3 Botones

| Variante | Fondo | Texto | Borde | Uso |
|---|---|---|---|---|
| **Principal** | `--brand` | blanco | — | Una sola por pantalla |
| **Secundario** | `--surface` | `--ink` | `--border` | Acciones alternativas |
| **Terciario** | transparente | `--ink-secondary` | — | «Cancelar», «Volver» |
| **Destructivo** | transparente | `--danger` | `--danger` | Eliminar, cancelar orden. **Con ícono** |
| **Destructivo confirmado** | `--danger` | blanco | — | **Solo dentro del diálogo de confirmación** |

| Tamaño | Alto | Texto | Padding |
|---|---|---|---|
| `sm` | 32px | 14px | 12px |
| `md` | 40px | 14px | 16px |
| `lg` | 48px | 16px | 24px |

**Estados:** hover cambia a `--brand-hover` (más claro); `active` a `--brand-active`; `disabled` va al 40% de opacidad sin cambiar de color y con `cursor: not-allowed`; `loading` reemplaza el texto por un indicador **conservando el ancho del botón**, para que la interfaz no salte.

**Un botón deshabilitado siempre explica por qué** — en texto adyacente o en un *tooltip*. Un botón apagado sin explicación es un callejón sin salida (RNF-08).

### 6.4 Etiquetas de estado

Píldora, `caption` 12px peso 500, fondo de tinte y texto del color semántico.

| Estado | Color | Texto |
|---|---|---|
| Orden activa | `--info` | Activa |
| Orden finalizada | `--success` | Finalizada |
| Orden cancelada | `--ink-secondary` | Cancelada |
| Origen manual | `--warning` | Manual |
| Sin stock | `--danger` | Sin stock |
| Stock bajo | `--warning` | Quedan N |
| Producto inactivo | `--ink-secondary` | Inactivo |
| Usuario bloqueado | `--danger` | Bloqueado |

**Nunca solo color.** Toda etiqueta lleva texto: quien no distingue rojo de verde debe poder operar el panel igual (RNF-02).

### 6.5 Selector de color de producto

```
Color:  Negro
        ●  ○  ○  ⊘
        │  │  │  └── sin stock: tachado en diagonal, 40% opacidad
        │  │  └───── disponible
        │  └──────── disponible
        └─────────── seleccionado: anillo burdeos de 2px con 2px de separación
```

- Muestras circulares de 32px con el hexadecimal del color, y **44px de área táctil** (§9): el relleno alrededor de la muestra es lo que concilia las dos medidas.
- Los colores claros llevan un borde `--border` de 1px para no desaparecer sobre el blanco.
- **El nombre del color se muestra siempre** junto al selector: no se depende del color para identificar la opción.
- **Un color sin stock SÍ se puede elegir**, con la barra diagonal y el 40% puestos. Decía lo contrario hasta el 2026-09-08, y el cambio tiene un motivo concreto: elegir el color agotado es lo que arma el mensaje de «Preguntá si va a haber» (§7.3, RF-03). Con el color bloqueado, ese estado no se alcanzaba desde ninguna parte de la pantalla. Lo que queda deshabilitado son las acciones de **compra**, no la elección.
- El 40% va sobre el **relleno del color**, no sobre la muestra entera: con la opacidad afuera, el anillo burdeos del color elegido se destiñe con ella y un producto agotado en su único color se ve sin marcar.
- Son `<input type="radio">` de verdad, escondidos bajo la muestra: el recorrido con flechas, el anuncio de «2 de 4» y el agrupado los da el navegador.

### 6.6 Campos de formulario

| Elemento | Especificación |
|---|---|
| Alto | 48px tienda · 40px panel |
| Radio | Píldora en la tienda · 8px en el panel |
| Borde | `--border` 1px; `--border-strong` al enfocar, más anillo de foco |
| Etiqueta | `body-sm` 14px peso 500, **siempre visible arriba**. No hay etiquetas flotantes |
| Ayuda | `caption` 12px, `--ink-secondary`, debajo del campo |
| Error | Borde `--danger`, mensaje en `--danger` **con ícono**, debajo |
| Obligatorio | Se marcan los **opcionales** con «(opcional)», no los obligatorios con asterisco |

**Los errores aparecen al salir del campo, no mientras se escribe**, salvo confirmación de contraseña. Validar cada tecla convierte un formulario en una regañina.

### 6.7 Precio

Componente propio, porque aparece en todas partes y tiene que ser consistente.

```
FICHA (§7.3) — apilado
Sin oferta:      $ 27.500,00              ink, peso 600, 24px
Con oferta:      $ 24.500,00              burdeos, peso 600, 24px
                 $ 27.500,00              tachado, terciario, 12px

TARJETA (§6.1) — una línea
Sin oferta:      $ 27.500,00              ink, peso 600
Con oferta:      $ 27.500,00 $ 24.500,00  tachado terciario 12px, después burdeos 600
```

**Dos números en las dos, y lo único que cambia es la disposición.** La ficha llevó «Ahorrás $ 3.000,00» hasta el 2026-09-08 y ya no: una oferta se comunica con cuánto valía y cuánto vale, y el tercer número dice la misma oferta otra vez (RN-04c). Lo que separa las dos composiciones es el lugar. En la grilla el precio comparte renglón con los puntos de color y tiene que entrar en una línea; en la ficha es lo primero que se lee después del nombre, sube a 24px y el tachado baja, donde no le compite.

El tachado va **primero en la tarjeta** porque así se lee un cartel de oferta —«valía tanto, ahora tanto»— y **después en la ficha** porque ahí el final ya es lo más grande de la pantalla y no necesita que nada lo anuncie.

- Formato `es-AR`: `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- **Siempre con decimales** (RN-02). Nunca se aclara nada sobre IVA.
- El descuento se guarda como **monto** y nunca como porcentaje (RN-04b), y **no se muestra**: lo comunica el tachado (RN-04c). Un «11% off» además obliga a calcular sobre un número que todavía no se leyó.
- Variantes numéricas tabulares para que las columnas se alineen.

### 6.8 Galería de la ficha

- **Escritorio:** tira vertical de miniaturas de 64px **a la izquierda**, imagen principal grande a la derecha, y flechas ‹ › sobre los bordes de la foto. La foto entera abre el visor.
- **Móvil:** carrusel deslizable a ancho completo con puntos indicadores. Sin miniaturas y sin flechas: el dedo ya hace las dos cosas.
- Relación 1:1, `object-fit: contain` sobre superficie blanca — los periféricos suelen venir con fondo blanco y recortarlos los mutila.
- **La foto llega al borde de la tarjeta y la recorta su radio.** Nada de relleno alrededor: un marco blanco adentro de una tarjeta blanca no se lee como marco, sólo como una foto más chica.
- Al cambiar de color, la galería se reemplaza con una transición de opacidad de 150ms.

**Las miniaturas se dibujan siempre, aunque haya una sola foto.** Ocupan una columna de la fila, así que esconderlas con menos de dos corre la foto principal de lugar al pasar de un color con tres fotos a uno con una. Ese salto no se lee como «este color tiene menos fotos»: se lee como que la página se movió sola. Lo mismo vale para la fila de puntos en el teléfono, que se reserva aunque quede vacía.

**Las miniaturas van primero en el DOM**, que es donde se ven. Se puede dejar la foto primera y girar la fila con `flex-row-reverse`, y eso es exactamente el desacuerdo entre orden visual y orden de lectura que §9 no permite.

**Las flechas se apagan en las puntas, no dan la vuelta.** Con encastre de desplazamiento, saltar de la última a la primera arrastra la pista entera de un lado al otro y se ve como un error.

#### Visor ampliado

No hay botón de ampliar: **lo anuncia el cursor** —lupa con más sobre la foto—. Un ícono de 36px en una esquina le pide a alguien que descubra un control para hacer lo que ya intentó, que es tocar la foto.

El visor ocupa casi toda la pantalla, con las miniaturas a la izquierda, las flechas abajo a la derecha y la cruz arriba a la derecha. **Un clic en cualquier lugar que no sea un control cierra**: sin eso, la única salida sería esa cruz.

Tiene **dos niveles**:

1. **Encuadrada** — la foto entera, achicada para entrar en la pantalla. Cursor: lupa con más.
2. **Tamaño real** — la foto a sus píxeles, recorrible moviendo el mouse. Cursor: lupa con menos. Es lo que hace falta para mirar de cerca la textura de una tecla o lo que dice una etiqueta, y encuadrar una foto es casi siempre achicarla.

Entre los dos hay **una transición, no un salto**: la foto está siempre puesta a su tamaño natural y es `transform` quien la encoge (`scale`) o la corre (`translate`), así que el navegador interpola entre las dos formas. Se entra **centrado en el punto donde se hizo clic**: quien apuntó a la etiqueta espera ver la etiqueta, no el centro de la foto.

Si la foto ya entra a 1:1 no hay segundo nivel y el cursor no lo promete — pasa con las fotos chicas, que es un caso real.

### 6.9 Tabla del panel

| Elemento | Especificación |
|---|---|
| Alto de fila | 44px |
| Cabecera | `caption` 12px/500, `--ink-secondary`, versalitas, fondo `--surface-sunken`, fija al scrollear |
| Celda | `body-sm` 14px |
| Separador | 1px `--border` entre filas |
| Hover de fila | Fondo `--surface-sunken`, cursor de puntero si la fila es clicable |
| Números | Alineados a la derecha, tabulares |
| Acciones | Última columna, alineada a la derecha, íconos con etiqueta accesible |
| Vacío | Ilustración mínima + explicación + acción sugerida. Nunca una tabla vacía a secas |
| Carga | Filas fantasma del alto real, no un spinner centrado |

**En móvil las tablas se vuelven tarjetas**, no un scroll horizontal. Una tabla de siete columnas en un teléfono es inoperable.

### 6.10 Logo de marca

**El recuadro del logo es siempre claro, en los dos modos.** Un logo de marca llega casi siempre como trazo sobre fondo transparente, y el trazo suele ser oscuro: sobre la superficie del panel en modo oscuro desaparece —es el mismo 1,83:1 de §2.3—. Con el logo de AnaVende eso se resuelve derivando una versión clara (`scripts/derivar-logo.mts`), pero el logo de Logitech no es nuestro y no se puede repintar.

La salida es no depender del modo: el logo va sobre un chip claro fijo, con el borde de §3. Se elige claro y no oscuro porque **es el fondo que va a tener en la tienda**, que es acromática sobre `--canvas`. Un logo que se ve bien acá se ve bien allá.

| Elemento | Especificación |
|---|---|
| Chip del listado | 24px, radio 4px, `--logo-chip`, `object-contain` |
| Chip del diálogo | 64px, radio de control del panel, `--logo-chip`, 4px de aire interior |
| Sin logo | El listado **no reserva lugar**; el diálogo muestra el recuadro vacío con su ícono, del mismo tamaño que con logo |
| Texto alternativo | Vacío: es decorativo. El nombre de la marca está al lado, en texto, y repetirlo se lo haría leer dos veces (§9) |

El recuadro del diálogo **no cambia de tamaño** al elegir un logo. Si creciera, el diálogo entero saltaría bajo el cursor justo cuando hay que apretar «Guardar».

### 6.11 Editor de descripción y texto con formato

Dos piezas de la misma decisión (FS RF-15): dónde se escribe la descripción y cómo se lee después.

**El editor, en el panel.** Barra de herramientas fija arriba del área de escritura, con un botón por formato disponible y ninguno más: negrita, cursiva, lista con viñetas, lista numerada, subtítulo. Nada de menús desplegables de tipografía, tamaño ni color — el formato lo pone este documento, no quien escribe.

| Elemento | Especificación |
|---|---|
| Área de escritura | Mínimo 200px de alto, crece con el contenido hasta 480px y ahí scrollea |
| Barra | Botones de ícono de 32px, `--ink-secondary`; el formato activo en el cursor se marca con `--surface-sunken` y `aria-pressed` |
| Borde y foco | Los mismos de §6.6: el conjunto barra + área es **un solo campo** y el anillo de foco lo rodea entero |
| Contador | Aparece recién en los últimos 500 caracteres, en `caption`; antes es ruido |
| Teclado | Negrita y cursiva responden a `⌘B` / `⌘I`. Toda la barra es alcanzable con `Tab` |

**El texto renderizado, en la ficha.** Es el único bloque de la tienda con texto largo, y necesita medida y aire propios:

| Elemento | Especificación |
|---|---|
| Ancho de línea | Máx. 68 caracteres. Una descripción a 1200px de ancho no se lee |
| Cuerpo | `body` 16px, interlineado 1,6 |
| Separación entre párrafos | 12px |
| Subtítulo | `body` 16px peso 600, con 20px arriba y 8px abajo. **No** hereda la escala de títulos de §4: es un rótulo dentro de un texto, no una sección de la página |
| Listas | Sangría 20px, 6px entre ítems, viñeta en `--ink-tertiary` |
| Negrita | Peso 600, mismo color. Nunca el acento: el burdeos es de la marca y de lo accionable, no del énfasis |

---

## 7. Composición de pantallas

### 7.1 Home

```
┌────────────────────────────────────────────────────┐
│                                                    │
│            Todo para tu setup                      │  display 36px
│      Periféricos y accesorios con envío            │  body-lg, secundario
│                                                    │
│         (  Buscar productos...        (→)  )       │  buscador, máx 560px
│                                                    │
│      [Teclados] [Mouses] [Auriculares] [Cables]    │  píldoras
│                                                    │
├──────────────────────── 80px ──────────────────────┤
│  Destacados                                   →    │  heading 20px
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │  grilla de 4
├──────────────────────── 80px ──────────────────────┤
│  En oferta                                    →    │
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │
├──────────────────────── 80px ──────────────────────┤
│  Vistos recientemente                              │  solo si hay historial
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │
├──────────────────────── 80px ──────────────────────┤
│  Medios de pago:  [logo] [logo] [logo]             │
│  Entregamos en Viedma, Patagones y alrededores      │
└────────────────────────────────────────────────────┘
```

Sin *hero* fotográfico: el hero es el buscador. Es una tienda de reventa, no una marca de estilo de vida, y la foto genérica de banco de imágenes le resta credibilidad.

### 7.2 Catálogo

> **Reescrita en F3.8.** Antes decía «filtros en columna izquierda de 260px». El canvas aprobado propone una barra con panel desplegable, y se adoptó: la columna lateral se come 260px de los 1200 —el 22%— para algo que se toca una vez y después estorba durante toda la sesión.

- **Una barra de tres controles**, del mismo alto (48px), encima de la grilla: buscador píldora que ocupa el espacio sobrante, botón «Filtros» y desplegable de orden. Tres alturas distintas en una fila se leen como un error.
- **El botón «Filtros» lleva el número de filtros puestos** en un círculo burdeos. La búsqueda no se cuenta ahí: tiene su propio campo al lado, y sumarla haría que el número no se corresponda con lo que se ve al abrir.
- **El panel se despliega de lado a lado por debajo de la barra**, no del ancho del botón, y se posiciona sobre la grilla en vez de empujarla. Abre con un `<details>` nativo: sin JavaScript, con teclado, y conservando su estado entre navegaciones — tocar un chip no lo cierra.
- **Dentro del panel, los tres grupos van en columnas**, no apilados: apilados el panel pasaba los 500px de alto y «Color» quedaba abajo de todo, así que se elegía categoría, se elegía marca y nadie llegaba a ver que había colores. En un teléfono vuelven a una sola columna.
- **Todo son chips con su conteo**: categoría, marca y color, cada grupo con su encabezado en versalitas. El color suma un punto relleno con su hexadecimal. El descuento es la excepción y se dibuja como casilla: no es una opción entre varias, es sí o no.
- **El pie del panel cierra el trato**: «Limpiar filtros» a la izquierda y **«Ver N productos»** a la derecha, relleno burdeos. Sin ese botón, la única forma de cerrar es volver a subir hasta «Filtros», que es justo el gesto que nadie encuentra después de elegir tres cosas. Es la única línea de JavaScript del panel —un `<details>` no se cierra desde adentro sin script— y degrada: su `href` baja a la grilla.

**Los tres estados del burdeos en esta pantalla no se pisan**, y esa es la regla que los mantiene distinguibles:

| Qué | Tratamiento |
|---|---|
| Chip **elegido** dentro del panel | Relleno burdeos, texto blanco |
| Chip de **filtro aplicado** sobre la grilla | Tinte `--brand-tint`, texto burdeos, borde tenue |
| Botón **«Filtros»** con algo puesto | Tinte `--brand-tint`, texto burdeos |

El botón «Filtros» **tiene que teñirse**, no alcanza con el círculo del contador: en una barra de tres controles blancos ese punto pasa desapercibido y la persona no ve que la lista que está mirando está recortada.
- Los filtros aplicados aparecen además como **chips removibles** arriba de la grilla, con «Limpiar todo», porque con el panel cerrado son la única señal de por qué hay nueve resultados.
- El conteo de resultados va a la derecha de esos chips, y es `aria-live`.
- **El `<h1>` dice qué se está mirando**: el término buscado, el nombre de la categoría elegida, o «Todos los productos».
- La grilla es 2 / 3 / 4 columnas según ancho, con 16px de separación.

**Limitación registrada:** categoría, marca y color son de **selección única**; RF-02 los pide multiselección. Filtrar por los tres a la vez ya se puede; lo que no se puede es elegir dos marcas. Tampoco está el rango de precio de RF-02. Son funciones pendientes, no decisiones de diseño.

### 7.3 Ficha de producto

```
┌──────────────────────┬─────────────────────────────┐
│ ┌──┐                 │  LOGITECH                   │  caption, versalitas
│ └──┘                 │  Teclado mecánico K120      │  title 24px
│ ┌──┐    imagen       │                             │
│ └──┘  principal   ›  │  $ 24.500,00                │  burdeos, 24px
│ ┌──┐                 │  $ 27.500,00                │  tachado, terciario, 12px
│ └──┘                 │                             │
│                      │  Color: Negro               │
│    ↑ pegada          │  ● ○ ○ ⊘                    │
│      (sticky)        │                             │
│                      │  Cantidad  [− 1 +]          │
│                      │  ✓ 5 disponibles            │
│                      │                             │
│                      │  [  Agregá al carrito  ]    │  principal, ancho completo
│                      │  [ Comprá ya por WhatsApp ] │  secundario, con ícono
│                      │                             │
│                      │  [ ♡ Guardar ][ ⤴ Compartir]│  dos secundarios, mitad y mitad
│                      │  ─────────────────────────  │
│                      │  Nuevos y en su caja        │
│                      │  Entrega en Viedma, Carmen  │
│                      │  de Patagones y alrededores │
│                      │  Pago al confirmar: …       │
│                      │                             │
│                      │  Sobre el producto          │  h2
│                      │  (descripción enriquecida)  │
│                      │                             │
│                      │  ┌─────────────────────────┐│
│                      │  │ ¿Cómo sigue después de  ││  recuadro, superficie
│                      │  │  comprar?               ││
│                      │  │  ① armás el pedido      ││
│                      │  │  ② confirmamos          ││
│                      │  │  ③ coordinamos entrega  ││
│                      │  │  [ ↩ Garantías y dev. ] ││  el botón va ADENTRO
│                      │  └─────────────────────────┘│
└──────────────────────┴─────────────────────────────┘
   ─────────── 64px ───────────
   También te puede interesar        → 4 tarjetas
   ─────────── 64px ───────────
   Productos similares               → 4 tarjetas
```

**La columna derecha desplaza y la galería se queda pegada.** La descripción, los datos y el recuadro viven en esa columna, así que es mucho más alta que la foto; sin `sticky`, leer la descripción es perder de vista el producto del que habla. Los bloques de recomendados sí van a lo ancho, debajo de las dos columnas: son otra pantalla dentro de la misma página.

**El corazón NO va sobre la imagen en la ficha**, y sí en la tarjeta (§6.1). Es la misma acción dibujada distinto a propósito: en una grilla el ícono solo es la única forma de que entre, y acá hay lugar para que diga «Guardar» con todas las letras al lado de «Compartir». Un ícono suelto sobre la foto es, además, la única señal que un lector de pantalla no aprovecha sin etiqueta.

**«Agregá al carrito» se dibuja apagado y sin explicación a la vista.** El carrito es F5.5 y todavía no existe; el botón está para ver la composición terminada, y el renglón que explicaba la falta era, en la pantalla, más grande que la falta. El motivo queda para lectores de pantalla (`aria-describedby`) y desaparece con el botón el día que se encienda. Es una excepción anotada a §8, no un olvido.

Para el **visitante sin sesión**, el botón principal dice **«Iniciá sesión para comprar»** y el secundario «Comprar por WhatsApp» (RF-08).

**El corazón va sobre la imagen, arriba a la derecha, igual que en la tarjeta** (§6.1) — mismo ícono, mismo lugar, mismos dos estados. Quien lo usó en la grilla no tiene que buscarlo de nuevo acá. Convive con la ampliación de la galería sin pelearse: la imagen es la que abre el modal y el corazón es un botón de 44px por encima, que es exactamente el arreglo que ya tiene la tarjeta con su enlace estirado.

**El precio son dos números, como en la tarjeta** (§6.7, RN-04c). La ficha llevó «Ahorrás $ 3.000,00» y ya no.

#### Sin stock

Es un estado de la **variante elegida**, no del producto: con el negro agotado y el blanco disponible, cambiar de color sale de este estado sin recargar (RF-03).

```
│  Color: Negro               │
│  ● ○ ○ ⊘                    │
│                             │
│  Cantidad  [− 1 +]          │  deshabilitado, atenuado
│  ⊘ Sin stock en negro       │  --danger, con ícono
│                             │
│  [ Preguntá si va a haber ] │  PRINCIPAL, abre WhatsApp
│                             │
│  Te contestamos por         │  caption, --ink-secondary
│  WhatsApp. No lo reservamos │
│  ni te avisamos solos.      │
```

Tres cosas que este estado hace a propósito:

- **Lo dice con palabras**, no con un botón apagado. Un botón gris sin explicación se lee como una falla del sitio, no como una falta de stock (§8, §9: nada se comunica sólo con color).
- **La consulta por WhatsApp sube a principal.** Es la única acción que le queda a quien llegó hasta acá; dejarla de secundaria mientras el principal está apagado deja la pantalla sin ninguna salida a la vista.
- **La aclaración de abajo no es letra chica, es la promesa que no hacemos.** «Preguntá si va a haber» suena a que el sitio va a avisar, y no hay ningún aviso: la respuesta la da la vendedora por WhatsApp, y decirlo acá evita que alguien se quede esperando.

**El corazón sigue disponible sin stock**, y es de las pocas cosas que sí siguen andando: marcar favorito algo agotado es precisamente para qué sirven los favoritos.

### 7.4 Carrito

- Lista de ítems a la izquierda, resumen fijo a la derecha (abajo en móvil).
- Cada ítem: miniatura 80px, nombre, color, precio unitario, control de cantidad, subtotal y «Quitar».
- **Los avisos de cambio van arriba de todo, no dentro del ítem**, y son persistentes hasta que se los cierre:

```
┌────────────────────────────────────────────────────┐
│ ⓘ  El precio de Teclado K120 pasó de $27.500,00    │  info, tinte
│    a $24.500,00                                    │
├────────────────────────────────────────────────────┤
│ ⚠  Quitamos Mouse G203 de tu carrito porque ya no  │  warning, tinte
│    está disponible                                 │
└────────────────────────────────────────────────────┘
```

- Debajo del resumen: **«Completá tu setup»** con recomendados (RF-32).

### 7.5 Confirmación de orden

Pantalla de éxito, centrada, sin distracciones:

```
              ✓                       círculo burdeos, 64px
      ¡Listo, tu pedido #1043         title 24px
         quedó registrado!

   Guardamos el stock hasta que        body, secundario
   coordinemos el pago.

   ┌──────────────────────────────┐
   │  resumen de la orden          │  tarjeta, radio 24px
   └──────────────────────────────┘

   [  Coordinar pago por WhatsApp  ]   principal
   [  Ver mis compras  ]               secundario
```

El botón de WhatsApp es la **acción principal**: es lo que efectivamente cierra la venta (RF-12).

---

## 8. Estados

Un componente no está terminado hasta que sus cinco estados están definidos.

| Estado | Regla |
|---|---|
| **Cargando** | Esqueletos con la **forma real** del contenido, no spinners centrados. La página no debe saltar cuando llegan los datos |
| **Vacío** | Explicar qué falta **y ofrecer la acción**. «Todavía no tenés favoritos» + «Explorar el catálogo». Nunca un espacio en blanco |
| **Sin resultados** | Repetir el término buscado, sugerir quitar filtros, y ofrecer «Limpiar todo» |
| **Error** | Qué pasó, en castellano, y qué hacer. Con acción de reintentar. Nunca un código ni un *stack trace* |
| **Deshabilitado** | Siempre acompañado del motivo, visible o en *tooltip* |

**Transiciones:** 150ms para color y opacidad, 200ms para transformaciones, `cubic-bezier(0.4, 0, 0.2, 1)`. Nada por encima de 300ms. Todo se desactiva bajo `prefers-reduced-motion`.

---

## 9. Accesibilidad

Requisito RNF-02. No es una capa final.

| Punto | Regla |
|---|---|
| **Contraste** | Texto normal ≥ 4,5:1, texto grande ≥ 3:1. Verificado en §3.1 |
| **Foco** | `--shadow-focus` visible en **todo** elemento interactivo. Jamás `outline: none` sin reemplazo |
| **Teclado** | Todo flujo de compra completable sin mouse. Orden de tabulación lógico |
| **Color solo** | Nunca es el único portador de información: los estados llevan texto, los colores llevan nombre, los errores llevan ícono |
| **Imágenes** | Texto alternativo con producto, marca y color: «Teclado mecánico K120 Logitech, negro» |
| **Formularios** | Etiqueta asociada siempre; errores anunciados por lector de pantalla |
| **Área táctil** | Mínimo 44×44px en móvil |
| **Movimiento** | Se respeta `prefers-reduced-motion` |
| **Zoom** | Usable al 200% sin scroll horizontal |
| **Idioma** | `lang="es-AR"` en el documento |

---

## 10. Voz

La misma persona escribe toda la interfaz: **cercana, directa, rioplatense**.

| Sí | No |
|---|---|
| «Agregá al carrito» | «Agregar al carrito» / «Añade al carrito» |
| «Quedan 3 unidades» | «Stock limitado» |
| «No pudimos guardar los cambios. Probá de nuevo.» | «Error 500: Internal Server Error» |
| «Todavía no tenés compras» | «Sin registros» |
| «El precio de X pasó de $A a $B» | «Los precios pueden haber variado» |
| «Coordinar pago por WhatsApp» | «Continuar» |

**Reglas:** voseo siempre. Nunca se culpa a la persona («ingresaste mal el email» → «ese email no parece válido»). Los botones dicen la acción concreta, no «Aceptar». Nada de vocabulario técnico: no existen «variantes», «SKU» ni «entidades» en la interfaz.

---

## 11. Qué hacer y qué no

### Hacer

- Usar el burdeos **solo** en acciones principales, precios en oferta, estados activos e identidad.
- Dejar que la foto del producto ponga el color; la interfaz se mantiene acromática.
- Separar las tarjetas con sombra, nunca con borde.
- Mantener 64–80px entre secciones de la tienda: el aire es parte de la identidad.
- Dar a la imagen interior ~8px menos de radio que su contenedor.
- Aclarar el burdeos al hacer hover, nunca oscurecerlo.
- Probar cada componente con el texto en castellano más largo que va a recibir.
- Definir los cinco estados antes de dar un componente por terminado.

### No hacer

- **No sumar un segundo color saturado.** El sistema tiene uno y de ahí sale su fuerza.
- **No usar burdeos relleno para acciones destructivas.** Están a 7 grados de matiz del rojo de peligro: se separan por forma (§2.2).
- No usar pesos de 700 o más: la jerarquía sale del grado y del tracking.
- No poner texto por debajo de 12px.
- No poner borde y sombra a la vez en una tarjeta elevada.
- No usar fondos de color en contenedores de interfaz.
- No agregar degradados, ilustraciones decorativas ni formas de adorno.
- No aplicar la escala de la tienda al panel: una tabla con radios de 24px y 80px de aire es inoperable.
- No ocultar productos sin stock: se muestran señalizados (RN-05, RN-06).
- No comunicar un estado solo con color.

---

## 12. Implementación

### 12.1 Tailwind 4

Los tokens se declaran con `@theme`, que genera las utilidades automáticamente:

```css
@import "tailwindcss";

@theme {
  --color-brand:        #832833;
  --color-brand-hover:  #9d3040;
  --color-brand-active: #6b202a;
  --color-brand-tint:   #fdf2f3;

  --color-canvas:       #f2f4f5;
  --color-surface:      #ffffff;
  --color-ink:          #16181a;
  --color-ink-secondary:#6b6f73;
  --color-ink-tertiary: #9aa0a5;
  --color-border:       #e8eaeb;

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;

  --radius-card:   24px;
  --radius-image:  16px;
  --radius-panel:  12px;

  --shadow-card:  0 4px 6px -1px rgb(22 24 26 / 0.10),
                  0 2px 4px -2px rgb(22 24 26 / 0.10);
  --shadow-brand: 0 4px 20px rgb(131 40 51 / 0.26);
}
```

El modo oscuro del panel se activa con `data-theme="dark"` en el elemento raíz de `/admin`, redefiniendo las mismas variables (§3.2).

### 12.2 shadcn/ui

Se usa como base y se le mapean los tokens en lugar de reescribir componentes.

| Componente de shadcn | Ajuste |
|---|---|
| `Button` | Variante `brand` (principal) y `destructive` como **contorno** por defecto |
| `Card` | Radio 24px en la tienda, 12px en el panel; sombra en lugar de borde |
| `Input`, `Select` | Píldora en la tienda, 8px en el panel; etiqueta siempre visible |
| `Badge` | Mapeado a las etiquetas de estado de §6.4 |
| `Dialog` | Radio 20px; el botón de confirmación destructiva va **relleno** acá |
| `Table` | Alto de fila 44px, cabecera fija |
| `Skeleton` | Con la forma real del contenido |

**Componentes propios, que no vienen de shadcn:** tarjeta de producto, precio, selector de color, galería, buscador con botón de envío, el bloque de avisos del carrito, y el chip de logo (§6.10) y el editor de descripción con su bloque de texto renderizado (§6.11).

### 12.3 Tipografía

Inter se carga con `next/font/google`, con subconjunto `latin`, `display: 'swap'` y solo los pesos 400, 500 y 600. Se declara como variable CSS y se consume desde `--font-sans`.

### 12.4 Skills de diseño obligatorias

Al programar cualquier apartado visual del frontend —pantallas, componentes, estados, animaciones, ajustes de espaciado o color— se usan las skills **`impeccable`** y **`ui-ux-pro-max`** para elevar el resultado por encima de la implementación literal de este documento.

| Skill | Cuándo se invoca | Qué aporta |
|---|---|---|
| `impeccable` | Al construir o rehacer una pantalla o componente completo, y antes de dar por terminado un apartado visual | Dirección visual, jerarquía, pulido de detalle, revisión de acabado y estados límite |
| `ui-ux-pro-max` | Al decidir layout, tipografía, color, gráficos, accesibilidad o comportamiento responsive de una pieza concreta | Guías de UX, escalas tipográficas, paletas, patrones por stack y criterios de interacción |

**Cómo se combinan con esta referencia:**

- Este documento es el **contrato**: tokens (§3), escalas (§4), componentes (§6) y reglas de accesibilidad (§9) no se negocian. Las skills mejoran *dentro* de ese marco, no lo reemplazan.
- Si una skill propone algo que contradice un token o una decisión registrada (§14), manda este documento. Si la propuesta es claramente mejor, se registra como decisión nueva antes de aplicarla.
- El acento sigue siendo uno solo (`#832833`), la interfaz sigue siendo acromática y la foto del producto sigue mandando: ninguna mejora visual justifica romper esas tres reglas.

**Momentos en que su uso no es opcional:**

1. Primera implementación de cada pantalla de §7.
2. Componentes propios de §12.2 (tarjeta de producto, precio, selector de color, galería, buscador, avisos del carrito, editor de descripción, chip de logo).
3. Estados vacíos, de carga y de error (§8).
4. Cualquier ajuste que el equipo perciba como "quedó bien pero soso".

---

## 13. Trazabilidad

| Requisito | Resuelto en |
|---|---|
| RF-01 Home | §7.1 |
| RF-02 Catálogo, filtros, orden | §7.2, §6.1 |
| RF-03 Ficha, selector de color | §7.3, §6.5, §6.8 |
| RF-04 Compra por WhatsApp | §6.3, §7.3, §7.5 |
| RF-08 Carrito y avisos de cambio | §7.4 |
| RF-12 Confirmación de orden | §7.5 |
| RF-14 a RF-28 Panel | §4, §5.2, §6.9 |
| RF-32 Recomendados | §7.3, §7.4 |
| RF-33 Vistos recientemente | §7.1 |
| RN-02 Formato de moneda | §6.7 |
| RN-04b Descuento como monto | §6.7 |
| RN-04c Dos números, nunca tres | §6.1, §6.7, §7.3 |
| RN-05, RN-06 Agotados visibles | §6.1, §6.5, §7.3 |
| RF-10 Favoritos | §6.1, §7.3 |
| RNF-01 Responsive | §5, §6.9, §7.2 |
| RNF-02 Accesibilidad | §9 |
| RNF-08 Errores accionables | §8, §10 |

---

## 14. Decisiones registradas

| Decisión | Motivo |
|---|---|
| Acento `#832833`, del logo | Es el color real de la marca, y da 9,07:1 de contraste (AAA), lo que además habilita su uso como color de texto |
| El hover aclara en vez de oscurecer | El color base ya es oscuro; oscurecerlo lo acerca al negro y anula la señal |
| Destructivo por contorno, no por color | Solo 7 grados de matiz separan la marca del rojo de peligro: la forma es la que distingue |
| `#d4697a` como acento en modo oscuro | `#832833` da 1,83:1 sobre fondo oscuro: ilegible |
| Inter en lugar de GT Standard | GT Standard es paga; Inter es el sustituto que indica la propia referencia |
| Piso tipográfico de 12px | Accesibilidad. Los 9px de la referencia eran para contadores de reseñas, que AnaVende no tiene |
| Encabezado superior en lugar de riel lateral | Un riel de íconos sin etiquetas obliga a adivinar la navegación |
| Dos escalas de densidad | El lenguaje aéreo de la tienda vuelve inoperable una tabla de órdenes |
| Modo oscuro solo en el panel | La tienda vive del canvas blanco; el panel es donde se pasan horas |
| Uso obligatorio de `impeccable` y `ui-ux-pro-max` al programar el frontend | Una referencia escrita fija el marco, pero no garantiza el acabado; las skills cierran esa brecha sin abrir la puerta a un segundo criterio visual |
| Sin hero fotográfico en la home | Una foto genérica de banco de imágenes le resta credibilidad a una tienda de reventa |
| Familia de grises cálida en vez de fría | Es lo que trajo el canvas aprobado en F3.8, y es de donde sale el aire de la referencia: grises cálidos sobre un canvas frío repiten la tensión de temperatura que §2.1 le pide al burdeos |
| `#716e6d` en vez del `#787574` del canvas | El del canvas da 4,14:1 sobre `--canvas`, bajo el AA de RNF-02. Un 6% menos de luminosidad conserva la temperatura y llega a 4,58:1 |
| Radios 28 / 20px en vez de 24 / 16px | Los del canvas aprobado. La diferencia de 8px que pide la regla del marco blanco (§3.5) se mantiene intacta |
| Las sombras se tiñen con `--ink` y no con negro | Al calentar los grises, una sombra azulada bajo una tarjeta cálida se nota aunque no se sepa nombrar |
| Inter se conserva pese a que el canvas usa Archivo | Archivo llegó por herencia del sistema Modernist que el canvas importó; no fue una decisión de diseño |
| El hover de marca sigue aclarando aunque el canvas lo oscurezca | El motivo de §2.1 no cambió, y un estado de hover en un mock estático no es una decisión tomada |
| **La ficha también muestra dos números: se va «Ahorrás $ X»** | Pedido tuyo del 2026-09-08. Lo que era una regla de la tarjeta pasa a ser una regla de la tienda (RN-04c). El tachado sobre el final ya dice cuánto bajó; el monto ahorrado es la misma oferta enunciada de nuevo, y obliga a leer un tercer número para no enterarse de nada nuevo |
| **La vista previa del panel también pierde el «Ahorrás»** | No es que RN-04c alcance al panel: es que esa vista previa dice literalmente «Se muestra», así que tiene que mostrar lo que el comprador ve. Y repetía el descuento que Ana acababa de tipear tres campos más arriba |
| **El corazón de favoritos se rellena con `--brand`, y no entra un rosa nuevo** | §1.2 decidió **un solo color saturado** y el canvas de F3.8 lo confirmó. Un rosa para el corazón sería el segundo, puesto por un ícono de 20px: el burdeos ya es el color de lo accionable y de lo elegido, y relleno sobre blanco lee exactamente como se espera que lea un corazón marcado |
| **El corazón está siempre a la vista, en la tarjeta y en la ficha** | Revelarlo al pasar el mouse lo deja inalcanzable en un teléfono, que es donde va a estar la mayoría. Y va **encima** del enlace, nunca adentro: un `<a>` que envuelva la tarjeta entera se lleva el botón adentro, que es HTML inválido y lo saca del recorrido de teclado |
| **Sin stock, «Preguntá si va a haber» es el botón principal de la ficha** | Es la única acción que le queda a quien llegó hasta ahí. De secundaria, al lado de un principal apagado, la pantalla queda sin ninguna salida a la vista y el botón gris se lee como una falla del sitio |
| **Un color agotado se puede elegir; §6.5 decía que no** | Sin eso, el estado sin stock de §7.3 —el que acabábamos de especificar— no se alcanzaba desde la pantalla: había que llegarle escribiendo el `?color=` a mano. Lo que se deshabilita es comprar, no elegir |
| **El color viaja en la dirección como `?color=negro`, no como identificador** | El catálogo filtra por `?color=<uuid>` porque ahí el valor sale de una lista y no lo lee nadie. En la ficha el enlace se manda por WhatsApp (§10.2 es exactamente eso), y `?color=negro` sobrevive a que alguien lo lea en voz alta |
| **El color cambia con `replaceState`, no con `pushState` ni con una navegación** | Con una navegación —aunque sea blanda— se vuelve al servidor a buscar lo que ya está en memoria y se pierde la transición de 150ms de §6.8. Con `pushState`, mirar tres colores deja tres entradas y el botón atrás recorre colores en vez de volver al catálogo |
| **La galería es UNA pista con encastre, y no dos galerías** | §6.8 describe dos comportamientos —deslizar en el teléfono, miniaturas en escritorio— y la tentación es escribir dos componentes. Con dos, el índice de la foto que se está viendo vive en dos lugares, y un día dicen cosas distintas |
| **La galería queda pegada y la columna derecha desplaza** | La descripción se mudó a la columna derecha, que pasó a ser mucho más alta que la foto. Leer «switches lineales» sin el teclado a la vista es leer sobre un producto abstracto |
| **La descripción se mudó de abajo de la ficha a la columna derecha** | Estaba a lo ancho, debajo de todo, donde llega quien ya decidió. Al lado del precio y del botón llega quien está decidiendo, que es cuando importa |
| **«Descripción» pasó a llamarse «Sobre el producto»** | El rótulo anterior nombraba el campo de la base, no lo que la persona va a leer |
| **Se va la tira de logos de medios de pago de la ficha; quedan los nombres** | En la pantalla de venta, una tira de logos se lee como «pagá acá», y acá no se paga. Los logos siguen en el pie y en la home, donde son señal de confianza y no promesa de un botón |
| **Aparece el recuadro «¿Cómo sigue después de comprar?»** | La tienda no cobra ni despacha sola: el pedido termina en una conversación de WhatsApp. Quien no lo sabe de antemano lee «Comprá ya» y espera un carrito con tarjeta. Decirlo ANTES del botón es la diferencia entre un proceso raro y uno que se entiende |
| **El botón de garantías vive adentro de ese recuadro** | Es la pregunta que sigue a «coordinamos la entrega» —«¿y si no me sirve?»—. Suelto en la página era un enlace más entre otros |
| **El corazón sale de la imagen en la ficha y se queda en la tarjeta** | Pedido tuyo del 2026-09-08. En la grilla el ícono solo es lo único que entra; en la ficha hay lugar para la palabra, y una etiqueta escrita le sirve a todo el mundo, no sólo a quien usa lector de pantalla |
| **Compartir funciona hoy y Guardar no** | No es una inconsistencia: los favoritos necesitan cuenta (F5.4) y compartir no necesita servidor. Dibujar los dos apagados habría escondido el único que ya se puede probar |
| **El fallo de «Compartir» se dice en pantalla** | El portapapeles necesita contexto seguro, y la tienda se abre a propósito por IP de la LAN para probarla desde el teléfono: ahí no existe. Un botón que se aprieta y no hace nada parece un sitio colgado |
| **El visor usa `<img>` y no `next/image`, única excepción del proyecto** | El zoom es «el tamaño real del archivo», y el optimizador devuelve el ancho que él elige. Sin ese ancho conocido no hay con qué calcular la escala |
| **La ficha sin stock aclara que nadie va a avisar** | «Preguntá si va a haber» suena a que el sitio agenda un aviso, y no hay ninguno: la respuesta la da la vendedora por WhatsApp. Prometer de menos y por escrito cuesta un renglón; alguien esperando un mail que no existe cuesta la venta |
