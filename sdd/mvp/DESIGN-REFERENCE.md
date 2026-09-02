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

---

## 3. Tokens

### 3.1 Color — tienda y panel en claro

```css
:root {
  /* ── Marca ─────────────────────────────────────────── */
  --brand:            #832833;   /* acción principal, identidad, precio en oferta */
  --brand-hover:      #9d3040;   /* MÁS CLARO: el color base ya es oscuro */
  --brand-active:     #6b202a;
  --brand-tint:       #fdf2f3;   /* fondo de etiquetas y estados suaves */
  --brand-tint-border:#f2dcdf;
  --brand-shadow:     rgba(131, 40, 51, 0.26);

  /* ── Superficies ───────────────────────────────────── */
  --canvas:           #f2f4f5;   /* fondo de página */
  --surface:          #ffffff;   /* tarjetas, campos, encabezado */
  --surface-sunken:   #fafbfb;   /* filas alternadas, bloques embebidos */

  /* ── Texto ─────────────────────────────────────────── */
  --ink:              #16181a;   /* primario */
  --ink-secondary:    #6b6f73;   /* secundario, etiquetas */
  --ink-tertiary:     #9aa0a5;   /* metadatos, marcadores de posición */
  --ink-inverse:      #ffffff;

  /* ── Líneas ────────────────────────────────────────── */
  --border:           #e8eaeb;   /* divisorias, contorno de campos */
  --border-strong:    #d3d7d9;   /* campo con foco, separadores marcados */

  /* ── Semánticos ────────────────────────────────────── */
  --success:          #15803d;   --success-tint: #f0fdf4;
  --warning:          #b45309;   --warning-tint: #fffbeb;
  --danger:           #dc2626;   --danger-tint:  #fef2f2;
  --info:             #0369a1;   --info-tint:    #f0f9ff;
}
```

> **`--ink` es `#16181a`, no negro puro.** El negro absoluto sobre blanco produce un contraste duro que cansa en textos largos. Un casi-negro conserva 15,8:1 y se lee más cómodo.

**Verificación de contraste** (todos cumplen WCAG AA para texto normal):

| Combinación | Ratio | Nivel |
|---|---|---|
| `--ink` sobre `--surface` | 15,8:1 | AAA |
| `--ink-secondary` sobre `--surface` | 5,3:1 | AA |
| `--ink-tertiary` sobre `--surface` | 2,8:1 | Solo texto ≥ 24px o elementos decorativos |
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
| Tarjeta de producto | **24px** | 12px | El panel muestra muchas más filas por pantalla |
| Imagen dentro de tarjeta | 16px | 8px | Siempre ~8px menos que su contenedor (§6.1) |
| Botón | **9999px** | 8px | En la tienda la píldora es la firma; en el panel estorba en barras densas |
| Campo de texto | 9999px | 8px | Ídem |
| Buscador | 9999px | 9999px | Es el mismo componente en ambos |
| Chip / etiqueta de estado | 9999px | 9999px | La píldora se conserva siempre |
| Modal | 20px | 16px | |
| Imagen suelta | 16px | 8px | |

> **Regla del marco blanco:** la imagen interior siempre lleva ~8px menos de radio que su contenedor. Eso deja un borde blanco visible que separa el producto del borde de la tarjeta. Recortar la imagen exactamente a la forma de la tarjeta rompe el efecto y hace que los productos de fondo blanco se fusionen con la página.

### 3.6 Sombras

```css
--shadow-sm:    0 2px 8px rgba(22, 24, 26, 0.06);
--shadow-md:    0 4px 6px -1px rgba(22, 24, 26, 0.10),
                0 2px 4px -2px rgba(22, 24, 26, 0.10);
--shadow-lg:    0 4px 24px rgba(22, 24, 26, 0.12);
--shadow-brand: 0 4px 20px var(--brand-shadow);
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
│  Envíos por PedidosYa · Medios de pago · Legales         │  pie oscuro
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
┌─────────────────────────┐   radio 24px, superficie blanca
│  ┌───────────────────┐  │   sombra md, sin borde
│  │                   │  │
│  │   imagen 1:1      │  │   radio 16px (8 menos que la tarjeta)
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  LOGITECH               │   caption 12px/500, secundario, VERSALITAS
│  Teclado mecánico K120  │   body-sm 14px/500, ink, máx. 2 líneas
│                         │
│  $ 24.500,00            │   body 16px/600 · burdeos si hay oferta
│  $ 27.500,00            │   caption 12px, tachado, terciario
│                     ♡   │
└─────────────────────────┘
```

| Estado | Tratamiento |
|---|---|
| Reposo | `--shadow-md` |
| Hover | Elevación a `--shadow-lg`, la tarjeta sube 2px, la imagen escala a 1.03 dentro de su marco. Transición 200ms |
| Foco | `--shadow-focus` sobre toda la tarjeta |
| **Con descuento** | Etiqueta «−$ 3.000» arriba a la izquierda de la imagen, píldora burdeos, texto blanco, caption |
| **Sin stock** | Imagen al 55% de opacidad + píldora «Sin stock» centrada sobre ella, superficie blanca al 92%. **La tarjeta sigue siendo clicable** (RN-05) |
| Favorito | Corazón arriba a la derecha; relleno burdeos si está marcado |

**Sobre la marca en versalitas:** separa visualmente marca de producto sin sumar un color ni un peso. Es un recurso de la referencia y funciona bien con Inter.

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

- Muestras circulares de 32px con el hexadecimal del color.
- Los colores claros llevan un borde `--border` de 1px para no desaparecer sobre el blanco.
- **El nombre del color se muestra siempre** junto al selector: no se depende del color para identificar la opción.
- Sin stock no se puede seleccionar, pero **sigue siendo visible** (RF-03).

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
Sin oferta:      $ 27.500,00              ink, peso 600

Con oferta:      $ 24.500,00              burdeos, peso 600
                 $ 27.500,00              tachado, terciario, 12px
                 Ahorrás $ 3.000,00       burdeos, caption
```

- Formato `es-AR`: `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- **Siempre con decimales** (RN-02). Nunca se aclara nada sobre IVA.
- El descuento es un **monto**, no un porcentaje: se comunica «Ahorrás $ X» (RN-04b).
- Variantes numéricas tabulares para que las columnas se alineen.

### 6.8 Galería de la ficha

- **Escritorio:** imagen principal grande a la izquierda, tira vertical de miniaturas de 64px. Clic amplía en modal.
- **Móvil:** carrusel deslizable a ancho completo con puntos indicadores.
- Relación 1:1, `object-fit: contain` sobre superficie blanca — los periféricos suelen venir con fondo blanco y recortarlos los mutila.
- Al cambiar de color, la galería se reemplaza con una transición de opacidad de 150ms.

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
│  Enviamos por PedidosYa                            │
└────────────────────────────────────────────────────┘
```

Sin *hero* fotográfico: el hero es el buscador. Es una tienda de reventa, no una marca de estilo de vida, y la foto genérica de banco de imágenes le resta credibilidad.

### 7.2 Catálogo

- **Escritorio:** filtros en columna izquierda de 260px, grilla de 4 columnas a la derecha.
- **Móvil:** botón «Filtros» que abre un panel inferior deslizable; la grilla pasa a 2 columnas.
- Los filtros aplicados aparecen como **chips removibles** arriba de la grilla, con «Limpiar todo».
- El ordenamiento es un desplegable arriba a la derecha, junto al conteo de resultados.
- La grilla es 2 / 3 / 4 columnas según ancho, con 16px de separación.

### 7.3 Ficha de producto

```
┌──────────────────────┬─────────────────────────────┐
│                      │  LOGITECH                   │  caption, versalitas
│                      │  Teclado mecánico K120      │  title 24px
│      imagen          │                             │
│      principal       │  $ 24.500,00                │  burdeos, 24px
│                      │  $ 27.500,00  Ahorrás $3.000│
│  ┌──┐┌──┐┌──┐        │                             │
│  └──┘└──┘└──┘        │  Color: Negro               │
│                      │  ● ○ ○ ⊘                    │
│                      │                             │
│                      │  Cantidad  [− 1 +]          │
│                      │  ✓ 5 disponibles            │
│                      │                             │
│                      │  [  Agregar al carrito  ]   │  principal, ancho completo
│                      │  [ Consultar por WhatsApp ] │  secundario
│                      │                             │
│                      │  🚚 Enviamos por PedidosYa  │
│                      │  💳 Medios de pago          │
│                      │  ↩  Garantías y devoluciones│
└──────────────────────┴─────────────────────────────┘
   Descripción
   ─────────── 64px ───────────
   También te puede interesar        → 4 tarjetas
   ─────────── 64px ───────────
   Productos similares               → 4 tarjetas
```

Para el **visitante sin sesión**, el botón principal dice **«Iniciá sesión para comprar»** y el secundario «Comprar por WhatsApp» (RF-08).

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

**Componentes propios, que no vienen de shadcn:** tarjeta de producto, precio, selector de color, galería, buscador con botón de envío, y el bloque de avisos del carrito.

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
2. Componentes propios de §12.2 (tarjeta de producto, precio, selector de color, galería, buscador, avisos del carrito).
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
| RN-05, RN-06 Agotados visibles | §6.1, §6.5 |
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
