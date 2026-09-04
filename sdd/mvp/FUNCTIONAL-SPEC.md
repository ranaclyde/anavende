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
| **RN-05** | Un producto es visible en el sitio público únicamente si `isActive = true`. Un producto activo se muestra **siempre**, aunque no tenga stock disponible. |
| **RN-06** | Una variante sin stock disponible se muestra, señalizada como «Sin stock» y no seleccionable para compra. |
| **RN-07** | Una orden en estado `activa` **reserva stock**. La reserva se libera únicamente cuando la orden pasa a `finalizada` (descuenta stock real) o `cancelada` (libera sin descontar). **No existe expiración automática.** |
| **RN-08** | El Visitante no genera órdenes ni reserva stock. Su compra sale exclusivamente como mensaje de WhatsApp. |
| **RN-09** | El carrito refleja siempre el **precio vigente** del producto. Los cambios de precio, stock o disponibilidad respecto de la última vista se comunican explícitamente al comprador. |
| **RN-10** | Los envíos se realizan por **PedidosYa**; su costo no se calcula ni se cobra en la web y se coordina por WhatsApp. |
| **RN-11** | Nunca se elimina físicamente un producto, marca, categoría o color que esté referenciado por una orden. Se desactiva (borrado lógico). |
| **RN-11b** | **Ningún producto activo puede pertenecer a una marca o categoría inactiva, ni tener variantes activas de un color inactivo.** No se puede desactivar una marca, categoría o color que esté en uso por algo activo: primero se desactiva lo que la usa. Tampoco se puede activar un producto cuya marca o categoría esté inactiva. |
| **RN-12** | Las órdenes conservan una copia del nombre y precio del producto al momento de crearse (snapshot), para que cambios posteriores del catálogo no alteren el historial. |

---

## 5. Módulo: Catálogo público

### RF-01 — Home

**Descripción:** Página de entrada con la propuesta visual de descubrimiento (ver `DESIGN-REFERENCE.md`).

**Contenido:**
- Buscador destacado.
- Accesos rápidos a categorías (chips/píldoras), con las **destacadas primero** (RF-18).
- Sección de productos destacados y/o novedades.
- Sección de productos en oferta (con descuento activo).
- Bloque «Vistos recientemente», si el visitante tiene historial (RF-33).
- Franja informativa de medios de pago.
- Aviso de envíos por PedidosYa.

**Criterios de aceptación:**
- [ ] La home carga sin productos cargados (estado vacío controlado, sin errores).
- [ ] Todos los bloques enlazan a listados filtrados del catálogo.
- [ ] Sólo se muestran productos con `isActive = true`.
- [ ] Los accesos rápidos muestran primero las categorías **destacadas** y, entre iguales, por nombre. Sólo se muestran categorías activas.

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
- [ ] Cada tarjeta muestra: imagen principal, marca, nombre, precio final y —si el descuento es mayor que cero— el precio original tachado y el ahorro en pesos.
- [ ] La franja de medios de pago configurados por la administradora es visible en el listado.

---

### RF-03 — Ficha de producto

**Descripción:** Página de detalle `/productos/[slug]`.

**Contenido:**
- Galería de imágenes de la variante seleccionada (hasta 5), con miniaturas y vista ampliada.
- Nombre, marca, categoría.
- Precio final; si el descuento es mayor que cero: precio original tachado y ahorro en pesos (ej. «Ahorrás $ 3.000,00»).
- Selector de color (variantes). Cada opción indica si está sin stock.
- Indicador de disponibilidad de la variante seleccionada.
- Selector de cantidad, limitado por el stock disponible de la variante.
- Descripción del producto, **con el formato que le dio la vendedora** (RF-15).
- Bloques de recomendados: «También te puede interesar», «Productos similares» y «Vistos recientemente» (RF-32, RF-33).
- Medios de pago aceptados.
- Aviso de envío por PedidosYa y enlace a Legales (garantías y devoluciones).

**Acciones:**

| Acción | Visitante | Comprador |
|---|---|---|
| Agregar al carrito | Botón «Iniciá sesión para comprar» → login y vuelve a la acción | Sí |
| Comprar ahora | Abre WhatsApp con el detalle del producto | Va al checkout con ese único ítem |
| Consultar por WhatsApp | Sí | Sí |
| Agregar a favoritos | Invita a iniciar sesión | Sí |

**Criterios de aceptación:**
- [ ] Al cambiar de color, cambian imágenes, stock y disponibilidad sin recargar la página, y la URL refleja la variante.
- [ ] Si una variante no tiene imágenes propias, se muestran las imágenes designadas como respaldo (ver RF-16).
- [ ] Si la variante no tiene stock disponible, las acciones de compra quedan deshabilitadas y se ofrece «Consultar por WhatsApp».
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
| **Mis datos** | Nombre, email, teléfono. Cambio de contraseña. |
| **Mis direcciones** | Libreta de direcciones (RF-09). |
| **Mis compras** | Listado de órdenes con estado, fecha, total y detalle. |
| **Favoritos** | Productos marcados como favoritos. |
| **Mi carrito** | Acceso al carrito actual. |

**Criterios de aceptación:**
- [ ] Rutas protegidas: un no autenticado es redirigido al login y vuelve a la ruta pedida tras loguearse.
- [ ] El detalle de una orden muestra los ítems con el precio al que se generó la orden (snapshot, RN-12), el estado y los datos de envío.
- [ ] Desde una orden `activa`, el comprador puede **cancelarla** (RF-23) y **retomar la conversación por WhatsApp**.

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
| La variante quedó sin stock | El ítem se marca «Sin stock», permanece en el carrito y no se incluye al confirmar. El comprador puede quitarlo o dejarlo guardado. |
| El producto o la variante se desactivó | El ítem se **elimina automáticamente** del carrito, informándolo antes: «Quitamos *X* de tu carrito porque ya no está disponible». |

**Criterios de aceptación:**
- [ ] Agregar, quitar y cambiar cantidad de ítems; vaciar carrito.
- [ ] El resumen muestra subtotal por ítem y total, más la leyenda de envío por PedidosYa (RN-10).
- [ ] Debajo del resumen se muestra el bloque «Completá tu setup» con complementos de lo que hay en el carrito (RF-32).
- [ ] Sin sesión iniciada no existe carrito: las acciones de agregar al carrito invitan a iniciar sesión y, al volver del login, se completan solas.
- [ ] Los ítems cuyo producto o variante fue **desactivado** se eliminan del carrito, siempre precedidos por un aviso visible que nombra qué se quitó y por qué.
- [ ] La eliminación por desactivación nunca es silenciosa: si el comprador no llega a ver el aviso en pantalla, éste persiste hasta que lo cierre.
- [ ] Los avisos de cambio se muestran una vez y no bloquean la navegación.
- [ ] No se puede avanzar al checkout si todos los ítems son inválidos.

---

### RF-09 — Libreta de direcciones

**Descripción:** El comprador administra varias direcciones y marca una como predeterminada.

**Campos:** alias (ej. «Casa»), nombre del receptor, teléfono, calle y número, piso/departamento, referencias, ciudad/localidad, provincia, código postal.

**Criterios de aceptación:**
- [ ] Crear, editar y eliminar direcciones; marcar una como predeterminada.
- [ ] No se puede eliminar la única dirección si hay una orden `activa` que la usa (se conserva copia en la orden — RN-12).
- [ ] En el checkout se puede elegir una dirección existente o cargar una nueva (con opción de guardarla).

---

### RF-10 — Favoritos

**Criterios de aceptación:**
- [ ] Marcar/desmarcar favorito desde la tarjeta del catálogo y desde la ficha.
- [ ] El listado de favoritos muestra precio y disponibilidad actualizados, y permite agregar al carrito.
- [ ] Un producto desactivado se muestra en favoritos como «No disponible».
- [ ] Para un visitante, la acción invita a iniciar sesión sin perder la navegación.

---

## 7. Módulo: Checkout y órdenes (comprador)

### RF-11 — Checkout

**Descripción:** Confirmación de la compra en un flujo de una sola página con secciones.

**Contenido:**
1. **Tus datos** — nombre, email, teléfono (editable, requerido).
2. **Envío** — dirección predeterminada preseleccionada, con opción de elegir otra o cargar una nueva. Aviso: *«El envío se realiza por PedidosYa. El costo se coordina y abona junto con el pago por WhatsApp.»*
3. **Resumen** — ítems con color, cantidad, precio unitario y subtotal; total de productos.
4. **Medios de pago** — informativos, según configuración del panel.
5. **Confirmación** — botón «Confirmar pedido» + leyenda de que el pago se coordina por WhatsApp.

**Criterios de aceptación:**
- [ ] El total del checkout **no incluye costo de envío** (RN-10).
- [ ] Antes de confirmar se revalida stock y precio; si algo cambió, se avisa y se pide reconfirmar en vez de crear la orden silenciosamente.
- [ ] Un email no verificado impide confirmar, con acción para reenviar la verificación.
- [ ] Faltando teléfono o dirección, el botón de confirmación está deshabilitado con la razón visible.

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
- Botón destacado **«Coordinar pago por WhatsApp»**, que abre `wa.me` con el número de orden y el detalle.
- Aviso de que el stock queda reservado hasta finalizar o cancelar la orden.
- Enlaces a «Mis compras» y a Legales.

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
- [ ] «Eliminar» un producto referenciado por alguna orden lo **desactiva** en lugar de borrarlo, informándolo (RN-11). Un producto sin órdenes puede eliminarse definitivamente, con confirmación explícita.
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
- [ ] **Sin reservas, quitar una variante que alguna orden nombra la desactiva en vez de borrarla** (RN-11), y se informa cuál de los dos pasó. La orden histórica la sigue mostrando, así que borrarla le rompería el enlace al producto. Una variante que ninguna orden nombra se borra de verdad, con sus imágenes.
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

---

### RF-20 — Configuración del sitio

**Criterios de aceptación:**
- [ ] Número de WhatsApp de contacto/ventas.
- [ ] Email de la administradora para avisos de órdenes.
- [ ] Datos de contacto y textos legales editables (RF-29).
- [ ] Umbral de «stock bajo» usado en el dashboard y en el listado de productos.

---

### RF-21 — Listado y detalle de órdenes

**Criterios de aceptación:**
- [ ] Solapas/filtros por estado: **activas**, **finalizadas**, **canceladas** (y «todas»).
- [ ] Filtros por rango de fechas, comprador y origen (web / manual).
- [ ] Búsqueda por número de orden, nombre o email del comprador.
- [ ] El listado muestra: número, fecha, comprador, cantidad de ítems, total, estado y origen.
- [ ] El detalle muestra ítems (producto, color, cantidad, precio unitario y subtotal), datos del comprador, dirección de envío, total, historial de cambios de estado y acceso directo al WhatsApp del comprador.

---

### RF-22 — Edición de una orden activa

**Descripción:** La administradora puede completar una orden parcialmente, quitando lo que no se pueda entregar.

**Criterios de aceptación:**
- [ ] Se pueden **quitar ítems** de una orden `activa`; el stock reservado de esos ítems se libera de inmediato.
- [ ] Se puede **reducir la cantidad** de un ítem, ajustando la reserva.
- [ ] El total se recalcula automáticamente y el cambio queda registrado en el historial de la orden.
- [ ] Quitar el último ítem de una orden equivale a cancelarla (se pide confirmación explícita).
- [ ] Sólo se pueden editar órdenes `activas`.

---

### RF-23 — Finalizar y cancelar órdenes

**Criterios de aceptación:**
- [ ] **Finalizar** (sólo administradora): descuenta el stock real de cada ítem y libera la reserva. Pide confirmación mostrando el impacto en stock.
- [ ] **Cancelar** (administradora **o** comprador desde su panel): libera la reserva sin descontar stock. La administradora puede registrar un motivo.
- [ ] Ambas acciones registran autor, fecha y motivo en el historial.
- [ ] Una orden ya finalizada o cancelada no admite nuevas transiciones (RF-13).

---

### RF-24 — Órdenes manuales (ventas fuera de la web)

**Descripción:** La administradora carga ventas hechas por WhatsApp o presencialmente para mantener el stock alineado.

**Criterios de aceptación:**
- [ ] Se pueden agregar productos y variantes buscándolos por nombre, con cantidad y precio unitario **editable** (para contemplar precios acordados).
- [ ] Los datos del comprador son de texto libre (nombre y teléfono/email), sin necesidad de que exista una cuenta; opcionalmente se puede asociar a un comprador registrado.
- [ ] La orden queda marcada con origen **manual** para distinguirla en los reportes (RF-28).
- [ ] Se puede crear directamente como `activa` (reserva stock) o como `finalizada` (descuenta stock de una).
- [ ] El sistema advierte —sin bloquear— si la cantidad supera el stock disponible, para permitir registrar ventas ya ocurridas.

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
- [ ] El aviso de envíos por **PedidosYa** está presente en: pie de página, ficha de producto, carrito y checkout (RN-10).
- [ ] El texto legal es editable desde el panel sin necesidad de un deploy.

---

## 10. Módulo: Emails transaccionales

### RF-30 — Emails del MVP

| # | Email | Destinatario | Disparador |
|---|---|---|---|
| E1 | Verificación de email | Comprador | Registro / reenvío manual |
| E2 | Recuperación de contraseña | Comprador o admin | Solicitud de reset, o reset disparado por la administradora (RF-26) |
| E3 | Definición de contraseña de cuenta nueva | Usuario creado por la administradora | Alta manual de usuario (RF-26) |
| E4 | **Nueva orden recibida** | Administradora | Confirmación de una orden en la web (RF-12) |

**Criterios de aceptación:**
- [ ] Todos los emails usan una plantilla común con la identidad visual de AnaVende.
- [ ] E4 incluye número de orden, comprador, teléfono, ítems con color y cantidad, total y enlace directo al detalle en el panel.
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
| FA-02 | Cálculo, cotización o integración con la API de PedidosYa | Sólo aviso informativo |
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
| Aviso de envíos por PedidosYa | RN-10, RF-29 |
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
| 2026-08-30 | Sin costo de envío en la web | PedidosYa se coordina y abona aparte |
| 2026-08-30 | Email de orden sólo a la administradora | Reduce alcance; el comprador tiene pantalla e historial |
| 2026-08-30 | ARS con decimales, IVA incluido sin discriminar | Definición comercial |
| 2026-08-30 | Dos roles: `admin` y `customer` | Un solo operador en el MVP |
| 2026-08-30 | Reportes exportables a Excel | Pedido explícito para control offline |
| 2026-09-02 | La vinculación de cuentas exige que el email original esté verificado | Protección contra apropiación previa de cuenta |
| 2026-08-30 | El descuento es un monto absoluto en ARS, no un porcentaje | Así se piensa la oferta en el negocio |
| 2026-08-30 | Teléfono obligatorio en el registro | Es el canal real de coordinación de la venta |
| 2026-08-30 | Login con Google y Facebook además de email/contraseña | Reducir fricción de registro |
| 2026-08-30 | El visitante no puede armar carrito | El carrito es una función de cuenta; el visitante compra por WhatsApp |
| 2026-08-30 | Los ítems desactivados se eliminan del carrito, con aviso previo | Evitar carritos con ítems fantasma |
| 2026-08-30 | Recomendados por afinidad de categorías + similares automáticos, en cascada | Barato de configurar, no depende de volumen de datos y nunca deja un bloque vacío |
| 2026-08-30 | Las relaciones entre categorías son recíprocas por defecto | Evita cargar cada relación dos veces y que queden a medias |
| 2026-08-30 | Co-compra queda fuera del MVP | Sin volumen de órdenes daría resultados vacíos o ruidosos |
