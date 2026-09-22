# AnaVende — Especificación Funcional (MVP)

| Campo | Valor |
|---|---|
| Producto | AnaVende — e-commerce de reventa de productos informáticos |
| Versión | 1.0 (MVP) |
| Fecha | 2026-08-30 |
| Estado | Aprobado para especificación técnica |
| Documento fuente | `sdd/PROVISIONAL.md` |
| Documentos hermanos | `TECHNICAL-SPEC.md`, `DESIGN-REFERENCE.md`, `DEVELOPMENT-PLAN.md` |

---

## 1. Resumen ejecutivo

AnaVende es una tienda online de reventa de productos informáticos (mouses, teclados, auriculares, pasta térmica, cables, memorias, entre otros).

El MVP **no procesa pagos online**. La web funciona como catálogo, carrito y generador de órdenes; el cobro y la coordinación del envío se cierran por WhatsApp fuera del sistema. El objetivo del producto es doble:

1. **Para el comprador:** una experiencia de descubrimiento y compra clara, rápida y visualmente cuidada (referencia de diseño: `shop.app`, ver `DESIGN-REFERENCE.md`).
2. **Para la vendedora:** una única fuente de verdad del stock, incluso para las ventas que ocurren fuera de la web (WhatsApp, presencial), y visibilidad del negocio mediante reportes.

### 1.1 Objetivos del MVP

| # | Objetivo | Métrica de éxito |
|---|---|---|
| O1 | Publicar y mantener el catálogo sin intervención técnica | La vendedora carga un producto completo con imágenes en < 5 min sin ayuda |
| O2 | Que el stock del sistema refleje la realidad | Diferencia entre stock del sistema y stock físico = 0 en un control semanal |
| O3 | Canalizar la venta hacia WhatsApp con contexto completo | Toda orden/consulta llega a WhatsApp con producto, color, cantidad y precio |
| O4 | Reducir la carga administrativa de la vendedora | Las órdenes de la web no requieren recarga manual de datos |

### 1.2 No-objetivos del MVP

Ver detalle en §12 (Fuera de alcance).

---

## 2. Actores

| Actor | Descripción | Autenticación |
|---|---|---|
| **Visitante** | Persona no autenticada. Navega el catálogo completo y puede consultar/comprar por WhatsApp. **No puede armar carrito**, ni tiene favoritos ni órdenes. | No |
| **Comprador** | Usuario registrado y verificado. Tiene carrito persistente, favoritos, libreta de direcciones, historial de órdenes. | Sí, rol `customer` |
| **Administrador (vendedora)** | Gestiona catálogo, stock, órdenes, devoluciones, usuarios, configuración y reportes. Puede existir más de una cuenta con este rol. | Sí, rol `admin` |
| **Sistema** | Procesos automáticos: optimización de imágenes, envío de emails, recálculo de stock disponible. | — |

> **Decisión:** solo existen dos roles (`admin`, `customer`). No hay rol operador en el MVP.

---

## 3. Glosario

| Término | Definición |
|---|---|
| **Producto** | Artículo del catálogo. Tiene nombre, descripción **con formato** (RF-15), marca, categoría, precio y descuento (monto absoluto; `0` = sin oferta). |
| **Variante** | Combinación producto + color. Es la unidad que tiene stock e imágenes propias. Un producto tiene 1..N variantes. |
| **Variante única** | Variante de un producto sin color relevante (ej.: pasta térmica). Se modela igual que cualquier variante, con color nulo/«Único». |
| **Stock total** | Unidades físicas de una variante. |
| **Stock reservado** | Unidades comprometidas por órdenes en estado `activa`. |
| **Stock disponible** | `stock_total − stock_reservado`. Es el número que ve el comprador. |
| **Orden** | Registro de una intención de compra generada en la web (por un comprador) o cargada a mano por la administradora. |
| **Orden manual** | Orden creada por la administradora para registrar una venta ocurrida fuera de la web. |
| **Devolución** | Registro de la restitución de uno o más ítems de una orden finalizada. |
| **Medio de pago** | Ítem informativo (nombre + logo) que se muestra al comprador. El MVP no cobra online. |

---

## 4. Reglas de negocio transversales

| ID | Regla |
|---|---|
| **RN-01** | El MVP no procesa pagos online. Ninguna pantalla debe pedir datos de tarjeta ni prometer cobro automático. |
| **RN-02** | Los precios se expresan en **pesos argentinos (ARS)**, con decimales, formato `$ 12.500,50` (locale `es-AR`). El precio ya incluye IVA y **no se discrimina ni se aclara** en la interfaz. |
| **RN-03** | Toda la interfaz (comprador y panel) está en **español rioplatense**. |
| **RN-04** | El precio y el descuento viven a nivel **producto**. El **stock y las imágenes** viven a nivel **variante (color)**. |
| **RN-04b** | El **descuento es un monto absoluto en ARS**, no un porcentaje. Si el descuento es `0`, no hay oferta y se muestra sólo el precio. Si es mayor que `0`, el **precio final = precio − descuento**, y se muestra el precio original tachado junto al precio final. El descuento nunca puede ser mayor o igual al precio. |
| **RN-04c** | Una oferta se comunica con **dos números y nunca con tres**: el precio original tachado y el precio final. **En ninguna pantalla se enuncia el monto ahorrado** («Ahorrás $ X») ni el porcentaje. El tachado ya dice cuánto bajó; el tercer número repite la misma oferta y obliga a leer de más. Vale para tarjeta, ficha, carrito y orden. |
| **RN-05** | Un producto es visible en el sitio público únicamente si `isActive = true`. Un producto activo se muestra **siempre**, aunque no tenga stock disponible. |
| **RN-06** | Una variante sin stock disponible se muestra, señalizada como «Sin stock» y no seleccionable para compra. |
| **RN-07** | Una orden en estado `activa` **reserva stock**. La reserva se libera únicamente cuando la orden pasa a `finalizada` (descuenta stock real) o `cancelada` (libera sin descontar). **No existe expiración automática.** |
| **RN-08** | El Visitante no genera órdenes ni reserva stock. Su compra sale exclusivamente como mensaje de WhatsApp. |
| **RN-09** | El carrito refleja siempre el **precio vigente** del producto. Los cambios de precio, stock o disponibilidad respecto de la última vista se comunican explícitamente al comprador. |
| **RN-10** | La tienda **entrega sólo en Viedma, Carmen de Patagones y alrededores** (los pueblos a menos de ~30 km). Hay dos formas: **envío a domicilio**, hoy con mensajería en moto, y **retiro en el punto de entrega**. El costo del envío no se calcula ni se cobra en la web: se coordina por WhatsApp. **La web no nombra a la empresa de mensajería**: puede cambiar, y lo que le sirve a quien compra es hasta dónde llegamos. |
| **RN-11** | Nunca se elimina físicamente un producto, marca, categoría o color que esté referenciado por una orden. Se desactiva (borrado lógico). **Lo mismo vale para un producto o una variante que esté en algún carrito** (2026-09-12): borrarlo se lo llevaría del carrito sin aviso, y RF-08 exige que el comprador lo vea apartado. |
| **RN-11b** | **Ningún producto activo puede pertenecer a una marca o categoría inactiva, ni tener variantes activas de un color inactivo.** No se puede desactivar una marca, categoría o color que esté en uso por algo activo: primero se desactiva lo que la usa. Tampoco se puede activar un producto cuya marca o categoría esté inactiva. |
| **RN-12** | Las órdenes conservan una copia del nombre y precio del producto al momento de crearse (snapshot), para que cambios posteriores del catálogo no alteren el historial. |
| **RN-13** | **Un usuario dado de baja (RF-34) no es un usuario bloqueado (RF-27).** Comparten el efecto —no puede entrar, no se borra nada, se revierte— y no comparten ni el significado ni el mensaje. Ninguno de los dos elimina datos: los usuarios no se eliminan (§5.6). |

---

## 5. Módulo: Catálogo público

### RF-01 — Home

**Descripción:** Página de entrada con la propuesta visual de descubrimiento (ver `DESIGN-REFERENCE.md`).

**Contenido**, en este orden (detallado el 2026-09-22 y **corregido el mismo día** contra el boceto que pasaste; el dibujo está en `DESIGN-REFERENCE.md` §7.1):

1. **Hero con bloques flotantes.** Hasta cinco productos de **una** categoría destacada, en tarjetas escalonadas, con la marca y la bajada debajo. Los bloques **cambian de categoría cada tanto** —unos mouses, después unos teclados— y **cada uno enlaza a su ficha**.
2. **Buscador**, con la invitación «¿Qué estás buscando hoy?». Sigue siendo lo que la pantalla pide hacer: no hay foto de portada ni banner.
3. **Chips de categoría**: las **destacadas** (RF-18), **hasta siete**. Las que no entran no se muestran acá. Cada chip lleva al catálogo **ya filtrado por esa categoría**, no a una pantalla propia.
4. **Aviso de la zona de entrega** (RN-10), **pegado a los chips**: es lo primero que alguien de afuera necesita saber para decidir si esta tienda le sirve. Acá va **en una línea** —hasta dónde llevamos y que el envío se coordina por WhatsApp—; la versión completa, con el retiro en el punto de entrega, la sigue diciendo el pie del sitio, que está en todas las pantallas.
5. **Sección de productos destacados** (RF-20).
6. **Una sección por cada categoría destacada**, con sus productos —los que entren en una fila—. La sección no aparece si la categoría no tiene ninguno activo.
7. **Sección de productos en oferta** (con descuento activo).
8. **Franja de medios de pago**: **sólo los que tienen logo cargado** (RF-19), en una sola hilera que gira. Va abajo y no arriba: es información de respaldo, no la propuesta de la pantalla.
9. **Sección de más categorías**, con un botón **«Ver todas»**.

**Lo que no entra, y por qué:**
- **«Vistos recientemente»** es RF-33 y se construye en F8.4. Su lugar en la pantalla está previsto en §7.1; hasta entonces no se dibuja.
- **La pantalla de listado de categorías no existe** y no tiene tarea en ninguna fase. Por eso **«Ver todas» nace deshabilitado, con el motivo al lado** (RNF-08): la sección se construye ahora y el botón se enciende el día que esa pantalla exista.
- **«Más categorías» va en píldoras y no en tarjetas.** La tarjeta con foto que pediste necesita una imagen de categoría, y `categories` no tiene ninguna: la decisión —usar la foto de uno de sus productos o darle campo propio, con su migración y su subida en el panel— quedó **postergada a pedido tuyo el 2026-09-22** y está anotada en `PROGRESO.md`.

**Criterios de aceptación:**
- [ ] La home carga sin productos cargados (estado vacío controlado, sin errores), y **cada bloque desaparece solo** cuando no tiene qué mostrar: sin destacados no hay sección de destacados, sin ofertas no hay ofertas, sin medios de pago con logo no hay franja, y **sin categorías con fotos suficientes el hero queda en marca, bajada y buscador**.
- [ ] Todos los bloques enlazan a listados filtrados del catálogo.
- [ ] Sólo se muestran productos con `isActive = true`.
- [ ] Los accesos rápidos muestran las categorías **destacadas**, ordenadas entre ellas por nombre (§5.4), **con un tope de siete**. Sólo se muestran categorías activas.
- [ ] Las secciones por categoría muestran **hasta una fila** de productos y enlazan a esa categoría en el catálogo.
- [ ] El hero **muestra los productos que haya**: una categoría con cuatro dibuja cuatro bloques. Entra a la rotación la que tenga **al menos tres productos activos con foto** —con menos no es un hero, es un hueco—, y sólo entran productos **con foto**.
- [ ] La rotación del hero **se detiene** mientras el mouse está encima o el foco del teclado está adentro, para que el enlace no se escape mientras se lo apunta.
- [ ] El hero **no rota** si el visitante pidió menos movimiento (`prefers-reduced-motion`): se queda en la primera categoría, con todo su contenido alcanzable.
- [ ] La hilera de medios de pago **queda quieta** si el visitante pidió menos movimiento (`prefers-reduced-motion`), y no es la única forma de llegar a esa información.

---

### RF-02 — Listado de catálogo con búsqueda, filtros, orden y paginación

**Descripción:** Página `/productos` (y variantes filtradas) que lista el catálogo.

**Búsqueda:**
- Campo de texto libre que busca en nombre y descripción del producto, y en el nombre de la marca. De la descripción se busca **el texto, no las marcas de formato**: que una palabra esté en negrita no cambia si se encuentra.
- Insensible a mayúsculas y acentos.
- Muestra la cantidad de resultados y el término buscado, con opción de limpiar.

**Filtros (combinables entre sí y con la búsqueda):**

| Filtro | Tipo | Comportamiento |
|---|---|---|
| Categoría | Multiselección | Muestra sólo categorías activas y con al menos un producto, con las **destacadas primero** |
| Marca | Multiselección | Ídem |
| Color | Multiselección | Muestra el producto si **alguna** de sus variantes tiene ese color |
| Rango de precio | Mín/Máx | Sobre el precio final (`precio − descuento`) |

**Ordenamiento:**
- Relevancia (por defecto; si hay búsqueda activa prioriza coincidencia, si no, destacados/novedad).
- Precio: menor a mayor.
- Precio: mayor a menor.
- Más nuevos primero.

**Paginación:** paginado clásico con tamaño de página fijo (por defecto 24 productos).

**Criterios de aceptación:**
- [ ] Los filtros, búsqueda, orden y página se reflejan en la URL (compartible y navegable con atrás/adelante del browser).
- [ ] Los filtros aplicados se muestran como chips removibles, con acción «Limpiar todo».
- [ ] Los productos sin stock aparecen en el listado, marcados «Sin stock».
- [ ] Los productos con `isActive = false` **nunca** aparecen, ni por búsqueda ni por URL directa de listado.
- [ ] Estado vacío explícito («No encontramos productos con esos filtros») con acción para limpiar filtros.
- [ ] Cada tarjeta muestra: imagen principal, marca, nombre, precio final y —si el descuento es mayor que cero— el precio original tachado. **No muestra el ahorro en pesos**: son dos números, cuánto valía y cuánto vale (RN-04c).
- [ ] Cada tarjeta ofrece marcar/desmarcar favorito con un corazón, **siempre a la vista** (RF-10).

---

### RF-03 — Ficha de producto

**Descripción:** Página de detalle `/productos/[slug]`.

**Contenido:**
- Galería de imágenes de la variante seleccionada (hasta 5), con miniaturas y vista ampliada.
- Nombre, marca, categoría.
- Precio final; si el descuento es mayor que cero: precio original tachado, y nada más (RN-04c).
- Selector de color (variantes). Cada opción indica si está sin stock.
- Indicador de disponibilidad de la variante seleccionada.
- Selector de cantidad, limitado por el stock disponible de la variante.
- Descripción del producto, **con el formato que le dio la vendedora** (RF-15).
- Bloques de recomendados: «También te puede interesar», «Productos similares» y «Vistos recientemente» (RF-32, RF-33).
- **Tres datos**, un renglón cada uno: que los productos son nuevos y en su caja original, la zona de entrega (RN-10) y que el pago se coordina al confirmar el pedido, nombrando los medios aceptados (RF-19).
- **Bloque «¿Cómo sigue después de comprar?»** con los tres pasos —armar el pedido o escribir por WhatsApp; confirmación de stock, precio y forma de pago; coordinación de la entrega o el retiro— y el enlace a Legales (garantías y devoluciones) adentro.
- **Guardar** (favoritos, RF-10) y **Compartir**, juntos debajo de las acciones de compra.

**Acciones:**

| Acción | Visitante | Comprador |
|---|---|---|
| Agregar al carrito | Botón «Iniciá sesión para comprar» → login y vuelve a la acción | Sí |
| Comprar ahora | Abre WhatsApp con el detalle del producto | Va al checkout con ese único ítem |
| Consultar por WhatsApp | Sí | Sí |
| **Preguntar si va a haber** (sólo sin stock) | Sí | Sí |
| Agregar a favoritos | Invita a iniciar sesión | Sí |

**Criterios de aceptación:**
- [ ] Al cambiar de color, cambian imágenes, stock y disponibilidad sin recargar la página, y la URL refleja la variante.
- [ ] Si una variante no tiene imágenes propias, se muestran las imágenes designadas como respaldo (ver RF-16).
- [ ] Si la variante no tiene stock disponible, la ficha **lo dice con palabras** —no sólo con un color o un botón apagado—, las acciones de compra quedan deshabilitadas y el botón **principal** pasa a ser **«Preguntá si va a haber»**, que abre WhatsApp con el mensaje de consulta de disponibilidad (RF-04). Es la única acción que le queda a quien llegó hasta acá, así que no puede ser la secundaria.
- [ ] Esa consulta **sale del sitio**: no crea orden, no reserva, no agenda ningún aviso. La ficha no promete que le vayan a avisar — la respuesta llega por WhatsApp y la da la vendedora.
- [ ] El corazón de favoritos está en la ficha además de en la tarjeta, **siempre a la vista**, y se ve relleno cuando el producto ya está marcado (RF-10).
- [ ] Un producto con `isActive = false` devuelve 404.
- [ ] No se puede seleccionar una cantidad mayor al stock disponible.
- [ ] La descripción se muestra con su formato —párrafos, negrita, cursiva, listas y subtítulos— y **nada más**: lo que quedó fuera del subconjunto de RF-15 no se renderiza ni aparece como texto crudo.

---

### RF-04 — Compra por WhatsApp (Visitante, sin login)

**Descripción:** Camino de compra para quien no quiere registrarse.

**Comportamiento:**
- Desde la ficha de producto, «Comprar por WhatsApp» abre `wa.me` con un mensaje prellenado.
- El mensaje incluye: nombre del producto, color, cantidad, precio unitario y enlace a la ficha.
- **No se crea orden. No se reserva ni descuenta stock.** (RN-08)
- La administradora, si la venta se concreta, la registra como **orden manual** (RF-24).

**Los mensajes prellenados son dos, y dicen cosas distintas:**

| Mensaje | Cuándo | Qué lleva |
|---|---|---|
| **Compra** | La variante tiene stock | Producto, color, cantidad, precio unitario y enlace a la ficha |
| **Consulta de disponibilidad** | La variante **no** tiene stock (RF-03) | Producto, color y enlace a la ficha. **Sin cantidad ni precio**: no se está comprando, se está preguntando si va a haber, y un precio en un mensaje sobre algo que todavía no existe es un precio que después hay que desdecir |

Los dos salen de la misma función y del mismo número de configuración (RF-20): lo que cambia es el texto, no la tubería.

**Criterios de aceptación:**
- [ ] El número de WhatsApp de destino es configurable desde el panel, no está hardcodeado.
- [ ] El mensaje se genera correctamente codificado (acentos, saltos de línea, símbolo `$`).
- [ ] La pantalla aclara al visitante que el stock no queda reservado y que puede registrarse para reservarlo.

---

## 6. Módulo: Cuenta del comprador

### RF-05 — Registro

**Descripción:** Alta de cuenta por auto-registro.

**Campos:** nombre y apellido, email, contraseña, **teléfono (obligatorio)**.

**Comportamiento:**
- Al registrarse se envía un **email de verificación** (ver RF-30).
- **Hasta verificar el email no se puede iniciar sesión.** Tras el alta se muestra la pantalla «Revisá tu email»; quien intente entrar antes de abrir el enlace recibe un mensaje que lo explica y ofrece **«Reenviar verificación»**.

> **Por qué no se puede entrar sin verificar.** La versión anterior de este requisito decía que la cuenta podía iniciar sesión sin verificar y que se le mostraba un aviso persistente. **Supabase Auth no lo permite:** GoTrue rechaza el ingreso de cualquier identidad sin `email_confirmed_at`, y lo hace mirando esa columna, no la configuración. Se comprobó en F1.7 con las dos configuraciones posibles —confirmación requerida y autoconfirmación global, creando la cuenta con `email_confirm: false`— y el ingreso se rechaza en ambas con `email_not_confirmed`.
>
> Las alternativas eran construir la verificación por nuestra cuenta —tokens, vencimiento y reenvío propios, justo lo que §13.1 le delega a Supabase— o dejar el MVP sin verificación, lo que además desarma la protección contra apropiación de cuenta de RF-06. Se adopta el comportamiento de la plataforma.
>
> **Consecuencia asumida:** si el registro empezó desde una acción de compra, esa acción se retoma después de verificar, no inmediatamente.

**Criterios de aceptación:**
- [ ] Email único; mensaje de error claro si ya existe.
- [ ] Requisitos mínimos de contraseña visibles antes de enviar el formulario.
- [ ] El enlace de verificación expira y puede reenviarse.
- [ ] El teléfono es obligatorio en el alta y no puede quedar vacío en el perfil: es el canal por el que se coordina la venta.
- [ ] Quien intenta ingresar sin haber verificado ve el motivo y puede **reenviar la verificación desde ahí mismo**, sin volver a registrarse.
- [ ] Si el registro se inició desde una acción de compra (agregar al carrito, favorito), al **verificar e ingresar** se vuelve a esa acción y se ejecuta.

---

### RF-06 — Inicio de sesión, cierre de sesión y recuperación de contraseña

**Métodos de inicio de sesión soportados:**

| Método | Detalle |
|---|---|
| Email + contraseña | Requiere email verificado para confirmar órdenes (RF-05) |
| **Google** | OAuth. El email que devuelve el proveedor se considera verificado |
| **Facebook** | OAuth. Si el proveedor no devuelve email, se lo pide antes de completar el alta |

**Criterios de aceptación:**
- [ ] Login con email + contraseña, con **Google** y con **Facebook**, disponibles tanto en la pantalla de registro como en la de inicio de sesión.
- [ ] Si alguien se registra con email/contraseña y luego entra con Google o Facebook usando **el mismo email**, se vincula el proveedor a la cuenta existente en lugar de crear una cuenta duplicada.
- [ ] La vinculación automática ocurre **solo si el email de la cuenta original está verificado**. Si no lo está, el ingreso social se rechaza con un mensaje que pide verificar primero el email. Es una protección deliberada: sin ella, alguien podría registrarse con el email de otra persona y quedarse con su cuenta cuando esa persona entre con Google.
- [ ] Tras el primer ingreso por Google o Facebook, si falta el **teléfono** se lo pide para completar el perfil antes de poder confirmar una orden.
- [ ] Una cuenta creada por proveedor social puede definir una contraseña más adelante desde «Mis datos».
- [ ] «Olvidé mi contraseña» envía email con enlace de un solo uso y vencimiento.
- [ ] Mensajes de error genéricos que no revelan si un email existe.
- [ ] **Usuario bloqueado:** al intentar iniciar sesión, se le niega el acceso y se le muestra el mensaje: cuenta bloqueada + **la razón registrada por la administradora** + canal de contacto. (Ver RF-27.)
- [ ] El cierre de sesión no borra el carrito persistido.

---

### RF-07 — Panel del comprador

**Descripción:** Área privada `/mi-cuenta` con las siguientes secciones:

| Sección | Contenido |
|---|---|
| **Mis datos** | Nombre, email, teléfono. Cambio de contraseña. Acceso visible para **pedir la baja de la cuenta** (RF-34). |
| **Mis direcciones** | Libreta de direcciones (RF-09). |
| **Mis compras** | Listado de órdenes con estado, fecha, total y detalle. |
| **Favoritos** | Productos marcados como favoritos. |
| **Mi carrito** | Acceso al carrito actual. |

**Criterios de aceptación:**
- [ ] Rutas protegidas: un no autenticado es redirigido al login y vuelve a la ruta pedida tras loguearse.
- [ ] El detalle de una orden muestra los ítems con el precio al que se generó la orden (snapshot, RN-12), el estado y los datos de envío.
- [ ] Desde una orden `activa`, el comprador puede **cancelarla** (RF-23) y **retomar la conversación por WhatsApp**.

> **El historial y el detalle son dos pantallas, y el detalle no es la confirmación** (F6.5, 2026-09-15). `/mi-cuenta/compras` lista, `/mi-cuenta/compras/[numero]` muestra una. La confirmación de RF-12 (`/orden/[numero]`) se queda donde está y con su tono: es el momento de haber comprado, se lee una vez y felicita. Al detalle se vuelve semanas después para otra cosa —ver en qué anda, releer qué se pidió, arrepentirse—, y las dos acciones que ofrece (WhatsApp y cancelar) sólo aparecen mientras la orden está `activa`.
>
> **Los estados se nombran para quien compró**: `activa` se lee **«En preparación»**, `finalizada` **«Entregada»**. Finalizar es lo que hace la vendedora en el panel; recibirla es lo que le pasa a él. El panel de F7.1 sí los nombra como la máquina de estados.

---

### RF-08 — Carrito persistente

**Descripción:** Carrito asociado a la cuenta del comprador, disponible en cualquier dispositivo.

**El carrito requiere sesión iniciada.** Un visitante no autenticado **no puede armar un carrito**: en su lugar, la acción de compra se presenta como **«Iniciá sesión para comprar»**, que lo lleva al login/registro y, al volver, ejecuta la acción pendiente. Su alternativa sin registrarse es siempre **«Comprar por WhatsApp»** (RF-04).

**Comportamiento:**
- Ítem del carrito = variante (producto + color) + cantidad.
- El carrito **no reserva stock**. La reserva ocurre recién al confirmar la orden.
- Al abrir el carrito se **revalida** contra el catálogo y se informa al comprador de forma explícita y no destructiva:

| Situación detectada | Mensaje y acción |
|---|---|
| El precio cambió | «El precio de *X* pasó de $A a $B». El ítem queda al **precio vigente** (RN-09). |
| El stock disponible es menor a la cantidad pedida | «Quedan N unidades de *X*». Se ajusta la cantidad a N con aviso. |
| La variante quedó sin stock | El ítem se marca «Sin stock», permanece en el carrito, **no suma al total** y no se incluye al confirmar. El comprador puede quitarlo o dejarlo guardado. |
| El producto o la variante se desactivó | El ítem **se aparta** en una sección «Ya no disponible»: sigue a la vista, fuera del total y de lo que se confirma, con la acción «Quitar». **Queda ahí hasta que el comprador lo quite**, así que el aviso no se pierde aunque no lo vea en esa visita (cambio del 2026-09-12: antes se eliminaba solo, con un aviso guardado aparte). |

**Criterios de aceptación:**
- [ ] Agregar, quitar y cambiar cantidad de ítems; vaciar carrito.
- [ ] El resumen muestra subtotal por ítem y total, más la leyenda de la zona de entrega y del retiro (RN-10).
- [ ] Debajo del resumen se muestra el bloque «Completá tu setup» con complementos de lo que hay en el carrito (RF-32).
- [ ] Sin sesión iniciada no existe carrito: las acciones de agregar al carrito invitan a iniciar sesión y, al volver del login, se completan solas.
- [ ] Los ítems cuyo producto o variante fue **desactivado** se apartan en «Ya no disponible», nombrando qué es y por qué, y fuera del total.
- [ ] Un ítem apartado nunca desaparece solo: sigue en el carrito hasta que el comprador lo quite.
- [ ] Un producto o una variante que está en algún carrito **no se borra** desde el panel: se desactiva, igual que el que ya figura en una orden (RN-11). Sin esto, el borrado se lo llevaría del carrito sin aviso.
- [ ] Los avisos de cambio se muestran una vez y no bloquean la navegación.
- [ ] No se puede avanzar al checkout si todos los ítems son inválidos.

---

### RF-09 — Libreta de direcciones

**Descripción:** El comprador administra varias direcciones y marca una como predeterminada.

**Campos:** alias (ej. «Casa»), nombre del receptor, teléfono, calle y número, piso/departamento, referencias y **localidad**.

**La localidad se elige de una lista** (decisión del 2026-09-13): Viedma, Carmen de Patagones, San Javier, El Cóndor u **«Otra localidad cercana»**, porque se entrega en Viedma, Carmen de Patagones y alrededores (RN-10). **La provincia y el código postal no se preguntan: se deducen de la localidad.** «Otra localidad cercana» pide el nombre y la provincia, Río Negro o Buenos Aires, y queda sin código postal: la entrega se coordina igual por WhatsApp.

**Criterios de aceptación:**
- [ ] Crear, editar y eliminar direcciones; marcar una como predeterminada.
- [ ] **Hasta 3 direcciones por comprador**: la predeterminada y dos más, para poder elegir otra en el checkout (decisión del 2026-09-13). Con 3, «Agregar» se muestra deshabilitado y con el motivo; en el checkout, la dirección nueva se puede usar para esa orden sin guardarla.
- [ ] Si hay direcciones, una es la predeterminada: la primera lo es sola, y al eliminar la predeterminada pasa a serlo la más antigua de las que quedan.
- [ ] Eliminar una dirección no cambia las órdenes que la usaron: cada orden guarda su propia copia (RN-12), y la dirección se da de baja con una marca, sin borrarse. Por eso no hace falta impedir que se elimine la única dirección de una orden `activa`, que era lo que este criterio pedía antes del 2026-09-13.
- [ ] En el checkout se puede elegir una dirección existente o cargar una nueva (con opción de guardarla).

---

### RF-10 — Favoritos

**Criterios de aceptación:**
- [ ] Marcar/desmarcar favorito desde la tarjeta del catálogo y desde la ficha.
- [ ] El corazón está **siempre a la vista** en las dos, y no aparece al pasar el mouse: en un teléfono no hay hover, y ahí quedaría inalcanzable.
- [ ] **Contorno** cuando no está marcado, **relleno** cuando sí. El relleno usa el burdeos de la marca (DR §6.1); no entra un color nuevo al sistema por un solo ícono.
- [ ] El estado no se comunica **sólo** con el relleno: el botón lo anuncia también para lectores de pantalla, y su etiqueta dice qué va a pasar al tocarlo.
- [ ] El listado de favoritos muestra precio y disponibilidad actualizados. **No agrega al carrito** (2026-09-14): el favorito es del producto y no del color, así que la tarjeta lleva a la ficha, donde se elige color y cantidad.
- [ ] Un producto desactivado se muestra en favoritos como «No disponible».
- [ ] Para un visitante, la acción invita a iniciar sesión sin perder la navegación.

---

## 7. Módulo: Checkout y órdenes (comprador)

### RF-11 — Checkout

**Descripción:** Confirmación de la compra en un flujo de una sola página con secciones.

**Contenido:**
1. **Tus datos** — nombre, email, teléfono (editable, requerido).
2. **Entrega** — **dos opciones** (2026-09-14): *que me lo envíen* o *lo retiro*. El retiro no muestra dónde: la vendedora pasa el domicilio por WhatsApp al coordinar. Sólo el envío pide **dirección** —la predeterminada preseleccionada, con opción de elegir otra o cargar una nueva—, y la pide **para coordinar el envío**, no para calcularlo. Aviso: *«Entregamos en Viedma, Carmen de Patagones y alrededores. El costo del envío se coordina y abona junto con el pago por WhatsApp.»*
3. **Resumen** — ítems con color, cantidad, precio unitario y subtotal; total de productos.
4. **Medios de pago** — informativos, según configuración del panel.
5. **Confirmación** — botón «Confirmar pedido» + leyenda de que el pago se coordina por WhatsApp.

**Criterios de aceptación:**
- [ ] El total del checkout **no incluye costo de envío** (RN-10).
- [ ] Antes de confirmar se revalida stock y precio; si algo cambió, se avisa y se pide reconfirmar en vez de crear la orden silenciosamente.
- [ ] Un email no verificado impide confirmar, con acción para reenviar la verificación.
- [ ] Faltando teléfono, el botón de confirmación está deshabilitado con la razón visible. **La dirección sólo se exige con «que me lo envíen»**: con el retiro no se pide y no bloquea.
- [ ] La opción elegida queda guardada en la orden: es lo primero que la vendedora necesita saber al abrirla. **Se deduce de la dirección** (2026-09-14): la orden con dirección es un envío y la orden sin dirección es un retiro.

---

### RF-12 — Confirmación de la orden

**Comportamiento al confirmar:**
1. Se crea la orden en estado **`activa`** con snapshot de ítems, precios y dirección (RN-12).
2. Se **reserva stock** de cada variante (RN-07).
3. Se vacía el carrito.
4. Se envía **email de nueva orden a la administradora** (RF-30).
5. Se muestra la **pantalla de confirmación**.

> **Decisión:** el comprador **no recibe email** de confirmación en el MVP. Su comprobante es la pantalla de éxito y la orden en «Mis compras».

**Pantalla de confirmación:**
- Número de orden.
- Detalle de ítems y total.
- Botón destacado **«Coordinar pago por WhatsApp»**, que abre `wa.me` con el número de orden, el nombre del pedido, qué se compró y el total.
- Aviso de que el stock queda reservado hasta finalizar o cancelar la orden.
- Enlaces a «Mis compras» y a Legales.

> **El WhatsApp es un atajo, no el canal** (decisión del 2026-09-15). El aviso
> formal a la vendedora es el email E4 (RF-30): la pantalla **le dice al
> comprador que ya la avisamos**, y ofrece el WhatsApp para **agilizar el
> trámite** sin esperar a que lo lea. De ahí sale qué lleva el mensaje: **quién
> compró, qué compró y el número de orden**, que es la llave con la que la
> vendedora encuentra el pedido en el panel. **No lleva los precios por
> unidad** —el panel los tiene, y dos fuentes para lo mismo terminan
> discrepando— ni enlaces a las fichas, porque los nombres son los del
> snapshot y el producto pudo cambiar desde entonces.

**Criterios de aceptación:**
- [ ] La operación es atómica: si falla la reserva de stock, no se crea la orden y se informa el motivo.
- [ ] Si el envío del email a la administradora falla, la orden **igual se crea** (el email no bloquea la operación) y el fallo queda registrado.
- [ ] Recargar la pantalla de confirmación no duplica la orden.
- [ ] Un doble clic en «Confirmar pedido» no genera dos órdenes.

---

### RF-13 — Estados de la orden

```
              ┌───────────────┐
   crear ────▶│    ACTIVA     │  (reserva stock)
              └───┬───────┬───┘
                  │       │
        finalizar │       │ cancelar (comprador o administradora)
                  ▼       ▼
        ┌──────────────┐ ┌──────────────┐
        │  FINALIZADA  │ │  CANCELADA   │
        │(descuenta    │ │(libera       │
        │ stock real)  │ │ reserva)     │
        └──────────────┘ └──────────────┘
```

| Estado | Significado | Efecto sobre stock | Transiciones permitidas |
|---|---|---|---|
| `activa` | Pedido generado, pago/envío en coordinación | Reserva | → `finalizada`, → `cancelada` |
| `finalizada` | Venta concretada y entregada | Descuenta stock total y libera la reserva | Ninguna (sólo admite devoluciones) |
| `cancelada` | No se concretó | Libera la reserva sin descontar | Ninguna |

**Criterios de aceptación:**
- [ ] Los estados `finalizada` y `cancelada` son terminales; no se puede reabrir una orden.
- [ ] Toda transición registra quién la hizo y cuándo.
- [ ] No existen otros estados en el MVP.

---

## 8. Módulo: Panel de administración

Ruta `/admin`, accesible sólo con rol `admin`. Un `customer` que intente acceder recibe 404/403 sin filtración de información.

### RF-14 — Dashboard del panel

**Criterios de aceptación:**
- [ ] Muestra: órdenes activas pendientes, ventas del mes, productos con stock bajo o en cero, cantidad de productos activos.
- [ ] Cada indicador enlaza al listado filtrado correspondiente.
- [ ] **Dice qué hay pendiente de hacer al entrar** (2026-09-14): bajas de
      cuenta pedidas (RF-34), órdenes por atender, productos con stock bajo.
      No dispara notificaciones: se ve al abrir el panel.

---

### RF-15 — Gestión de productos

**Descripción:** ABM completo de productos.

**Campos del producto:** nombre, slug (autogenerado y editable), descripción **con formato**, marca, categoría, **precio**, **descuento** (monto absoluto en ARS; `0` = sin oferta), destacado (sí/no), activo (`isActive`).

**Criterios de aceptación:**
- [ ] Listado con búsqueda, filtro por categoría/marca/estado, y orden por nombre, precio, stock y fecha.
- [ ] El listado muestra el stock total (suma de variantes) y advierte visualmente el stock en cero.
- [ ] El listado muestra los **tres** números de stock por producto —total, reservado y disponible—, y el que manda es el **disponible**: es el único que responde si el producto se puede vender hoy.
- [ ] El aviso de stock es **uno solo por producto**, porque los estados son excluyentes: «Sin colores» (todavía no hay nada que vender, RF-16), «Stock negativo» (alguna variante quedó bajo cero: es una discrepancia de RF-24, no una compra pendiente), «Sin stock» (nada disponible) o «Quedan N» (por debajo del umbral de RF-20).
- [ ] Además de categoría, marca y estado, el listado filtra **por stock**: «Sin stock» y «Para reponer» —lo que está en el umbral de RF-20 o por debajo, incluido el que ya está en cero—. Es una sola pregunta, «qué hay que comprar», y por eso es una sola opción; es también el destino del enlace «stock bajo o en cero» del dashboard (RF-14).
- [ ] Crear y editar producto con sus variantes en una sola pantalla.
- [ ] «Eliminar» un producto referenciado por alguna orden **o que está en algún carrito** lo **desactiva** en lugar de borrarlo, informándolo (RN-11). Un producto sin órdenes ni carritos puede eliminarse definitivamente, con confirmación explícita.
- [ ] Un producto con `isActive = false` desaparece del sitio público de inmediato, pero sigue visible en el panel y en las órdenes históricas.
- [ ] El precio no admite valores negativos ni cero.
- [ ] El descuento no admite valores negativos y debe ser **menor que el precio**: no puede dejar el precio final en cero o negativo.
- [ ] El formulario muestra en vivo el **precio final** resultante (`precio − descuento`) mientras se cargan los valores.
- [ ] Marcar un producto como **destacado** lo adelanta en la home (RF-01) y en el orden por relevancia sin búsqueda (RF-02). Destacar no publica: un producto destacado con `isActive = false` sigue sin aparecer en ningún lado.

**La descripción se escribe con formato.** La vendedora la edita en un editor visual —ve el resultado, no la sintaxis— con este subconjunto y ningún otro:

| Se puede | No se puede, y por qué |
|---|---|
| Párrafos y saltos de línea | **Imágenes**: las fotos del producto son las de RF-16, con su canalización, sus tamaños y su orden. Una imagen suelta en la descripción se saltea todo eso |
| **Negrita** y *cursiva* | **Enlaces**: nada dentro del MVP los necesita, y son la puerta de entrada de todo lo que hay que sanitizar. Se suman el día que haga falta, no antes |
| Listas con viñetas y numeradas | **Tablas**: no sobreviven a un teléfono, que es donde se lee la ficha |
| Un nivel de subtítulo | **HTML crudo**, tipografías, colores y tamaños: el formato lo pone el sistema de diseño, no quien escribe |

**Criterios de aceptación de la descripción:**
- [ ] El editor es visual: la vendedora no escribe ni ve sintaxis de formato en ningún momento.
- [ ] Pegar texto con formato desde Word, Google Docs o una página web **conserva lo que está en la lista de arriba y descarta el resto**, en silencio y sin romper el resto del texto.
- [ ] Lo que se descarta se descarta en el **servidor** al guardar, no solo en el editor.
- [ ] La descripción admite hasta 5.000 caracteres de texto; el editor muestra cuántos quedan cuando se está cerca del límite.
- [ ] Una descripción vacía es válida: no todo producto necesita una.

---

### RF-16 — Variantes de color: stock e imágenes

**Descripción:** Cada producto tiene una o más variantes; una variante es la unidad con stock e imágenes.

**Criterios de aceptación:**
- [ ] Se pueden agregar, editar y quitar variantes de color; el color se elige del catálogo de colores (RF-18).
- [ ] Cada variante tiene su propio **stock total** editable.
- [ ] Cada variante admite **hasta 5 imágenes**, con orden definible y una marcada como principal.
- [ ] Una variante puede configurarse para **reutilizar las imágenes de otra variante** del mismo producto, en lugar de tener las propias. Se ofrecen las variantes que tienen imágenes de verdad —no las que a su vez están reutilizando— y hay que borrar las propias antes: si no, quedarían guardadas sin verse en ninguna parte.
- [ ] Un producto sin color relevante se carga con una única variante («Único»), y el selector de color no se muestra en la ficha pública.
- [ ] No se puede quitar una variante con stock reservado por órdenes activas; el sistema lo impide e indica qué órdenes la usan.
- [ ] **Sin reservas, quitar una variante que alguna orden nombra o que está en algún carrito la desactiva en vez de borrarla** (RN-11), y se informa cuál de los dos pasó. La orden histórica la sigue mostrando, así que borrarla le rompería el enlace al producto; y en un carrito tiene que quedar apartada, a la vista (RF-08). Una variante que ninguna orden ni ningún carrito nombra se borra de verdad, con sus imágenes.
- [ ] El panel muestra siempre stock total, reservado y disponible por variante.
- [ ] El stock que se escribe **a mano** no admite valores negativos ni decimales. Que la columna acepte un total negativo (RF-24) no es lo mismo: ahí el negativo lo **produce** una venta ya ocurrida, y es una discrepancia a corregir. Escribir «−3» en el formulario no registra ninguna discrepancia, es un error de tipeo.
- [ ] Cambiar el stock desde el panel es un **ajuste** y queda asentado como tal, con quién lo hizo y cuánto cambió, igual que cualquier otra operación de stock.

---

### RF-17 — Carga y optimización de imágenes

**Descripción:** Toda imagen subida pasa por un proceso de conversión y reducción antes de publicarse.

**Reglas:**

| Regla | Valor |
|---|---|
| Formatos aceptados en la subida | JPG, PNG, WEBP |
| Tamaño máximo por archivo (entrada) | 10 MB |
| Máximo de imágenes por variante | 5 |
| Formato de salida | WEBP |
| Variantes generadas | Miniatura, tarjeta de catálogo y detalle (tamaños definidos en `TECHNICAL-SPEC.md`) |
| Objetivo de peso | Reducción sustancial respecto del original, priorizando calidad visual del producto |

**Criterios de aceptación:**
- [ ] Subida por selección o arrastre, con vista previa y progreso.
- [ ] Un archivo mayor a 10 MB o de formato no aceptado se rechaza con mensaje claro **antes** de subirse.
- [ ] El resultado publicado siempre es WEBP; el original no se sirve al público.
- [ ] Reordenar imágenes por arrastre y elegir la principal.
- [ ] Eliminar una imagen la quita del almacenamiento.
- [ ] Si la optimización falla, la imagen no se publica a medias y se informa el error.

---

### RF-18 — Gestión de categorías, marcas y colores

**Criterios de aceptación:**
- [ ] ABM de **categorías** (nombre, slug, activa, **destacada**, **categorías relacionadas** — ver RF-31) — enlazadas a productos.
- [ ] ABM de **marcas** (nombre, slug, logo opcional, activa).
- [ ] El **logo de marca** se sube desde el mismo diálogo donde se carga el nombre, con las reglas de RF-17: JPG, PNG o WEBP, hasta 10 MB, y sale WEBP. Se muestra en el listado del panel, al lado del nombre.
- [ ] Es **opcional y reversible**: una marca puede no tener logo, se le puede poner uno después y se le puede quitar. Quitarlo borra los archivos, no solo la referencia.
- [ ] **Reemplazar un logo borra el anterior.** Un logo que ya nadie muestra pero sigue ocupando lugar es basura que no se ve en ninguna pantalla.
- [ ] Borrar la marca se lleva su logo. Vale también para desactivarla, con la diferencia de que ahí el logo **se conserva**: desactivar es reversible, borrar no.
- [ ] ABM de **colores** (nombre y valor hexadecimal para mostrar la muestra de color).
- [ ] Cada listado muestra cuántos productos usan el ítem, distinguiendo los activos de los inactivos.
- [ ] No se puede eliminar un ítem en uso: se ofrece desactivarlo (RN-11).
- [ ] **No se puede desactivar un ítem que tenga productos activos** (RN-11b). El aviso dice cuántos son y qué hacer: desactivarlos primero.
- [ ] Nombres únicos, sin distinción de mayúsculas.
- [ ] Una categoría se puede marcar como **destacada**: pasa al frente en los accesos rápidos de la home (RF-01), en la fila de categorías del encabezado (`DESIGN-REFERENCE.md` §5.1) y en el filtro por categoría del listado (RF-02). Entre destacadas se ordenan por nombre.
- [ ] **Destacar no publica.** Una categoría destacada e inactiva no aparece en ningún lado: `isActive` sigue siendo la única verdad sobre la visibilidad, y destacar sólo decide el orden entre las que ya se ven.
- [ ] No hay tope de destacadas —es una decisión de la vendedora—, pero el diálogo dice qué hace destacar y advierte que destacarlas todas equivale a no destacar ninguna.
- [ ] La **dirección** (el `slug`) se deriva del nombre al crear el ítem y **no cambia al renombrarlo**: es la URL pública, y cambiarla rompería en silencio todo enlace ya compartido. No es un campo del formulario —«slug» es jerga (`DESIGN-REFERENCE.md` §10)—; se muestra para leer.

> **Por qué desactivar exige que no quede nada activo usándolo.** La
> alternativa era que desactivar una marca escondiera sus productos del sitio
> público. Es cómodo pero traicionero: un clic esconde una cantidad de
> productos que nadie contó, y cada consulta pública tendría que acordarse de
> mirar el estado de la marca además del del producto —una condición que el
> día que se olvida no falla, sino que muestra de más—. Con RN-11b el estado
> del producto es la única verdad sobre su visibilidad, y las consultas de
> `TECHNICAL-SPEC.md` §10.1 y §11.2 pueden seguir filtrando solo por
> `p.is_active`. El costo es un paso más para la vendedora cuando deja de
> trabajar con una marca: desactivar sus productos y después la marca.

---

### RF-19 — Gestión de medios de pago

**Descripción:** ABM de los medios de pago informativos que ve el comprador.

**Campos:** nombre, logo/ícono, descripción corta (ej. «10% off transfiriendo»), orden de aparición, activo.

**Criterios de aceptación:**
- [ ] Se muestran en catálogo, ficha de producto y checkout, respetando el orden configurado.
- [ ] Ningún medio de pago desencadena un cobro: son puramente informativos (RN-01).
- [ ] El orden se cambia moviendo cada uno **un lugar arriba o abajo**, contra la lista a la vista. No se escribe un número de posición: eso obligaría a renumerar a mano para meter uno en el medio.
- [ ] Uno nuevo se agrega **al final**. Elegir dónde va es la acción de mover, no un campo del alta.
- [ ] Se puede **desactivar**: deja de mostrarse en la tienda y conserva su logo y su descripción. Es lo que corresponde cuando se deja de aceptar un medio por un tiempo.
- [ ] **Borrar siempre se puede**, con confirmación, y se lleva el logo. A diferencia del catálogo (RN-11), ninguna orden nombra un medio de pago: no hay historial que se rompa. La confirmación ofrece desactivar en su lugar.

---

### RF-20 — Configuración del sitio

**Criterios de aceptación:**
- [ ] Número de WhatsApp de contacto/ventas. Se escribe **como salga** —con o sin +54, con o sin 9, con espacios o guiones— y se guarda **normalizado a `+549…`**: es la misma regla que el teléfono del comprador (RF-05) y la misma implementación, para que el enlace `wa.me` se arme concatenando y no haya que adivinar en cada pantalla qué forma tenía el que se cargó.
- [ ] Email de la administradora para avisos de órdenes. **Puede ser distinto del email con el que entra al panel**: atarlo a la identidad la obligaría a cambiar de cuenta para cambiar de casilla.
- [ ] Datos de contacto y textos legales editables (RF-29). **No son de esta pantalla**: viven en `legal_pages`, con su propio editor de Markdown.
- [ ] Umbral de «stock bajo» usado en el dashboard y en el listado de productos. Es un entero **del 1 al 100**: con 0 el aviso no se encendería nunca —y «Sin stock» ya cubre ese caso, así que sería apagar una función en vez de configurarla—, y por encima de 100 marcaría casi todo el catálogo, que es dejar de señalar nada.
- [ ] Mientras **nada esté guardado** la pantalla lo dice, y dice también con qué está funcionando el sistema mientras tanto: sin número de WhatsApp para la tienda y con el aviso de stock bajo en 3. Los campos ya muestran ese 3, porque ofrecer otro número haría que guardar sin tocar nada cambiara el listado sin que nadie lo pidiera.

---

### RF-21 — Listado y detalle de órdenes

**Criterios de aceptación:**
- [ ] Solapas/filtros por estado: **activas**, **finalizadas**, **canceladas** (y «todas»). La solapa por omisión es **activas**: el listado se abre en lo que hay que preparar, no en el archivo histórico.
- [ ] Filtros por rango de fechas, comprador y origen (web / manual). **El rango recorta por la fecha del estado que muestra la solapa** (2026-09-17): en «Finalizadas» por la de entrega, en «Canceladas» por la de cancelación, y en «Activas» y «Todas» por la de carga, que es la única que tienen en común. La pantalla dice cuál está usando.

> **El «filtro por comprador» es la búsqueda, y no un desplegable** (F7.1). Una lista con todos los compradores registrados crece sin techo, deja afuera las órdenes manuales —que no tienen cuenta (RF-24)— y obliga a saber el nombre exacto antes de empezar. El mismo campo que busca por número busca por nombre y por email, que es lo que se tiene a mano cuando alguien escribe preguntando por su pedido. Cuando exista la ficha del usuario (RF-26), «ver sus órdenes» va a enlazar a este listado con su nombre puesto.

> **El rango de fechas se lee en la zona horaria del negocio**, no en la del servidor. Una orden de las 22:00 de un lunes en Argentina es de la 01:00 del martes en UTC: sin zona explícita, la fecha de la columna y el corte del filtro dicen días distintos.

- [ ] Búsqueda por número de orden, nombre o email del comprador. **El número se compara exacto** —«104» no trae la #1043—: quien escribe un número está yendo a una orden, no explorando. Los textos van por subcadena y sin tildes.
- [ ] El listado muestra: número, fecha, comprador, cantidad de ítems, total, estado y origen. **«Cantidad de ítems» son unidades**, no renglones: es lo que contesta la pregunta que se hace mirando el listado —cuántas cosas van en la caja—, y el desglose por renglón está en el detalle.
- [ ] El listado **se pagina**. No estaba pedido y hace falta igual: a diferencia de los productos, las órdenes se acumulan solas y sin techo.
- [ ] El detalle muestra ítems (producto, color, cantidad, precio unitario y subtotal), datos del comprador, dirección de envío, total, historial de cambios de estado y acceso directo al WhatsApp del comprador.
- [ ] El historial **distingue quién hizo cada transición**, y en particular si canceló el comprador (RF-23) o la administradora. Se resuelve comparando el autor con el dueño de la orden y **no con su rol de hoy**: una compradora que después sea administradora no puede volver retroactivamente «de la vendedora» algo que hizo ella.
- [ ] Los datos del comprador muestran **el snapshot del pedido y la cuenta por separado** cuando las dos existen. No son lo mismo (RN-12, RF-11): quien compró para un tercero puso los datos del tercero, y verlas juntas es lo que evita escribirle a la persona equivocada.

---

### RF-22 — Edición de una orden activa

**Descripción:** La administradora ajusta una orden `activa` contra lo que se terminó acordando: **quita** lo que no puede entregar y **suma** lo que el comprador pidió después.

> **Nació sólo restando, y eso era un hueco** (2026-09-16). El requisito se escribió pensando en una sola situación —«me quedé sin uno de los tres, se lo aviso y le mando dos»— y por eso hablaba únicamente de quitar y reducir. Pero la coordinación por WhatsApp (RN-01) va en los dos sentidos: «¿me mandás otro igual?» y «ya que estás, sumame el cable» son tan frecuentes como la falta de stock, y hoy la única salida sería cancelar la orden y rehacerla, o cargar una segunda orden manual (RF-24) por el agregado — que parte una venta en dos y le arruina el historial al comprador. **Sumar entra al requisito**, y lo implementa **F7.2a**.

**Criterios de aceptación — quitar y reducir** (F7.2):
- [ ] Se pueden **quitar ítems** de una orden `activa`; el stock reservado de esos ítems se libera de inmediato.
- [ ] Se puede **reducir la cantidad** de un ítem, ajustando la reserva.
- [ ] El total se recalcula automáticamente y el cambio queda registrado en el historial de la orden.
- [ ] Quitar el último ítem de una orden equivale a cancelarla (se pide confirmación explícita).
- [ ] Sólo se pueden editar órdenes `activas`.
- [ ] Antes de confirmar, la pantalla dice **qué pasa con el stock**: cuántas unidades se liberan y en cuánto queda el disponible de esa variante. Es el número con el que se decide si conviene.
- [ ] **Quitar y bajar la cantidad son dos acciones separadas**, cada una con su confirmación. Bajar deja el producto en la orden; quitar lo saca, y si era el único, además cancela. Un solo control que llegue hasta cero mezcla las dos y convierte un cero distraído en una cancelación.
- [ ] **Ninguna se puede deshacer, y las dos lo avisan.** Volver a agregar no está en este requisito —habría que reservar de nuevo y puede no haber stock— y de `cancelada` no se sale (RF-13).

**Criterios de aceptación — sumar** (F7.2a):
- [ ] Se puede **aumentar la cantidad** de un ítem que ya está en la orden; la diferencia se reserva.
- [ ] Se puede **agregar un producto que no estaba**, buscándolo por nombre, con su color y su cantidad; se reserva al agregarlo.
- [ ] **Si no hay stock disponible, no se agrega**, y se dice cuánto hay. Es la diferencia de fondo con quitar: quitar siempre se puede y sumar puede no poderse.
- [ ] Agregar un producto **que ya está en la orden suma sobre su renglón**, no crea un segundo renglón igual. Es lo mismo que hace el carrito (RF-08).
- [ ] Las unidades que se suman a un renglón existente van **al precio de ese renglón**, no al del catálogo de hoy: ese es el precio que se acordó para esa línea, y es el que el comprador ya vio.
- [ ] Un producto nuevo entra **al precio vigente del catálogo**, con su descuento aplicado (RN-04b), y queda congelado como cualquier otro renglón (RN-12).
- [ ] El total se recalcula y el cambio queda en el historial con su autor, igual que al quitar.
- [ ] Sólo se puede sumar a órdenes `activas`.
- [ ] Antes de confirmar, la pantalla dice **qué pasa con el stock**, como en RF-22: cuántas unidades se reservan y en cuánto queda el disponible.

> **El precio no se edita desde acá.** Cambiar el precio de un renglón de una orden web es cambiar lo que el comprador aceptó, y para eso está el canal por el que se acordó. Precio editable existe en las **órdenes manuales** (RF-24), que son ventas ya cerradas fuera de la web. Si hace falta otro precio para las unidades nuevas, se quita el renglón y se carga como corresponda.

> **Sumar no bloquea por falta de stock «con aviso», como sí hace RF-24.** La orden manual registra una venta **que ya ocurrió**, y por eso puede dejar el stock en negativo y limitarse a advertir. Acá la venta todavía no pasó: reservar de más rompería el invariante `reserved_stock <= stock_total` (`TECHNICAL-SPEC.md` §8.1), que es lo único que evita vender dos veces la misma unidad en la tienda. Si va a entrar mercadería, primero se carga el stock (RF-16) y después se suma.

> **El sistema no le avisa al comprador.** No hay emails de cambios de estado (FA-07) ni de confirmación de orden (FA-06): el aviso lo da la vendedora por el mismo WhatsApp donde se acordó. Lo que sí pasa solo es que **«Mis compras» (RF-07) muestra la orden ya cambiada**, con su total nuevo, y el historial deja registrado quién la tocó. La pantalla que suma se lo recuerda.

---

> **La edición se registra en el historial de estados, como `activa → activa`** (F4.4). Es el único historial que tiene la orden, y ensanchar su uso es preferible a partir la línea de tiempo en dos tablas que la pantalla después tiene que volver a unir. **Pero no se muestra así**: el panel lee esas filas y dice lo que pasó —«Se quitó "Auricular Cloud II (Rojo)"»—, porque «Activa → Activa» es la implementación asomándose (F7.2).

---

### RF-23 — Finalizar y cancelar órdenes

**Criterios de aceptación:**
- [ ] **Finalizar** (sólo administradora): descuenta el stock real de cada ítem y libera la reserva. Pide confirmación mostrando el impacto en stock.
- [ ] **Cancelar** (administradora **o** comprador desde su panel): libera la reserva sin descontar stock. La administradora puede registrar un motivo.
- [ ] Ambas acciones registran autor, fecha y motivo en el historial.
- [ ] **La cancelación por el comprador es el arrepentimiento** (RF-34, «El arrepentimiento no es esto»). Tiene que estar **a la vista** en el detalle de la orden y no detrás de un menú: es el mecanismo con el que el sitio cumple ese derecho, y su visibilidad es parte del requisito.

> **A la vista quiere decir en el detalle, no en cada renglón del listado** (F6.5). Un botón destructivo al lado de cada compra de una lista es el que se toca sin querer; en el detalle está solo y con el pedido enfrente. **Y sin campo de motivo**: el motivo se lo pide RF-23 a la administradora, que cancela la orden de otro. A quien se arrepiente no se le pide explicación — un campo obligatorio ahí es fricción puesta justo donde el requisito quiere que no haya ninguna. Igual queda registrado **quién** canceló, que es lo que en el panel distingue un arrepentimiento de una cancelación de la vendedora.
- [ ] **El comprador ve quién canceló su pedido, y el motivo si la administradora lo escribió.** Su detalle de compra dice «Cancelamos este pedido» cuando la canceló la tienda y «Cancelaste este pedido» cuando se arrepintió él, y en el primer caso muestra el motivo debajo.
- [ ] Una orden ya finalizada o cancelada no admite nuevas transiciones (RF-13).

> **Lo del comprador se agregó el 2026-09-16, al implementar F7.3.** Hasta
> entonces el único que podía cancelar era él, así que la pantalla podía decir
> «Cancelaste este pedido» sin equivocarse nunca; con la vendedora cancelando,
> ese mismo texto le avisaría a alguien que canceló él lo que le cancelaron.
> **El motivo se le muestra** porque a quien le cancelan un pedido «por qué» es
> la única pregunta que le queda, y tenerla contestada le ahorra escribir. Eso
> convierte el campo del panel en algo que se publica, y el diálogo lo dice:
> un campo que se cree interno y no lo sea es peor que no tenerlo.

---

### RF-24 — Órdenes manuales (ventas fuera de la web)

**Descripción:** La administradora carga ventas hechas por WhatsApp o presencialmente para mantener el stock alineado.

**Criterios de aceptación:**
- [ ] Se pueden agregar productos y variantes buscándolos por nombre, con cantidad y precio unitario **editable** (para contemplar precios acordados).
- [ ] Los datos del comprador son de texto libre (nombre y teléfono/email), sin necesidad de que exista una cuenta; opcionalmente se puede asociar a un comprador registrado.
- [ ] La orden queda marcada con origen **manual** para distinguirla en los reportes (RF-28).
- [ ] Se anota si fue **envío o retiro**, como en el checkout (RF-11). **Con envío, la dirección es obligatoria**, y el formulario lo dice: una orden sin dirección se lee como retiro (2026-09-14).
- [ ] Se puede crear directamente como `activa` (reserva stock) o como `finalizada` (descuenta stock de una).
- [ ] El sistema advierte —sin bloquear— si la cantidad supera el stock disponible, para permitir registrar ventas ya ocurridas. **Eso vale para la orden que nace `finalizada`**, que es la venta ya hecha: el stock baja y puede quedar en negativo (TS §5.4), y esa es la señal de discrepancia que el panel destaca. **Una orden que nace `activa` sí necesita stock libre**: reservar de más rompería el invariante que impide vender dos veces la misma unidad, y no registraría una venta ocurrida sino que prometería una entrega imposible. Cuando no alcanza, se dice y se ofrecen las dos salidas: cargarla como finalizada si ya se entregó, o ajustar el stock antes (RF-16).

> **El matiz de la última línea se escribió el 2026-09-16, al implementar F7.4.** El requisito decía «advierte sin bloquear» sin distinguir entre los dos estados iniciales que él mismo permite, y para uno de los dos no se puede cumplir: el `CHECK reserved_within_total` de TS §5.4 —el mismo que deja pasar el stock negativo— impide comprometer unidades que no existen. Lo que se conserva es la intención del requisito, que es no obligar a la vendedora a mentirle al sistema sobre una venta que ya ocurrió.

---

### RF-25 — Devoluciones

**Descripción:** La administradora registra devoluciones contra una orden finalizada.

**Criterios de aceptación:**
- [ ] La devolución se crea seleccionando una orden `finalizada` y uno o más de sus ítems, con la cantidad a devolver (nunca mayor a la vendida ni a lo ya devuelto).
- [ ] Por cada ítem se define si **repone stock** (producto en condiciones) o **no repone** (producto defectuoso/descartado), con un motivo.
- [ ] Al confirmarse, los ítems marcados como reponibles suman al stock total de su variante; los no reponibles no modifican stock.
- [ ] Listado de devoluciones con filtros por fecha y por reposición, mostrando orden asociada, ítems, cantidades y motivo.
- [ ] Las devoluciones se descuentan de las ventas netas en los reportes (RF-28).
- [ ] Una devolución registrada no se edita: se anula (con motivo) y se vuelve a cargar, revirtiendo el efecto en stock.

---

### RF-26 — Gestión de usuarios

**Criterios de aceptación:**
- [ ] Listado de usuarios con búsqueda por nombre/email y filtro por estado (activo/bloqueado) y rol.
- [ ] **Crear** usuario (nombre, email, rol) enviándole un email para definir su contraseña.
- [ ] **Modificar** datos y rol de un usuario.
- [ ] **Resetear contraseña**: dispara el email de recuperación al usuario.
- [ ] Ver las órdenes de un usuario desde su ficha.
- [ ] La administradora no puede quitarse a sí misma el rol admin ni bloquear su propia cuenta.
- [ ] **Bajas de cuenta pendientes** (RF-34): se ven los pedidos con su motivo, se ejecutan y se revierten. El filtro por estado distingue activo, bloqueado y dado de baja.
- [ ] **No hay «eliminar usuario», y es a propósito** (§5.6): un comprador con órdenes no se borra ni se puede borrar. Lo que existe es bloquear (RF-27) y dar de baja (RF-34).

---

### RF-27 — Bloqueo de usuarios

**Criterios de aceptación:**
- [ ] Bloquear requiere ingresar una **razón obligatoria**, que queda registrada con fecha y autor.
- [ ] Un usuario bloqueado **no puede iniciar sesión**; al intentarlo ve un mensaje con la razón del bloqueo y el canal de contacto (RF-06).
- [ ] Las sesiones activas del usuario bloqueado se invalidan.
- [ ] Se puede desbloquear, quedando también registrado.
- [ ] El bloqueo no elimina ni altera sus órdenes; las órdenes `activas` siguen su curso normal.

---

### RF-28 — Reportes de ventas

**Descripción:** Reportes basados en órdenes **finalizadas**, netos de devoluciones, con selector de rango de fechas.

**Contenido:**

| Reporte | Detalle |
|---|---|
| **Totales del período** | Facturación total, cantidad de órdenes, unidades vendidas, ticket promedio. Comparación con el período anterior equivalente. |
| **Productos más vendidos** | Ranking por unidades e ingresos, con desglose por color/variante. |
| **Ventas por categoría** | Facturación y unidades agrupadas por categoría. |
| **Ventas por marca** | Facturación y unidades agrupadas por marca. |
| **Web vs. manual** | Comparativa de facturación y cantidad de órdenes según origen (web / carga manual). |

**Criterios de aceptación:**
- [ ] El rango de fechas tiene atajos: hoy, últimos 7 días, este mes, mes anterior, personalizado.
- [ ] Las órdenes `activas` y `canceladas` **no** se computan como ventas.
- [ ] Las devoluciones restan del período en que se registraron.
- [ ] Cada reporte puede **exportarse a Excel** (`.xlsx`), respetando los filtros aplicados.
- [ ] Las compras de visitantes (WhatsApp sin orden) no figuran, salvo que se hayan cargado como orden manual.

---

## 9. Módulo: Contenido y legales

### RF-29 — Sección de legales

**Criterios de aceptación:**
- [ ] Páginas accesibles desde el pie de página: **Garantías y devoluciones**, **Términos y condiciones**, **Política de privacidad**, **Cómo comprar**.
- [ ] «Garantías y devoluciones» explica plazos, condiciones, qué cubre la garantía y el procedimiento (coordinación por WhatsApp).
- [ ] Explica también **cómo arrepentirse de una compra**: cancelar la orden desde «Mis compras» si todavía está activa (RF-23), o pedir la devolución si ya se finalizó (RF-25). Es donde el sitio deja por escrito cómo se ejerce ese derecho.
- [ ] El aviso de **zona de entrega y retiro** está presente en: pie de página, ficha de producto, carrito y checkout (RN-10). Ninguno de los cuatro nombra a la empresa de mensajería.
- [ ] El texto legal es editable desde el panel sin necesidad de un deploy.

---

### RF-34 — Baja de cuenta, pedida por el comprador y ejecutada por la administradora

> **El número es el siguiente libre, no la posición.** Los IDs se referencian
> desde `TECHNICAL-SPEC.md`, `DEVELOPMENT-PLAN.md` y `PROGRESO.md`: renumerar
> para que quedaran en orden rompería todas esas referencias. RF-34 vive acá,
> entre los legales, porque es de donde viene.

**Origen:** requisito legal, incorporado el 2026-09-06 por decisión de negocio.
La normativa argentina de comercio electrónico exige que el consumidor tenga a
la vista un mecanismo para desvincularse, accionable por él mismo y sin
trámite. Reemplaza a la idea previa de una «baja lógica» genérica.

**Quién hace qué, y por qué está partido en dos.** El comprador **pide** la
baja; la administradora **la ejecuta**. El comprador no puede darse de baja
solo. La razón es que una baja toca historial de ventas —órdenes, devoluciones,
reportes— y hay estados en los que no puede ocurrir: quien decide si están
dados es una persona, no un formulario.

**Criterios de aceptación:**

- [ ] El comprador autenticado ve un acceso **visible** para pedir la baja de
      su cuenta, y puede accionarlo sin intermediarios ni pedirlo por otro
      canal. Está en «Mis datos», y el pie de la tienda enlaza ahí desde todas
      las páginas (2026-09-14).
- [ ] Antes de confirmar, la pantalla **advierte qué implica**: qué deja de
      poder hacer, qué se conserva —sus órdenes y su historial, que no se
      borran (§5.6)— y que volver es posible pidiéndolo.
- [ ] El comprador **escribe el motivo**, y es obligatorio. Queda registrado
      con fecha, igual que el motivo de bloqueo de RF-27.
- [ ] **La baja no procede si el comprador tiene órdenes `activas`.** Se le
      dice cuántas son, cuáles, y qué puede hacer: cancelarlas él mismo desde
      «Mis compras» (RF-23) o esperar a que se finalicen. No se le ofrece un
      botón que va a fallar.
- [ ] Pedirla **la deja pendiente en el panel** (RF-14), con quién la pide y
      el motivo. **Sin email** (decisión del 2026-09-14): el E5 de RF-30 se
      descartó; la administradora se entera al entrar al panel.
- [ ] **Mientras está pedida, la cuenta es de solo lectura** (2026-09-14): el
      comprador puede mirar la tienda, pero no comprar, ni usar favoritos, ni
      cambiar sus datos, su contraseña o sus direcciones. La tienda lo dice
      arriba, en todas las páginas.
- [ ] Mientras la administradora no la ejecutó, el comprador **puede retirar
      el pedido** él mismo, desde «Mis datos», y la cuenta vuelve a como
      estaba (2026-09-14).
- [ ] La administradora ve las bajas pendientes en el panel y **las ejecuta**
      (RF-26). Al ejecutarla queda registrado quién y cuándo. **Solo ejecuta lo
      pedido** (2026-09-17): no puede dar de baja a quien no la pidió, porque
      para sacar a alguien por decisión suya está el bloqueo de RF-27, que
      además exige motivo y se lo muestra. Si las dos cosas salieran del mismo
      botón, «se fue sola» dejaría de querer decir eso (RN-13).
- [ ] **La baja es lógica: no se borra nada.** Un usuario dado de baja no puede
      iniciar sesión y, al intentarlo, ve un mensaje **distinto del bloqueo de
      RF-27** — se fue por su cuenta, no lo echaron. Sus sesiones activas se
      cierran.
- [ ] La administradora puede **revertirla**, y ahí la persona vuelve con su
      historial, sus direcciones y sus favoritos intactos.
- [ ] El listado de usuarios de RF-26 distingue los tres estados: activo,
      bloqueado y dado de baja. **Y filtra además por «con baja pedida»**
      (2026-09-17), que no es un estado de la cuenta —está activa, en solo
      lectura— sino trabajo por hacer: es a donde lleva el aviso de pendientes
      del inicio del panel (RF-14).

> **RN-13.** Un usuario dado de baja no es un usuario bloqueado. Comparten el
> efecto —no puede entrar, no se borra nada, se revierte— y no comparten el
> significado ni el mensaje. Reusar `is_banned` para las dos cosas le diría
> «tu cuenta está bloqueada» a alguien que se fue solo.

#### El arrepentimiento no es esto, y ya está cubierto

Se planteó la duda al escribir RF-34 —si el botón de arrepentimiento era un
requisito **aparte**— y **quedó resuelta el 2026-09-06**: no lo es, porque acá
las dos cosas no se pueden mezclar aunque en otro sitio se parezcan.

**Arrepentirse sólo tiene sentido con sesión, y por eso ya está hecho.**
**RN-08** dice que el Visitante no genera órdenes ni reserva stock: su compra
sale exclusivamente como mensaje de WhatsApp y se va del flujo del sitio. No
hay compra registrada que revocar para alguien sin cuenta — no existe la orden.
Para quien sí tiene sesión, **cancelar su orden `activa` desde «Mis compras»
(RF-23, RF-07) es el arrepentimiento**: libera la reserva, no descuenta stock y
la persona la ejecuta sola, sin pedirle permiso a nadie.

**Lo único que hay que cuidar es que se pueda señalar.** El derecho está
cubierto por el mecanismo, pero eso no se ve solo: la página **Garantías y
devoluciones** (RF-29) tiene que decir con todas las letras cómo se ejerce
—cancelar desde «Mis compras», y devolver si la orden ya se finalizó
(RF-25)— y la acción de cancelar tiene que estar a la vista en el detalle de la
orden, no escondida. Si no, dentro de un año nadie puede señalar dónde el sitio
cumple.

**Y no se mezcla con RF-34.** Que la baja de cuenta no proceda con órdenes
activas no le quita nada a esto: quien quiera revocar una compra cancela la
orden, que es otra acción y está disponible siempre.

---

## 10. Módulo: Emails transaccionales

### RF-30 — Emails del MVP

| # | Email | Destinatario | Disparador |
|---|---|---|---|
| E1 | Verificación de email | Comprador | Registro / reenvío manual |
| E2 | Recuperación de contraseña | Comprador o admin | Solicitud de reset, o reset disparado por la administradora (RF-26) |
| E3 | Definición de contraseña de cuenta nueva | Usuario creado por la administradora | Alta manual de usuario (RF-26) |
| E4 | **Nueva orden recibida** | Administradora | Confirmación de una orden en la web (RF-12) |
| ~~E5~~ | ~~Pedido de baja de cuenta~~ | — | **Descartado el 2026-09-14**: la baja pedida se ve como pendiente en el panel (RF-14, RF-34), sin email |

**Criterios de aceptación:**
- [ ] Todos los emails usan una plantilla común con la identidad visual de AnaVende.
- [ ] E4 incluye número de orden, comprador, teléfono, ítems con color y cantidad, total y enlace directo al detalle en el panel.

> **El enlace al detalle esperó a F7.1**, y llegó el mismo 2026-09-15. Mientras ese detalle no existía el botón llevaba al **inicio del panel**: una dirección inventada por adelantado habría dado 404 en todos los avisos de esa ventana. Hoy lleva a `/admin/ordenes/<numero>` —por número, que es la dirección del panel y la misma que dice el asunto—. **El email no depende de ese enlace para servir**: lleva el pedido entero —quién, qué, cuánto y cómo se entrega— justamente para que se pueda decidir si hay que hacer algo sin abrir nada. El enlace es para lo que el email no puede hacer, que es cambiar el estado del pedido.
- [ ] Los enlaces con token (E1, E2, E3) son de un solo uso y expiran.
- [ ] Un fallo de envío nunca revierte la operación de negocio asociada; queda registrado para diagnóstico.
- [ ] **No** se envía email de confirmación de orden al comprador (decisión de alcance del MVP).
- [ ] **No** se envía email por cambios de estado de orden ni por bloqueo de cuenta (el bloqueo se comunica en el login — RF-27).

---

## 11. Módulo: Recomendaciones

Los recomendados persiguen dos intenciones distintas y por eso son **dos bloques separados**, nunca mezclados:

| Bloque | Intención | Pregunta que responde |
|---|---|---|
| **«También te puede interesar»** | Cross-sell / complementos | *¿Qué otra cosa necesito junto con esto?* |
| **«Productos similares»** | Alternativas | *¿Hay algo parecido que me convenga más?* |

### RF-31 — Categorías relacionadas

**Descripción:** Extensión del ABM de categorías (RF-18) que define qué categorías se complementan entre sí, para alimentar los recomendados sin curar producto por producto.

**Comportamiento:**
- Al crear o editar una categoría se pueden seleccionar **una o varias categorías relacionadas** (ej.: *Teclados* → *Mouses*, *Auriculares*, *Pads*).
- La relación es **bidireccional por defecto**: cargar `Teclados → Pads` crea implícitamente `Pads → Teclados`, sin necesidad de repetir la carga.
- Cada relación tiene una opción **«Recíproca»** activada por defecto que puede destildarse, dejando la relación dirigida en un solo sentido (ej.: *Notebooks* → *Fundas* sí, pero *Fundas* → *Notebooks* no).
- Las categorías relacionadas admiten un **orden**, que define la prioridad al armar las recomendaciones.

**Criterios de aceptación:**
- [ ] El selector de categorías relacionadas es un multiselect que excluye la propia categoría y las inactivas.
- [ ] Al guardar una relación recíproca, la categoría del otro extremo la refleja automáticamente en su propia ficha.
- [ ] Al quitar una relación recíproca, se quita en ambos sentidos; al quitar una dirigida, sólo en el suyo.
- [ ] Destildar «Recíproca» en una relación existente elimina el sentido inverso, informándolo antes.
- [ ] Desactivar o eliminar una categoría no rompe las fichas de las demás: la relación deja de producir recomendaciones sin generar errores.
- [ ] La pantalla muestra, por cada relación, cuántos productos activos aporta, para detectar relaciones vacías.

---

### RF-32 — Bloques de productos recomendados

**Descripción:** Cálculo y despliegue de los dos bloques de recomendados.

**Estrategia en cascada.** Cada bloque recorre sus fuentes en orden hasta completar el cupo, de modo que **ningún bloque quede vacío**:

```
«También te puede interesar»          «Productos similares»
────────────────────────────          ──────────────────────
1. Productos de las categorías        1. Misma categoría, precio
   relacionadas (RF-31)                  final dentro de ±30%
2. Productos destacados con stock     2. Misma categoría (cualquier precio)
                                      3. Misma marca
```

**Reglas comunes de selección:**

| Regla | Detalle |
|---|---|
| Producto actual | Siempre excluido |
| Estado | Sólo productos con `isActive = true` (RN-05) |
| Stock | Los productos con stock disponible se priorizan; los agotados sólo se usan si no alcanza el cupo |
| Duplicados | Un producto no aparece dos veces, ni dentro de un bloque ni entre los dos bloques de la misma pantalla |
| Cupo | Entre 4 y 8 productos por bloque |
| Orden | Determinístico y estable: destacados primero, luego con stock, luego más recientes. No aleatorio |
| Bloque vacío | Si aun con la cascada no hay candidatos, el bloque **no se renderiza** (no se muestra un contenedor vacío) |

**Ubicaciones:**

| Pantalla | Bloque | Base del cálculo |
|---|---|---|
| **Ficha de producto** (RF-03) | «También te puede interesar» + «Productos similares» | El producto que se está viendo |
| **Carrito** (RF-08) | **«Completá tu setup»** | Las categorías de los productos que ya están en el carrito. Excluye lo que ya está en el carrito |

**Criterios de aceptación:**
- [ ] En la ficha, los dos bloques aparecen debajo de la descripción, claramente rotulados y visualmente diferenciados.
- [ ] Las tarjetas de recomendados usan el mismo componente que el catálogo (imagen, marca, nombre, precio final y precio tachado si hay descuento).
- [ ] En el carrito, «Completá tu setup» nunca sugiere un producto que ya está en el carrito.
- [ ] Con el carrito vacío, «Completá tu setup» no se muestra.
- [ ] Los recomendados no incluyen productos inactivos bajo ninguna circunstancia.
- [ ] Los bloques no degradan el tiempo de carga de la ficha ni del carrito.

---

### RF-33 — Vistos recientemente

**Descripción:** Historial de navegación propio del visitante, sin necesidad de cuenta.

**Comportamiento:**
- Se registran los últimos **10** productos visitados, guardados en el navegador del propio usuario.
- Se muestran en la **home** y en la **ficha de producto**, con el rótulo «Vistos recientemente».

**Criterios de aceptación:**
- [ ] Funciona para visitantes y compradores por igual, sin requerir sesión.
- [ ] El producto que se está viendo se excluye del bloque en la ficha.
- [ ] Los productos que quedaron inactivos se descartan del historial al mostrarlo.
- [ ] Con menos de 2 productos en el historial, el bloque no se muestra.
- [ ] Los precios y la disponibilidad que se muestran son los vigentes, no los del momento de la visita.
- [ ] El historial se puede borrar desde el propio bloque.

---

## 12. Requisitos no funcionales (nivel funcional)

| ID | Requisito |
|---|---|
| **RNF-01** | **Responsive**: la experiencia del comprador es plenamente usable en móvil (prioridad de diseño), tablet y escritorio. El panel de administración es usable en tablet y escritorio; en móvil se garantizan como mínimo las operaciones sobre órdenes. |
| **RNF-02** | **Accesibilidad**: contraste suficiente, navegación por teclado, foco visible, textos alternativos en imágenes de producto, formularios con etiquetas asociadas. |
| **RNF-03** | **Rendimiento percibido**: el catálogo con filtros responde de forma inmediata a la interacción; las imágenes se sirven optimizadas y con carga diferida. Objetivos numéricos en `TECHNICAL-SPEC.md`. |
| **RNF-04** | **SEO**: URLs limpias y descriptivas, títulos y descripciones por producto, datos estructurados de producto, sitemap. |
| **RNF-05** | **Consistencia de stock**: las operaciones que afectan stock son atómicas; dos confirmaciones simultáneas nunca pueden reservar más unidades de las disponibles. |
| **RNF-06** | **Trazabilidad**: toda operación sensible (cambio de estado de orden, edición de orden, bloqueo de usuario, devolución, ajuste de stock) registra autor, fecha y motivo cuando aplica. |
| **RNF-07** | **Seguridad**: contraseñas con hash, sesiones seguras, protección de rutas por rol, validación en servidor de toda entrada. |
| **RNF-08** | **Mensajes de error accionables**: ningún error se muestra como texto técnico; siempre indica qué pasó y qué hacer. |

---

## 13. Fuera de alcance del MVP

| # | Excluido | Nota |
|---|---|---|
| FA-01 | Pagos online (MercadoPago, tarjetas, etc.) | Se coordina por WhatsApp (RN-01) |
| FA-02 | Cálculo, cotización o integración con la API de una empresa de mensajería | Sólo aviso informativo |
| FA-03 | Seguimiento de envíos y estados logísticos | — |
| FA-04 | Cuentas de invitado con orden o carrito persistido | El visitante no arma carrito; sólo usa WhatsApp (RN-08, RF-08) |
| FA-05 | Expiración automática de reservas de stock | Liberación sólo manual (RN-07) |
| FA-06 | Email de confirmación de orden al comprador | Decisión explícita (RF-12) |
| FA-07 | Notificaciones por email de cambios de estado y de bloqueo | — |
| FA-08 | Reseñas, valoraciones y preguntas de productos | — |
| FA-09 | Cupones, promociones por volumen o combos | Sólo descuento por producto |
| FA-10 | Login social más allá de Google y Facebook (Apple, GitHub, etc.) | Google y Facebook **sí** entran en el MVP (RF-06) |
| FA-11 | Multi-idioma y multi-moneda | Sólo es-AR / ARS |
| FA-12 | Rol operador y permisos granulares | Sólo `admin` y `customer` |
| FA-13 | Importación/exportación masiva de catálogo | La exportación existe sólo en reportes (RF-28) |
| FA-14 | Aplicación móvil nativa | — |
| FA-15 | Devoluciones iniciadas por el comprador | Las registra la administradora (RF-25) |
| FA-16 | Múltiples atributos de variante (talle, capacidad, etc.) | Sólo color (RN-04) |
| FA-17 | Recomendaciones por co-compra / co-visitación («quienes compraron esto también compraron») | Requiere volumen de órdenes que el MVP no tiene (*cold start*). Candidato natural para la fase 2, reutilizando los bloques de RF-32 |
| FA-18 | Relacionados curados manualmente producto a producto | Se resuelve por afinidad de categorías (RF-31). Es la capa a sumar antes que la co-compra si hace falta más precisión |
| FA-19 | Recomendaciones personalizadas por perfil o historial de compras | Más allá de «Vistos recientemente» (RF-33) |
| FA-21 | **Imagen de categoría**, chica, como referencia visual en un listado de categorías | Hoy la categoría es sólo texto en las tres superficies donde aparece —chips del encabezado, accesos de la portada, filtro del listado—. Una imagen chica al lado del nombre ayuda a reconocerla de un vistazo; **no** es una portada ni una cabecera, y por eso no necesita el tamaño `detail` de §9.2: con `thumb` y `card` alcanza. Es **una** imagen por categoría, así que va en una columna de `categories` y no en una tabla aparte — `variant_images` existe porque un producto tiene hasta cinco y hay que ordenarlas. **La marca no lleva otra imagen**: su logo (RF-18) ya cubre lo que necesita. La condición para que esto se vea bien: el listado tiene que quedar prolijo **con categorías sin imagen mezcladas**, porque va a haberlas — el día que se agregue nadie va a cargar las diez de una sentada |
| FA-20 | **Etiquetas de producto** (*tags*) y filtro por etiqueta | Un producto pertenece a **una** categoría y `categories` no tiene jerarquía, así que hoy la única forma de subdividir una categoría grande —«Cables» en HDMI, VGA, USB-C, energía— es el nombre del producto, ayudado por la búsqueda tolerante de RF-02. Alcanza mientras la categoría entre en una página (24 productos). Cuando deje de entrar, la respuesta son etiquetas —muchas por producto, transversales a la categoría— y no partir la categoría en hermanas: seis «Cables …» al mismo nivel que «Teclados» arruinan la fila de categorías del encabezado, que es la navegación principal |

---

## 14. Supuestos

| # | Supuesto | Impacto si es incorrecto |
|---|---|---|
| S-01 | El límite de 5 imágenes es **por variante de color**, no por producto. | Cambia el modelo de datos y la UI de carga |
| S-02 | Existe una sola vendedora/administradora operando el panel, con posibilidad de sumar otras cuentas admin. | — |
| S-03 | El descuento es un **monto absoluto en ARS** que se resta al precio; `0` significa sin oferta. Confirmado por el negocio. | — |
| S-04 | El número de WhatsApp de ventas es único para todo el sitio. | — |
| S-05 | El volumen del MVP es bajo (cientos de productos, decenas de órdenes por mes), lo que permite paginación y reportes sin infraestructura analítica. | Reportes y listados necesitarían optimización |
| S-06 | La verificación de email es requisito para confirmar órdenes, pero no para navegar ni armar el carrito. | — |

---

## 15. Trazabilidad con `PROVISIONAL.md`

| Requisito original (PROVISIONAL) | Cubierto por |
|---|---|
| Web similar a shop.app con sistema de diseño | `DESIGN-REFERENCE.md`, RF-01 |
| Catálogo con buscador, paginación y filtros | RF-02 |
| Mostrar medios de pago definidos por el vendedor | RF-02, RF-03, RF-19 |
| Página de detalle del producto | RF-03 |
| Dos formas de comprar (logueado / WhatsApp) | RF-04, RF-11, RF-12 |
| Carrito persistente que actualiza precios e informa cambios | RF-08 |
| Panel del comprador (datos, compras, favoritos, carrito) | RF-07, RF-09, RF-10 |
| Checkout con elección de dirección + pantalla final + email | RF-11, RF-12, RF-30 (email → administradora) |
| Aviso de zona de entrega y retiro | RN-10, RF-29 |
| Sección de legales (garantías y devoluciones) | RF-29 |
| Sin pago online, se maneja por WhatsApp | RN-01 |
| Panel protegido de gestión | RF-14 a RF-28 |
| ABM de productos con imágenes | RF-15, RF-16, RF-17 |
| Máx. 5 imágenes, hasta 10 MB, conversión a WEBP | RF-17 |
| Crear/modificar/resetear/bloquear usuarios con razón y aviso | RF-26, RF-27 |
| Órdenes activas / finalizadas / canceladas | RF-13, RF-21 |
| Completar orden parcialmente, quitar productos | RF-22 |
| Órdenes activas reducen stock temporalmente | RN-07, RF-12, RF-23 |
| Órdenes manuales por ventas fuera de la web | RF-24 |
| Stock e imágenes por color, con reutilización de imágenes | RF-16 |
| Devoluciones con o sin reposición de stock | RF-25 |
| Reporte de ventas sin usuarios no registrados | RF-28 |
| El vendedor mantiene el stock de ventas externas | RF-24, RF-25 |

**Alcance agregado que no figuraba en `PROVISIONAL.md`:**

| Agregado | Cubierto por | Motivo |
|---|---|---|
| Recomendaciones por categorías relacionadas y similares | RF-31, RF-32 | Pedido posterior. Sube el ticket promedio a bajo costo de implementación |
| Vistos recientemente | RF-33 | Complemento barato de las recomendaciones |
| Login con Google y Facebook | RF-06 | Reducir fricción de registro |
| Configuración del sitio (WhatsApp, emails, textos) | RF-20 | Evitar valores fijos en el código |
| Exportación de reportes a Excel | RF-28 | Control offline del negocio |

---

## 16. Historial de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-08-30 | El visitante no genera orden ni reserva stock; sólo WhatsApp | Simplicidad del MVP y fidelidad al PROVISIONAL |
| 2026-08-30 | Auto-registro con verificación de email | Evitar cuentas basura sin frenar la conversión |
| 2026-08-30 | Precio en producto, stock e imágenes en variante de color | Refleja la operación real y simplifica la carga |
| 2026-08-30 | Las reservas de stock no expiran automáticamente | La coordinación por WhatsApp puede demorar; la vendedora decide |
| 2026-08-30 | Sin costo de envío en la web | La mensajería se coordina y abona aparte |
| 2026-08-30 | Email de orden sólo a la administradora | Reduce alcance; el comprador tiene pantalla e historial |
| 2026-08-30 | ARS con decimales, IVA incluido sin discriminar | Definición comercial |
| 2026-08-30 | Dos roles: `admin` y `customer` | Un solo operador en el MVP |
| 2026-08-30 | Reportes exportables a Excel | Pedido explícito para control offline |
| 2026-09-08 | RN-10 pasa de nombrar a **PedidosYa** a nombrar la **zona**: Viedma, Carmen de Patagones y alrededores | La empresa de mensajería puede cambiar; lo que decide si alguien puede comprar acá es hasta dónde llegamos, no quién lleva el paquete |
| 2026-09-08 | Se agrega el **retiro en el punto de entrega** como segunda forma de recibir | Es lo que ya se hace |
| 2026-09-08 | El checkout (RF-11) elige entre **envío, retiro y coordinar**, y sólo el envío pide dirección | Pedido tuyo. La dirección deja de ser un paso obligatorio del checkout y pasa a ser un dato del envío: quien retira o quien prefiere hablarlo no tiene por qué cargar una calle para poder confirmar |
| 2026-09-14 | El checkout (RF-11) queda en **envío o retiro**: «coordinar con la vendedora» se va | Pedido tuyo. Eran la misma cosa: el retiro ya se coordina con la vendedora, que pasa el domicilio por WhatsApp |
| 2026-09-14 | La forma de entrega **se deduce de la dirección** de la orden: con dirección es envío, sin ella es retiro. Todo envío lleva dirección, también en las órdenes manuales (RF-24) | Pedido tuyo. Una columna aparte guardaría el mismo dato dos veces, y habría que cuidar que no se contradigan |
| 2026-09-08 | **El catálogo no muestra medios de pago**: se saca ese criterio de RF-02 | Pedido tuyo. Una tira de logos sobre una grilla de productos no responde ninguna pregunta que alguien tenga mientras mira el catálogo, y RF-19 ya tiene dónde mostrarse |
| 2026-09-08 | La ficha **no dibuja los logos de medios de pago**: los nombra | Una tira de logos en la pantalla de venta se lee como «pagá acá», y acá no se paga (RN-01, RN-08). Los logos siguen en el pie y en la home |
| 2026-09-08 | La ficha declara que los productos son **nuevos y en su caja original** | No se venden reacondicionados. Es texto fijo y no un dato por producto: el día que eso cambie, cambia el modelo y no una frase |
| 2026-09-02 | La vinculación de cuentas exige que el email original esté verificado | Protección contra apropiación previa de cuenta |
| 2026-08-30 | El descuento es un monto absoluto en ARS, no un porcentaje | Así se piensa la oferta en el negocio |
| 2026-08-30 | Teléfono obligatorio en el registro | Es el canal real de coordinación de la venta |
| 2026-08-30 | Login con Google y Facebook además de email/contraseña | Reducir fricción de registro |
| 2026-08-30 | El visitante no puede armar carrito | El carrito es una función de cuenta; el visitante compra por WhatsApp |
| 2026-08-30 | Los ítems desactivados se eliminan del carrito, con aviso previo | Evitar carritos con ítems fantasma |
| 2026-08-30 | Recomendados por afinidad de categorías + similares automáticos, en cascada | Barato de configurar, no depende de volumen de datos y nunca deja un bloque vacío |
| 2026-08-30 | Las relaciones entre categorías son recíprocas por defecto | Evita cargar cada relación dos veces y que queden a medias |
| 2026-08-30 | Co-compra queda fuera del MVP | Sin volumen de órdenes daría resultados vacíos o ruidosos |
