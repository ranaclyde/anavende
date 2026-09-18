# Product

<!-- impeccable:product-schema 1 -->

> Este archivo es un **resumen operativo**, no la autoridad. La verdad del
> producto vive en `sdd/mvp/FUNCTIONAL-SPEC.md` y `sdd/mvp/TECHNICAL-SPEC.md`;
> las decisiones visuales, en `sdd/mvp/DESIGN-REFERENCE.md`. Ante cualquier
> diferencia, mandan las especificaciones. Acá está destilado lo que un agente
> necesita saber antes de tocar una pantalla, con la referencia al lado.

## Platform

web

## Users

**Quien compra.** Persona de Viedma, Carmen de Patagones y los pueblos a menos
de ~30 km que busca productos de informática y gaming: mouses, teclados,
auriculares, joysticks, cables, memorias, pasta térmica. Llega mayormente desde
el teléfono: el móvil es prioridad de diseño, no una adaptación (RNF-01).
Aparece en dos estados (FUNCTIONAL-SPEC §2):

- **Visitante** — no autenticado. Navega el catálogo completo y consulta o
  compra por WhatsApp. **No arma carrito**, no tiene favoritos ni órdenes, y no
  reserva stock (RN-08).
- **Comprador** — registrado y verificado. Carrito persistente, favoritos,
  libreta de direcciones e historial de órdenes.

**Ana, la vendedora.** Una sola persona operando el panel, con la posibilidad de
sumar otras cuentas `admin` (S-02). Carga el catálogo, mantiene el stock,
gestiona órdenes, devoluciones, usuarios y reportes. Trabaja en tablet y
escritorio; en el teléfono necesita al menos poder operar sobre órdenes
(RNF-01).

No hay rol operador ni permisos granulares: sólo `admin` y `customer` (FA-12).

## Product Purpose

AnaVende es una tienda online de reventa de productos informáticos que **no
cobra online**. La web es catálogo, carrito y generadora de órdenes; el cobro y
la coordinación del envío se cierran por WhatsApp, fuera del sistema (RN-01).

Sirve a dos personas a la vez:

- **Para quien compra:** descubrir y decidir rápido y sin fricción, y terminar
  en una conversación de WhatsApp que ya tiene todo el contexto.
- **Para Ana:** una única fuente de verdad del stock —incluidas las ventas que
  ocurren por WhatsApp o en persona— y visibilidad del negocio por reportes.

El éxito está medido en objetivos concretos (FUNCTIONAL-SPEC §1.1): cargar un
producto completo con imágenes en menos de 5 minutos sin ayuda técnica (O1);
diferencia cero entre el stock del sistema y el físico en un control semanal
(O2); toda orden o consulta llegando a WhatsApp con producto, color, cantidad y
precio (O3); órdenes de la web que no obligan a recargar datos a mano (O4).

## Positioning

Cuatro cosas que un competidor no podría copiar diciendo la verdad, y que
sostienen el negocio juntas:

1. **Entrega local, hoy o mañana.** Mensajería en moto o retiro en el punto de
   entrega, dentro de Viedma, Patagones y alrededores. No se espera una semana a
   que llegue del otro lado del país.
2. **Curaduría.** No es un catálogo infinito: lo que está publicado está porque
   Ana lo eligió y lo respalda. Parte del valor es lo que decidió no vender.
3. **Trato con una persona.** Se le compra a Ana por WhatsApp, con preguntas,
   recomendación y seguimiento. No hay soporte de plataforma ni formulario
   anónimo.
4. **Precio de reventa.** Comprar al por mayor deja precios mejores que el
   retail local.

**Sin decidir:** cuál de las cuatro lidera cuando hay que elegir una sola. Las
cuatro son verdad; cuál va primero en una superficie donde entra un solo mensaje
es una decisión abierta.

## Operating Context

- **La venta se cierra afuera.** Toda pantalla de compra desemboca en un mensaje
  de WhatsApp que ya lleva producto, color, cantidad y precio (RF-04, O3).
- **El alcance de entrega es acotado y explícito** (RN-10): Viedma, Carmen de
  Patagones y los pueblos a menos de ~30 km. Dos formas, envío a domicilio o
  retiro en el punto de entrega. El costo del envío **no se calcula ni se cobra
  en la web**: se coordina por WhatsApp. **La web no nombra a la empresa de
  mensajería** —puede cambiar, y lo que le sirve a quien compra es hasta dónde
  se llega.
- **El stock del sistema incluye lo que se vende afuera.** Las ventas por
  WhatsApp o presenciales se cargan como órdenes manuales (RF-24) para que el
  número no se despegue de la realidad.
- **Una orden activa reserva stock**, y la reserva se libera sólo cuando la
  orden se finaliza o se cancela. No hay expiración automática (RN-07, FA-05).
- **El volumen es bajo:** cientos de productos y decenas de órdenes por mes
  (S-05). Paginación y reportes simples alcanzan; no hay infraestructura
  analítica ni la necesita.

## Capabilities and Constraints

- **Nunca se pide un dato de pago.** Ninguna pantalla pide tarjeta ni promete
  cobro automático (RN-01, FA-01).
- **Moneda y formato:** pesos argentinos con decimales, `$ 12.500,50`, locale
  `es-AR`. El precio ya incluye IVA y **no se discrimina ni se aclara** (RN-02).
  Sin multi-idioma ni multi-moneda (FA-11).
- **Idioma:** toda la interfaz, tienda y panel, en español rioplatense con voseo
  (RN-03).
- **Modelo:** precio y descuento viven en el **producto**; stock e imágenes, en
  la **variante de color** (RN-04). El color es el único atributo de variante:
  no hay talle ni capacidad (FA-16). Hasta 5 imágenes **por variante** (S-01).
- **El descuento es un monto absoluto en ARS**, no un porcentaje; `0` significa
  sin oferta (RN-04b). Una oferta se comunica con **dos números y nunca con
  tres**: el precio original tachado y el precio final. En ninguna pantalla se
  enuncia lo ahorrado ni el porcentaje (RN-04c).
- **Visibilidad:** un producto se ve en el sitio público sólo si está activo, y
  se muestra siempre, aunque no tenga stock (RN-05). Una variante sin stock se
  muestra señalizada y no seleccionable (RN-06).
- **Nada se elimina.** Borrado lógico para todo lo referenciado por una orden o
  presente en un carrito (RN-11), y coherencia de activo/inactivo entre
  producto, marca, categoría y color (RN-11b). Los usuarios no se eliminan.
- **Las órdenes guardan snapshot** de nombre y precio, para que el historial no
  cambie cuando cambia el catálogo (RN-12).
- **Baja de cuenta y bloqueo no son lo mismo** (RN-13): comparten el efecto, no
  el significado ni el mensaje. Ninguno borra datos.
- **Terminología del dominio** (FUNCTIONAL-SPEC §3), a respetar en la interfaz:
  producto, variante, stock total, stock reservado, stock disponible, orden,
  orden manual, devolución, medio de pago.
- **Fuera de alcance del MVP:** FUNCTIONAL-SPEC §13. Entre lo que más suele
  darse por supuesto y no existe: reseñas y valoraciones, cupones y
  promociones, seguimiento de envíos, carrito de invitado, app nativa,
  importación masiva de catálogo, y devoluciones iniciadas por quien compra.

## Brand Commitments

- **Nombre:** AnaVende.
- **Isotipo:** una cuadrícula de cuatro celdas —una **A**, un joystick, unos
  auriculares y una **V**— a trazo burdeos sobre transparente. Archivos reales
  en `public/marca/logo.png` y `public/marca/logo-claro.png`; la versión clara
  se deriva del original con `scripts/derivar-logo.mts`, no se mantiene a mano.
  **Nunca** se deforma, recolorea, sombrea ni rota, y no se usa por debajo de
  24px salvo en el favicon (DESIGN-REFERENCE §2.3).
- **Eslogan:** «Ana vende, vos elegís la tecnología.» La última palabra rota por
  categoría donde hay contexto que lo justifique; la forma canónica va donde la
  persona lo lee una sola vez —pie de página, emails—. Nunca se invierten las
  dos mitades, nunca se tutea, y nunca se sustituye la palabra final por una
  marca de tercero (DESIGN-REFERENCE §2.4).
- **Voz:** español rioplatense con voseo, en producto y en documentación.

## Evidence on Hand

- **Especificaciones completas y vigentes:** `sdd/mvp/FUNCTIONAL-SPEC.md`,
  `TECHNICAL-SPEC.md`, `DESIGN-REFERENCE.md`, `DEVELOPMENT-PLAN.md`. Estado tarea
  por tarea en `PROGRESO.md`.
- **Logo real recibido y en el repo:** `public/marca/`.
- **No hay catálogo real.** La base tiene únicamente datos de prueba. **No
  existen** hoy: fotos propias de producto, precios reales, stock real,
  testimonios, clientes citables, métricas de venta ni casos. Nada de esto debe
  inventarse, ni citarse, ni usarse como relleno en una pantalla: si una
  superficie necesita contenido real, se pide.

## Product Principles

1. **El número que se ve es el número que hay.** El stock del sistema es la
   única fuente de verdad, y toda venta —venga de la web, de WhatsApp o del
   mostrador— pasa por él.
2. **La web no cobra: prepara la conversación.** Cada camino de compra termina
   en un WhatsApp que ya tiene el contexto completo, para que nadie tenga que
   repetir lo que ya eligió.
3. **La cercanía es el producto.** Sólo se promete lo que se entrega en la zona,
   y se dice hasta dónde se llega antes de que alguien se ilusione.
4. **Nada se borra.** Se desactiva. El historial de una orden no cambia porque
   cambió el catálogo.
5. **Ana opera sola.** Ninguna tarea del panel puede necesitar ayuda técnica
   para completarse.

## Accessibility & Inclusion

Requisito del producto, no aspiración (RNF-02): contraste suficiente, navegación
completa por teclado, foco visible, texto alternativo en las imágenes de
producto y formularios con etiquetas asociadas.

El móvil es prioridad de diseño en la tienda; el panel es usable en tablet y
escritorio, y en móvil garantiza como mínimo las operaciones sobre órdenes
(RNF-01).

Los mensajes de error nunca se muestran como texto técnico: dicen qué pasó y qué
hacer (RNF-08).
