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
| **Un segundo color: azul pizarra `#2f4a6d`** (2026-09-17) | La ficha tiene **dos formas de comprar** y ninguna es el plan B de la otra. Un solo color no puede decir eso: el segundo botón quedaba en contorno blanco, a 1,08:1 contra el canvas. El pizarra da 9,05:1 contra los 9,07:1 del burdeos, así que pesan igual. Ver §2.5 |

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

**Dónde no aparece nunca:** fondos de sección, bordes decorativos, íconos generales, texto de párrafo, cabeceras de tabla, **y estados de resultado** —éxito, error, aviso—, que tienen sus propios semánticos (§3.1).

> **Corregido: el burdeos se había filtrado a los estados.** El círculo de
> «tu pedido quedó registrado» era `--brand` con un tilde adentro, y el
> checkbox marcado también. Un círculo casi rojo con un tilde se lee como
> problema justo en el instante en que hay que decir que salió bien: el
> burdeos está a **7°** de matiz del rojo de error (§2.2). El círculo pasó a
> `--success` y el checkbox a `--accent` (§2.5). Esto **no es un color nuevo
> para los estados**: los cuatro semánticos ya existían y estaban en uso; lo
> que faltaba era usarlos en los controles en vez del burdeos.

### 2.2 El problema del rojo, y cómo se resuelve

El burdeos de marca (352,7°) y un rojo destructivo estándar (0°) están a **7 grados de matiz**: son el mismo tono para cualquier persona que no los mire uno al lado del otro. Un botón relleno burdeos y un botón relleno rojo de «Eliminar» son indistinguibles en la práctica.

**Se separan por forma, no por color:**

| Tipo de acción | Forma | Ejemplo |
|---|---|---|
| **Principal (marca)** | Relleno burdeos, texto blanco | «Agregar al carrito», «Guardar producto» |
| **Destructiva** | **Contorno** rojo, texto rojo, fondo transparente, con ícono | «Eliminar producto», «Cancelar orden» |
| **Destructiva confirmada** | Relleno rojo, dentro del diálogo de confirmación | El botón «Sí, eliminar» del modal |

La tercera es segura porque dentro del diálogo **no hay ningún botón de marca al lado** con el cual confundirla. Toda acción destructiva pasa por confirmación de todos modos (RF-15, RF-23).

**El panel queda exento de la separación por forma, y puede distinguir por color** (decisión tuya del 2026-09-21). La regla de arriba se escribió para la tienda, que es donde el color lo tiene que poner la foto del producto y donde un relleno rojo compite con el burdeos de «Agregar al carrito». En el panel no pasa ninguna de las dos cosas, y sí pasan tres que la vuelven contraproducente:

1. **La acción se repite decenas de veces por pantalla.** Un contorno rojo por fila, cuarenta por página, deja una columna de alertas al lado del contenido que hay que leer.
2. **Muchas acciones son un ícono sin rótulo**, así que «con ícono» no las distingue de nada: sus vecinas también son íconos.
3. **Ana opera en tablet** (RNF-01) y ahí **no hay hover**. Un destructivo que se pone rojo recién al pasar el puntero es un destructivo que en su pantalla no se ve nunca.

Con dos colores y ninguna otra señal, equivocarse es cuestión de tiempo, y en el panel equivocarse cuesta un producto borrado. Así que **el rojo semántico distingue por sí solo**: el ícono de una acción destructiva va en `--danger` desde el reposo, sin caja y sin depender del hover (variante `destructive-ghost`, §6.3). Da 4,83:1 en claro y 6,01:1 en oscuro, sobre los 3:1 que pide un ícono.

**Lo que la exención NO habilita**, porque si no deja de ser un sistema:

- **No se inventan colores.** El panel distingue con los cuatro semánticos que ya existen —éxito, aviso, peligro, información— y con el burdeos y el pizarra. Ninguno más.
- **El burdeos sigue sin decorar.** La regla de una sola voz (§2.1) no se toca: marca acción principal e identidad, y nada más.
- **El relleno rojo sigue siendo solo del diálogo de confirmación.** Lo que se habilita es el ícono y el texto en rojo, no una caja roja suelta al lado de una de marca.
- **El color nunca va solo cuando comunica un estado.** §9 sigue pidiendo que todo estado tenga texto además de color; esto es sobre qué hace una acción, no sobre en qué estado está algo.

En la tienda la regla original sigue en pie, entera.

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

### 2.5 El segundo color

> **Azul pizarra `#2f4a6d`.** Tiene dos trabajos y nada más: **la otra acción
> de compra** —«Comprá ya por WhatsApp» en la ficha— y **lo elegido**, como el
> checkbox marcado.

**Es un desvío deliberado de §1 y §11**, que pedían un solo color. Se toma por
un motivo que no es estético: en la ficha hay **dos formas de comprar**, el
carrito y el WhatsApp, y la segunda es la que cierra la venta de verdad. Estaba
en contorno blanco, con un borde de **1,08:1** contra el canvas —muy por debajo
del 3:1 que WCAG pide para el contorno de un control—, así que se leía igual
que «Compartir».

| Propiedad | Valor | Consecuencia |
|---|---|---|
| Contraste sobre blanco | **9,05:1** | El burdeos da 9,07:1 |
| **Diferencia de peso con el burdeos** | **0,02** | Es la cifra que lo eligió |
| Contraste sobre canvas | 8,20:1 | De sobra para el contorno de un control |
| Tilde blanco encima | 9,05:1 | Sirve de relleno con texto o ícono adentro |

**Por qué ese número y no otro.** Los dos botones son **pares**: dos caminos
igual de válidos para lo mismo. Con 0,02 de diferencia ninguno grita por encima
del otro y la persona elige por lo que dicen, no por cuál se ve más. Los otros
candidatos fallaban ahí: la tinta `#111010` daba 19:1 —más del doble que el
burdeos, se lo comía— y el petróleo `#0f5c63` daba 7,69:1, más liviano, con lo
que la compra por WhatsApp pesaba menos que el carrito.

**El punto a vigilar.** El pizarra queda a **13°** de matiz del `--info`, la
insignia «En preparación» de una orden. No coinciden en la ficha; donde pueden
verse juntos es **«Mis compras»**. Si alguna vez se confunden, la salida es
correr el `--info` a un azul más franco, no mover el pizarra. La alternativa
descartada, si hiciera falta más separación, es ciruela `#6b21a8`: 0,35 de
diferencia de peso y 72° del `--info`.

**Nunca:** usarlo en la acción principal, en el precio, en el logo, ni como
fondo de sección.

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

  /* ── Segundo color (§2.5) ──────────────────────────── */
  --accent:           #2f4a6d;   /* la otra acción de compra, lo elegido */
  --accent-hover:     #3c5d87;   /* MÁS CLARO: el color base ya es oscuro */
  --accent-active:    #24394f;
  --accent-tint:      #eef2f7;   /* reservado; todavía sin uso */
  --accent-tint-border:#d5deea;  /* reservado; todavía sin uso */

  /* ── Superficies ───────────────────────────────────── */
  --canvas:           #f2f4f5;   /* fondo de página */
  --surface:          #ffffff;   /* tarjetas, campos, encabezado */
  --surface-sunken:   #fafbfb;   /* filas alternadas, bloques embebidos */

  /* ── Texto ─────────────────────────────────────────── */
  --ink:              #111010;   /* primario */
  --ink-secondary:    #716e6d;   /* secundario, etiquetas */
  --ink-tertiary:     #8f8b8a;   /* decorativo, NUNCA texto — ver abajo */
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
| `--ink-tertiary` sobre `--surface` | 3,37:1 | **No es un color de texto**: ver abajo |
| `--brand` sobre `--surface` | **9,07:1** | AAA |
| `--accent` sobre `--surface` | **9,05:1** | AAA. A 0,02 del burdeos: pesan igual |
| `--success` sobre `--surface` | 5,02:1 | AA. Tilde blanco en el círculo de orden confirmada |
| `--ink-inverse` sobre `--brand` | **9,07:1** | AAA |
| `--danger` sobre `--surface` | 4,83:1 | AA |
| `--success` sobre `--surface` | 5,02:1 | AA |

**`--ink-tertiary` no se usa para texto, y desde el 2026-09-22 está dicho
así.** La fila de arriba decía «solo texto ≥ 24px o elementos decorativos», y
esa primera mitad no la cumplía nadie: había **69 usos en 33 archivos, 41 de
ellos pegados a `text-caption` (12px) o `text-body-sm` (14px)**, y ni uno solo
de 24px. Medido sobre el render del panel en oscuro da **3,28:1**, y en claro
3,37: AA pide 4,5 para texto normal. El terciario existe igual, y su lista de
usos es cerrada:

| Vale | No vale |
|---|---|
| Marcadores de posición (`placeholder:`) | Metadatos, ayudas y leyendas |
| Viñetas y numeración de listas (`marker:`) | Precios tachados |
| Íconos decorativos —lupas, chevrones, el ícono del estado vacío— | Cualquier texto de 12 o 14px |
| Separadores `aria-hidden` («·», «/») | Etiquetas y valores de una ficha |
| Controles desactivados, que WCAG exime | |

**Lo que era terciario y es texto pasa a `--ink-secondary`** (5,06:1 en claro,
6,46:1 en oscuro). La consecuencia se asume: la escala de tres grises queda en
**dos niveles de texto más uno decorativo**, y un metadato pesa lo mismo que
una etiqueta. Lo que ordena la jerarquía es el tamaño y el peso, que siguen
estando.

**Y una tarjeta no se apaga con `opacity`.** La devolución anulada usaba
`opacity-70`, que multiplica el contraste de todo lo que hay adentro y dejaba
sus metadatos en **2,17:1**. Para que algo retroceda se cambia su superficie
—`--surface-sunken`—, que no toca el contraste del texto.

### 3.2 Color — modo oscuro del panel

```css
[data-theme="dark"] {
  color-scheme: dark;            /* lo que pinta el navegador y no nosotros */

  --brand:            #d4697a;   /* ACLARADO: #832833 da 1,83:1 en oscuro, ilegible */
  --brand-hover:      #e08a97;
  --brand-active:     #c04a5c;
  --brand-tint:       #2a1a1d;
  --brand-tint-border:#3d2429;
  --brand-shadow:     rgba(212, 105, 122, 0.20);

  /* ACLARADO: #2f4a6d da 1,84:1 sobre la superficie oscura, ilegible. */
  --accent:           #7d9dc4;
  --accent-hover:     #94b0d4;
  --accent-active:    #6b8cb5;
  --accent-tint:      #1a2230;
  --accent-tint-border:#2a3648;

  --canvas:           #141416;
  --surface:          #1e1e21;
  --surface-sunken:   #18181b;

  --ink:              #ececee;
  --ink-secondary:    #a1a1a6;
  --ink-tertiary:     #6e6e73;   /* decorativo, NUNCA texto — ver §3.1 */
  --ink-inverse:      #141416;

  --border:           #2e2e33;
  --border-strong:    #43434a;

  --success: #4ade80;  --success-tint: #052e16;
  --warning: #fbbf24;  --warning-tint: #2a1d05;
  --danger:  #f87171;  --danger-tint:  #2a1213;
  --info:    #38bdf8;  --info-tint:    #05202e;
}
```

**`color-scheme` no es un token, y hace falta igual** (2026-09-22). Hay piezas
que dibuja el navegador y no la hoja de estilos: el ícono del calendario de un
`<input type="date">`, el calendario que abre, las barras de scroll y la lista
desplegada de un `<select>`. Sin declararlo, el navegador las pinta siempre
para fondo claro, y en el panel en oscuro **el ícono del calendario quedaba
negro sobre negro**: el campo se veía bien y el botón para abrirlo no existía.
`:root` declara `light` y el bloque de oscuro declara `dark`; ningún token lo
podía arreglar, porque esos píxeles no son nuestros.

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

**Sombra y borde nunca van juntos.** Ensucian y aplanan la elevación. Cuál de los dos separa depende de la escala, y es una excepción que se anota (2026-09-18):

| Escala | Separa por | Por qué |
|---|---|---|
| Tienda | **Sombra** | Es siempre clara. La sombra da volumen y deja la tarjeta sin contorno duro, que es el lenguaje de la referencia |
| Panel | **Borde** (`--border`) | Tiene modo oscuro, y ahí la sombra no existe |

**El motivo del panel es medible, no de gusto.** Las tres sombras se tiñen con `--ink` —`rgb(17 16 16 / …)`— y **no se redefinen** en `[data-theme="dark"]`. Sobre el canvas oscuro (`#141416`), `--shadow-sm` mueve el píxel **de 20 a 19,82 sobre 255**: no se ve. Y la superficie contra el canvas da **1,11:1**, así que sin borde la tarjeta no tiene filo: se adivina en vez de verse. En claro esa misma sombra lo mueve de 242 a 228,5, y por eso ahí alcanza sola.

Hasta el 2026-09-18 la regla decía «por sombra» para las dos escalas, y el panel la incumplía en 29 de sus 38 tarjetas. Se alineó hacia el borde, que es lo que la mayoría ya hacía y lo único que funciona en los dos temas.

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
| Ancho máximo | 1200px | Ancho completo menos el menú **en listados y fichas**; **1024px en formularios y en el tablero**, alineados a la izquierda (§4.1) |
| Modo oscuro | No | Sí |

**Por qué no son idénticas.** El lenguaje de la tienda —radios de 24px, 80px entre secciones, tarjetas flotantes— existe para que se luzcan cinco o seis productos por pantalla. Aplicado a una tabla de cuarenta órdenes produce una pantalla donde entran seis filas y hay que hacer scroll para todo. La vendedora no está descubriendo productos: está buscando la orden 1043 lo más rápido posible.

**Qué se comparte, y no es negociable:** la paleta, Inter, el rol del color de marca, el estilo del foco, la voz de los mensajes y todos los componentes de formulario.

#### 4.1 El ancho del panel

**Hasta el 2026-09-21 esta fila decía «ancho completo» a secas, y ninguna pantalla de formulario la cumplía.** Había cuatro criterios conviviendo —768px centrado, 768px a la izquierda, 672px centrado y sin tope— porque no existía un lugar donde el número estuviera escrito. Se resolvió así (decisión tuya del 2026-09-21, tomada viendo las cuatro opciones aplicadas a «Nuevo producto»):

| | Ancho | Alineación |
|---|---|---|
| Listados y fichas | Completo, menos el menú | — |
| **Formularios y tablero** | **`--container-admin-form`, 1024px** | **A la izquierda**, sin `mx-auto` |

**Por qué los formularios llevan tope.** Son de una sola columna, y a ancho completo el campo «Nombre» mide 1100px en una pantalla de 1440 y 1580px en una de 1920, para escribir «Teclado mecánico K120». La línea original se escribió pensando en tablas, que es donde el ancho completo sí sirve: ahí cada píxel de más es una columna que se lee sin apretar.

**Por qué a la izquierda y no centrado.** Es lo que resuelve el problema que se reportó, que no era cuánto medían sino que **se movían**. Sin `mx-auto`, el borde izquierdo del contenido cae en el mismo lugar en las siete pantallas y en toda resolución —medido: x=264 a 1280, 1440 y 1920—, así que el título de un formulario queda alineado con el del listado del que se viene y nada salta al navegar. Centrado, «Nuevo producto» aparecía 190px a la derecha de «Productos».

**Por qué 1024 y no el 768 que ya se usaba.** Con 1024 los pares de campos —precio y descuento, marca y categoría— respiran, y el texto de ayuda entra en un renglón en vez de dos. Por debajo de 1288px de viewport el tope no llega a morder y formulario y listado miden exactamente lo mismo, que es el caso de la mayoría de las pantallas reales.

**El número vive en `app/globals.css` como `--container-admin-form`**, no como una clase suelta, por el mismo motivo por el que existe `--container-shop`: sin un lugar donde esté escrito, la próxima pantalla inventa el suyo.

##### La edición de un producto lleva el formulario al lado del stock (2026-09-21)

En esa pantalla el `<form>` convive con «Colores y stock», que es su hermana y no su hija —cada color se guarda solo, en el momento (F2.4)—. Puestas una debajo de la otra, el título de la tarjeta de stock empezaba **a y=1280 con una ventana de 900**: al abrir un producto no se asomaba. Y el stock es, junto con el precio, lo que más se toca. Van al lado, y el título pasa a **y=134**.

**El formulario conserva el ancho que tiene en el alta: 1024px, `--container-admin-form`.** No es una comodidad, es la regla de esta misma sección. Se viene de «Nuevo producto», que es este mismo formulario, y todo el punto de §4.1 es que el contenido **no se mueva** al navegar. El primer intento le puso un tope propio de `34rem` y produjo exactamente eso: los campos medían 1024 en el alta y 488 en la ficha, y el salto se veía al crear un producto. Lo reportaste con las dos capturas al lado. El ancho del formulario no se negocia por pantalla.

| Columna | Ancho |
|---|---|
| Formulario | `--container-admin-form`, el mismo que en el alta y en las otras seis pantallas de formulario |
| Colores y stock | El resto |

**La consulta es de contenedor y no de ventana** (`@container` / `@min-[1400px]`), y la razón es concreta: **el menú lateral se contrae a pedido y libera 176px**. Con una consulta de ventana, contraerlo —que es justo el gesto de quien quiere más ancho— no cambiaría nada. Medido a 1600px de ventana: con el menú desplegado el stock va abajo, y contrayéndolo se pone al costado. Es la primera consulta de contenedor del proyecto, y entró por este motivo y no por novedad.

**1400px es una suma, no un número redondo**: 1024 del formulario, 16 de separación y 360 del stock, que es lo que necesita una fila de tres fotos. Por debajo van apiladas y **las dos topeadas en 1024**, que es exactamente como se veía la pantalla antes de partirla en dos.

**Lo que esto deja sin resolver, y se anota para no perderlo.** Los textos de ayuda del formulario siguen en **102 caracteres por renglón** en «Publicación», contra el techo de **68** que pone §7; los de la tarjeta de stock, alrededor de 97. Angostar el formulario los arreglaba —bajaban a 51— pero a cambio del salto que se acaba de sacar, así que no es por ahí: se arreglan cortando el texto o topeando el párrafo, que es trabajo aparte y toca `TarjetaDeSeccion`, que usan cinco pantallas.


---

**Lo que se pinta en un portal se lleva la escala puesta.** Diálogos, menús y globos de ayuda salen a `document.body` para que ningún `overflow` los recorte, y ahí arriba ya no hay `data-scale`: un diálogo abierto desde el panel se pintaba con la escala de la tienda —16px y campos con forma de píldora— aunque sus clases `admin:` estuvieran escritas. Se resuelve en `components/ui/escala.tsx`, que marca el atributo y además lo pasa por contexto, para que el contenido portaleado lo repita sobre sí mismo. El modo oscuro no tiene el problema: `data-theme` vive en `<html>`, y `body` está adentro.

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

#### 6.2.1 La barra de filtros del panel

**No es el buscador de la tienda.** Aquél es la firma del sistema —píldora de 48px, botón burdeos con `--shadow-brand`— y vive solo sobre fondo de tienda. El del panel es un campo común de 40px con la lupa adentro, porque convive con tres o cuatro controles más en el mismo renglón y un botón de marca ahí sería el segundo de la pantalla (§6.3).

Las tres piezas viven en `components/admin/filtros.tsx`, y desde el 2026-09-21 **una sola vez**: el buscador estaba copiado en las tres barras que lo tienen, el rango de fechas en las dos, y el contador en las cuatro.

| Pieza | Dónde | Qué guarda |
|---|---|---|
| `BuscadorDelPanel` | Órdenes, usuarios, productos | El `role="search"` acotado, la lupa y la limpieza |
| `RangoDeFechas` | Órdenes, devoluciones | «Desde» y «Hasta», apilados en el teléfono |
| `ContadorDeResultados` | Las cuatro | «N resultados», anunciado |

Tres cosas que cada copia tenía que acordarse de traer, y que ahora están escritas una vez:

- **`admin:pl-9` además de `pl-9`.** `Input` trae su propio `admin:px-3`, que le gana a un `pl-*` suelto —misma especificidad, y las variantes van después—. Sin repetirlo en la escala del panel, **la lupa se apoya sobre la primera letra**.
- **La cruz nativa de `type="search"` se retira** (`appearance: none`): no se puede enfocar con el teclado ni tiene nombre accesible. La limpieza es un botón propio, y al tocarlo **el foco vuelve al campo** — si no, se cae al `<body>`, porque el botón que se acaba de tocar deja de existir.
- **`role="search"` envuelve la búsqueda y nada más.** Alrededor de toda la barra anunciaría los filtros como parte del buscador, que es justo lo que no son.

**El rango no tiene botón de limpiar**: el navegador manda `""` al borrar la fecha, que es exactamente el valor de «sin filtro». **Y se apila en el teléfono**, que no es un gusto: un campo de fecha nativo no baja de unos 130px, y dos con sus rótulos en una línea de 390px desbordaban la pantalla 156px hacia la derecha.

**El contador se anuncia** (`aria-live="polite"`): quien no ve la lista tiene que enterarse igual de cuántos quedaron (§9). Mientras la navegación está en curso dice «Buscando…» y se atenúa, porque el número anterior ya no es el de ahora y dejarlo firme sería mentir por un instante.

### 6.3 Botones

| Variante | Fondo | Texto | Borde | Uso |
|---|---|---|---|---|
| **Principal** | `--brand` | blanco | — | Una sola por pantalla |
| **Alterna** | `--accent` | blanco | — | **Par de la principal**, no escalón debajo: la otra forma de hacer lo mismo (§2.5) |
| **Secundario** | `--surface` | `--ink` | `--border` | Acciones de apoyo entre pares: «Guardar», «Compartir» |
| **Terciario** | transparente | `--ink-secondary` | — | **Ghost.** «Cancelar», «Volver». Al pasar el puntero aparece el plato de `--canvas` |
| **Destructivo** | transparente | `--danger` | `--danger` | Eliminar, cancelar orden, **con rótulo**. **Con ícono** |
| **Destructivo ghost** | transparente | `--danger` | — | **Solo el panel** (§2.2). El destructivo de una columna de acciones: ícono rojo desde el reposo, sin caja; al pasar el puntero aparece el plato `--danger-tint` |
| **Destructivo confirmado** | `--danger` | blanco | — | **Solo dentro del diálogo de confirmación** |

> **«Blanco» en esa columna quiere decir `--ink-inverse`, no `#ffffff`.** Las tres variantes de relleno —principal, alterna y destructivo confirmado— usan el token, que en claro vale blanco y **en oscuro se da vuelta**. Escribirlo literal cuesta caro justo en el destructivo confirmado: en oscuro `--danger` se aclara a `#f87171`, y el blanco encima da **2,77:1**, por debajo de AA incluso para texto grande; con el token da 6,65:1. Estuvo así hasta el 2026-09-18, en los nueve diálogos destructivos del panel.

| Tamaño | Alto | Texto | Padding |
|---|---|---|---|
| `sm` | 32px | 14px | 12px |
| `md` | 40px | 14px | 16px |
| `lg` | 48px | 16px | 24px |

**Estados:** hover cambia a `--brand-hover` (más claro); `active` a `--brand-active`; `disabled` va al 40% de opacidad sin cambiar de color y con `cursor: not-allowed`; `loading` reemplaza el texto por un indicador **conservando el ancho del botón**, para que la interfaz no salte.

**La escalera de énfasis**, de más a menos peso: Principal → Alterna →
Secundario → Terciario. **Alterna no es un escalón**: es el par de Principal, y
sólo se usa cuando hay dos caminos igual de válidos. Dos rellenos de color al
lado que *no* son pares obligan a decidir cuál manda, que es lo que la escalera
evita.

**El terciario es ghost, y el hover no es su única señal.** En reposo se ve el
texto; al pasar el puntero aparece el plato. En táctil no hay hover, así que el
texto tiene que alcanzar solo — por eso nunca es sólo un ícono sin rótulo, y
mantiene el área táctil de su tamaño (§9). Para el **«Cancelar» de un diálogo
destructivo** se usa Secundario y no Terciario: ahí cancelar es la salida
segura y tiene que pesar lo mismo que el botón que borra, no menos.

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
                 $ 27.500,00              tachado, secundario, 12px

TARJETA (§6.1) — una línea
Sin oferta:      $ 27.500,00              ink, peso 600
Con oferta:      $ 27.500,00 $ 24.500,00  tachado secundario 12px, después burdeos 600
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
| Cabecera | `caption` 12px/500, `--ink-secondary`, versalitas, fondo `--surface-sunken`, **fija al scrollear la tabla** |
| Celda | `body-sm` 14px |
| Separador | 1px `--border` entre filas |
| Hover de fila | Fondo `--surface-sunken`, cursor de puntero si la fila es clicable |
| Números | Alineados a la derecha, tabulares |
| Acciones | Última columna, alineada a la derecha, íconos con etiqueta accesible |
| Vacío | Ilustración mínima + explicación + acción sugerida. Nunca una tabla vacía a secas |
| Carga | Filas fantasma del alto real, no un spinner centrado |

**El vacío son dos situaciones y no una** (escrito el 2026-09-21, al sacarlo a `VacioDelPanel` en `components/admin/vacio.tsx`). Hasta ese día la fila de arriba decía una sola cosa, y de once vacíos **uno solo tenía ícono**: tres eran una línea de texto gris y un botón, sin ninguna explicación. No era descuido de una pantalla, era que no existía el componente.

| | Cuándo | Lleva |
|---|---|---|
| **Todavía no hay ninguno** | Se entra por primera vez | Ícono, título, explicación de dónde sale lo que va a aparecer acá, y la acción del primer paso |
| **Nada coincide con los filtros** | Se llega buscando | Título con lo que se buscó, qué probar, y «Limpiar todo». **Sin ícono** |

**Por qué el segundo no lleva ícono.** Aparece y desaparece con cada tecla mientras se filtra, y un dibujo que parpadea ahí es ruido; además quien filtró ya sabe en qué pantalla está, que es la mitad de lo que el ícono venía a decir. La acción tampoco es la misma: en el primero es el primer paso, en el segundo es la salida.

**Un vacío adentro de una tarjeta hunde el fondo** (`--surface-sunken`) y se acorta, porque ahí no hay una pantalla que llenar y dos tarjetas apoyadas una sobre otra se leen mal. Es el caso de «Colores y stock» en la ficha de producto.

**No todo recuadro punteado es un vacío.** Quedan tres notas —la de la ficha de orden, la de «Todavía no guardaste la configuración» y la del buscador de productos del alta manual— que son un párrafo dentro de un flujo, sin título ni acción. Un ícono y un encabezado ahí gritarían.

**La cabecera se fija, y para eso la que scrollea es la tabla y no la página** (resuelto el 2026-09-21; hasta ese día la línea de arriba decía «fija al scrollear» y **no lo era**). `position: sticky` se fija dentro del ancestro que scrollea, y ese ancestro era el `div` propio de la tabla, que no scrolleaba nunca: la página se deslizaba por debajo y se llevaba la cabecera puesta. Medido en `/admin/productos` con 26 filas: al scrollear 600px la cabecera terminaba en y=−398. En órdenes y usuarios *parecía* andar, pero sólo porque con diez filas la página apenas scrollea 163px.

Ahora ese `div` lleva **`max-h-[calc(100svh-20rem)]`** y es el que scrollea. De paso resuelve algo que no era el problema declarado: con 40 filas por página la tabla mide 1760px, así que el encabezado, los filtros y la paginación se iban de la pantalla apenas se empezaba a bajar. **La página ya no scrollea: scrollea la tabla.**

**Las `20rem` están medidas contra el peor caso** —órdenes o usuarios, que tienen encabezado, solapas, barra de filtros, contador y paginación a la vez— en una ventana de 700px. Con 19 la página quedaba scrolleando 11px, que es justo lo que este tope viene a evitar; con 20 sobran 5. Cuesta una fila: siete en vez de ocho a 700px, doce a 900.

**Una celda puede llevar su propia acción, y el número sigue pegado a la derecha.** En el listado de productos, la columna «Disponible» tiene el botón de reponer **antes** de las cifras: puesto después, la columna terminaba en el botón y los números dejaban de caer bajo su encabezado. El bloque de cifras va `shrink-0 whitespace-nowrap`, porque comprimido parte «de 15 · 2 reservadas» en dos renglones y sube la fila de 55px a 72 sólo en los productos con reservas, dejando la tabla despareja.

**En móvil las tablas se vuelven tarjetas**, no un scroll horizontal. Una tabla de siete columnas en un teléfono es inoperable.

**Paginación:** «Anterior / Página N de M / Siguiente», no un botón por página como la tienda (F7.1). Un listado del panel puede crecer sin techo —las órdenes se acumulan solas—, y una tira de cien números no sirve de nada: a una orden vieja se llega por la búsqueda o el rango de fechas, no acordándose de en qué página estaba. Los pasos que no existen —«anterior» en la primera— **no se dibujan apagados**: un enlace deshabilitado no se puede enfocar ni explica por qué no anda, y el «Página N de M» del medio ya dice dónde está el límite.

**Solapas: son dos, y la diferencia significa algo** (decidido el 2026-09-21, al sacarlas a `SolapasDelPanel` en `components/admin/solapas.tsx`). Hasta ese día existían las dos sin que nadie lo hubiera escrito, así que divergían en todo lo demás —alto, color de la activa, elemento contenedor— y parecían dos gustos en vez de dos trabajos.

| | Cambia | Forma | Número |
|---|---|---|---|
| **Segmentado** | Qué se ve del mismo listado | Pastilla blanca sobre fondo hundido: se lee «elegí uno de estos» | **Sí** |
| **Subrayado** | En qué pantalla se está | Subrayado en color de marca: se lee «esta es la sección» | **No** |

**Las dos miden 40px de alto**, para que el renglón no salte al pasar de una pantalla a otra: el segmentado son 4 + 32 + 4 y el subrayado es un ítem de 40 apoyado sobre el borde.

**El segmentado lleva el número de cada solapa, y no es decoración.** Es la pregunta con la que se abre la pantalla, y contesta «¿tengo algo que hacer?» sin entrar. Ese número es el del total, no el del filtro puesto: si cambiara con cada búsqueda dejaría de ser un indicador para ser un resultado más. Va en `aria-hidden` con una frase completa al lado en `sr-only` —«(11 cuentas)»—, porque «Activas 11» leído en voz alta no dice once qué.

**El subrayado no lleva número a propósito:** cada solapa es otra tabla, así que no hay un total que contestar. Sumarle uno obligaría a cuatro consultas para decir cuántas filas tiene cada pantalla vecina, que es un dato que nadie fue a buscar.

**Las dos pantallas que llevan segmentado son órdenes y usuarios.** Usuarios lo ganó el 2026-09-21: esta regla lo nombraba desde que se escribió y la pantalla tenía un desplegable de cinco opciones sin un solo número, así que la regla estaba vencida. El estado que más importa ahí es «Baja pedida», que es trabajo por hacer (RF-34) y antes no se veía sin abrir el desplegable.

**La solapa no es un filtro que se limpia.** «Limpiar todo» borra la búsqueda y los desplegables y **conserva la solapa**: dice dónde se está parada, y limpiar filtros no tiene por qué mover a nadie de pantalla. Cambiar de solapa, al revés, conserva los filtros y vuelve a la página 1.

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

### 6.12 Encabezado de pantalla del panel

**Toda pantalla del panel abre con el mismo encabezado**, y lo pone `EncabezadoDePanel` (`components/admin/encabezado.tsx`). Son cinco piezas, y la única obligatoria es el título:

| Pieza | Cuándo va | Forma |
|---|---|---|
| Volver | La pantalla se abrió desde otra | Botón terciario `sm` con `-ml-3`, `ChevronLeft` y el nombre de a dónde vuelve |
| Título | Siempre | `title`, `--ink` |
| Insignias | El título es un dato que tiene estado — una orden, una cuenta | Píldoras de §6.4, al lado del título |
| Bajada | La pantalla necesita decir qué es | `body-sm`, `--ink-secondary`, debajo del título |
| Acciones | Hay algo para hacer que no es sobre una fila | Arriba a la derecha, §6.3 |

**La alineación la decide la bajada, y no el tipo de pantalla.** Con bajada, la columna izquierda son dos renglones y el bloque va `items-start`, para que el botón de la derecha se alinee con el título en vez de flotar en el medio; sin bajada es un renglón solo y va `items-center`. Hasta el 2026-09-21 los listados hacían lo primero y las fichas lo segundo, y parecían dos criterios: es uno solo mirado en dos formas.

**Por qué es un componente y no una receta escrita acá.** Las trece pantallas lo armaban a mano y habían llegado a cinco formas de la misma cosa. La que más se notaba era el volver: cuatro pantallas usaban el botón terciario y la ficha de producto un `<Link>` pintado a mano en `body-sm`/`--ink-secondary` — 20px contra 32px, otro color y la mitad del área para el dedo, en la misma posición de la misma pantalla.

**El fantasma vive en el mismo archivo** (`EsqueletoDeEncabezado`, §8). Es lo único que evita que se separen con el tiempo: el esqueleto de la ficha de producto dibujaba el volver de 20px porque estaba escrito en otro lado y nadie los había visto juntos.

### 6.13 Tarjeta de sección del panel

**Todo bloque con título dentro de una pantalla del panel es una `TarjetaDeSeccion`** (`components/admin/tarjeta.tsx`). Hasta el 2026-09-21 estaba escrita cinco veces —`Seccion`, `Tarjeta`, `Ficha`, una suelta en el historial y ocho a mano en los formularios— y había **quince tarjetas con tres paddings, tres separaciones y tres tamaños de título**.

| | Valor | Por qué |
|---|---|---|
| Padding | `p-4`, 16px | §4 fija 12–16px para el panel, y nueve de quince estaban en 20px sin que la desviación estuviera anotada |
| Separación interna | `gap-4`, 16px | Con 16px de padding, el mismo número adentro da un solo ritmo |
| Título | `body` 16px, peso 500 | Decisión tuya del 2026-09-21 |
| Nombre accesible | `aria-labelledby` al `h2` | Decisión tuya del mismo día |

**Por qué 16px y no los 20 del formulario ni los 14 de la ficha.** Eran el mismo nivel jerárquico dicho de tres maneras. A 14px el título de una sección medía lo mismo que el rótulo de un campo y dejaba de separar; a 20px, en una columna de 352px, pesaba tanto como el dato que anunciaba. Es además el tamaño del título de `VacioDelPanel`, así que el panel tiene **una sola voz para «esto es una sección»**. De yapa, el esqueleto quedó exacto: `text-body` da 24px de alto y `h-6` son 24px, mientras que contra los 20px de antes se quedaba un píxel corto.

**Por qué se anuncia como región.** Antes lo hacían cuatro de quince. Un `<section>` sin nombre accesible **no es una región**: para un lector de pantalla es un contenedor más, así que once de esas tarjetas eran un `div` con pasos de más. Con nombre se salta entre «Comprador», «Envío» e «Historial» sin recorrer el contenido, que es exactamente lo que §6.9 quiere de una pantalla de trabajo. El `id` se pide por parámetro y no se genera: estas tarjetas se pintan en el servidor, donde `useId` no corre.

**La alineación del encabezado la decide la ayuda**, la misma regla que §6.12: con ayuda son dos renglones y va `items-start`; sin ayuda es uno y va `items-center`.

**Dos excepciones, las dos a propósito.** El envoltorio de una tabla no lleva padding —una tabla llena la tarjeta de borde a borde— y su título va en `sr-only`, porque la cabecera de la tabla ya dice qué es cada columna. Y una tarjeta que solo lleva un mensaje, sin título, no es una sección: no se anuncia ni se nombra.

### 6.14 Diálogos

**Tope de alto: `max-h-[85svh]`, en el primitivo y no en cada diálogo.** Hasta el 2026-09-21 lo tenía **uno de los veinticinco** —el de registrar una devolución, que es el que alguien vio romperse—; los otros veinticuatro no tenían ninguno.

Sin tope, un diálogo más alto que la pantalla **no se corta por abajo: se corta por los dos lados**, porque la caja está centrada con `translate(-50%, -50%)`. Y lo que queda afuera es **inalcanzable**: la caja es `position: fixed`, así que no se mueve al scrollear, y además Radix bloquea el scroll del cuerpo mientras el modal está abierto (`data-scroll-locked`). Medido a 320px de alto: «Cancelar la orden» perdía 40px —20 arriba y 20 abajo— y «Nueva marca», 44.

**`svh` y no `vh`:** en el teléfono la barra del navegador se come parte de `vh` y el diálogo terminaba debajo de ella.

**Lo que scrollea es el contenido, no la caja.** La × está posicionada con `absolute top-4 right-4`; dentro de un contenedor con scroll se iría con el contenido y el diálogo se quedaría sin su salida visible. Por eso los hijos van en un envoltorio propio con el scroll, y la × queda fija contra la caja.

**Ese envoltorio es transparente**, y tiene que serlo: hay diálogos que fijan su alto y su separación desde afuera —la galería de la ficha manda `h-[calc(100dvh-2rem)]` y `gap-0`—, así que el envoltorio lleva `flex-1` para no achatar a quien fija su alto y `gap-[inherit]` para no imponer el suyo. **Un diálogo que es la pantalla entera anula el tope con `max-h-none`**, que es el único caso previsto.

#### 6.14.1 Un diálogo que se abre solo se abre desde la dirección (2026-09-21)

Hay un caso en que abrir un diálogo no lo decide quien mira la pantalla: **el alta de un producto termina en su ficha con «Agregar color» ya abierto**. Un producto sin colores no tiene stock ni fotos, así que no se puede vender; crear el producto es media tarea, y la bajada de «Nuevo producto» venía prometiendo «la pantalla que se abre sola al crearlo» sin que eso fuera cierto — se aterrizaba en la ficha con la tarjeta de colores al pie.

**Ese estado viaja en la URL y no en memoria** (`?agregar=color`, §10.2). Tres cosas salen de ahí y ninguna sale de pasarse un dato entre pantallas: el enlace se puede pegar en cualquier lado —«andá a cargarle un color a esto»—, el botón atrás funciona, y dos pantallas no tienen que ponerse de acuerdo sobre algo invisible.

**Y al cerrar, el parámetro se saca.** Si se quedara, recargar volvería a abrir el alta encima de un color que ya se cargó. Se saca navegando (`router.replace` a la dirección sin él) y no refrescando: la navegación ya trae los datos nuevos, y hacer las dos cosas sería pedir la misma página dos veces.

**La regla, para el próximo diálogo que quiera abrirse solo:** si lo abre una acción de quien mira, es estado del cliente; si lo abre de dónde se viene, va en la dirección, y quien lo cierra lo limpia.

### 6.15 Avisos flotantes

**La biblioteca es `sonner`**, la misma que usa shadcn (decisión tuya del 2026-09-21, después de ver una versión propia que no se distinguía lo suficiente). Pone la cola, el apilado, el reloj que se detiene con el puntero encima, arrastrar para descartar, el foco, el `aria-live` y su propia regla de `prefers-reduced-motion`. El proyecto pone el aspecto y las palabras.

**Dos tonos, y cada uno tiene su disco.** Un glifo relleno dentro de un círculo de color, no un trazo suelto: es lo que hace que el aviso se lea de reojo, que es todo lo que un aviso tiene que lograr.

| Tono | Disco | Cuándo |
|---|---|---|
| **Éxito** (`avisar`) | Verde con el check | Salió como se pidió |
| **Pero** (`avisarConPero`) | Ámbar con el triángulo | Salió, **pero no como se pidió**. El caso real es «Borrar»: si el producto está en una orden no se borra, se desactiva (RF-15). Con el check verde al lado, esa frase se lee de reojo como «listo, borrado», que es justo lo que no pasó |

**El disco va en el color semántico y el glifo en su tinte**, no al revés ni en blanco fijo. En claro eso da el disco verde con el check casi blanco, que es lo pedido; en oscuro el par se da vuelta solo —verde claro con el glifo casi negro—. Con blanco fijo, el check sobre el verde del modo oscuro (`#4ade80`) queda en 1,5:1 y §9 pide 3:1 para un objeto gráfico.

**Confirman, no reportan errores.** Un error tiene que decir qué pasó, qué hacer y a veces ofrecer reintentar (§8), y nada de eso entra en algo que se va solo a los cuatro segundos. Los errores se quedan **donde estuvo la acción**: el diálogo que falla no se cierra y lo muestra adentro.

**Cuándo va uno y cuándo no**, que es lo único que hay que decidir:

| | |
|---|---|
| **Flotante** | El lugar donde pasó la cosa **desapareció** —un diálogo que se cerró, una fila que se borró, un globo que se fue— o la pantalla **no cambia de forma visible** |
| **En su lugar** | Lo que pasó **se ve**: subir una foto la hace aparecer, destacar un producto rellena su estrella, desactivarlo le cambia la insignia. Un cartel que repita lo que ya está a la vista es ruido |
| **Tampoco** | Guardar y quedarse en la misma pantalla, que ya tiene su «Listo, se guardó» en línea (Configuración) |

Tres decisiones de integración, las tres con motivo:

- **Sin `next-themes`.** La receta de shadcn lee el tema con `useTheme` y se lo pasa a `sonner` para que elija su paleta. Acá el tema es `data-theme` en `<html>` y los colores salen de los tokens, que ya se dan vuelta solos: dos fuentes para el mismo color es una de más.
- **`unstyled`.** Los selectores de `sonner` —`[data-sonner-toast]`— pesan lo mismo que una utilidad de Tailwind, y quién gana depende del orden de las hojas. Apagadas sus reglas de aspecto no hay empate que resolver, y el aviso se dibuja con los tokens del panel. Lo que se conserva son sus reglas de posición y animación, que no dependen de ese interruptor.
- **Adentro de `MarcoDeEscala` y no al final del `<body>`.** `sonner` **no usa un portal**: se dibuja donde se lo monta y se posiciona con `fixed`. Puesto adentro hereda el `data-scale="admin"` y no hace falta el truco de `escala.tsx`. Verificado: la tipografía del aviso sale a 14px, la del panel.

**El apilado no necesita ayuda.** `sonner` pone su lista en `z-index: 999999999`, y medido, ni ella ni la capa del diálogo tienen un ancestro que cree contexto de apilado: los dos están en el raíz, así que el aviso pinta encima. **Mientras el diálogo está abierto, el aviso se lee pero no se puede tocar**, porque Radix marca el `<body>` con `pointer-events: none`. Eso es lo correcto para un modal y no se corrige: el aviso se va solo a los cuatro segundos.

**Lo único que se le corrige a la biblioteca son los 400ms** de su transición, que pasan el techo de 300 de §8. La regla vive en `globals.css` con el selector repetido —`[data-sonner-toast][data-sonner-toast]`— porque la hoja del paquete queda después y a igual peso ganaría la suya; repetirlo sube la especificidad sin `!important`, que no se usa en ninguna otra parte del proyecto.

**El panel entero está cableado** (2026-09-21). Son **26 avisos en 18 componentes**. Y seis lugares que mutan **no llevan aviso flotante a propósito**, que es la otra mitad de la regla:

| Dónde | Por qué no |
|---|---|
| Configuración | Ya tiene su «Listo, se guardó» en línea, y la pantalla no se va |
| Modo mantenimiento | La insignia pasa de «Abierta» a «Cerrada al público» ahí mismo |
| Datos de un usuario | Guarda en su lugar, los campos quedan a la vista con lo guardado |
| Restablecer contraseña | El diálogo **no se cierra**: se da vuelta y muestra «Listo». Un flotante encima sería decir dos veces lo mismo |
| Fotos de un producto | La foto aparece o desaparece. «Subimos la foto» al lado de la foto es ruido |
| Destacar, activar, desactivar y reordenar filas | La estrella, la insignia o el lugar de la fila cambian delante tuyo |

**Dos canales que no se pisan.** Bloquear y dar de baja una cuenta tienen las dos cosas: el flotante confirma que se hizo, y la caja de aviso que ya estaba se queda **sólo cuando Supabase Auth no respondió**. Eso último no es un éxito limpio —la persona todavía puede iniciar sesión— y es información que hay que ir a revisar: un cartel que se va a los cuatro segundos no sirve para eso.

**Y un caso que enseña dónde está el límite de la regla.** Subir o bajar la cantidad de un ítem cambia el renglón a la vista, así que por la tabla de arriba no haría falta aviso. Lleva uno igual, y el motivo es que **cada uno escribe en el libro de stock**: agregar reserva unidades y quitar las libera, y eso es justamente lo que no se ve desde la pantalla. La pregunta no es «¿cambió algo en pantalla?» sino «¿alcanza lo que cambió para saber qué pasó?».

## 7. Composición de pantallas

### 7.1 Home

> **Detallada el 2026-09-22, pedido tuyo.** El canvas dejaba «Destacados / En
> oferta / Vistos recientemente» y nada más; lo que faltaba era qué hace la
> home con las **categorías**, que es lo que esta tienda tiene para ofrecer
> antes de que nadie sepa qué busca. El dibujo de abajo reemplaza al anterior.

```
┌────────────────────────────────────────────────────┐
│                                                    │
│            Todo para tu setup                      │  display 36px
│      Periféricos y accesorios con envío            │  body-lg, secundario
│                                                    │
│         (  Buscar productos...        (→)  )       │  buscador, máx 560px
│                                                    │
│   [Teclados] [Mouses] [Auriculares] [Cables] …     │  píldoras, hasta 7
│                                                    │
├──────────────────────── 80px ──────────────────────┤
│  Teclados                                     →    │  heading 20px
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │  una fila, grilla de 4
├──────────────────────── 80px ──────────────────────┤
│  Mouses                                       →    │  una sección por cada
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │  categoría destacada
├──────────────────────── 80px ──────────────────────┤
│  Destacados                                   →    │
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │
├──────────────────────── 80px ──────────────────────┤
│  En oferta                                    →    │
│  [tarjeta] [tarjeta] [tarjeta] [tarjeta]           │
├──────────────────────── 80px ──────────────────────┤
│  (Vistos recientemente)                            │  F8.4, todavía no
├──────────────────────── 80px ──────────────────────┤
│  ←  [logo] [logo] [logo] [logo] [logo] [logo]  →   │  hilera que gira
├──────────────────────── 80px ──────────────────────┤
│  Más categorías                    (Ver todas)     │  el botón, apagado
│  [Cables] [Sillas] [Monitores] [Adaptadores]       │
├────────────────────────────────────────────────────┤
│  Entregamos en Viedma, Patagones y alrededores     │
└────────────────────────────────────────────────────┘
```

Sin *hero* fotográfico: el hero es el buscador. Es una tienda de reventa, no una marca de estilo de vida, y la foto genérica de banco de imágenes le resta credibilidad.

**Las categorías aparecen dos veces, y hacen dos cosas distintas.** Arriba son
**chips**: un atajo para quien ya sabe qué busca, y por eso están pegadas al
buscador y llevan directo al catálogo filtrado. En el medio son **secciones con
producto adentro**: son para quien no sabe qué busca y necesita ver qué hay. La
de abajo es la tercera cara —**el resto del catálogo**, las que no están
destacadas— y ahí lo que importa no es cada producto sino que existan.

**Tope de siete chips.** Con más, la fila envuelve a tres renglones y deja de
leerse como un atajo. Las que no entran no desaparecen del sitio: están en el
menú del encabezado, en los filtros del catálogo y en la sección de abajo.

**Una fila por sección, y si no llena, no se rellena.** Una categoría con dos
productos muestra dos. Una sin ninguno activo **no dibuja su sección**: media
pantalla de secciones vacías es peor que una home más corta, y es lo que
protege a esta pantalla del riesgo P1 —hoy se ve con un catálogo sembrado y
mañana con el de Ana, que va a tener otra forma—.

**La hilera de medios de pago gira, y se queda quieta con
`prefers-reduced-motion`** (§9). Van sólo los que tienen logo: un nombre suelto
en una fila de logos se lee como una imagen que no cargó. Los que no tienen
logo siguen estando donde importan —§7.3, la ficha, donde se nombran—.

**«Ver todas» nace apagado, con el motivo al lado** (RNF-08): la pantalla de
categorías no existe todavía y no tiene tarea en ninguna fase. La sección se
construye igual porque el hueco es real; el botón se enciende el día que esa
pantalla exista.

### 7.2 Catálogo

> **Reescrita en F3.8.** Antes decía «filtros en columna izquierda de 260px». El canvas aprobado propone una barra con panel desplegable, y se adoptó: la columna lateral se come 260px de los 1200 —el 22%— para algo que se toca una vez y después estorba durante toda la sesión.

- **Una barra de tres controles**, del mismo alto (48px), encima de la grilla: buscador píldora que ocupa el espacio sobrante, botón «Filtros» y desplegable de orden. Tres alturas distintas en una fila se leen como un error.
- **El botón «Filtros» lleva el número de filtros puestos** en un círculo burdeos. La búsqueda no se cuenta ahí: tiene su propio campo al lado, y sumarla haría que el número no se corresponda con lo que se ve al abrir.
- **El panel se despliega de lado a lado por debajo de la barra**, no del ancho del botón, y se posiciona sobre la grilla en vez de empujarla. Abre con un `<details>` nativo: sin JavaScript, con teclado, y conservando su estado entre navegaciones — tocar un chip no lo cierra.
- **En teléfono no es un desplegable: es una hoja a pantalla completa** (agregado el 2026-09-08, midiendo a 390×844). El desplegable tiene un tope de alto con scroll propio, y en un teléfono eso dejaba el último tercio —el campo «Hasta», su «Aplicar», la casilla del descuento y **«Ver N productos», que es la acción principal**— detrás de una ranura sin ninguna señal: el corte caía a la mitad de un campo y el borde redondeado se leía como el final del panel. Encima el mismo gesto hacía dos cosas según dónde cayera el dedo. La hoja resuelve las dos: **la lista scrollea sola y de arriba abajo, y las dos salidas están fijas y siempre a la vista** —una × arriba a la derecha para quien abrió a mirar y se arrepintió, «Ver N productos» abajo para quien terminó de filtrar—. Se van el radio, la sombra y el tope de alto, que son de una tarjeta apoyada sobre algo, y acá no hay nada debajo. Encabezado con el rótulo «Filtros» y su contador, porque a pantalla completa se pierde el botón que decía qué es esto. Ninguna de las dos salidas descarta lo elegido: cada chip ya navegó al tocarse.
- **La hoja no es un diálogo modal y no finge serlo.** Sigue siendo el mismo `<details>`, así que no atrapa el foco ni marca inerte lo de atrás. Es una limitación conocida y aceptada: convertirla en diálogo obliga a manejar foco, `Escape` e historial en cliente, y perdería lo que hace que este panel funcione sin JavaScript. Si alguna vez molesta de verdad, se revisa como decisión propia y no de paso.
- **Dentro del panel, los tres grupos van en columnas**, no apilados: apilados el panel pasaba los 500px de alto y «Color» quedaba abajo de todo, así que se elegía categoría, se elegía marca y nadie llegaba a ver que había colores. En un teléfono vuelven a una sola columna.
- **Todo son chips con su conteo**: categoría, marca y color, cada grupo con su encabezado en versalitas. El color suma un punto relleno con su hexadecimal. Los tres son **multiselección** —dentro del grupo las opciones se suman, entre grupos se cruzan: «(Teclados o Mouses) y Logitech»— y volver a tocar un chip encendido lo apaga. No hay rótulo que anuncie que se puede elegir varios: se descubre eligiendo el segundo, y hasta ahí el chip se comporta igual que antes.
- **El descuento se dibuja como casilla**: no es una opción entre varias, es sí o no.
- **El rango de precio es el único control de verdad del panel**: dos campos numéricos con su etiqueta a la vista y un botón «Aplicar». Es un formulario `GET` y no un enlace, porque hasta que no se escribe el número no existe la dirección a la que ir; los demás filtros viajan como campos ocultos para que poner un precio no borre la marca elegida. Va sobre el **precio final**, que es lo que se paga.
- **El pie del panel cierra el trato**: «Limpiar filtros» a la izquierda y **«Ver N productos»** a la derecha, relleno burdeos. Sin ese botón, la única forma de cerrar es volver a subir hasta «Filtros», que es justo el gesto que nadie encuentra después de elegir tres cosas. Es la única línea de JavaScript del panel —un `<details>` no se cierra desde adentro sin script— y degrada: su `href` baja a la grilla. **En la hoja de teléfono ese pie es una franja fija abajo**, respetando el área segura, y el botón ocupa el ancho que le queda libre: un botón principal que no usa el espacio disponible se lee como secundario. La × de la hoja es la segunda y última línea de JavaScript, y es el mismo truco.

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

**Un chip por VALOR aplicado, no por grupo.** Con dos marcas puestas hay dos chips y cada uno saca la suya; el del precio es uno solo y se lleva los dos bordes. Un chip «2 marcas» diría cuántas hay y obligaría a abrir el panel para saber cuáles, que es justo lo que los chips existen para evitar. **«Limpiar todo» no es opcional**: un identificador que ya no está en la lista de opciones —una categoría cuyo último producto se desactivó— filtra sin dibujar chip, y ese enlace es la única salida.

### 7.3 Ficha de producto

```
┌──────────────────────┬─────────────────────────────┐
│ ┌──┐                 │  LOGITECH                   │  caption, versalitas
│ └──┘                 │  Teclado mecánico K120      │  title 24px
│ ┌──┐    imagen       │                             │
│ └──┘  principal   ›  │  $ 24.500,00                │  burdeos, 24px
│ ┌──┐                 │  $ 27.500,00                │  tachado, secundario, 12px
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

   Ya le avisamos a la vendedora       body, secundario
   por email y guardamos el stock
   hasta coordinar el pago. Si querés
   agilizarlo, escribile por WhatsApp.

   ┌──────────────────────────────┐
   │  resumen de la orden          │  tarjeta, radio 24px
   └──────────────────────────────┘

   [  Coordinar pago por WhatsApp  ]   principal
   [  Ver mis compras  ]               secundario
```

El botón de WhatsApp es la **acción principal**: es lo que efectivamente cierra la venta (RF-12). **Pero el texto de arriba lo presenta como opcional**, y las dos cosas no se contradicen: la venta ya está registrada y la vendedora ya fue avisada, así que apurarla es una elección de quien compra. Destacado porque es lo que más le conviene, no porque sin él no pase nada.

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
| **Confirmado** | Toda acción que muta dice que salió bien. Flotante o en su lugar según §6.15; nunca en silencio |

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

- **No sumar un TERCER color saturado.** El sistema tiene dos —el burdeos y el
  azul pizarra de §2.5— y de ahí sale su fuerza. El pizarra entró el 2026-09-17
  por un motivo estructural, no estético: en la ficha hay dos formas de comprar
  y tienen que pesar igual. Cualquier otro caso se resuelve con la escala de
  grises, con el contorno o con los semánticos, que ya existen.
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
| **Los filtros del catálogo son multiselección, y se suman dentro del grupo** | Cruzarlas dentro del grupo daría cero resultados siempre: ningún producto es de dos categorías a la vez. Sumar entre grupos convertiría cada filtro nuevo en un listado más grande, que es lo contrario de filtrar |
| **El rango de precio es un formulario y no un enlace** | Es el único filtro cuyo valor no sale de una lista cerrada: hasta que no se escribe el número, no hay dirección a la que apuntar. Sigue sin JavaScript y sigue dejando el atrás funcionando, que era todo lo que los enlaces daban |
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
