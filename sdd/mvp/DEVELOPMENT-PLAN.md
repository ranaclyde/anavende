# AnaVende — Plan de Desarrollo (MVP)

| Campo | Valor |
|---|---|
| Producto | AnaVende — e-commerce de reventa de productos informáticos |
| Versión | 1.0 (MVP) |
| Fecha | 2026-08-31 |
| Equipo | Una persona, con asistencia de IA |
| Fecha objetivo | Sin fecha comprometida: sale cuando está listo |
| Lanzamiento | Único, con el MVP completo |
| Documentos base | `FUNCTIONAL-SPEC.md`, `TECHNICAL-SPEC.md`, `DESIGN-REFERENCE.md` |

---

## 1. Cómo usar este plan

### 1.1 Qué es y qué no es

Este documento define **en qué orden se construye** AnaVende y **cómo se sabe que cada parte está terminada**. No repite requisitos ni decisiones técnicas: los referencia.

Cada tarea lleva:

| Campo | Significado |
|---|---|
| **ID** | `F3.2` = fase 3, tarea 2. Estable: se usa para referirse a ella en commits y notas |
| **Tamaño** | **S** (una sesión de trabajo) · **M** (dos o tres) · **L** (una semana o más) |
| **Referencias** | Las secciones de las especificaciones que hay que leer **antes** de empezar |
| **Hecho cuando** | La condición verificable de terminación. Si no se puede comprobar, la tarea no está terminada |

### 1.2 Trabajar con asistencia de IA

El plan está escrito para que cada tarea pueda entregarse a un asistente con el contexto suficiente. Cuatro reglas que evitan los problemas típicos:

1. **Las especificaciones mandan, no el asistente.** Ante una duda de negocio, la respuesta está en `FUNCTIONAL-SPEC.md`. Si no está, es una decisión que hay que tomar y **anotar** en el documento, no improvisar en el código.
2. **Pasar las referencias, no solo la tarea.** «Implementá el carrito» produce un carrito genérico. «Implementá RF-08 según §5.5 y §8.4» produce el carrito de AnaVende.
3. **La lógica de stock se verifica con tests, no leyéndola.** Es la parte donde un error se ve tarde y caro. Los tests de F4 no son opcionales ni posteriores: son parte de la tarea.
4. **Una tarea a la vez, terminada.** Terminar significa que su «Hecho cuando» se cumple, no que el código compila.
5. **Todo lo visual pasa por las skills de diseño.** Al programar cualquier apartado visual del frontend se usan `impeccable` y `ui-ux-pro-max` (`DESIGN-REFERENCE.md` §12.4). Las skills mejoran el acabado **dentro** del marco de la referencia: si una propuesta contradice un token o una decisión registrada, manda el documento.
6. **La documentación de las bibliotecas se consulta, no se recuerda.** Antes de escribir código contra Next.js, Tailwind, Drizzle, Zod, Supabase, Resend o cualquier otra dependencia, se usa la skill `context7` **fijada a la versión registrada en `TECHNICAL-SPEC.md` §2.1** (ver F0.9), no a «la última». Se consulta **antes de escribir**, no cuando algo falla: Tailwind 4 y Zod 4 cambiaron su API respecto de la versión anterior, y es la anterior la que un asistente escribe por omisión.

### 1.3 Criterio de terminado, para toda tarea

Ninguna tarea está terminada si no cumple **todo** esto:

- [ ] Funciona en móvil, tablet y escritorio (RNF-01)
- [ ] Sus cinco estados están definidos: normal, cargando, vacío, error, deshabilitado (`DESIGN-REFERENCE.md` §8)
- [ ] Es navegable por teclado y el foco es visible (RNF-02)
- [ ] Los textos están en castellano rioplatense y siguen la voz definida (`DESIGN-REFERENCE.md` §10)
- [ ] Toda entrada se valida en el **servidor**, no solo en el cliente
- [ ] Los errores dicen qué pasó y qué hacer, sin códigos ni jerga (RNF-08)
- [ ] No quedan valores fijos en el código que deberían ser configuración
- [ ] Si la tarea toca el frontend: se pasó por `impeccable` y `ui-ux-pro-max` antes de darla por cerrada (`DESIGN-REFERENCE.md` §12.4)
- [ ] El código escrito contra una biblioteca externa se verificó con `context7` en la versión fijada en F0.9, no de memoria

---

## 2. Principios de secuenciación

El orden no es arbitrario. Responde a cuatro criterios, en este orden de prioridad:

| # | Criterio | Cómo se aplica |
|---|---|---|
| **1** | **Lo incierto primero** | Las verificaciones de infraestructura (F0) van antes que todo. Descubrir en la semana ocho que `pg_trgm` no se puede instalar es carísimo; descubrirlo el primer día no cuesta nada |
| **2** | **Lo riesgoso temprano** | El núcleo de stock (F4) se construye y se prueba **antes** de que haya interfaz que lo use. Es la parte donde un error se paga más caro (R1) |
| **3** | **Datos antes que vistas** | El panel de catálogo (F2) precede a la tienda (F3): sin productos reales cargados, el catálogo se construye contra datos inventados y se descubren los problemas tarde |
| **4** | **Lo que desbloquea, primero** | Autenticación antes que panel; panel antes que tienda; stock antes que compra |

**Consecuencia contraintuitiva:** la tienda pública —lo que se ve, lo que entusiasma— llega recién en la fase 3. Es deliberado. Construirla primero obliga a rehacerla cuando aparecen los datos reales.

---

## 3. Mapa de fases

```
F0  Verificación y aprovisionamiento
     │
F1  Cimientos ──────────────────────────────┐
     │                                      │
F2  Panel: catálogo                         │  (F4 puede
     │                                      │   adelantarse:
F3  Tienda: descubrimiento                  │   no depende
     │                                      │   de F2 ni F3)
F4  Núcleo de stock y órdenes ◀─────────────┘
     │
F5  Cuenta del comprador
     │
F6  Compra
     │
F7  Panel: operación
     │
F8  Descubrimiento avanzado
     │
F9  Reportes y contenido
     │
F10 Endurecimiento y lanzamiento
     │
     ▼  Producción
```

| Fase | Objetivo | Tamaño |
|---|---|---|
| **F0** | Confirmar que el stack elegido funciona en la infraestructura elegida | M |
| **F1** | Un proyecto que arranca, con base de datos, sesión y sistema de diseño | L |
| **F2** | La vendedora puede cargar su catálogo completo con imágenes | L |
| **F3** | Un catálogo público navegable, buscable y filtrable | L |
| **F4** | Stock y órdenes correctos y probados, sin interfaz | L |
| **F5** | El comprador tiene cuenta, carrito, favoritos y direcciones | L |
| **F6** | Se puede comprar de punta a punta | M |
| **F7** | La vendedora opera órdenes, devoluciones y usuarios | L |
| **F8** | Recomendados y vistos recientemente | M |
| **F9** | Reportes, legales y emails | M |
| **F10** | Listo para recibir gente de verdad | L |

---

## F0 — Verificación y aprovisionamiento

**Objetivo:** confirmar que cada supuesto de `TECHNICAL-SPEC.md` §23 se sostiene, **antes** de construir encima.

**Por qué va primero:** todas estas verificaciones invalidan trabajo si fallan tarde. Ninguna toma más de unas horas.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F0.1** | Aprovisionar los dos servidores en DonWeb y unirlos por LAN virtual | M | TS §2.2, §2.4 | Ambos servidores se ven por IP privada. El servidor APP tiene al menos 30 GB de disco (V8) |
| **F0.2** | Instalar Coolify en el servidor APP y **activar la limpieza automática de Docker** | S | TS §2.4, R11 | Coolify responde por HTTPS y la limpieza está programada, no solo disponible |
| **F0.3** | Instalar Supabase en el servidor DATA | M | TS §2.2 | Studio accesible; Postgres responde por la IP privada |
| **F0.4** | **Cerrar Postgres al mundo** y verificarlo desde afuera | S | TS §16, §18.2, R12, V9 | Desde una máquina externa, el puerto de Postgres **no responde**. Firewall local activo en ambos servidores |
| **F0.5** | Restringir Studio: autenticación y acceso por IP | S | TS §2.4 | Studio no es accesible desde una IP no autorizada |
| **F0.6** | Verificar `pg_trgm` y `unaccent` con una consulta de similitud real | S | TS §5.10, §10.1, V5 | `SELECT similarity(...)` sobre datos de prueba con acentos devuelve lo esperado |
| **F0.7** | Verificar Supabase Storage: subir, leer y borrar desde un script | S | TS §9.4, R6, V4 | Las tres operaciones funcionan con la clave de servicio. La URL pública sirve el archivo |
| **F0.8** | Medir la latencia real de la LAN con una consulta ida y vuelta | S | TS §20, V10 | Latencia medida y anotada. Si supera los 5 ms, revisar §20 antes de seguir |
| **F0.9** | Fijar versiones exactas del stack y anotarlas | S | TS §2.1, V1, V6 | Versiones instaladas registradas. **Estos números son el parámetro de toda consulta posterior a `context7`** (§1.2, regla 6): documentación de la versión que el proyecto usa, no de la última publicada |
| **F0.11** | **Configurar Resend como SMTP de Supabase y recibir un email de verificación real** | S | TS §14, R15, V2 | Un email de verificación llega a una casilla de verdad. **Sin esto no hay registro posible**: el emisor por omisión de Supabase manda 2 mensajes por hora y solo a direcciones autorizadas |
| **F0.12** | Probar la Admin API de Auth auto-hospedada | S | TS §13.5, V3, V3b | Crear, invitar, bloquear y desbloquear funcionan. **Anotar qué error recibe un bloqueado en el primer intento de ingreso**: define cómo se detecta el bloqueo |
| **F0.13** | Verificar si el *Send Email Hook* funciona auto-hospedado | S | TS §13.6, V3c | Respuesta anotada. Si funciona, los cuatro emails se unifican en React Email; si no, se personalizan las plantillas de Supabase |
| **F0.10** | Backup automático de Postgres y del bucket, **fuera del servidor DATA**, con una restauración de prueba | M | TS §19 | Un volcado se restauró con éxito en un entorno limpio. Sin esto, no hay backup |

> **Compuerta F0:** no se pasa a F1 hasta que **F0.4, F0.6 y F0.11** estén verificadas. Las dos primeras cambian decisiones de arquitectura si fallan; la tercera es la que, si falla, deja el producto sin registro de usuarios y no se descubre hasta que alguien intenta crearse una cuenta.

---

## F1 — Cimientos

**Objetivo:** un proyecto que arranca, se conecta a la base, tiene sesión y renderiza con el sistema de diseño.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F1.1** | Crear el proyecto Next.js 16 con TypeScript estricto y la estructura de carpetas | S | TS §4 | La estructura de `src/` existe y `npm run dev` levanta |
| **F1.2** | Configurar Tailwind 4 con los tokens del sistema de diseño | M | DR §3, §12.1 | Todos los tokens de color, tipografía, radios y sombras disponibles como utilidades. Inter cargada con `next/font` |
| **F1.3** | Instalar shadcn/ui y mapearle los tokens | M | DR §12.2 | Botón, campo, tarjeta, diálogo, tabla y etiqueta se ven según `DESIGN-REFERENCE.md`, no según el tema por omisión |
| **F1.4** | Configurar Drizzle y la conexión a Postgres por IP privada | S | TS §2.1, §18.3 | `drizzle-kit` se conecta y lista las tablas |
| **F1.5** | Escribir el esquema completo de la base | **L** | TS §5 (entero) | Todas las tablas, enums, constraints e índices de §5 declarados. Las restricciones `CHECK` incluidas: son parte del diseño, no un adorno |
| **F1.6** | Generar y aplicar la primera migración, más las extensiones | S | TS §5.10, §18.2 | Base creada desde cero con una sola corrida. `pg_trgm`, `unaccent` y la función `immutable_unaccent` presentes |
| **F1.7** | Integrar Supabase Auth: clientes de navegador, servidor y servicio; Google y Facebook configurados en Supabase | **L** | TS §13.1, §13.2 · FS RF-05, RF-06 | Se puede registrar, entrar y salir por los tres métodos. Entrar con Google usando un email ya registrado **vincula**, no duplica |
| **F1.7b** | Tabla `user_profiles` y alta con compensación | M | TS §5.3, §13.4 | El registro crea identidad y perfil, o **ninguno de los dos**. Tras OAuth sin perfil, se exige completarlo antes de operar |
| **F1.7c** | Resolución de sesión: `getClaims()` local más lectura de perfil | M | TS §13.3 | Las guardias de página verifican localmente; **toda Server Action lee rol y bloqueo frescos de la base** |
| **F1.8** | Personalizar las plantillas de Supabase (E1, E2, E3) y armar el layout de React Email para E4 | M | TS §14 · FS RF-30 | Los emails de identidad llegan con la identidad visual de AnaVende. E4 tiene su plantilla lista |
| **F1.9** | Teléfono obligatorio en las tres vías de alta | M | FS RF-05, RF-06 · TS §5.3, §13.4 | No se puede operar sin teléfono cargado, ni por email ni por Google ni por Facebook |
| **F1.10** | Escribir el envoltorio de Server Actions y los errores de dominio | M | TS §6.2, §6.3 | Una acción de prueba valida entrada, verifica rol, rechaza usuarios bloqueados y devuelve la forma `{ ok, ... }` |
| **F1.11** | Escribir el módulo de dinero y activar la regla de lint que prohíbe `parseFloat` sobre montos | S | TS §7.1, R2 | Formatea `es-AR` con decimales. El lint **falla** ante un `parseFloat` sobre un monto |
| **F1.12** | `proxy.ts` y las guardias de rol por capas | S | TS §6.1, §13.3 | Un anónimo en `/admin` es redirigido; un `customer` en `/admin` recibe 404 |
| **F1.13** | Encabezado, pie y layout base de la tienda | M | DR §5.1, §7 | Encabezado fijo con sombra al scrollear; pie con PedidosYa, medios de pago y legales |
| **F1.14** | Layout del panel con menú lateral y modo oscuro | M | DR §4, §5.2, §3.2 | Menú de 240px colapsable; el interruptor de modo oscuro funciona y **persiste** |
| **F1.15** | Sentry en servidor y cliente, con datos personales filtrados | S | TS §16, §19 | Un error de prueba llega a Sentry **sin** email, teléfono ni dirección |
| **F1.16** | Dockerfile con base Debian slim, y despliegue por CI a Coolify | M | TS §18.1, §18.2, R3 | Un push a `main` despliega. **sharp funciona dentro del contenedor** (V7) |

> **Compuerta F1:** el sitio despliega solo, se puede crear una cuenta y entrar al panel vacío. Es el primer momento en que algo real está en línea.

---

## F2 — Panel: catálogo

**Objetivo:** que la vendedora pueda cargar todo su catálogo, con imágenes optimizadas. Al terminar esta fase **hay datos reales** con los que construir la tienda.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F2.1** | ABM de marcas, categorías y colores | M | FS RF-18 · TS §5.4 | Alta, edición y baja. No se puede borrar un elemento en uso: se ofrece desactivarlo (RN-11) |
| **F2.2** | **Canalización de imágenes**: subida, validación, sharp, tres tamaños, Storage | **L** | FS RF-17 · TS §9.1, §9.2, §9.4, R3 | Un JPG de 8 MB queda como tres WEBP. Un archivo de más de 10 MB o de tipo inválido se rechaza **antes** de subirse. Si falla a mitad, no quedan archivos huérfanos |
| **F2.3** | ABM de productos con precio y descuento como **monto** | M | FS RF-15 · TS §5.4, §7.2 · RN-04b | El formulario muestra el precio final en vivo. Rechaza descuento mayor o igual al precio |
| **F2.4** | Variantes de color: stock e imágenes por variante | **L** | FS RF-16 · TS §5.4, §9.5 | Se agregan y quitan variantes; cada una con su stock y hasta 5 imágenes. Reutilizar las imágenes de otra variante funciona. No se puede quitar una variante con stock reservado |
| **F2.5** | Listado de productos con búsqueda, filtros y aviso de stock bajo | M | FS RF-15, RF-20 | Se ve stock total, reservado y disponible por producto. El stock en cero se destaca |
| **F2.6** | ABM de medios de pago | S | FS RF-19 | Alta con logo, descripción y orden |
| **F2.7** | Configuración del sitio | S | FS RF-20 | Número de WhatsApp, email de avisos y umbral de stock bajo, editables sin desplegar |
| **F2.8** | **Cargar el catálogo real** | M | — | Los productos reales de AnaVende, con sus fotos, están cargados |

> **Compuerta F2:** la vendedora carga un producto completo con dos colores e imágenes, sola, sin ayuda técnica, en menos de cinco minutos (objetivo O1).

---

## F3 — Tienda: descubrimiento

**Objetivo:** un catálogo público navegable, con datos reales de F2.

> **Toda tarea de esta fase es visual.** Ninguna se cierra sin haber pasado por `impeccable` y `ui-ux-pro-max` (`DESIGN-REFERENCE.md` §12.4). Aplica igual a F2, F5, F6, F7 y a cualquier pantalla posterior.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F3.1** | Componente de tarjeta de producto, con todos sus estados | M | DR §6.1 · FS RN-05, RN-06 | Estados de descuento, sin stock, favorito y hover. **Sin stock sigue siendo clicable** |
| **F3.2** | Componente de precio | S | DR §6.7 · FS RN-02, RN-04b | Formato `es-AR` con decimales; con oferta muestra tachado y «Ahorrás $X»; números tabulares |
| **F3.3** | Búsqueda tolerante a acentos y errores de tipeo | **L** | FS RF-02 · TS §10.1 | «mecanico» encuentra «Mecánico»; «lojitech» encuentra «Logitech». Umbral de similitud calibrado con el catálogo real |
| **F3.4** | Catálogo: filtros, orden, paginación, todo en la URL | **L** | FS RF-02 · TS §10.2 | Filtros combinables; el botón atrás funciona; la URL es compartible. Chips removibles y «Limpiar todo» |
| **F3.5** | Ficha de producto con galería y selector de color | **L** | FS RF-03 · DR §6.5, §6.8, §7.3 | Cambiar de color cambia imágenes y stock sin recargar, y la URL lo refleja. Producto inactivo devuelve 404 |
| **F3.6** | Enlaces de WhatsApp | S | FS RF-04 · TS §3 | El mensaje llega con producto, color, cantidad y precio, bien codificado. El número sale de configuración |
| **F3.7** | Home | M | FS RF-01 · DR §7.1 | Buscador como protagonista, chips de categoría, destacados, ofertas, medios de pago y aviso de PedidosYa |
| **F3.8** | SEO: URLs, metadatos por producto, datos estructurados, sitemap | M | FS RNF-04 | Una ficha compartida en WhatsApp muestra imagen, nombre y precio |

> **Compuerta F3:** una persona ajena al proyecto encuentra un producto concreto usando solo el buscador y los filtros, sin ayuda.

---

## F4 — Núcleo de stock y órdenes

**Objetivo:** la lógica de stock y de órdenes, correcta y probada, **antes de que exista interfaz que la use**.

**Por qué está aislada:** es donde un error no se nota hasta que ya vendiste dos veces la misma unidad (R1). Construirla junto a la interfaz mezcla dos tipos de problema y hace que los errores de dominio se escondan detrás de los de la vista.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F4.1** | Operaciones de stock con `UPDATE` condicional atómico | **L** | TS §8.1, §8.2, §8.3 | Reservar, liberar, vender, reponer y ajustar. Cada una escribe en `stock_movements` **en la misma transacción** |
| **F4.2** | Máquina de estados de la orden | M | FS RF-13 · TS §5.6 | Las transiciones válidas funcionan; las inválidas se rechazan con `INVALID_ORDER_STATE`. Cada una escribe en el historial |
| **F4.3** | Creación de orden con snapshot e idempotencia | **L** | FS RF-12 · TS §8.4, §8.5 | El procedimiento de §8.4 completo. Dos envíos con la misma clave devuelven **la misma orden** |
| **F4.4** | Edición de orden activa: quitar ítems, reducir cantidades | M | FS RF-22 · TS §8.1 | Libera la reserva y recalcula el total. Quitar el último ítem equivale a cancelar |
| **F4.5** | Devoluciones con y sin reposición | M | FS RF-25 · TS §5.7 | No permite devolver más de lo vendido. La anulación revierte el efecto en stock |
| **F4.6** | **Tests unitarios contra Postgres real** | **L** | TS §17.1, RNF-05 | Cubiertos: stock insuficiente, **dos reservas concurrentes sobre la última unidad**, transiciones inválidas, devolución excesiva, y que el libro mayor cuadre con los contadores |

> **Compuerta F4:** el test de concurrencia pasa. Dos confirmaciones simultáneas sobre la última unidad producen **una orden y un `INSUFFICIENT_STOCK`**, nunca dos órdenes. Sin esto verificado, no se avanza.

---

## F5 — Cuenta del comprador

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F5.1** | Pantallas de registro, ingreso y recuperación | M | FS RF-05, RF-06 · DR §6.6 | Los tres métodos de ingreso. Un bloqueado ve **la razón** al intentar entrar |
| **F5.2** | Panel del comprador: datos y cambio de contraseña | S | FS RF-07 | Rutas protegidas; tras entrar vuelve a donde estaba |
| **F5.3** | Libreta de direcciones | M | FS RF-09 · TS §5.5 | Varias direcciones, una predeterminada garantizada por la base |
| **F5.4** | Favoritos | S | FS RF-10 | Desde tarjeta y ficha. Un producto desactivado aparece como «No disponible» |
| **F5.5** | Carrito: modelo y operaciones | M | FS RF-08 · TS §5.5 | Agregar, quitar, cambiar cantidad, vaciar. **No existe carrito sin sesión** |
| **F5.6** | Revalidación del carrito y avisos | **L** | FS RF-08 · TS §8.4 | Precio cambiado avisa y toma el vigente; stock reducido ajusta; **desactivado se elimina con aviso previo persistente** |
| **F5.7** | «Iniciá sesión para comprar» y retomar la acción pendiente | M | FS RF-08 · DR §7.3 | El visitante que intenta agregar al carrito va al login y, al volver, **el producto queda agregado** |

> **Compuerta F5:** un comprador arma un carrito, cierra sesión, entra desde otro dispositivo y lo encuentra igual.

---

## F6 — Compra

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F6.1** | Checkout | **L** | FS RF-11 · DR §7 | Datos, elección de dirección, resumen y medios de pago. **Sin costo de envío** (RN-10). Email no verificado impide confirmar |
| **F6.2** | Reconfirmación ante cambios | M | FS RF-11 · TS §8.4 paso 3 | Si el precio o el stock cambió entre ver y confirmar, **se avisa y se pide reconfirmar**; no se crea la orden en silencio |
| **F6.3** | Confirmación: pantalla de éxito y WhatsApp | M | FS RF-12 · DR §7.5 | Número de orden, resumen y botón de WhatsApp como acción principal. Recargar no duplica |
| **F6.4** | Email E4 a la administradora | S | FS RF-30 · TS §14 | Llega con el detalle completo y enlace al panel. **Si falla, la orden se crea igual** |
| **F6.5** | «Mis compras» y cancelación por el comprador | M | FS RF-07, RF-23 | Historial con precios de la orden (snapshot). Cancelar libera la reserva |

> **Compuerta F6:** una compra completa de punta a punta, con el stock reservado correctamente al final.

---

## F7 — Panel: operación

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F7.1** | Listado y detalle de órdenes | M | FS RF-21 · DR §6.9 | Solapas por estado, filtros, búsqueda. En móvil las tablas son tarjetas |
| **F7.2** | Editar orden activa | M | FS RF-22 (sobre F4.4) | Quitar ítems y reducir cantidades desde la interfaz, con el impacto en stock visible |
| **F7.3** | Finalizar y cancelar | S | FS RF-23 (sobre F4.2) | Finalizar pide confirmación **mostrando el impacto en stock** |
| **F7.4** | Órdenes manuales | **L** | FS RF-24 | Productos con precio editable, comprador de texto libre. Se puede crear ya finalizada. Advierte sin bloquear si supera el stock |
| **F7.5** | Devoluciones en el panel | M | FS RF-25 (sobre F4.5) | Selección de ítems, cantidades y si repone stock, con motivo |
| **F7.6** | Gestión de usuarios | M | FS RF-26 · TS §13.2 | Crear, editar, resetear contraseña. Un admin no puede quitarse el rol ni bloquearse |
| **F7.7** | Bloqueo con razón | M | FS RF-27 · TS §13.5 | Motivo obligatorio, garantizado por el `CHECK` de la base. Se bloquea en Supabase Auth **y** se cierran las sesiones activas. Al intentar entrar, el usuario ve el motivo registrado |
| **F7.8** | Dashboard del panel | S | FS RF-14 | Órdenes activas, ventas del mes, stock bajo o en cero, cada uno enlazando a su listado |

> **Compuerta F7:** la vendedora opera un ciclo completo —recibir, editar, finalizar, devolver— sin tocar la base de datos.

---

## F8 — Descubrimiento avanzado

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F8.1** | Categorías relacionadas, recíprocas por defecto | M | FS RF-31 · TS §5.4, §11.1 | Marcar recíproca crea los dos sentidos; desmarcarla elimina el inverso avisando. Se ve cuántos productos aporta cada relación |
| **F8.2** | Recomendados en cascada | **L** | FS RF-32 · TS §11.2 | Los dos bloques, con fallback. Nunca vacíos, nunca con inactivos, nunca con el producto actual. Orden determinístico |
| **F8.3** | «Completá tu setup» en el carrito | S | FS RF-32 | No sugiere lo que ya está en el carrito. Con carrito vacío no aparece |
| **F8.4** | Vistos recientemente | S | FS RF-33 · TS §11.3 | Últimos 10 en el navegador, sin sesión. Descarta inactivos y muestra precios vigentes |

---

## F9 — Reportes y contenido

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F9.1** | Reportes de ventas | **L** | FS RF-28 · TS §15 | Totales, más vendidos, por categoría y marca, web contra manual. Las sumas se calculan **en SQL**. Activas y canceladas no cuentan; las devoluciones restan |
| **F9.2** | Exportación a Excel | M | FS RF-28 · TS §15 | Respeta los filtros en pantalla; moneda y fechas con formato |
| **F9.3** | Páginas legales editables | M | FS RF-29 | Garantías, términos, privacidad y cómo comprar, editables sin desplegar. Markdown sanitizado |
| **F9.4** | Email E3 de cuenta nueva | S | FS RF-30 | El usuario creado por la administradora recibe el enlace para definir contraseña |

---

## F10 — Endurecimiento y lanzamiento

**Objetivo:** que el sistema aguante gente real. Esta fase **no es opcional ni se recorta**: es donde se paga la deuda acumulada.

| ID | Tarea | Tam. | Referencias | Hecho cuando |
|---|---|---|---|---|
| **F10.1** | **Test E2E de aislamiento entre compradores** | M | TS §13.4, §17.2 caso 6, R13 | Un comprador intentando llegar por ID directo a la orden, el carrito, la dirección y el favorito de otro recibe **404 en los cuatro**. Sin RLS, esta es la única barrera |
| **F10.2** | Resto de los tests E2E | **L** | TS §17.2 | Los cinco recorridos: buscar y WhatsApp, comprar completo, cargar producto, finalizar orden, bloquear usuario |
| **F10.3** | Repaso de accesibilidad | M | FS RNF-02 · DR §9 | Contraste, teclado, foco, textos alternativos, áreas táctiles, zoom al 200%. Ningún estado comunicado solo por color |
| **F10.4** | Rendimiento | M | FS RNF-03 · TS §20 | LCP bajo 2,5 s en móvil; catálogo con filtros bajo 300 ms. **Revisadas las cascadas de consultas secuenciales**, que ahora cruzan la red |
| **F10.5** | Repaso de seguridad | M | TS §16 | Cabeceras, rate limiting, verificación de tipo por *magic bytes*, secretos sin `NEXT_PUBLIC_`, Postgres cerrado (revalidar V9) |
| **F10.6** | Ajustar sharp para el servidor | S | TS §9, R3 | `sharp.concurrency(1)` y `MALLOC_ARENA_MAX=2`. Verificado que subir cinco imágenes seguidas no tumba el contenedor |
| **F10.7** | Repaso de textos y estados vacíos | M | DR §8, §10 | Todo error, estado vacío y mensaje revisado: voseo, sin jerga, con acción |
| **F10.8** | Verificar backups y restauración, otra vez | S | TS §19 | Restauración de prueba con datos reales, ya cargados |
| **F10.9** | Prueba con gente real | M | — | Dos o tres personas ajenas compran de verdad. Se corrige lo que aparezca |
| **F10.10** | Lanzamiento | S | — | Dominio apuntando, TLS, Sentry mirando, backups corriendo |

> **Compuerta F10:** **F10.1 es bloqueante.** Sin RLS (§13.4), es la única verificación de que un comprador no puede ver los datos de otro. No se lanza sin ese test pasando.

---

## 4. Riesgos del plan

Distintos de los técnicos de `TECHNICAL-SPEC.md` §21: estos son riesgos de **ejecución**.

| # | Riesgo | Señal temprana | Qué hacer |
|---|---|---|---|
| **P1** | Construir la tienda antes de tener datos reales | Aparecen productos de mentira en el código | Respetar el orden F2 → F3. Es el punto donde más tienta desviarse |
| **P2** | Postergar los tests de stock de F4 | «Después los escribo, primero que funcione» | F4.6 es parte de F4, no una tarea posterior. La compuerta existe por esto |
| **P3** | Recortar F10 por ansiedad de lanzar | «Eso lo vemos después de salir» | F10.1 y F10.8 no se negocian. El resto se puede escalonar |
| **P4** | Un asistente de IA inventa reglas de negocio ausentes | Aparece lógica que no está en ninguna especificación | Toda regla nueva se **escribe primero** en `FUNCTIONAL-SPEC.md` y después se implementa |
| **P7** | Confiar la autorización al JWT en vez de al perfil | Aparecen verificaciones de rol que leen el token y no la base | Un rol o un bloqueo en el token quedan congelados hasta la renovación. Las mutaciones leen `user_profiles` (TS §13.3) |
| **P5** | Los documentos se desactualizan respecto del código | Al revisar, la especificación ya no describe lo que hay | Cambiar la especificación es parte de la tarea que cambia el comportamiento, no un trámite posterior |
| **P6** | Crecimiento del alcance por «ya que estoy» | Aparecen funciones que están en «Fuera de alcance» | La lista FA-01 a FA-19 existe para esto. Lo que se quiera sumar va al backlog de §6 |

---

## 5. Mantener vivos los documentos

Los cuatro documentos son la fuente de verdad. Cuando algo cambia:

| Cambia | Se actualiza |
|---|---|
| Una regla de negocio o un comportamiento | `FUNCTIONAL-SPEC.md` (y su historial de decisiones) |
| Una decisión técnica, un esquema, una versión | `TECHNICAL-SPEC.md` |
| Un color, un componente, una pantalla | `DESIGN-REFERENCE.md` |
| El orden o el alcance del trabajo | Este documento |

**La regla:** si el código y la especificación difieren, **la especificación está mal hasta que se demuestre lo contrario** — pero se arregla en el momento, no «cuando haya tiempo». Un documento que miente es peor que ninguno.

---

## 6. Después del MVP

Ordenado por relación entre valor y esfuerzo, no por entusiasmo. Nada de esto entra al MVP.

| Prioridad | Qué | De dónde sale |
|---|---|---|
| 1 | Email de confirmación de orden al comprador | FA-06 |
| 2 | Avisos por email de cambios de estado | FA-07 |
| 3 | Expiración automática de reservas de stock | FA-05 |
| 4 | Caché del catálogo con `cacheComponents`, **con medición previa** | TS §12 |
| 5 | Relacionados curados producto a producto | FA-18 |
| 6 | Recomendados por co-compra, cuando haya volumen de órdenes | FA-17 |
| 7 | Cupones y promociones | FA-09 |
| 8 | Pago en línea | FA-01 |
| 9 | Más atributos de variante además de color | FA-16 |
| 10 | Entorno de staging | TS §18.2 |

---

## 7. Resumen

| Fase | Qué queda funcionando al terminarla |
|---|---|
| **F0** | La infraestructura verificada, sin supuestos pendientes |
| **F1** | Un sitio en línea con sesión y sistema de diseño |
| **F2** | El catálogo real cargado por la vendedora |
| **F3** | Un catálogo público navegable y buscable |
| **F4** | Stock y órdenes correctos, probados con concurrencia |
| **F5** | Cuentas, carrito, favoritos y direcciones |
| **F6** | Se puede comprar de punta a punta |
| **F7** | La vendedora opera el negocio completo |
| **F8** | Recomendados y vistos recientemente |
| **F9** | Reportes, legales y emails |
| **F10** | Listo para gente real |

**Tres compuertas que no se negocian:**

1. **F0.4** — Postgres no responde desde internet, verificado desde afuera.
2. **F4.6** — El test de concurrencia sobre la última unidad pasa.
3. **F10.1** — Un comprador no puede acceder a los datos de otro por ID directo.

Las tres protegen contra fallas que **no se ven mientras se desarrolla** y se descubren cuando ya hicieron daño.
