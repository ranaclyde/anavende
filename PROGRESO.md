# AnaVende — Estado del desarrollo

Estado tarea por tarea de `sdd/mvp/DEVELOPMENT-PLAN.md`. Los IDs son los del
plan. Se actualiza al cerrar cada tarea, en el mismo commit que la cierra.

Última actualización: 2026-09-08.

**Qué significa cada estado**

| | |
|---|---|
| ✅ | Cumple su «Hecho cuando» y está verificado |
| 🟡 | El código está, falta una verificación o una pieza externa |
| ⬜ | Sin empezar |
| ⛔ | Bloqueada por algo que no depende de mí |

---

## F0 — Infraestructura

**El 2026-09-05 el desarrollo dejó de apuntar al stack local y pasó a
producción.** `.env.local` apunta al Supabase auto-hospedado del VPS, se
aplicaron las siete migraciones sobre esa base, y de ahí en adelante todo lo
que dice ✅ acá abajo está verificado **donde va** (`TECHNICAL-SPEC.md` §18.2).
El stack local del CLI quedó guardado en `.env.stack-local.bak` y ya no se usa.

**Postgres no responde desde afuera**, así que el acceso desde la máquina de
desarrollo va por un **túnel SSH** al puerto 5433 (nunca el 54322: ver la
guarda de `scripts/solo-local.mts`, que distingue producción del stack local
justamente por ese número).

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F0.1 | Servidores en DonWeb unidos por LAN | 🟡 | Hay **un** VPS con el stack completo. La separación APP/DATA de §2.2 no existe todavía: el servidor APP y la LAN privada quedan para cuando se despliegue la aplicación |
| F0.2 | Coolify + limpieza de Docker | ⬜ | Postergada por decisión tuya |
| F0.3 | Supabase en el servidor DATA | ✅ | Docker compose oficial, trece servicios (etiquetas exactas en `VERSIONS.md`). GoTrue v2.184.0, Postgres 15.8. Studio por HTTPS en `https://vps-6346459-x.dattaweb.com` |
| F0.4 | Cerrar Postgres al mundo | 🟡 | **Compuerta F0.** Cerrado por dos capas independientes y verificado desde afuera. **(a)** El firewall virtual de DonWeb bloquea todo por defecto y abre solo 80, 443 y 5400 (SSH): el 5432 nunca estuvo en la lista. **(b)** `supabase-pooler` publicaba 5432 y 6543 en `0.0.0.0` —o sea que la única defensa era el perímetro de DonWeb— y ahora publica en `127.0.0.1`, por `docker-compose.override.yml` con `ports: !override`. Sin (b), borrar una regla en el panel de DonWeb dejaba la base abierta a internet. `DOCKER-USER` está vacía: no hay ni hubo firewall local. **Lo que falta es lo que no se puede hacer todavía**: «firewall local activo en **ambos** servidores» necesita que exista el segundo (F0.1). Cuando exista, son tres cosas y están acá para no redescubrirlas: publicar el pooler en la **IP privada** en vez de `127.0.0.1`, firewall local en los dos —y en el DATA tiene que ir en la cadena `DOCKER-USER`, porque **Docker se saltea `ufw`** y un `ufw` solo daría falsa tranquilidad—, y `pg_hba.conf` restringido a la IP del APP. El firewall de DonWeb **no sirve para esto**: es perimetral y no toca el tráfico de la LAN privada (§2.4) |
| F0.5 | Restringir Studio | ⬜ | Studio queda accesible por HTTPS con usuario y contraseña del dashboard. §2.4 pide además restricción por IP |
| F0.6 | `pg_trgm` y `unaccent` | ✅ | **Compuerta F0.** Las crea la migración `0000`. `db:verificar` contra producción: las dos extensiones, `immutable_unaccent` IMMUTABLE, y las dos pruebas que importan —«mecanico» encuentra «Mecánico» con la misma similitud que con acento, «lojitech» encuentra «Logitech» con 0,500— |
| F0.7 | Storage: subir, leer, borrar | ✅ | Bucket `productos` creado en Studio con los tres valores de `supabase/config.toml`: público en lectura, 10 MiB, solo `image/webp`. `db:imagenes` pasó entero contra ese bucket. **R6 no se materializó**: ni una falla de firma S3, y la prueba difícil —una subida cortada en el tercer tamaño— no dejó huérfanos |
| F0.8 | Latencia real de la LAN | ⬜ | Sin sentido hasta que exista el segundo servidor (F0.1) |
| F0.9 | Fijar versiones del stack | ✅ | Aplicación e infraestructura registradas en `VERSIONS.md`, con las **trece imágenes** del stack del VPS y su etiqueta exacta: son el parámetro de toda consulta a `context7` (§1.2 regla 6), y una actualización silenciosa de cualquiera es un cambio de producción que nadie pidió. El desfase de versión mayor quedó corregido: `supabase/config.toml` pasó de `major_version = 17` a **15**, la del servidor DATA (§18.2) |
| F0.10 | Backup con restauración de prueba | ⬜ | **Hay un piso, y hay que conservarlo:** DonWeb hace un *Backup Standard* del VPS entero, **semanal, con retención de una sola copia** y restauración no inmediata, por Mesa de Ayuda. Cubre que el servidor se rompa, y nada más. Los tres huecos, en orden de gravedad: **(a)** con una única copia, un daño que no se note dentro de la semana se sobrescribe con el respaldo de los datos ya rotos —y una migración mala o un borrado por error casi nunca se notan el mismo día—; **(b)** no se puede restaurar sin ticket ni saber cuánto tarda, con el sitio caído mientras; **(c)** es la imagen del VPS entero, así que no hay forma de recuperar una tabla o un producto sin llevarse todo lo demás para atrás. Lo que falta es lo de §18.2: `pg_dump` de la base y respaldo del bucket, **fuera del VPS**, con varias copias de retención y **una restauración de prueba documentada**. La base comprimida son pocos MB: treinta copias no pesan nada y se restauran en minutos sin depender de nadie. **Sobre la frecuencia:** semanal alcanza *hoy*, con solo el catálogo —carga grande al principio y pocos artículos por mes, criterio tuyo y es correcto—. Deja de alcanzar cuando el checkout esté andando (F6): ahí adentro hay pedidos y clientes, y una semana perdida son ventas reales con gente esperando algo que ya pagó |
| F0.11 | Resend como SMTP de Supabase | ✅ | **Compuerta F0.** `SMTP_HOST=smtp.resend.com`, puerto 465, usuario `resend` y la API key como contraseña, remitente en el dominio verificado. Los emails llegan a Gmail sin ir a spam. Reemplazó al contenedor `supabase-mail`, que **ni siquiera estaba corriendo**: el registro en producción estaba roto y no se veía |
| F0.12 | Admin API de Auth | ✅ | Usada de verdad contra producción: listar y borrar usuarios por `service_role`. El borrado se lleva el perfil solo, por el `ON DELETE CASCADE` de la migración `0002` |
| F0.13 | *Send Email Hook* auto-hospedado | ⬜ | Sigue abierta, pero **F1.8 ya no depende de su respuesta**: la vía de las plantillas quedó decidida por lo que se descubrió acá (abajo, en las decisiones) |

---

## F1 — Cimientos

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F1.1 | Proyecto Next.js 16 + estructura | ✅ | Sin `src/`, por decisión tuya. `TECHNICAL-SPEC.md` §4 actualizado |
| F1.2 | Tailwind 4 con los tokens | ✅ | |
| F1.3 | shadcn/ui mapeado a los tokens | ✅ | |
| F1.4 | Drizzle y la conexión a Postgres | ✅ | **Ahora contra producción**, por el pooler (Supavisor) y a través del túnel SSH. El usuario lleva pegado el `POOLER_TENANT_ID`: `postgres.your-tenant-id`, no `postgres` |
| F1.5 | Esquema completo de la base | ✅ | |
| F1.6 | Primera migración y extensiones | ✅ | Siete migraciones; la base se crea desde cero de una corrida. **Comprobado en producción**: `db:migrate` sobre el esquema vacío del VPS y `db:verificar` en verde, las 18 comprobaciones |
| F1.7 | Supabase Auth: los tres métodos | ⛔ | **Email completo y probado en producción**, de punta a punta y en los tres caminos: alta con email de verificación que llega y lleva a `/mi-cuenta`; reenvío del enlace; y recuperación de contraseña, incluido cerrar sesión y volver a entrar con la nueva. Los tres llegaron rotos a producción por el mismo motivo —abajo, en las decisiones— y los tres se arreglaron. **Google y Facebook necesitan que crees las apps en las consolas de Google y Meta** |
| F1.7b | `user_profiles` y alta con compensación | ✅ | La compensación se probó sola: un fallo real dejó cero identidades huérfanas |
| F1.7c | Resolución de sesión | ✅ | |
| F1.8 | Plantillas E1–E3 y layout compartido | 🟡 | **E1, E2 y E3 escritas y revisadas** en `lib/email/`, en español y con la identidad de DESIGN-REFERENCE; `npm run email` las convierte en el HTML que descarga GoTrue (`public/emails/`) y deja una copia para mirar en el navegador. **E4 salió de esta tarea y volvió a F6.4**, que es donde el plan ya lo tenía: el layout que necesitaba está hecho, y hasta que la orden no exista no hay qué mostrarle a la administradora. Lo que falta acá es **conectarlas**, y no depende de nosotros: GoTrue carga las plantillas **por HTTP contra `SITE_URL`** —probado en el VPS: no lee archivos— así que recién funcionan con la aplicación desplegada. Hasta entonces los emails salen con la plantilla por defecto de Supabase, en inglés. **Los asuntos van en el mismo viaje al VPS**, no antes: cambiarlos solos daría un asunto en español sobre un cuerpo en inglés |
| F1.9 | Teléfono obligatorio en las tres vías | ✅ | Normaliza a `+549…`; validado en el servidor |
| F1.10 | Envoltorio de Server Actions | ✅ | |
| F1.11 | Módulo de dinero + regla de lint | ✅ | El lint falla ante `parseFloat` sobre un monto |
| F1.12 | `proxy.ts` y guardias por capas | ✅ | Un `customer` en `/admin` recibe 404, verificado en el navegador |
| F1.13 | Encabezado, pie y layout de la tienda | ✅ | |
| F1.14 | Panel con menú lateral y modo oscuro | ✅ | 240px ↔ 64px, persistido |
| F1.15 | Sentry con datos personales filtrados | 🟡 | Configurado y con el filtro escrito. **Sin DSN todavía**: falta ver un error de prueba llegar sin email ni teléfono |
| F1.16 | Dockerfile y despliegue por CI | ⬜ | Postergada por decisión tuya |

---

## F2 — Panel: catálogo

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F2.1 | ABM de marcas, categorías y colores, con el **logo de marca** | ✅ | Reabierta dos veces: **categoría destacada** y el **logo de marca** que RF-18 pedía y no tenía tarea. Probado en el navegador: alta con logo, el chip en el listado, reemplazar, quitar —que borra los archivos, no solo la referencia—, borrar la marca llevándose su logo, y el rechazo **antes de subir** de un `.txt` y de un archivo de 11 MB |
| F2.2 | Canalización de imágenes | ✅ | Su «Hecho cuando» está cumplido y verificado: `db:imagenes` prueba contra Storage de verdad que un JPG de 8 MB sale como tres WEBP y que una subida cortada a mitad no deja huérfanos; el rechazo **antes de subir** se probó en el navegador con el logo de marca, que fue su primer consumidor real. Las piezas de RF-17 que **necesitan varias imágenes por variante** —arrastre, progreso, reordenar y elegir la principal— se hicieron en F2.4, que es donde tenían dónde probarse |
| F2.3 | ABM de productos | ✅ | Alta, edición, activar/desactivar, destacar y baja, con la **descripción con formato**. `description_text` y su índice quedaron en la migración `0006`. Verificado con tres scripts (`db:descripcion`, `db:markdown`, `db:productos`) y en el navegador: se cargó un producto real, se editó, se rechazó activarlo con la marca desactivada (RN-11b al revés) y se borró. **La búsqueda del «Hecho cuando» se probó contra el producto de verdad**: «cable hdmi» encuentra `Cable **HDMI** 2.1`. Necesitó un **listado mínimo** que el plan tenía en F2.5 |
| F2.4 | Variantes de color | ✅ | Agregar, editar y sacar variantes, cada una con su stock y hasta 5 imágenes; reutilizar las de otra variante; arrastre, progreso, reordenar y elegir la principal. `db:variantes` prueba 30 reglas contra Postgres y contra Storage de verdad. Probado en el navegador de punta a punta: alta de producto que sigue en su pantalla, dos colores, tres fotos, reordenar arrastrando, «hacer principal», borrar, rechazo de un `.txt`, reutilizar las fotos de otro color, RN-11b en los dos sentidos, y borrar el producto dejando el bucket vacío. **Arrastrando aparecieron dos errores que no se veían leyendo el código** —están abajo—. Pasó por `impeccable` como pide DR §12.4, y de ahí salieron tres correcciones que sí se ven mirando: el menú de cada foto se mudó **encima de su miniatura** —debajo quedaba más cerca del número de la foto siguiente que del suyo—, la ayuda de las fotos se dice **una vez por sección** en vez de dos renglones por color, y el selector de «reutilizar las fotos de otro color» aparece **solo cuando puede hacer algo**. También se corrigió el contraste de los textos en `--ink-tertiary`, que sobre `--surface-sunken` daban 2,6:1 en claro y 3,5:1 en oscuro contra el 4,5:1 que pide §9 |
| F2.5 | Listado de productos | ✅ | Búsqueda por nombre, marca y descripción; filtros por categoría, marca, estado **y stock**; orden por nombre, precio, stock disponible y fecha, en los dos sentidos y también desde las cabeceras de la tabla. Los tres números de stock por producto, con el cero, el stock bajo de RF-20 y el **negativo** de RF-24 señalizados. Todo el estado vive en la URL (§10.2). `db:listado` prueba 39 reglas contra Postgres de verdad. Verificado en el navegador con seis productos que cubren los cuatro avisos: «mecanico» encuentra «Mecánico», «8k a 60hz» encuentra por la descripción, «Para reponer» trae tres de seis, ordenar por una cabecera y volver a tocarla da vuelta la dirección, «Limpiar todo» conserva el orden, y el vacío y el sin-resultados dicen cosas distintas. Los productos de prueba se borraron: la base quedó como estaba. Pasó por `impeccable` como pide DR §12.4, y de ahí salieron cinco correcciones que sí se ven mirando: la **lupa se apoyaba sobre la primera letra** del texto de ayuda —abajo está por qué, y vale para todo el panel—; en las columnas de números la **flecha de ordenar se mudó adelante del título**, porque el lugar que ocupaba mientras no se veía corría el título 18px a la izquierda del borde donde terminan las cifras; la columna **Estado se ensanchó** para que «Activo» y el aviso de stock entren en la misma línea y la tabla conserve su renglón parejo de 44px (§6.9); en la tarjeta de móvil el **precio y el disponible arrancan en la misma línea**, que apilados dejaban el número grande flotando; y con el catálogo vacío **desaparece el botón del encabezado**, porque el estado vacío ya ofrece el mismo primer paso y dos botones de marca iguales a 100px uno del otro se leen como un error (§6.3) |
| F2.6 | ABM de medios de pago | ✅ | Alta con logo, descripción y orden, edición, activar/desactivar y baja, en una solapa nueva del catálogo. El orden se cambia con flechas y se renumera solo. `db:pagos` prueba 26 reglas contra Postgres y contra Storage de verdad. Probado en el navegador: tres medios con y sin logo, reordenar, desactivar, borrar, y el estado vacío. **La canalización de logos se generalizó**: la que hizo F2.1 para las marcas ahora sirve a las dos, con una sola copia del orden de operaciones que evita archivos huérfanos —y se volvió a probar el logo de marca de punta a punta para asegurarse de que no se rompió—. Arrastrando el flujo apareció **un error que no se veía leyendo el código**: está abajo. Lo que RF-19 pide **mostrar** —la franja en la tienda, la ficha y el checkout— no es de esta tarea: cae en F3.7, F3.5 y F6.1, que son las pantallas donde va |
| F2.7 | Configuración del sitio | ✅ | Número de WhatsApp, email de avisos y umbral de stock bajo, editables desde `/admin/configuracion`. `db:configuracion` prueba 22 reglas contra Postgres de verdad, y las cuatro que importan no se ven leyendo el código: que **guardar la primera vez CREE la fila** —es un UPSERT, y con un UPDATE la pantalla diría «se guardó» sin haber guardado nada—, que la segunda pise a la primera sin que aparezca una segunda fila, que `updated_at` avance al pisar, y que **el umbral guardado llegue al listado**: con 5, un producto con 5 disponibles entra en «Para reponer»; con 4, sale. La normalización del teléfono se sacó a `lib/telefono.ts` y ahora es **una sola** para el comprador y para el sitio; el script prueba que las dos den lo mismo. Probado en el navegador: el estado sin configurar, un envío vacío que señala los dos campos y lleva el foco al primero, el número que vuelve normalizado a `+549…`, el email recortado y en minúsculas, el 101 rechazado por el servidor con su motivo y el campo vacío por el formulario con el mismo texto que usaría el servidor, en claro y en oscuro y a 390px. Arrastrando el flujo apareció **un callejón sin salida que no se veía leyendo el código**: está abajo. Pasó por `impeccable` y `ui-ux-pro-max` como pide DR §12.4, y de ahí salieron seis correcciones que sí se ven mirando: el campo del umbral dejó de ser `type="number"` y pasó a `inputMode="numeric"`, **por la misma razón que ya estaba escrita en el stock de una variante** —el campo numérico del navegador sube y baja con la rueda del mouse encima, y acá eso cambiaría el umbral de todo el catálogo mientras alguien baja la página—; el botón «Guardar» deshabilitado **dice por qué con palabras** («Todo guardado.») en vez de colgarlo de un `title`, que sobre un botón deshabilitado puede no llegar a aparecer nunca (§8); la unidad «unidades» entró en la descripción accesible del campo, que si no se lee «avisar stock bajo a partir de: 3» sin decir de qué; el esqueleto de carga usaba separaciones distintas de las de la pantalla de verdad y **la página saltaba 40px** al llegar los datos, así que ahora comparte las tres medidas y hasta la cantidad de renglones de cada ayuda; y dos textos se acortaron: la bajada del encabezado, que hablaba de «tocar el código» —vocabulario que la vendedora no tiene por qué tener (§10)—, y la de «Avisos», que decía en dos renglones lo que dice en uno. **La fila se borró al terminar**: el número de prueba no es el de nadie, y dejarlo puesto sería peor que dejarlo vacío. **Cargada con los datos reales el 2026-09-07**, y comprobado en la base: `id = 1`, el WhatsApp normalizado a `+549` + 10 dígitos y el email en minúsculas y recortado, o sea que la normalización del servidor corrió y no se guardó lo que se tipeó. El umbral quedó en **2**, más estricto que el 3 por defecto: es criterio tuyo y queda anotado para que no se lea como un descuido |
| F2.8 | Cargar el catálogo real | ⬜ | **Desbloqueada el 2026-09-05.** Lo que la trababa —F0.3 y F0.7— está hecho: la base y el bucket de producción existen y están probados, así que lo que Ana cargue queda donde va y no hay que volcarlo ni volver a subirlo. Sigue conviniendo hacer antes la **Compuerta F2**, que es la prueba de usabilidad del panel |

---

## F3 — Tienda: descubrimiento

**El desarrollo de F3 volvió al stack local, y es a propósito.** `.env.local`
apunta otra vez a `127.0.0.1:54322` —la copia de producción quedó guardada en
`.env.produccion.bak`— porque F3 son pantallas, y para mirar una pantalla hace
falta un catálogo. El real es de Ana y entra en F2.8; mientras tanto lo llena
`npm run seed`: 26 productos con **imágenes de verdad**, que pasan por sharp,
por los tres tamaños y por Storage, para que la grilla se vea con los pesos y
las proporciones que va a tener. Se va entero con `npm run seed:limpiar`.

Lo que eso cambia es el criterio de cierre, y conviene decirlo antes de la
tabla: **nada de F3 está verificado donde va**, y las dos cosas que el plan
pide explícitamente contra el catálogo real —el umbral de similitud de F3.3 y
la Compuerta F3— no se pueden aprobar contra 26 productos que elegimos
nosotros. Un buscador calibrado sobre nombres propios se aprueba solo.

**Solo F3.5 pasó por `impeccable` y por `ui-ux-pro-max`,** que es lo que
`DESIGN-REFERENCE.md` §12.4 exige para cerrar cualquier pantalla y lo que las
tareas de F2 anotan una por una. Comparar lo implementado contra el canvas
aprobado no es lo mismo: el canvas dice cómo se ve, las skills dicen si se
puede usar. Es el motivo por el que abajo no hay ningún ✅, y no un descuido de
rotulación — **la tarjeta, el catálogo y el precio siguen sin esa pasada**.

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F3.1 | Tarjeta de producto, con todos sus estados | 🟡 | `components/shop/tarjeta-producto.tsx`, y es siempre la misma en catálogo, home, recomendados y favoritos (§6.1). Están el descuento —**dos números**, tachado y final (RN-04c)—, el **sin stock** —imagen al 55% con la píldora encima, y la tarjeta **sigue siendo clicable** (RN-05)—, el hover que eleva y escala la imagen dentro de su marco, la marca en versalitas y los puntos de color. **Repasada el 2026-09-08 contra el rediseño**: los tres primeros puntos quedaron confirmados como están y el cuarto se terminó de decidir; abajo está el detalle. Faltan dos, y las dos son de otra tarea: **el corazón es un hueco, no un botón** —entra por `accionFavorito` y hoy nadie se lo pasa, porque favoritos es F5.4—, así que el estado «favorito» del «Hecho cuando» no está probado; y **el enlace de la tarjeta apunta a un 404**, porque `/productos/[slug]` es la ficha y es F3.5. El enlace estirado vive dentro del `<h3>` y no envuelve la tarjeta: envolviéndola, el corazón quedaría **dentro** del ancla, que es HTML inválido y lo deja inalcanzable con teclado |
| F3.2 | Componente de precio | 🟡 | `components/shop/precio.tsx`, con `es-AR`, decimales siempre (RN-02) y `tabular-nums` —sin eso las columnas de precios de la grilla bailan al cambiar de página—. **Las dos composiciones muestran los mismos dos números desde el 2026-09-08** (RN-04c): la de tarjeta es una línea —tachado y después final— y la de ficha va apilada, final a 24px y tachado abajo. El renglón «Ahorrás $ X» se fue de las dos. La de tarjeta está en pantalla; **la de ficha no tiene consumidor todavía** (F3.5), y código sin consumidor es código que nadie probó |
| F3.3 | Búsqueda tolerante a acentos y errores de tipeo | ⬜ | Hay media, y es la mitad que no da nombre a la tarea: `condicionDeBusqueda()` en `modules/catalog/products/tienda.ts` resuelve **los acentos** con `immutable_unaccent` sobre nombre, marca y `description_text`, así que «mecanico» encuentra «Mecánico». Sin trigramas, «lojitech» **no** encuentra «Logitech». El umbral que falta no se calibra hasta que exista el catálogo real (F2.8), que es lo que pide el «Hecho cuando» |
| F3.4 | Catálogo: filtros, orden, paginación, todo en la URL | 🟡 | `/productos` con filtros por categoría, marca, color, **rango de precio** y descuento, cinco órdenes y paginación, y **todo el estado en la dirección** (§10.2): el botón atrás funciona, el enlace se manda por WhatsApp tal como se está viendo, y la pantalla no necesita una línea de estado de cliente para lo que muestra. Tres pantallas vacías distintas y no una —«todavía no hay productos», «no encontramos nada para esto» y la que apareció probando, `?pagina=9` a mano, que antes ofrecía «Limpiar todo» sin ningún filtro puesto—. El conteo es `aria-live`, la paginación son enlaces y las cuatro primeras tarjetas cargan con prioridad, por el LCP. **Completada el 2026-09-08**: categoría, marca y color pasaron a **multiselección** y entró el **rango de precio**, que eran las dos funciones que RF-02 pedía y no estaban. Un chip por valor aplicado, contador por valor, y el precio sobre el precio **final**. **34 tests nuevos** sobre un módulo que no tenía ninguno. **Pasó por `impeccable` (audit) y por `ui-ux-pro-max`** el mismo día: de ahí salieron nueve arreglos de accesibilidad, todos medidos y ninguno visible. Abajo están |
| F3.5 | Ficha de producto con galería y selector de color | 🟡 | `/productos/[slug]`, y con esto **la tarjeta del catálogo dejó de apuntar a un 404**. Están la galería de §6.8, el selector de color de §6.5, la cantidad con tope en el stock, la descripción con formato pintada como React y no como HTML, y los tres estados de compra: con stock, **sin stock** y «todavía no está a la venta» —un producto activo sin ninguna variante, que RN-05 muestra igual—. Cambiar de color cambia foto, stock y mensaje **sin recargar** y escribe `?color=` con `replaceState`; un producto inactivo da 404. **17 tests** sobre la consulta y los mensajes. **Rehecha el 2026-09-08 con diecisiete pedidos tuyos**: miniaturas a la izquierda y siempre dibujadas —el salto de la foto al cambiar de color era eso—, foto al borde de la tarjeta, flechas, visor de dos niveles con recorrido a tamaño real, galería pegada con la columna derecha desplazando, descripción adentro de esa columna, recuadro «¿Cómo sigue después de comprar?», y Guardar y Compartir. Arriba está el detalle. Pasó por `impeccable` y `ui-ux-pro-max`. **Falta mirarla en un teléfono** y **falta ver moverse la galería**: el navegador de esta máquina no entrega cuadros, así que el desplazamiento suave no ocurre —la instrucción sale bien, está comprobado—. Le faltan los recomendados de RF-03, que son F8.2 y F8.4 |
| F3.6 | Enlaces de WhatsApp | 🟡 | `lib/whatsapp.ts`, que es donde §4 lo tenía previsto, y **se hizo junto con F3.5 por decisión tuya**: la ficha no tiene ninguna otra acción, así que sin esto salía una pantalla que no se podía terminar de probar. **Son dos mensajes y no uno**: el de compra —producto, color, cantidad, precio y enlace— y el de **consulta de disponibilidad**, que lleva producto, color y enlace y **no** lleva precio ni cantidad: no se está comprando, y un precio sobre algo que todavía no existe es un precio que después hay que desdecir. El criterio de RF-04 —acentos, saltos de línea y el `$` bien codificados— está probado, y el número se limpia a dígitos venga como venga. Sin número configurado **no se dibuja ningún botón**: `wa.me/` sin destino abre WhatsApp en la nada. **Falta abrir uno en un teléfono con WhatsApp de verdad**: lo verificado es la dirección, no la entrega |
| F3.7 | Home | ⬜ | Hoy `/` es un **marcador de posición deliberado** —título, bajada y nada más—, y lo dice en su propio archivo: construir la home contra productos inventados es el riesgo P1 del plan. Recibió los tokens nuevos de F3.8 como todo lo demás, y ninguna otra cosa del canvas |
| F3.8 | Rediseño de la tienda desde el canvas aprobado | 🟡 | **Tarea nueva, agregada al plan el 2026-09-08**; abajo está entera. Cuatro pasadas —tokens, estructura del catálogo, ajustes de panel y tarjeta, y encabezado— aplicadas a la capa de tokens, al catálogo y al navbar. **Falta bajarlo a la home, a la sección de categorías, al pie, al carrito y a la ficha**, y eso no se hace de una: cada pantalla lo adopta cuando se construye. **El panel de administración queda afuera**: el rediseño es de la tienda, lo que ve el comprador |
| F3.9 | SEO: URLs, metadatos, datos estructurados, sitemap | ⬜ | Era F3.8 hasta el 2026-09-08 |

> **Compuerta F3:** «una persona ajena al proyecto encuentra un producto
> concreto usando solo el buscador y los filtros, sin ayuda.» **No se puede
> tomar todavía**, y no por falta de pantalla: contra un catálogo de 26
> productos que elegimos nosotros se aprueba sola. Espera a F2.8.

---

### El rediseño de la tienda (F3.8)

Sale de un canvas de Claude Design aprobado por vos, **`Rediseño UI AnaVende`**
—siete pantallas: home, catálogo, categorías, ficha, carrito, orden enviada y
panel—, construido sobre esta misma referencia:

<https://claude.ai/design/p/630d6d88-0a72-4ac6-b785-b1153d5e419b?file=AnaVende.dc.html>

Lo primero que hizo el canvas fue **confirmar las decisiones grandes** de DR
§1.2 —acento burdeos, encabezado superior con etiquetas, un solo color
saturado—, así que lo que cambia es detalle y no rumbo. Lo que cambió, lo que
no se tomó y por qué está escrito en **DR §1.3**, que es nueva, y las seis
decisiones entraron a §14.

**El alcance es la tienda, y solo la tienda.** El rediseño no toca el panel de
administración: lo que se rehace es lo que ve el comprador. El canvas trae una
pantalla de panel entre las siete y **no se adopta** —está en DR §1.3, con el
motivo: §1.2 ya había decidido dos escalas de densidad, y una tabla de órdenes
en el lenguaje aéreo de la tienda es ilegible—. El panel conserva su escala
densa de §4, sus radios de 12/8px y su modo oscuro, que no se tocaron.

Lo único que sí lo alcanza es **la capa de tokens, porque es una sola** y así
está decidido desde §4: una paleta, dos densidades. Los grises cálidos y el
tinte nuevo de las sombras llegan al panel en modo claro por herencia, sin que
se haya tocado un componente suyo — y la paleta oscura, que es donde el panel
vive de verdad, quedó intacta. Es el efecto que se buscaba: **una tienda
rediseñada y un panel que no se enteró**, salvo por los grises, que ahora son
los mismos en los dos lados en vez de dos familias distintas.

**Las cuatro pasadas, en orden:**

1. **Solo tokens.** No se tocó un componente y el catálogo, el encabezado, el
   pie y los formularios ya se veían distintos — que es para lo que sirve tener
   una capa de tokens. La familia de grises pasa de fría a **cálida**, los
   radios de tienda de 24/16 a **28/20px**, y el tinte de marca y el de las
   tres sombras se corrigen: estaban teñidas con el `--ink` que se estaba
   retirando, y una sombra azulada bajo una tarjeta cálida se nota aunque nadie
   sepa decir por qué.
2. **La estructura del catálogo.** La columna lateral de filtros se convierte
   en una **barra de tres controles** sobre la grilla. El motivo es medible: se
   comía 260px de 1200 —el 22% del ancho— para algo que se toca una vez y
   después estorba el resto de la sesión. El panel abre con un `<details>`
   nativo, sin JavaScript y con teclado, y **entra el filtro por color**, que
   RF-02 pedía y no estaba.
3. **Seis ajustes de comparar el canvas contra lo implementado**, pantalla al
   lado de pantalla: los tres grupos del panel en columnas —apilados, «Color»
   quedaba abajo de todo y nadie llegaba a verlo—, el botón «Filtros» teñido
   cuando hay algo puesto, «Ver N productos» en el pie del panel, los tres
   estados del burdeos separados, los puntos de color en la tarjeta, y **cuatro
   números que pasan a dos**: la tarjeta mostraba la píldora «−$ 9.900», el
   final, el tachado y «Ahorrás $ 9.900» — la misma cifra dos veces para
   comunicar una sola oferta.
4. **El encabezado.** El buscador pasa a la variante compacta y se ubica junto
   al carrito; el carrito deja de ser un ícono con una insignia de 18px encima
   y pasa a ser una píldora con el número en el mismo renglón. Y **el buscador
   del encabezado desaparece cuando la página ya tiene el suyo**: dos
   buscadores uno arriba del otro hacen dudar de cuál usar.

**Lo que falta.** El canvas cubre siete pantallas y el rediseño llegó a tres y
media: tokens, catálogo, navbar y —desde el 2026-09-08— **la ficha, que nació
sobre el lineamiento en vez de ser rediseñada después**, que era exactamente el
plan. Quedan **la home, la sección de categorías, el pie y el carrito**. No
entran como pasadas nuevas de rediseño sino con la pantalla: F3.7 (home) y F5.5
(carrito) se construyen ya sobre el lineamiento, porque rediseñar algo que
todavía no existe es hacer dos veces el mismo trabajo. El plan lo dice en la
nota de F3. **La sección de categorías es la excepción y no tiene tarea**: está
abajo.

**Dos cosas del canvas que no se adoptaron, y son de forma distinta.** Una es
de aspecto y está en DR §1.3 con las otras cinco: tipografía, tamaños de 10px,
hover de marca, el gris `#787574` que no llega al AA de RNF-02. La otra es de
arquitectura y merece decirse acá: **el canvas propone filtros desplegables sin
paginación ni estado en la URL**. Se toma su aspecto y se conserva §10.2,
porque un prototipo no necesita que el enlace se pueda compartir ni que el
botón atrás funcione, y la tienda sí. También se revirtieron los enlaces
«Inicio · Productos · Categorías · Destacados» del navbar: dos de esas cuatro
secciones no existen todavía, y el pedido era acomodar el navbar, no sumar
navegación.

---

### El repaso de F3.1, y las cuatro cosas que dejó decididas (2026-09-08)

La pregunta era qué le había cambiado a la tarjeta el rediseño de F3.8. La
respuesta corta: el precio, y nada más. Las otras tres cosas que se miraron
quedaron confirmadas o terminadas de decidir, y las cuatro están ahora en las
especificaciones — que es donde faltaban, porque **la tarjeta implementada y
`FUNCTIONAL-SPEC.md` se estaban contradiciendo desde F3.8 y nadie lo había
anotado**.

**1. El precio: dos números, y ahora también en la ficha.** La tarjeta dejó de
mostrar «Ahorrás $ X» en la tercera pasada de F3.8, pero RF-02 seguía pidiendo
«el precio original tachado **y el ahorro en pesos**». Un criterio de
aceptación que el código incumplía sin que ninguno de los dos estuviera mal a
propósito. Se resolvió por decisión tuya y hacia el lado más simple: la regla
sube de la tarjeta a la tienda entera y se escribe como **RN-04c** —dos
números, nunca tres, en tarjeta, ficha, carrito y orden—. Es la única de las
cuatro que tocó código:

- `components/shop/precio.tsx` — la composición de ficha pierde el renglón
  «Ahorrás». Las dos variantes siguen existiendo porque siguen siendo dos
  disposiciones distintas —una línea en la grilla, apilado a 24px en la
  ficha—, pero ya no se diferencian en **qué** dicen.
- `components/admin/productos/formulario.tsx` — la vista previa del panel
  también lo pierde, y **no** porque RN-04c alcance al panel: esa vista dice
  literalmente «Se muestra», así que mostrar algo que el comprador no ve la
  volvía mentirosa. Además repetía el descuento que Ana acaba de tipear tres
  campos más arriba. Con eso, `Vista.ahorro` quedó sin usar y se fue.

**2. Sin stock sigue siendo clicable.** Confirmado, y ya era así: es RN-05, y
la tarjeta lo cumple desde F3.1. No hubo cambio.

**3. La ficha sin stock ahora tiene estado propio, y no lo tenía.** RF-03 decía
que las acciones de compra quedan deshabilitadas «y se ofrece Consultar por
WhatsApp», y DR §7.3 no dibujaba el caso en ninguna parte. Ahora está entero,
con tres decisiones que no estaban tomadas: **lo dice con palabras** y no con
un botón apagado —un botón gris sin explicación se lee como una falla del
sitio—; **«Preguntá si va a haber» pasa a ser el botón principal**, porque es
la única acción que le queda a quien llegó hasta ahí; y la pantalla **aclara
que nadie va a avisar**, porque el botón suena a que el sitio agenda un aviso y
no hay ninguno — la respuesta la da la vendedora por WhatsApp. Eso convierte
a F3.6 en **dos mensajes y no uno**: el de consulta no lleva cantidad ni
precio.

**4. Favoritos es F5.4, y ahora tiene el aspecto decidido de antemano.** La
tarea existía y estaba bien ubicada —«Desde tarjeta y ficha»—, así que no se
creó nada nuevo; lo que faltaba era el contrato visual, que hasta hoy vivía en
una sola línea de §6.1. Quedó escrito en §6.1, §7.3, RF-10 y en el propio
`accionFavorito` de la tarjeta: **siempre a la vista** en las dos pantallas
—al revelarlo con el hover, en un teléfono no existe—, contorno sin marcar y
**relleno `--brand`** marcado, 44px de área táctil, y el estado anunciado
además del relleno.

Sobre el color, que era la pregunta abierta: **el corazón se rellena con el
burdeos de la marca y no con un rosa nuevo.** §1.2 decidió **un solo color
saturado** en todo el sistema y el canvas de F3.8 lo confirmó; meter el segundo
por un ícono de 20px es la clase de excepción que después justifica la
siguiente. El burdeos ya es el color de lo accionable y de lo elegido —el
anillo del selector de color, el precio en oferta—, y relleno sobre blanco lee
exactamente como se espera que lea un corazón marcado. **El corazón sigue
disponible sin stock**: marcar algo agotado es precisamente para qué sirven los
favoritos.

**Lo que esto no hace.** No dibuja el corazón: sigue siendo el hueco
`accionFavorito`, y lo llena F5.4. Un corazón que no guarda nada es peor que
ningún corazón.

---

### La ficha, y lo que encontró al existir (F3.5 y F3.6)

**Las dos tareas se hicieron juntas, y es una decisión tuya.** F3.6 es tamaño S
y es la única acción que la ficha puede tener hoy —el carrito es F5.5—, así que
por separado salía una pantalla que no se podía terminar de probar: sin el
`wa.me`, el estado sin stock que acabábamos de especificar no tiene con qué
comprobarse.

**«Agregá al carrito» se dibuja deshabilitado, y también es decisión tuya.** La
alternativa era no dibujarlo hasta F5.5. Llevaba abajo el renglón que §8 pide
para todo estado deshabilitado —«el carrito todavía no está disponible»—, y **el
2026-09-08 lo sacaste**: en la pantalla ocupaba más que la falta que explicaba.
El motivo quedó para lectores de pantalla, y es una excepción anotada a §8, no
un olvido. Cuando llegue el carrito, ese botón se enciende y WhatsApp baja a
secundario, que es donde §7.3 lo pone.

**Cómo se armó, en una línea cada cosa.** La consulta es **una sola** con las
variantes y sus imágenes adentro: separadas serían tres viajes encadenados
—hasta no tener el producto no hay variantes, hasta no tener variantes no hay
imágenes— y la ficha no puede pintar nada sin las tres. Va envuelta en `cache()`
de React porque la página y `generateMetadata` piden lo mismo. Lo que cambia con
el color vive en **una** isla de cliente y lo que no —nombre, marca, precio,
información de envío— se pinta en el servidor y le entra como nodo: es la misma
decisión que `accionFavorito` en la tarjeta, y acá el precio la justifica solo,
porque formatearlo en el navegador significaría mandarle `decimal.js` entero
para poner un punto de miles.

**La descripción se pinta como elementos de React, nunca como HTML.** Era la
pantalla que habría necesitado un `dangerouslySetInnerHTML`, y no lo tiene: el
árbol de Markdown ya filtrado se recorre y cada nodo se convierte en su
etiqueta. Un `<script>` guardado en la base no tiene por dónde llegar a ser un
`<script>` en la página, y no porque se lo escape bien sino porque nunca se lo
trata como marcado. Es además la **segunda** pasada del filtro que pide §16.

**Seis cosas salieron de las skills de diseño, y cuatro no se veían leyendo el
código:**

1. **El botón «Ampliar» flotaba fuera de la foto.** La columna de la derecha es
   más alta y estiraba a la galería; el botón, que se posiciona con `inset-0`,
   cubría el alto estirado y su ícono caía 40px por debajo de la imagen, sobre
   el fondo. Se arregla con `self-start`.
2. **Las miniaturas estaban del lado equivocado.** §6.8 pone la foto a la
   izquierda; había quedado `flex-row-reverse`.
3. **El anillo del color elegido se destiñe con el 40% de «agotado».** La
   opacidad estaba sobre la muestra entera en vez de sobre el relleno, así que
   un producto agotado en su único color se veía **sin marcar** — que es el caso
   más común, no un borde.
4. **`pt-8` en un `<fieldset>` no separa nada.** El `<legend>` se pinta sobre el
   borde del `fieldset` e **ignora su relleno**: la separación real entre el
   precio y el «Color:» era **cero**, y el rótulo se leía como una aclaración
   del precio. Se midió con el inspector, no se estimó. Con margen sí funciona.
5. **Dos áreas táctiles por debajo del mínimo de §9.** Las muestras de color
   median 32px y las flechas de cantidad 36. Ahora las dos llegan a 44 sin
   cambiar de tamaño a la vista: la muestra conserva sus 32px de §6.5 y el
   relleno del `label` pone el resto.
6. **«Sin stock» estaba reimplementado.** §6.4 ya tiene la etiqueta de estado
   —píldora de tinte, color semántico, siempre con texto— y la ficha la estaba
   dibujando de nuevo con un punto y un renglón. Es el `Badge` que ya existe.

Dos más que no fueron de las skills sino de mirar la pantalla: el
desplazamiento de la galería usaba `behavior: "smooth"` **por JavaScript**, y la
regla global de `prefers-reduced-motion` apaga `scroll-behavior`, que es la
propiedad de CSS y no ese parámetro; y las miniaturas no llevaban borde, así que
la foto blanca de un periférico sobre superficie blanca desaparecía —el mismo
motivo por el que las muestras de color lo llevan desde §6.5—.

**Lo que la ficha destapó en el catálogo.** La tarjeta elegía su foto de portada
con `ORDER BY i.sort_order, v.id`, y `v.id` es un UUID al azar: la tarjeta podía
mostrar el teclado negro y la ficha abrir en el blanco. No se veía hasta que
existió la ficha, y es de las cosas que nadie reporta como error porque se
siente como que el sitio cambió de producto. Las dos consultas usan ahora el
mismo orden: `sort_order` de la variante y después el nombre del color.

**El seed ahora escribe también el número de WhatsApp**, sin el cual la ficha se
dibuja sin su acción principal. **Los medios de pago se intentaron y se
sacaron**, y el motivo queda escrito porque es la clase de cosa que se vuelve a
intentar: el listado de RF-19 se ordena globalmente y
`tests/unit/settings/pagos.test.ts` mueve sus tres filas contando desde el
principio de la tabla, así que con filas sembradas encima «subir el primero no
cambia nada» sí cambia algo y la batería se pone en rojo. La causa de fondo es
la de siempre —el seed y los tests comparten base— y su arreglo es separarlas,
no acomodar un test.

---

### El repaso de la ficha, y el cambio de RN-10 que arrastró (2026-09-08)

Diecisiete pedidos tuyos en un solo mensaje. Salvo tres, todos entraron tal
cual; los tres tienen nombre y motivo más abajo.

**El más grande no era de la ficha: era de la regla de envíos.** RN-10 decía
«los envíos se realizan por PedidosYa» y lo exigía en cuatro pantallas —pie,
ficha, carrito y checkout—. Al pedir que la ficha hablara de Viedma y Carmen de
Patagones, la tienda quedaba contándose dos historias: la ficha decía «te lo
llevo a Viedma» y el pie seguía diciendo «enviamos por PedidosYa». Ahora **RN-10
nombra la zona y no la empresa** —la mensajería puede cambiar; hasta dónde
llegamos es lo que decide si alguien puede comprar acá— y suma el **retiro en el
punto de entrega**. Los cinco lugares del código que la nombraban ya no lo
hacen.

**El checkout se tocó de más y se corrigió el mismo día.** Yo había dicho que
lo dejaba anotado y no lo tocaba, y después edité RF-11 y F6.1 igual —y encima
con dos opciones, que no era lo que querías—. Corregido con lo que dijiste:
**tres opciones —envío, retiro o coordinar con la vendedora— y sólo el envío
pide dirección**, que se pide para coordinar el envío y no para calcularlo. Es
un cambio de RF-11, no de RN-10: la regla sigue describiendo dos formas de
recibir, y «coordinar» no es una tercera forma sino no elegir todavía. **No
está construido**: F6 no empezó.

**La galería.** Las miniaturas se mudaron a la izquierda y **se dibujan siempre,
aunque haya una sola foto**: es el arreglo del salto que reportaste. Ocupan una
columna, así que esconderlas cuando hay una sola corría la foto principal de
lugar al cambiar de color, y eso no se lee como «este color tiene menos fotos»,
se lee como que la página se movió sola. La foto perdió sus 16px de relleno
blanco y ahora la recorta el radio de la tarjeta; aparecieron las flechas, que
se apagan en las puntas en vez de dar la vuelta —con encastre de
desplazamiento, saltar de la última a la primera arrastra la pista entera y se
ve como un error—.

**El visor.** Se fue el botón de ampliar y quedó el cursor de lupa: un ícono de
36px en una esquina le pide a alguien que descubra un control para hacer lo que
ya intentó, que es tocar la foto. Adentro hay **dos niveles** —encuadrada y a
tamaño real, recorrible con el mouse— y entre los dos hay una transición y no un
salto: la foto está siempre puesta a su tamaño natural y es `transform` quien la
encoge o la corre, así que el navegador interpola entre las dos formas. Cambiar
`width` habría dado exactamente el salto que estábamos sacando, y escalar una
imagen ya encuadrada la habría dejado borrosa justo cuando se la quiere mirar de
cerca. Se entra **centrado en el punto donde se hizo clic**, y si la foto ya
entra a 1:1 no hay segundo nivel y el cursor no lo promete.

**Es el único `<img>` del proyecto**, y está justificado en TS §9.3: el zoom es
«el tamaño real del archivo» y `next/image` devuelve el ancho que elige el
optimizador. Sin ese ancho conocido no hay con qué calcular la escala.

**La columna derecha.** La descripción se mudó de abajo de todo a al lado del
precio —abajo llega quien ya decidió; al lado del botón llega quien está
decidiendo—, se llama **«Sobre el producto»** en vez de «Descripción» —el
rótulo viejo nombraba el campo de la base—, y **la galería quedó pegada**
mientras esa columna desplaza: leer «switches lineales» sin el teclado a la
vista es leer sobre un producto abstracto. La alternativa que también leía tu
pedido —una barra de desplazamiento propia adentro de la columna— se descartó:
rompe el desplazamiento en el teléfono y deja sin lugar a los recomendados, que
vos mismo querés al final de la página y no al final de una cajita.

**Los medios de pago dejaron de dibujarse y pasaron a nombrarse.** Era una tira
de logos, y en la pantalla de venta una tira de logos se lee como «pagá acá» —y
acá no se paga (RN-01, RN-08)—. Los nombres siguen saliendo de lo que carga Ana
(RF-19), así que agregar un medio sigue siendo cargar una fila. Los logos
quedan en el pie y en la home, donde son señal de confianza y no promesa de un
botón. **No se puso el enlace a «qué medios aceptamos» que mencionaste**: sería
el sexto enlace de la tienda apuntando a un `/legales/` que todavía no existe.

**Guardar y Compartir.** El corazón salió de arriba de la imagen en la ficha y
se quedó en la tarjeta, que es lo que pediste: en una grilla el ícono solo es lo
único que entra, y en la ficha hay lugar para la palabra. **Compartir funciona
hoy** —hoja nativa del sistema, y portapapeles si no hay— porque no necesita
servidor; Guardar espera a F5.4. Y **el fallo de compartir se dice en
pantalla**: el portapapeles necesita contexto seguro, y `next.config.ts` habilita
a propósito abrir la tienda por IP de la LAN para probarla desde el teléfono —
ahí `navigator.clipboard` no existe—. Un botón que se aprieta y no hace nada
parece un sitio colgado.

**Lo que no se pudo verificar en el navegador.** El desplazamiento de la galería
usa `behavior: "smooth"`, y el navegador de esta máquina **no está entregando
cuadros** —`requestAnimationFrame` no dispara nunca, que es la misma causa por
la que falla el cambio de tamaño de ventana y por la que el portapapeles
contesta «el documento no tiene foco»—. Lo comprobado es que la instrucción sale
bien: al tocar la segunda miniatura se llama `scrollTo({left: 555})` sobre la
pista correcta. Que la pista se mueva es trabajo del navegador, y hace falta uno
que pinte para verlo.

---

### Los filtros terminados (F3.4, 2026-09-08)

RF-02 pedía tres filtros multiselección y un rango de precio desde el
principio. Estaban los tres, de a uno, y el precio no estaba. Ahora están.

**Multiselección: se suman dentro del grupo, se cruzan entre grupos.**
«(Teclados o Mouses) y Logitech». La otra combinación —cruzar dentro del
grupo— no es una alternativa que se descartó por gusto: da cero resultados
siempre, porque ningún producto es de dos categorías a la vez.

**Van repetidos en la dirección**, `?marca=a&marca=b`, y no separados por
comas. Es la forma que entienden `URLSearchParams.getAll`, un formulario con
varios campos del mismo nombre y el `searchParams` de Next, los tres sin una
línea de código de por medio.

**El rango de precio es el único control de verdad de todo el panel, y es un
formulario `GET`.** El resto son enlaces porque el valor sale de una lista
cerrada; acá no existe la dirección a la que ir hasta que alguien escribe el
número. Sigue funcionando sin JavaScript, sigue dejando el atrás en su lugar y
sigue siendo compartible, que era todo lo que los enlaces daban. Los demás
filtros viajan como campos ocultos: sin eso, poner un precio borraría la marca
elegida, que es la trampa clásica del formulario adentro de un panel de
filtros. **Mira el precio final y no el de lista**: quien pone «hasta 20.000»
dice cuánto quiere pagar, no cuánto salía antes de la oferta.

Queda una fea a propósito: un campo vacío se envía igual —así funcionan los
formularios—, así que poner sólo el mínimo deja `&precioMax=` colgando en la
dirección. No filtra de más ni de menos, y el próximo clic en cualquier chip
reescribe la URL limpia. Sacarlo pedía una isla de cliente y no la vale.

**Dos cosas que aparecieron escribiendo los tests.** La primera: `formatMoney`
—que pinta el chip del precio— tira una excepción con más de diez dígitos
enteros, porque la columna es `numeric(12,2)`. Mi tope inicial dejaba pasar
dieciséis, así que `?precioMax=99999999999` habría roto la página en vez de no
filtrar nada; ahora el tope de la lectura es el de la columna. La segunda: hay
**tope de veinte valores por filtro**, y no es una limitación de producto —
nadie elige veinte marcas a mano— sino que `?marca=` repetido quinientas veces
arma un `IN` de quinientos elementos con una sola pegada de texto.

**34 tests nuevos sobre un módulo que no tenía ninguno.** Veintiuno puros
sobre leer y escribir la dirección —ida y vuelta sin perder ni inventar nada,
la basura descartada antes de llegar a Postgres, el rango al revés dado vuelta
en vez de tirado— y trece contra Postgres de verdad sobre la consulta, que es
donde vive la diferencia entre sumar y cruzar. Cada caso compara además el
total con la cantidad de filas: son dos consultas distintas con el mismo
`WHERE`, y es exactamente donde se despegan.

---

### La auditoría del catálogo (2026-09-08)

`DESIGN-REFERENCE.md` §12.4 exige `impeccable` y `ui-ux-pro-max` para cerrar
una pantalla, y el catálogo nunca las había pasado. Salieron **nueve cosas,
todas de accesibilidad, todas medidas en el navegador y ninguna visible**: lo
que se arregló fue el blanco al que hay que apuntar y el contraste, no el
dibujo.

**Siete controles por debajo del mínimo táctil de §9** —44×44 en móvil—: los
chips del panel median 38px, los campos de precio y el botón «Aplicar» 40, la
casilla del descuento y «Limpiar filtros» 32, los chips aplicados 30 y
«Limpiar todo» 27. Se arreglaron **estirando el área y no el dibujo**:
agrandar la píldora habría cambiado la composición aprobada en F3.8, y lo que
está chico no es el chip sino el blanco. Los campos sí crecieron a 44, que es
altura de campo y no de píldora.

Hay un detalle que se mide y no se ve: **lo que sobresale tiene que caber en
la separación entre filas**. Los chips del panel sobresalen 3px por lado y su
lista tiene 8px de separación, así que entran. Los chips aplicados sobresalen
7 y tenían los mismos 8: dos filas se habrían pisado el blanco, y tocar el de
abajo habría activado el de arriba. Su separación vertical pasó a 16px.

**Dos textos por debajo del contraste que pide la propia §3.1.** El número de
productos de cada chip está en `--ink-tertiary` a 12px, y §3.1 dice —textual—
que ese token es «solo texto ≥ 24px o elementos decorativos»: 3,37:1 medido,
contra los 4,5 que pide §9. No es decoración, es el dato que decide si vale la
pena tocar el chip. Lo mismo el signo `$` de los campos de precio, que había
puesto yo ese mismo día. Los dos pasaron a `--ink-secondary`: 5,06:1.

**El conteo de resultados se anunciaba a medias.** Era `aria-live="polite"` sin
`aria-atomic`, así que un lector puede leer solo el nodo que cambió —«9»— en
vez de «9 productos». Un número suelto no dice qué cambió. Ahora es
`role="status"` con `aria-atomic`.

**El formulario del precio no tenía nombre accesible**: el «PRECIO» era un
`h3` que vivía afuera. Se ató con `aria-labelledby` en vez de convertirlo en
`fieldset` con `legend`, que sería el marcado más correcto para agrupar dos
campos pero dejaría a este grupo fuera del recorrido por encabezados mientras
los otros tres son `h3`.

**Lo que la auditoría no pudo hacer** —y se destrabó horas después. El
detector de `impeccable` sabe abrir una URL con el ancho que se le pida
—`--viewport 390x844`— pero necesita `puppeteer`, que no estaba instalado, y
era la tercera vez que la misma falta frenaba lo mismo. Se resolvió con
**Playwright**, que ya estaba elegido en TS §2.1 y da las mismas medidas sin
un segundo navegador sin cabeza. Lo que salió de ahí está más abajo.

**Lo que quedó afuera a propósito.** El botón del buscador mide 40px y el logo
del encabezado 32: están en la misma pantalla y son de F1.13 y F3.8, no de
F3.4. Se anotan y no se tocan. *(Arreglados el 2026-09-08 en la pasada de
móvil, junto con los del pie y los de la ficha.)*

---

### El teléfono deja de ser una suposición (2026-09-08)

Hasta hoy la tienda **nunca se había visto en un teléfono**. Ni pantalla
completa, ni modo dispositivo, ni nada que midiera: cada decisión de móvil se
tomó de memoria y cada auditoría terminó con la misma frase, «falta la revisión
móvil». Se instaló **Playwright** —sólo Chromium— y se abrieron el catálogo y la
ficha a 390×844 con `isMobile` y `hasTouch`.

**Lo bueno primero, porque también es un resultado**: no hay desborde
horizontal en ninguna de las tres pantallas, no hay errores de consola, las
muestras de color de la ficha miden **exactamente 44×44**, y el panel de
filtros se lee bien —los chips entran de a tres y los grupos se distinguen—.
Nada de eso estaba comprobado antes de hoy.

**Los campos ampliaban la pantalla del iPhone.** Es el hallazgo que no se ve
mirando: iOS Safari agranda la página entera al enfocar un campo con menos de
16px y **no la devuelve al salir**. El comprador escribe una palabra en el
buscador y se queda con la tienda ampliada y corrida, sin entender qué hizo.
Estaban en 14px el buscador del encabezado, los dos campos del rango de precio
de F3.4 y el selector de «Ordenar por», que también lo dispara al abrirse.
Pasan a 16px **sólo en teléfono**; en escritorio siguen los 14px del sistema.

**Nueve controles más por debajo de los 44px de §9**, ahora medidos en el
aparato y no estimados: el logo 32×32 y la píldora del carrito 40 de alto en el
encabezado; los cuatro enlaces legales del pie, 17; «Guardar», «Compartir» y
«Garantías y devoluciones» de la ficha, 40; las dos migas de pan, 17; y el
botón de enviar del buscador de página, 40×40.

Se arreglan de las tres maneras que corresponden, y la elección de cuál no es
de estilo:

- **Estirando el área y no el dibujo**, con el `::after` que ya usaba la barra
  de filtros, donde el tamaño está fijado por otra regla: el isotipo, porque
  §2.3 fija sus 32px, y las migas, porque son texto. El pseudo-elemento subió
  a `lib/utils.ts` —`AREA_TACTIL` y `AREA_TACTIL_CUADRADA`— la tercera vez que
  hizo falta.
- **Dándole altura de verdad a la fila** en el pie. Ahí el `::after` no sirve:
  con 8px entre filas, lo que sobresale de una se mete en la de al lado y el
  dedo activa el enlace equivocado. El pie crece 84px en teléfono y queda igual
  en escritorio.
- **En la variante y no en la llamada** para el botón `md`, que son 40px y es
  el tamaño por defecto. Arreglar las tres llamadas de la ficha dejaba el mismo
  defecto en el carrito, el checkout y todo lo que venga.

**§9 dice «44×44px en móvil», y se respeta al pie de la letra**: todo va con
`max-md:`. En escritorio no se movió un píxel, y está comprobado midiendo
—logo 137×32, carrito 63×40, encabezado 56, enlace del pie 20, pie 335px, los
mismos números que antes—. Las zonas invisibles sí se verificaron a mano: el
dedo agarra el logo 5px por fuera del dibujo en las cuatro direcciones, y las
migas 12px arriba y abajo.

**Lo que no se tocó** está en «Pendiente detectado»: el panel de filtros se
corta en el teléfono y arreglarlo cambia §7.2, que está aprobada.

---

### Lo que F3 encontró, y no se veía leyendo el código

**Los tests le comen el stock al catálogo sembrado.** `.env.test` y `.env.local`
tienen hoy el **mismo** `DATABASE_URL` —`127.0.0.1:54322`—, así que `npm test`
reserva, vende y devuelve sobre la misma base donde está el catálogo de
demostración: después de correrlo, la tienda entera se ve «Sin stock». Explica
también por qué los tests de stock se ven inestables y fallan distinto en cada
corrida. Se arregla con `npm run seed`, pero eso es un parche, y está abajo en
lo pendiente. **La guarda de F4.0 no protege de esto**: fue escrita para que
los tests nunca toquen producción, y lo cumple; que compartan base con el
desarrollo local es otro problema y no lo mira.

**`rounded-panel` no existía.** Los enlaces de filtro lo usaban y no está
definido en `globals.css` —están `panel-card`, `panel-image` y `panel-control`—,
así que Tailwind no emitía nada y salían con las esquinas rectas. Se fue con el
archivo reescrito en la segunda pasada. Es la misma clase de error que el
`admin:px-3` de F2.5: **una clase que no existe no falla, no se ve**.

**Había dos `<main>` anidados.** El layout de la tienda abre uno y el catálogo
abría otro adentro. Es HTML inválido, y en la práctica significa que «saltar al
contenido principal» tiene dos destinos. Ahora es un `<section>` con nombre.

**El buscador borraba los filtros.** `SearchBox` empujaba siempre a
`/productos?q=…`, así que buscar «teclado» con una marca puesta la tiraba
mientras el chip seguía en pantalla — diciendo que el filtro estaba aplicado
cuando ya no lo estaba. Toma una bandera `conservarFiltros` y relee la URL.
Bandera y no una función que arme la dirección: es un componente de cliente
usado desde uno de servidor, y una función no cruza ese borde.

**La regla que esconde el buscador del encabezado no puede ir en `@layer`.**
Dentro de `@layer base` perdía contra el `md:block` del propio buscador, porque
Tailwind emite las utilidades en una capa posterior y **la última capa gana sin
importar la especificidad**. Una regla sin capa gana sobre cualquiera que esté
en una, así que se evita el `!important`. Se resuelve además con
`body:has(…)` y no con estado de React: con estado, el encabezado se pinta con
su buscador y recién en el efecto se entera de que sobra, así que aparecería un
cuadro y se iría.

---

## F4 — Núcleo de stock y órdenes

**Producción está al día con el código desde el 2026-09-07.** Las cuatro
migraciones que faltaban —`0007` a `0010`— se aplicaron contra el servidor DATA
por el túnel SSH. No se borró ni se recreó nada, y no hacía falta: el
inventario previo mostró las 21 tablas en cero salvo `user_profiles` con una
fila, y el bucket sin archivos. Se comprobó el **efecto** de cada una, no el
registro de Drizzle —los dos `DEFAULT` en `clock_timestamp()`, la columna
`idempotency_key` con su índice único parcial, y `confdeltype = 'r'` en la FK
de `orders.user_id`—, y después `db:verificar` completo: **24 comprobaciones en
verde** contra producción.

**Se adelanta a F3 por decisión tuya del 2026-09-06.** El mapa de fases de
`DEVELOPMENT-PLAN.md` §3 ya lo permitía —«F4 puede adelantarse: no depende de
F2 ni F3»— y el motivo para usar ese permiso ahora es que F3 necesita el
catálogo real (F2.8) y F4 no necesita nada de nadie.

**Dónde corren estos tests, y por qué importa.** Contra el **stack local**
(`npm run dev:stack`, puerto 54322), nunca contra producción: reservan, venden
y devuelven stock, y `.env.local` apunta al servidor DATA desde el 2026-09-05.
No queda librado a acordarse — `tests/setup/entorno.ts` lee `.env.test`
**pisando** lo que haya en el entorno y aborta si la base no es la del stack
local, **sin escape por variable de entorno**, que es la diferencia con
`soloLocal()`: un script de verificación contra producción tiene un caso
legítimo algún día, una batería que crea órdenes y las cancela no tiene
ninguno.

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F4.0 | Vitest andando, con `npm test` | ✅ | No es una tarea del plan: es la deuda de los once `db:xxx` venciendo donde estaba anotado que vencía. Vitest 5.0.0, `tests/unit/**/*.test.ts`, un archivo por vez —comparten base, y dos a la vez se pisan los datos—. La guarda se probó de los dos lados: verde contra el stack local, y abortando con el mensaje correcto cuando la URL apunta al **5433**, que es el puerto del túnel SSH a producción |
| F4.0b | Migrar los diez `db:xxx` a Vitest | ✅ | Tampoco es del plan: es la otra mitad de la deuda de F4.0, que quedaba agendada **para después de la Compuerta F4** y venció el 2026-09-07. Los diez pasaron a `tests/unit/`, **314 tests** el día que se cerró —eran 92— sin perder una sola comprobación, y los scripts se borraron: ya no conviven las dos formas. `db:verificar` se queda —§18.3, y su lugar es correr contra producción— y **`db:drizzle` también, reclasificado**: no era una batería de verificación sino una SONDA, como `sondear-auth` y `sondear-resend`. Es lo de abajo, y casi se pierde en silencio |
| F4.1 | Operaciones de stock con `UPDATE` condicional atómico | ✅ | Reservar, liberar, vender, reponer y ajustar, en `modules/stock/operaciones.ts`, cada una con su asiento en la misma transacción. **24 tests en verde** contra Postgres de verdad. El ABM de variantes de F2.4 pasó a usar `ajustar()`: el libro mayor tiene un solo autor. La migración `0007` **quedó aplicada en producción el 2026-09-07** |
| F4.2 | Máquina de estados de la orden | ✅ | `modules/orders/estados.ts`. La transición es un `UPDATE` condicional con el estado esperado en el `WHERE` y **va antes de tocar el stock**: es lo que decide quién gana. Finalizar vende y suelta la reserva; cancelar sólo suelta. Cada una escribe en el historial en la misma transacción. La tabla de RF-13 se exporta como dato (`TRANSICIONES`) para que la vista no repita la regla. **16 tests**, incluidos dos de concurrencia con solapamiento forzado |
| F4.3 | Creación de orden con snapshot e idempotencia | ✅ | `modules/orders/crear.ts`, el procedimiento de §8.4 completo: carrito bloqueado, revalidación contra lo que el comprador vio, snapshot de comprador, dirección e ítems, reserva en orden determinístico, total sumado en SQL, historial y carrito vaciado. **18 tests**, entre ellos dos compradores solapados sobre la última unidad. La migración `0008` **quedó aplicada en producción el 2026-09-07** |
| F4.4 | Edición de orden activa | ✅ | `modules/orders/editar.ts`: quitar un ítem y reducir cantidades, liberando la reserva **de inmediato** y recalculando el total en SQL. La orden se bloquea con `FOR UPDATE` antes de mirarle el estado, y eso no es de más: sin el bloqueo, entre leer «está activa» y liberar, otra transacción la finaliza. Quitar el último cancela, pero **hay que pedirlo**: si no, la función se niega y avisa que eso es lo que va a pasar. **11 tests**. La migración `0009` **quedó aplicada en producción el 2026-09-07** |
| F4.5 | Devoluciones con y sin reposición | ✅ | `modules/returns/registrar.ts`. Con reposición suma al stock, sin reposición no toca nada y queda registrada igual para RF-28. El tope de RF-25 —ni más de lo vendido ni de lo ya devuelto— se calcula con la orden **bloqueada**: dos devoluciones simultáneas sobre el mismo renglón leerían la misma suma y entre las dos devolverían de más. Anular revierte lo repuesto y libera el cupo. **15 tests** |
| F4.5b | Los usuarios no se eliminan | ✅ | No es del plan: es la contradicción de §5.6 que F4.3 destapó, resuelta por decisión tuya. `orders.user_id` pasa de `SET NULL` a **`RESTRICT`** (migración `0010`), que es lo que RF-26 venía diciendo sin decirlo. Un usuario **sin** órdenes se sigue borrando, porque de eso depende la compensación de §13.4. **3 tests** |
| F4.6 | Tests unitarios contra Postgres real | ✅ | **92 tests** en total, todos contra Postgres de verdad. Los de cada tarea viven con la tarea; acá quedan los dos que son de toda la fase: la carrera por la última unidad y el cuadre del libro |

## Compuerta F4 — **pasa**

> «Dos confirmaciones simultáneas sobre la última unidad producen **una orden y
> un `INSUFFICIENT_STOCK`**, nunca dos órdenes. Sin esto verificado, no se
> avanza.»

Verificada el 2026-09-06, en los dos niveles y con el solapamiento forzado, no
con un `Promise.all` que puede no solaparse: en `reservar()` directo
(`tests/unit/stock/compuerta.test.ts`) y de punta a punta desde el checkout,
con dos compradores distintos peleando la misma unidad
(`tests/unit/orders/crear.test.ts`). Y al revés: quitándole la condición al
`UPDATE` de la reserva se ponen en rojo **siete** tests, la compuerta entre
ellos. Un test que no falla cuando el código está roto no prueba nada.

**El libro mayor cuadra**, con dos comprobaciones que se complementan:
`stock_total = SUM(quantity)` sobre `ajuste`, `venta` y `devolucion` —si no da,
algún asiento tiene el signo o la cantidad mal—, y que el **último** asiento
diga el estado actual, que es la que detecta un cambio hecho **sin** asentar.
Esa segunda tiene su propio test que la rompe a propósito, moviéndole el
contador por afuera del módulo.

---

**Un `Promise.all` no prueba una condición de carrera** (F4.2). Lanzar dos
transacciones a la vez no garantiza que se solapen: el planificador puede
correr la primera entera —COMMIT incluido— antes de que la segunda abra su
conexión. El test da verde y no probó nada, que es la peor clase de test que
puede haber justo acá. `tests/apoyo/concurrencia.ts` fuerza el solapamiento:
la primera hace su trabajo y **se queda abierta**, la segunda arranca y se
traba esperando el bloqueo de la fila, y recién ahí la primera commitea. Ese
despertar de la segunda —cuando vuelve a evaluar su `WHERE` contra la fila ya
cambiada— es el instante que decide si el sistema vende dos veces la última
unidad. Es el andamiaje que va a usar la Compuerta F4.

Y los tests se comprobaron al revés, que es la otra mitad: sacándole la
condición `AND status = 'activa'` al `UPDATE` se ponen en rojo cinco, los dos
de concurrencia entre ellos. Un test que no falla cuando el código está roto
no está probando lo que dice.

**La anulación de una devolución no estaba en §8.1** (F4.5). Esa tabla lista
las operaciones directas, y RF-25 pide aparte que «una devolución registrada no
se edita: se anula, revirtiendo el efecto en stock». Sin inversa esa frase no
se puede cumplir. `revertirReposicion()` escribe el **mismo tipo** de asiento
que la reposición con el signo dado vuelta, para que el invariante del libro
siga cerrando: un tipo nuevo la sacaría de la suma. Agregada a §8.1.

**El historial de la orden se ensanchó, y queda dicho** (F4.4). RF-22 pide que
la edición «quede registrada en el historial de la orden» y el único historial
que existe es `order_status_history`. Una edición no es un cambio de estado,
así que se escribe como `activa → activa` con el motivo contando qué pasó. La
alternativa era una segunda tabla, y entonces la pantalla de la orden tendría
que unir dos líneas de tiempo para mostrar una. De paso se le aplicó a esa
tabla el mismo `clock_timestamp()` del libro mayor (migración `0009`): con una
transición por transacción todavía no molestaba, pero quitar dos ítems de una
es una sola transacción con dos filas.

**La columna de la idempotencia no existía** (F4.3). §8.5 decía «la clave se
guarda en `orders` con un índice único» y §5.6 nunca la declaró: la
especificación daba por existente algo que el modelo de datos no tenía.
Migración `0008`, y escrita primero en §5.6. Vale anotar por qué el índice es
la pieza que decide y no la consulta previa: dos peticiones con la misma clave
que llegan a la vez consultan las dos, no encuentran nada las dos e insertan
las dos. Es la misma carrera que el stock. Quien resuelve es el índice único, y
la que pierde tiene que **releer** la orden ganadora **fuera** de su
transacción, porque una transacción abortada no puede consultar — de ahí que
`crearOrdenDesdeCarrito()` abra su propia transacción en vez de recibir una,
al revés que todo el resto del módulo.

**Lo que F4.1 encontró, y no se veía leyendo el código.**

**El libro mayor no tenía orden dentro de una transacción.** `created_at` era
`DEFAULT now()`, y `now()` devuelve el momento en que **arrancó** la
transacción: no se mueve hasta que termina. Cuatro movimientos escritos en la
misma transacción quedaban con el timestamp **idéntico**, y el índice
`(variant_id, created_at DESC)` que pide §5.8 los devolvía en un orden
cualquiera — en la tabla que existe justamente para reconstruir qué pasó y en
qué orden. Lo encontró un test que asentaba reserva, liberación, venta y
devolución seguidas y las leía de vuelta cambiadas de lugar. Corregido a
`clock_timestamp()` en la migración **`0007_libro_con_orden`**, y escrito
primero en `TECHNICAL-SPEC.md` §5.8. Hoy pasa en la práctica pocas veces —casi
siempre hay un solo movimiento por variante por transacción— y ese «casi» es
exactamente lo que esconde el problema hasta el día que importa.

**El ABM de variantes decidía contra un número viejo.** `editarUnaVariante`
leía el stock reservado **fuera** de la transacción y recién después
actualizaba: entre esas dos cosas otra orden podía reservar unidades, y el
aviso «no puede bajar de N» se decidía contra un N que ya no era. Cuando eso
pasaba, quien rechazaba era el CHECK `reserved_within_total`, con un error de
integridad que sale como INTERNAL y llega a Sentry como si fuera un incidente,
en vez de la frase que explica qué pasa. Se cerró al pasar el ABM a
`ajustar()`, que bloquea la fila.

**El signo de `quantity` estaba sin decidir.** §5.8 decía «con signo, según el
efecto» y hay **dos** contadores. Se fijó y se escribió en la especificación:
cada movimiento firma el contador que mueve. De ahí sale el invariante que la
Compuerta F4 va a verificar.

**Lo que F4.1 NO cubre, y hay que saberlo.** Las dos Server Actions del ABM que
ahora llaman a `ajustar()` no tienen test automático: `db:variantes` sólo
prueba su esquema Zod, y el envoltorio de `lib/action.ts` pide sesión y
`revalidatePath`, que fuera de una petición de Next no existen. Montar eso es
infraestructura de pruebas para Server Actions, y cae en F7. Lo que sí se probó
es el patrón nuevo que usan —insertar una variante y ajustarla **en la misma
transacción**, que es donde el `SELECT … FOR UPDATE` tiene que ver una fila que
todavía no commiteó nadie—. El resto es glue tipado; conviene una pasada por el
navegador en la Compuerta F2.

**Tres cosas que cambiaron fuera de la carpeta de tests**, y ninguna es
gratuita, así que quedan escritas:

1. **`@types/node` pasó de `^20` a `^22`.** Vitest 5 no acepta los de 20. No es
   una concesión: `TECHNICAL-SPEC.md` §2.1 dice **Node 22 LTS** y el runtime
   instalado es v22.22.0, así que los tipos venían describiendo un Node que no
   era el que corre — herencia de la plantilla de Next. El typecheck pasa
   limpio con los nuevos.
2. **`allowImportingTsExtensions` en el tsconfig.** La regla que decide si una
   base es el stack local ahora tiene dos consumidores —los scripts y los
   tests— y no puede estar escrita en dos lados; el archivo que la tiene es
   `.mts` y TypeScript exige este permiso para importarlo con la extensión a
   la vista. Con `noEmit` no cambia nada de lo que sale.
3. **`cerrarConexion()` en `db/index.ts`.** No había forma de cerrar el pool:
   los scripts se lo saltean con `process.exit`, que un test no puede hacer.
   Sin esto `vitest run` no termina y hay que matarlo a mano — la fricción
   exacta por la que un día los tests dejan de correrse.

**~~`.env.test` se commitea, y es la única excepción al `.gitignore`.~~**
Escrito en F4.0 con dos argumentos: que la clave del stack local viene fija en
el CLI de Supabase y no es secreta, y que sin el archivo en el repositorio
`npm test` depende de que cada quien lo arme a mano. **Revertido el 2026-09-07
por decisión tuya**: no se suben claves al repositorio, sean o no secretas. Lo
que se commitea es `.env.test.example`, con los valores vacíos, y `.env.test`
entró al `.gitignore`.

El segundo argumento seguía siendo cierto, así que se pagó y quedó anotado: en
un clon nuevo hay **un paso manual** antes de que los tests corran. Lo que se
hizo para que no muerda es que el error lo diga con los dos comandos exactos
—`cp .env.test.example .env.test` y `npx supabase status`— en vez de con un
ENOENT sobre una ruta, que es la diferencia entre un minuto y una tarde.
Comprobado moviendo el archivo: el mensaje sale entero.

---

## Decisiones que cambiaron las especificaciones

Cada una se escribió primero en la especificación y después en el código
(`DEVELOPMENT-PLAN.md` §1.2, regla 1).

| Qué | Dónde quedó | Por qué |
|---|---|---|
| **RF-05 reescrito**: hay que verificar el email *antes* de poder entrar | `FUNCTIONAL-SPEC.md` RF-05, `TECHNICAL-SPEC.md` §13.6 | GoTrue rechaza el ingreso de cualquier identidad sin `email_confirmed_at` mirando la columna, no la configuración. Probado con las dos configuraciones posibles: el requisito original no era implementable |
| **Un bloqueado recibe `user_banned` aunque erre la contraseña** | `TECHNICAL-SPEC.md` §13.5 | Amplía la excepción registrada: no hace falta acertar la contraseña para confirmar que la cuenta existe |
| **Guarda en el CHECK de stock** (`stock_total < 0 OR reserved <= total`) | `TECHNICAL-SPEC.md` §5.4 | Sin la guarda, las dos restricciones juntas implicaban `stock_total >= 0` e imponían en silencio el CHECK que §5.4 decidió no poner, rompiendo RF-24 |
| **Estructura sin `src/`** | `TECHNICAL-SPEC.md` §4 | Decisión tuya sobre el andamiaje |
| **Producción es el entorno de verdad** | `TECHNICAL-SPEC.md` §18.2, `VERSIONS.md` | El stack local es una comodidad de desarrollo. Nada verificado ahí cierra una tarea de F0 |
| **Código de error `INTERNAL`** | `TECHNICAL-SPEC.md` §6.3 | El envoltorio necesitaba un código para lo que no previó |
| **RN-11b**: ningún producto activo puede tener marca, categoría o color inactivos | `FUNCTIONAL-SPEC.md` RN-11b y RF-18, `TECHNICAL-SPEC.md` §5.4 | Las especificaciones no decían qué le pasaba a los productos de una marca desactivada, y la consulta de §10.1 no miraba `b.is_active`. En vez de agregar ese filtro a cada consulta pública —una condición que el día que se olvida muestra de más—, se prohíbe desactivar algo que esté en uso por algo activo |
| **§2.3 corregida al recibir el logo real** | `DESIGN-REFERENCE.md` §2.3 | Describía un cuadrado burdeos con letras blancas, que era el marcador de posición. El logo real es trazo burdeos sobre transparente; se agregó la versión clara obligatoria para fondo oscuro y el piso de 24px |
| **El slug no cambia al renombrar** | `components/admin/catalogo/dialogo.tsx` | Es la dirección pública: si cambiara, todo enlace ya compartido dejaría de funcionar sin aviso |
| **El chip del logo es claro en los dos modos** | `DESIGN-REFERENCE.md` §6.10; token `--logo-chip` en `app/globals.css` | Un logo de marca llega como trazo sobre transparente, casi siempre oscuro, y sobre el panel en modo oscuro **desaparece** — el mismo 1,83:1 de §2.3. El logo de AnaVende se resuelve derivando una versión clara (`derivar-logo.mts`); el de Logitech no es nuestro y no se puede repintar. Así que el chip no depende del modo. Claro y no oscuro porque es el fondo que va a tener en la tienda, que es acromática sobre `--canvas`. Es un token propio, sin redefinición en oscuro, justamente para que se lea la intención |
| **La imagen de categoría queda post-MVP, sexta** | `FUNCTIONAL-SPEC.md` FA-21; `DEVELOPMENT-PLAN.md` §6 | Pedido tuyo: una imagen **chica**, para dar referencia visual en un listado de categorías, no una portada. Por eso no necesita el tamaño `detail` de §9.2 y va en una columna de `categories`, no en una tabla — `variant_images` existe porque un producto tiene hasta cinco y hay que ordenarlas. **La marca no lleva otra imagen**: su logo ya cubre lo que necesita. Lo que hay que resolver el día que se haga no es la subida, que ya existe: es que el listado quede prolijo **con categorías sin imagen mezcladas** |
| **Las columnas de logo guardan la clave, no la URL** | `TECHNICAL-SPEC.md` §5.4, §5.9 y §9.4; migración `0005_logo_key.sql` | `brands.logo_url` y `payment_methods.logo_url` se llamaban así desde antes de que §9.4 decidiera que el código maneja claves. El nombre le pedía a quien las implementara justo lo contrario, y guardar la URL completa deja el logo cargado en local apuntando a `127.0.0.1` una vez en producción: las imágenes dejarían de verse sin que nadie hubiera tocado nada. Se renombraron **con las dos columnas vacías**, que es cuando cuesta un `ALTER` de una línea y no una conversión de datos |
| **El bucket acepta `image/webp` y nada más** | `supabase/config.toml`, `TECHNICAL-SPEC.md` §9.4 | De ese bucket solo sale lo que produjo sharp (§9.0). Restringir el tipo en el bucket es la última barrera si algún día alguien escribe una subida que se saltea la canalización — la clase de error que no se ve al escribirlo y se descubre sirviendo un archivo que no debía existir |
| **La subida es un Route Handler y no una Server Action** | `app/api/admin/upload/route.ts`, `TECHNICAL-SPEC.md` §9.1 | Las Server Actions serializan su entrada: mandarle 8 MB de binario significa pasarlo a base64 y crecerlo un tercio en el camino. Es la única mutación del proyecto fuera del envoltorio de §6.2, así que sus garantías —rol, validación, traducción de errores, Sentry solo para lo inesperado— se repiten a mano ahí, en el mismo orden |
| **La descripción del producto lleva formato, en Markdown** | `FUNCTIONAL-SPEC.md` RF-03 y RF-15; `TECHNICAL-SPEC.md` §5.4, §10.1 y §16; `DESIGN-REFERENCE.md` §6.11 | Decisión tuya: la vendedora tiene que poder poner negrita, cursiva y listas. Se eligió **Markdown y no HTML** porque §16 ya había elegido Markdown sanitizado para las páginas legales — un formato, un sanitizador y un renderizador en todo el proyecto en vez de dos tuberías para el mismo problema. La vendedora nunca ve la sintaxis: el editor es visual. Se dejaron **afuera** imágenes, enlaces, tablas y HTML crudo, cada uno con su motivo escrito en RF-15. Efecto lateral que había que resolver: `%cable hdmi%` no encuentra `Cable **HDMI**`, así que se agrega `description_text`, columna generada como `final_price`, que es lo que busca §10.1 y no se muestra nunca |
| **Las etiquetas (*tags*) quedan para después del MVP, quintas** | `FUNCTIONAL-SPEC.md` FA-20; `DEVELOPMENT-PLAN.md` §6 | Un producto tiene **una** categoría y `categories` no tiene jerarquía. Mientras una categoría entre en una página (24 productos), subdividirla por el nombre del producto más la búsqueda tolerante alcanza. Cuando no entre, la respuesta son etiquetas y **no** partir la categoría en hermanas: seis «Cables …» al lado de «Teclados» arruinan la fila del encabezado, que es la navegación principal. Va quinta porque es la única de esa lista cuyo momento lo fija el catálogo y no nosotros |
| **Las categorías también se destacan** | `FUNCTIONAL-SPEC.md` RF-01, RF-02, RF-15 y RF-18; `TECHNICAL-SPEC.md` §5.4 y §10.2 | Los productos ya tenían `is_featured`; las categorías no, y sin eso el orden del menú de la tienda y de los chips de la portada era alfabético y nada más. Se agrega como **bandera, no como orden**: un `sort_order` obligaría a renumerar al insertar en el medio para un puñado de filas que desempatan solas por nombre. Destacar **no publica** —`is_active` sigue siendo la única verdad sobre la visibilidad—, y no hay tope: destacarlas todas es reversible con un clic, y un límite del servidor sería una regla que se choca sin haberla pedido |
| **Lexical para el editor, mdast para el sanitizador** | `TECHNICAL-SPEC.md` §2.1 y §16; `VERSIONS.md` | RF-15 pedía un editor visual y §16 un sanitizador, y ninguna especificación decía con qué. Se eligió **Lexical** por sobre Tiptap/ProseMirror —pedido tuyo, y con un motivo que lo sostiene: su lista de *transformers* de Markdown **es** la lista blanca de §16, no una copia, así que un formato que no está no tiene ida ni vuelta posible. Del lado del servidor, `mdast-util-*` parsea, filtra y vuelve a serializar; la ficha va a renderizar el árbol a React **sin pasar por HTML**, así que no queda un `dangerouslySetInnerHTML` en ninguna parte del proyecto |
| **Lo descartado no siempre se borra** | `TECHNICAL-SPEC.md` §16; `modules/content/markdown.ts` | RF-15 pide descartar «sin romper el resto del texto». Un enlace, una cita o un tachado pierden el formato y **conservan las palabras**; se borra entero solo lo que no es texto legible —imágenes, HTML y tablas—. Pegar una nota de Word con tres enlaces tiene que dejar la nota, no tres agujeros |
| **El sanitizador parsea GFM aunque GFM no esté permitido** | `TECHNICAL-SPEC.md` §2.1; `modules/content/markdown.ts` | Para descartar una tabla primero hay que verla. Sin la extensión, `\| Tecla \| Vida útil \|` no era una tabla para el parseador sino un párrafo, y salía del sanitizador **con los pipes a la vista**: justo el «resto roto» que RF-15 no quiere. Al serializar no se agrega el lado GFM, porque del filtro no sale ninguno de esos nodos |
| **El límite de 5.000 se mide en texto, y el servidor cuenta menos que el editor** | `modules/content/markdown.ts`, `limites.ts` | Si contara el Markdown, poner un párrafo en negrita acercaría al tope sin agregar una letra. Y el servidor **no suma los saltos entre bloques** mientras que el editor sí: la diferencia va a propósito en esa dirección, para que todo lo que el editor acepta se pueda guardar. Al revés, el contador diría que entra y el guardado lo negaría |
| **El subtítulo tiene un solo nivel, y es `h3`** | `modules/content/markdown.ts`; DR §6.11 | RF-15 permite «un nivel de subtítulo» y no dice cuál. En la ficha el nombre del producto es el `h1` y «Descripción» el `h2` (DR §7.3), así que un subtítulo dentro de la descripción es el escalón siguiente. Todo encabezado pegado de afuera —venga como `#` o como `######`— se normaliza a ese nivel: no hay jerarquía que preservar |
| **«Eliminar» un producto tiene dos finales, y la pantalla dice cuál pasó** | `modules/catalog/products/actions.ts` | RF-15 pide que un producto nombrado por una orden se desactive en vez de borrarse. La acción devuelve **cuál de los dos ocurrió** en vez de un «listo» genérico: decir «lo borramos» sobre algo que sigue en el listado es peor que no decir nada |
| **La imagen principal es la que está en la posición 0** | `TECHNICAL-SPEC.md` §5.4 | RF-17 pide elegir una principal y no dice cómo. Una bandera `is_primary` da **dos fuentes para la misma pregunta** y dos estados imposibles que igual hay que programar: ninguna principal, o dos. Con el orden alcanza, y elegir la principal pasa a ser moverla al frente, que es lo que se ve. El precio es que `sort_order` tiene que quedar sin huecos ni repetidos: borrar una del medio **renumera** en la misma operación |
| **Reutilizar imágenes tiene tres condiciones, y las tres viven en el código** | `TECHNICAL-SPEC.md` §9.5; `FUNCTIONAL-SPEC.md` RF-16 | §9.5 decía «un solo salto, sin cadenas» sin decir cómo se garantiza. La fuente tiene que ser del mismo producto, no puede estar reutilizando a su vez, y quien reutiliza no puede tener imágenes propias —quedarían ocupando lugar en Storage sin verse en ninguna pantalla, que es la peor clase de basura—. Las dos últimas no son expresables como restricción de la base, así que las tres se verifican juntas en la acción en vez de dejar media regla de cada lado |
| **«Sacar» una variante también tiene dos finales** | `FUNCTIONAL-SPEC.md` RF-16 | RF-16 solo nombraba el freno por stock reservado. Pero una variante es lo que `order_items` referencia, así que RN-11 le cabe igual que al producto: si alguna orden la nombra se desactiva, y si no, se borra con sus imágenes. Sin esto, borrar el color negro de un producto vendido le rompía a la orden histórica el enlace al producto en silencio |
| **El stock que se escribe a mano no puede ser negativo** | `FUNCTIONAL-SPEC.md` RF-16 | Parece contradecir a §5.4, y no: ahí el total negativo lo **produce** una venta ya ocurrida (RF-24) y es una discrepancia a corregir. Escribir «−3» en un formulario no registra ninguna discrepancia, es un error de tipeo que después hay que perseguir |
| **El ajuste de stock del panel entra al libro mayor desde ya** | `modules/catalog/variants/actions.ts`; §8.1, §8.3 | §8.1 lista «ajuste de la vendedora» entre las operaciones de stock y §8.3 exige que cada cambio escriba su fila en `stock_movements` **en la misma transacción**. Se podría haber dejado para F4.1, que es donde vive el resto del libro; se hizo acá porque una fila de stock escrita sin asiento es justamente la que va a faltar el día que un número no cuadre, y porque retrofitearlo después es tocar código que ya anda |
| **A los medios de pago no les cabe RN-11** | `FUNCTIONAL-SPEC.md` RF-19; `TECHNICAL-SPEC.md` §5.9 | Marcas, categorías y colores no se borran mientras algo los use porque las órdenes los nombran. A `payment_methods` no apunta **ninguna** clave foránea: son informativos (RN-01), el MVP no cobra online y la orden no guarda con qué se pagó. Así que borrar siempre se puede, y lo único que hay que acordarse de llevar son sus archivos. Queda escrito para que se vea que fue una decisión y no un olvido: el día que una orden guarde el medio de pago, esto se da vuelta |
| **El orden se mueve de a un lugar, y se renumera solo** | `FUNCTIONAL-SPEC.md` RF-19; `TECHNICAL-SPEC.md` §5.9 | RF-19 pedía «orden de aparición» sin decir cómo. Un campo con el número de posición obliga a renumerar a mano para meter uno en el medio, que es justo el trabajo que la computadora hace bien. Con flechas, además, se decide contra la lista a la vista. `sort_order` se reescribe entero —0, 1, 2…— en cada alta, baja y movimiento: es también de dónde sale la posición del próximo (`max + 1`), y una numeración con huecos no falla el día que se hace sino el siguiente |
| **Una sola implementación del logo para marcas y medios de pago** | `TECHNICAL-SPEC.md` §9.2; `modules/media/subir.ts` | Son idénticos en todo lo que importa: uno por fila, en una columna, reemplazarlo borra el anterior, borrar la fila se lleva los archivos. Lo delicado es el ORDEN —subir, apuntar la fila al nuevo, recién ahí borrar el viejo— y una segunda copia de esa secuencia es exactamente donde aparece el archivo huérfano. Quedó una secuencia y una tabla que dice, por destino, cómo se lee y se escribe su columna. Lo mismo del lado visual: el selector de logo salió del diálogo de marcas a `components/admin/logo/`, porque lo que se comparte no es el dibujo sino el comportamiento —que «Cancelar» cancele también el logo, que la vista previa se libere, que un archivo rechazado deje el campo limpio— |
| **La búsqueda del panel no usa trigramas** | `TECHNICAL-SPEC.md` §10.3; `modules/catalog/products/queries.ts` | §10.1 combina subcadena y similitud, y estaba escrita para el comprador. La vendedora busca lo que **sabe** que existe: un resultado parecido, traído por un umbral que no se calibra hasta F3.3, le esconde el producto que fue a buscar entre otros que no pidió. Se queda la mitad por subcadena, que es la que resuelve los acentos, y se escapan `%` y `_` del término: sin eso, buscar «50%» traía el catálogo entero |
| **El filtro de stock vive en `HAVING`** | `TECHNICAL-SPEC.md` §10.3 | Mira la suma de las variantes. En `WHERE` se evaluaría variante por variante y un producto con un color en cero y otro con diez aparecería como «sin stock»: el filtro diría que hay que comprar algo que está en la caja |
| **«Stock negativo» no es «Sin stock», y se cuenta por variante** | `FUNCTIONAL-SPEC.md` RF-15; `TECHNICAL-SPEC.md` §10.3 | §5.4 pide que el panel destaque la discrepancia de RF-24, y el aviso genérico no alcanza: un negativo es una venta ya registrada sobre unidades que el sistema no tenía —se corrige con un ajuste—, y «sin stock» es una compra pendiente. Además hay que contarlo por variante: un color en −3 y otro en +10 suman 7 y en el total no se ve nada |
| **El listado filtra también por stock, y «Para reponer» es una sola opción** | `FUNCTIONAL-SPEC.md` RF-15 | RF-15 pedía categoría, marca y estado. Falta la pregunta que la vendedora hace todos los días —«¿qué tengo que comprar?»—, que no se responde ordenando: hay que ver **solo** eso. Es una opción y no dos porque sin stock y por debajo del umbral son la misma decisión de compra, y es el destino natural del enlace «stock bajo o en cero» del dashboard de RF-14, que hoy no tendría a dónde apuntar |
| **El umbral se lee con respaldo, y el respaldo es permanente** | `TECHNICAL-SPEC.md` §5.9 y §10.3; `modules/settings/queries.ts` | `site_settings` es una fila única que puede no existir. En F2.5 se anotó como «hasta F2.7»; F2.7 mostró que no era provisorio: **la fila no la escribe ninguna migración sino la vendedora**, la primera vez que guarda la pantalla de configuración, porque sus dos columnas de texto son NOT NULL y no hay número de WhatsApp ni email que una migración pueda inventar. Fallar sería dejar el listado caído por una configuración que nadie cargó aún, así que se usa el mismo `3` que declara la columna. La constante está repetida a propósito y no derivada: la base decide el valor de la fila nueva y el código decide qué pasa cuando no hay fila |
| **Una sola normalización de teléfono para el comprador y para el sitio** | `lib/telefono.ts`; `FUNCTIONAL-SPEC.md` RF-20; `modules/users/schemas.ts`, `modules/settings/schemas.ts` | El número de WhatsApp de RF-20 sigue exactamente la misma regla que el teléfono obligatorio de RF-05: se acepta con o sin +54, con o sin 9, con espacios y guiones, y se guarda como `+549` más diez dígitos. Copiarla habría dejado dos regex que un día se contestan distinto, y el síntoma sería un `wa.me` armado sobre un número guardado en otra forma. Lo único que cambia entre los dos es el texto de los mensajes —a la compradora se le explica para qué se lo pedimos—, así que eso es lo que entra por parámetro. `db:configuracion` prueba que los dos den el mismo resultado |
| **La fila de configuración la crea guardar, no una migración** | `TECHNICAL-SPEC.md` §5.9; `modules/settings/service.ts` | `whatsapp_number` y `admin_notification_email` son NOT NULL y no hay valor que una migración pueda inventar. Así que la primera vez que la vendedora guarda es también la primera vez que la fila existe, y la escritura es un `INSERT … ON CONFLICT (id) DO UPDATE` con el `id = 1` escrito y no dejado al DEFAULT: es lo que le da al conflicto contra qué chocar. Con un `UPDATE` a secas esa primera vez no afectaría ninguna fila y la pantalla diría «se guardó» sin haber guardado nada, que es el peor final posible para un formulario |
| **La escritura de la configuración vive fuera de la acción** | `TECHNICAL-SPEC.md` §4; `modules/settings/service.ts` | Es lo único de F2.7 que no se puede comprobar leyéndolo, y **una Server Action no se puede llamar desde un script**: necesita sesión, cookies y un pedido. Si el UPSERT se quedaba adentro de la acción, `db:configuracion` tenía que copiarse el SQL, y entonces no probaría el código que corre en producción sino que Postgres sabe hacer `ON CONFLICT`. La acción sigue siendo la puerta —rol, validación y revalidación son suyos (§6.2)—; `service.ts` es solo la escritura, y §4 ya lo tenía previsto en la lista de archivos de un módulo |
| **El umbral de stock bajo tiene topes: 1 y 100** | `FUNCTIONAL-SPEC.md` RF-20; `modules/settings/limites.ts` | RF-20 pedía «umbral» sin decir entre qué y qué. Con **0** el aviso no se enciende nunca y «Sin stock» ya cubre ese caso: sería una forma escondida de apagar una función en vez de configurarla. Por encima de **100** marca casi todo el catálogo, y un aviso que señala todo no señala nada. Los dos números y la frase que los explica viven en `limites.ts` y no en el esquema, por lo mismo que `modules/content/limites.ts`: el formulario los necesita, y traerlos desde el esquema arrastraría Zod entero al navegador por una constante de texto |
| **Guardar invalida todo, a propósito** | `modules/settings/actions.ts` | El umbral lo lee el listado de productos y lo va a leer el dashboard (RF-14); el número de WhatsApp, cada ficha y cada botón de compra de la tienda (RF-04). Una lista de rutas en la acción es una lista que el día que se agrega una pantalla nadie se acuerda de actualizar, y el síntoma sería un umbral guardado que la tienda sigue ignorando, sin ningún error a la vista. Se paga revalidando de más algo que se toca una vez por mes |
| **Un color «en uso por algo activo» se mide por la variante, no por el producto** | `modules/catalog/queries.ts`, `modules/catalog/actions.ts` | RN-11b habla de «variantes activas de un color inactivo», pero el conteo miraba solo `products.is_active`. Hasta F2.4 no había variantes y no se podía ver; con variantes es un callejón sin salida: desactivás el color en el producto, volvés a intentar desactivar el color y el aviso te pide desactivar un producto que ya no lo ofrece. Ahora bloquea lo que RN-11b dice que bloquea, ni más ni menos |
| **El alta usa `signUp` y el reenvío `signInWithOtp`; `auth.resend()` no se usa en ninguna parte** | `modules/users/actions.ts`; `TECHNICAL-SPEC.md` §13.4 | El alta hacía `admin.createUser` + `auth.resend()`, y el reenvío `auth.resend()`. **El endpoint `/resend` de GoTrue descarta el `code_challenge`** que le manda `@supabase/ssr`: no deja fila en `auth.flow_state`, y sin esa fila `/auth/v1/verify` no tiene un `code` que emitir y devuelve la sesión por el flujo implícito, en el fragmento (`#access_token=…`). El fragmento **no se manda al servidor**, así que `/api/auth/confirmar` recibía una URL pelada y respondía «enlace inválido» —con la cuenta ya confirmada y la sesión perdida—. En local no se veía. Comprobado contra el servidor DATA con el mismo `code_challenge`: por `/signup` deja fila, por `/resend` no deja ninguna. `signUp` y `signInWithOtp` sí lo registran. `shouldCreateUser: false` en el reenvío es lo que impide que se vuelva un alta encubierta sin perfil |
| **El contenido de E4 es de F6.4, no de F1.8** | `DEVELOPMENT-PLAN.md` F1.8 y F6.4 | Decisión tuya, y el plan ya la insinuaba: F1.8 pedía «armar el layout de React Email para E4», pero su «Hecho cuando» exigía además la plantilla terminada. Escribirla ahora sería inventar la forma de los datos de una orden que todavía no existe —número, ítems, total, enlace al panel— y volver a tocarla entera cuando F4.3 la cree de verdad. El layout compartido sí es de F1.8 y está hecho: E4 no arranca de cero, arranca de `Marco`. Se corrigieron las dos filas del plan para que ninguna de las dos tareas quede a medias sin que se note |
| **Las plantillas de email van en `public/` de la aplicación** | `PROGRESO.md` F1.8; F0.13 | GoTrue **no lee plantillas de un archivo**: toma `GOTRUE_MAILER_TEMPLATES_*` como URL y la busca por HTTP contra `SITE_URL`. Probado en el VPS montando la carpeta en el contenedor: el archivo estaba ahí y el log decía `Get "http://localhost:3000/etc/gotrue/email-templates/confirm.html": connection refused`. Servirlas hoy exigiría un contenedor más —en un stack que R5 ya marca como pesado— para tirarlo cuando la app se despliegue. Como GoTrue las resuelve contra `SITE_URL`, que **es la aplicación**, el lugar donde terminan es `public/`: versionadas con el código y sin infraestructura nueva. El intento se revirtió entero; el `docker-compose.yml` del VPS no quedó tocado |
| **El rediseño de la tienda es una tarea del plan, y es F3.8** | `DEVELOPMENT-PLAN.md` F3; `DESIGN-REFERENCE.md` §1.3 | El canvas se aprobó después de escrito el plan, y se implementó en cuatro commits que ya lo llaman «F3.8». El ID que F3.8 tenía —SEO— no estaba citado en ningún commit ni en ninguna otra especificación, mientras que el del rediseño ya estaba escrito en la referencia de diseño: §1.3 se llama «Lo que cambió el canvas de F3.8». Así que **SEO se renumeró a F3.9** en vez de rotular el rediseño con un número que otro documento ya usaba para otra cosa. La regla de §1.2 pide IDs estables porque los commits los citan; acá los commits citan el rediseño |
| **§7.2 pasa de columna de filtros a barra con panel desplegable** | `DESIGN-REFERENCE.md` §7.2, reescrita entera | La columna lateral se comía 260px de los 1200 —el 22% del ancho— para algo que se toca una vez y después estorba toda la sesión. Y había un motivo más urgente para reescribirla: **§7.2 estaba contradiciendo al código**, que es la peor forma de tener una referencia, porque no se sabe cuál de los dos está mal |
| **La tarjeta muestra dos números, no cuatro** | `DESIGN-REFERENCE.md` §6.1 y §6.7 | Llegó a mostrar la píldora «−$ 9.900» sobre la imagen, el final, el tachado y «Ahorrás $ 9.900»: la misma cifra dos veces para comunicar una sola oferta. Quedan los dos que dicen cosas distintas —cuánto valía y cuánto vale—, tachado primero, como se lee un cartel. **No es una desviación del canvas ni de la referencia**: §6.1 ya dibujaba dos números; el «Ahorrás» venía de §6.7, que es el componente genérico. *(Ampliada el 2026-09-08: la regla dejó de ser de la tarjeta y pasó a ser de toda la tienda — RN-04c, la fila de abajo. El «Ahorrás» tampoco sigue vivo en la ficha.)* |
| **RN-04c: una oferta son dos números, nunca tres** | `FUNCTIONAL-SPEC.md` RN-04c, RF-02, RF-03; `TECHNICAL-SPEC.md` §7.2; `DESIGN-REFERENCE.md` §6.1, §6.7, §7.3 y §14 | Decisión tuya. La tarjeta ya lo hacía desde F3.8 y **RF-02 seguía pidiendo lo contrario**: un criterio de aceptación que el código incumplía sin que ninguno de los dos estuviera mal a propósito. En vez de corregir RF-02 para que describiera la tarjeta, la regla subió a la tienda entera — el tachado sobre el final ya dice cuánto bajó, y enunciar el ahorro es la misma oferta dicha de nuevo. La ficha era la única pantalla que lo llevaba, y no llegó a tener consumidor: se fue antes de estrenarse |
| **La vista previa del panel también pierde el «Ahorrás»** | `components/admin/productos/formulario.tsx` | RN-04c es de la tienda y el panel no entra. Pero esa vista previa dice «Se muestra», así que mostrar de más la volvía mentirosa sobre lo único que promete. Y el número que agregaba era el descuento que Ana acababa de tipear tres campos más arriba. `Vista.ahorro` quedó sin usar y se borró |
| **Los filtros del catálogo pasan a multiselección y aparece el rango de precio** | `DESIGN-REFERENCE.md` §7.2 y §14; `PROGRESO.md` F3.4 | No cambia ningún requisito: RF-02 los pedía así desde el principio y §7.2 tenía la ausencia registrada como «función pendiente». Lo que cambia es §7.2, que ahora describe lo que hay en vez de lo que falta |
| **RN-10 deja de nombrar a PedidosYa y pasa a nombrar la zona; aparece el retiro** | `FUNCTIONAL-SPEC.md` RN-10, RF-01, RF-03, RF-08, RF-11, RF-29, FA-02, decisiones; `TECHNICAL-SPEC.md` §3; `DESIGN-REFERENCE.md` §5.1, §7.1; `DEVELOPMENT-PLAN.md` F1.13, F3.7, F6.1 | Pedido tuyo, y era más grande que la ficha: la regla exigía el aviso en cuatro pantallas, así que cambiar sólo la ficha dejaba a la tienda contándose dos historias. El efecto lateral está en **el checkout**, y ahí me pasé: dije que lo anotaba y lo edité igual. Corregido con lo que aclaraste — RF-11 ofrece **envío, retiro o coordinar**, y sólo el envío pide dirección |
| **Los medios de pago se nombran en la ficha en vez de dibujarse** | `FUNCTIONAL-SPEC.md` RF-03 y decisiones; `DESIGN-REFERENCE.md` §7.3, §14 | Pedido tuyo. Una tira de logos en la pantalla de venta se lee como «pagá acá», y acá no se paga. No se agregó el enlace a «qué medios aceptamos» que mencionaste: sería el sexto enlace apuntando a un `/legales/` que no existe hasta F9.3 |
| **La ficha declara que los productos son nuevos y en su caja original** | `FUNCTIONAL-SPEC.md` RF-03 y decisiones | Preguntado y contestado: no se venden reacondicionados. Va como texto fijo y no como dato por producto, porque el día que eso cambie cambia el modelo, no una frase |
| **La galería cambia de forma: miniaturas a la izquierda y siempre visibles, sin botón de ampliar, con visor de dos niveles** | `DESIGN-REFERENCE.md` §6.8 (reescrita) y §14; `TECHNICAL-SPEC.md` §9.3; `DEVELOPMENT-PLAN.md` F3.5 | Pedido tuyo, y el primer punto arregla un error que reportaste: la foto se corría de lugar al cambiar a un color con menos fotos. TS §9.3 tuvo que registrar **la única excepción a `next/image`** del proyecto: el zoom es «el tamaño real del archivo» y el optimizador devuelve el ancho que él elige |
| **La descripción se muda a la columna derecha y la galería queda pegada** | `DESIGN-REFERENCE.md` §7.3 (canvas reescrito) y §14; `DEVELOPMENT-PLAN.md` F3.5 | Pedido tuyo. De las dos lecturas posibles se tomó la del `sticky`: una barra de desplazamiento propia adentro de la columna rompe el desplazamiento en el teléfono y deja sin lugar a los recomendados del final |
| **El corazón sale de la imagen en la ficha; en la tarjeta se queda** | `DESIGN-REFERENCE.md` §7.3, §14; `DEVELOPMENT-PLAN.md` F3.5, F5.4 | Pedido tuyo, y contradecía lo que §7.3 había decidido tres días antes —«mismo ícono, mismo lugar en las dos»—. La misma acción dibujada distinto a propósito: en la grilla el ícono solo es lo único que entra; en la ficha hay lugar para la palabra |
| **«Agregá al carrito» pierde su explicación a la vista** | `DESIGN-REFERENCE.md` §7.3, §14 | Pedido tuyo. §8 pide que todo deshabilitado diga por qué; queda dicho para lectores de pantalla y anotado como excepción, no como olvido. El renglón ocupaba en pantalla más que la falta que explicaba |
| **La ficha sin stock tiene estado propio, con «Preguntá si va a haber» de principal** | `FUNCTIONAL-SPEC.md` RF-03 y RF-04; `DESIGN-REFERENCE.md` §7.3 y §14; `DEVELOPMENT-PLAN.md` F3.5, F3.6 | Pedido tuyo. RF-03 tenía una línea —«se ofrece Consultar por WhatsApp»— y §7.3 no dibujaba el caso. Faltaban las tres decisiones que lo hacen usable: decirlo **con palabras** y no con un botón apagado, que la consulta suba a **principal** —es la única salida que le queda a esa pantalla—, y **aclarar que nadie va a avisar**, porque el botón suena a que el sitio agenda un aviso y no hay ninguno. Efecto lateral: F3.6 pasa a tener **dos** mensajes, y el de consulta va sin cantidad ni precio |
| **El corazón de favoritos se rellena con `--brand`** | `DESIGN-REFERENCE.md` §6.1, §7.3 y §14; `FUNCTIONAL-SPEC.md` RF-10; `DEVELOPMENT-PLAN.md` F3.1, F3.5, F5.4 | La pregunta era si entraba un rosa. No: §1.2 decidió **un solo color saturado** y el canvas de F3.8 lo confirmó, así que el segundo no entra por un ícono de 20px. El burdeos ya es el color de lo accionable y de lo elegido, y relleno sobre blanco lee como se espera que lea un corazón marcado. Con eso quedó escrito el contrato entero —siempre a la vista, contorno/relleno, 44px, estado anunciado además del color— para que **F5.4 no tenga que inventar nada**, que es lo que pasa cuando una tarea de una fase posterior hereda media especificación |
| **F3.5 y F3.6 se hacen juntas, y «Agregá al carrito» se dibuja apagado** | `DEVELOPMENT-PLAN.md` F3.5 y F3.6; `PROGRESO.md` | Decisión tuya. F3.6 es la única acción que la ficha puede tener hasta F5.5, así que por separado salía una pantalla imposible de terminar de probar. El botón del carrito se dibuja deshabilitado **con el motivo al lado**, que es la condición que §8 le pone a todo estado deshabilitado; sin ese renglón sería el botón gris sin explicación que acabábamos de decidir evitar |
| **Un color agotado se puede elegir: §6.5 decía lo contrario** | `DESIGN-REFERENCE.md` §6.5 y §14 | Sin eso, el estado sin stock que se especificó el mismo día **no se alcanzaba desde la pantalla**: había que escribirle el `?color=` a mano. Lo que queda deshabilitado son las acciones de compra, no la elección — y elegir el color agotado es justamente lo que arma el mensaje de «Preguntá si va a haber». RN-06 no cambia: ya decía «no seleccionable **para compra**» |
| **El `?color=` de la ficha lleva el nombre corto, no el identificador** | `modules/catalog/products/ficha.ts`; `DESIGN-REFERENCE.md` §14 | El catálogo filtra por `?color=<uuid>` y está bien: ahí el valor sale de una lista y no lo lee nadie. En la ficha el enlace se manda por WhatsApp —que es literalmente para lo que §10.2 puso el estado en la dirección— y `?color=negro` sobrevive a que alguien lo lea en voz alta. Un color que ya no existe **no es un 404**: abre en el primero |
| **`lib/env.ts` gana `urlDelSitio()`** | `lib/env.ts`, `app/layout.tsx`, `modules/users/actions.ts` | El mismo `?? "http://localhost:3000"` ya estaba escrito en dos lugares y el enlace de WhatsApp de la ficha pedía un tercero. Tres copias de un respaldo es cómo se termina teniendo dos respaldos distintos. Se migraron los dos que había en el mismo movimiento |
| **La tarjeta y la ficha eligen la misma variante** | `modules/catalog/products/tienda.ts` | La portada de la tarjeta desempataba por `v.id`, que es un UUID al azar, así que podía mostrar un color y la ficha abrir en otro. Nadie lo reporta como error: se siente como que el sitio cambió de producto |
| **El seed escribe el número de WhatsApp; los medios de pago no** | `scripts/sembrar-catalogo.mts` | Sin número la ficha no dibuja ningún botón, así que sembrarlo es lo que hace que F3.6 se pueda mirar. Los medios de pago se intentaron y **rompen** `tests/unit/settings/pagos.test.ts`, que ordena contando desde el principio de la tabla; la causa de fondo es que el seed y los tests comparten base, y eso se arregla separándolas, no acomodando un test |
| **La familia de grises de la tienda es cálida** | `DESIGN-REFERENCE.md` §3.1, §3.5, §3.6 y §14 | Es de donde sale el aire de la referencia: `--canvas` es un gris frío, y grises cálidos encima repiten la tensión de temperatura que §2.1 le pide al burdeos. Se cambió la familia **entera** —textos, tinte del anillo de foco, ícono de «sin logo» y las tres sombras—: mezclar las dos deja los secundarios azulados sobre tarjetas cálidas. El gris del canvas no se pudo usar tal cual: `#787574` da 4,14:1 sobre `--canvas`, por debajo del 4,5 de RNF-02, y `#716e6d` conserva la temperatura llegando a 4,58 |
---

## La baja de cuenta ya es un requisito: RF-34

Escrita el 2026-09-06, y **por ley**, no por prolijidad: la normativa argentina
de comercio electrónico exige que el consumidor tenga a la vista un mecanismo
para desvincularse. Reemplaza a la «baja lógica» que el día anterior figuraba
acá como idea suelta.

Dónde quedó escrita, para no buscarla:

| | |
|---|---|
| El requisito | `FUNCTIONAL-SPEC.md` **RF-34**, en la sección de legales |
| La regla que la separa del bloqueo | **RN-13** |
| El aviso a la administradora | **E5**, en la tabla de RF-30 |
| Cómo se construye sobre lo que ya hay | `TECHNICAL-SPEC.md` **§13.5b** |
| Las tareas | **F5.8** (el comprador la pide) y **F7.9** (la administradora la ejecuta) |

**Lo que decidiste, en una línea:** el comprador **pide** y la administradora
**ejecuta**. El comprador no se da de baja solo, porque una baja toca historial
de ventas y hay estados en los que no puede ocurrir —con **órdenes activas no
procede**—, y eso lo decide una persona. La pantalla advierte qué implica, el
motivo es obligatorio, y volver es posible: la baja es lógica y se revierte.

**El arrepentimiento no era esto, y ya está cubierto.** Lo planteé como punto
abierto —si el botón de arrepentimiento era un requisito aparte— y lo cerraste
el mismo día con el argumento que faltaba: **RN-08** dice que el Visitante no
genera órdenes, su compra sale sólo como mensaje de WhatsApp y se va del flujo
del sitio. No hay compra registrada que revocar para alguien sin sesión. Y para
quien la tiene, **cancelar su orden activa desde «Mis compras» (RF-23) es el
arrepentimiento**: libera la reserva, no descuenta stock, y lo hace solo.

Así que no hay requisito nuevo ni tarea nueva. Lo que sí quedó escrito, para
que dentro de un año se pueda **señalar dónde el sitio cumple**: la
cancelación tiene que estar **a la vista** en el detalle de la orden y no
detrás de un menú (RF-23, y en el plan F6.5), y la página «Garantías y
devoluciones» tiene que decir con todas las letras cómo se ejerce (RF-29, y en
el plan F9.3). El mecanismo estaba; lo que faltaba era nombrarlo.

**F10.10 se fue.** La había creado bloqueante de la Compuerta F10 para cerrar
este punto; sin punto que cerrar, la compuerta vuelve a depender sólo de F10.1.

---

## Qué está esperando algo tuyo

1. **F2.8 — cargar el catálogo real.** Ahora traba dos cosas que antes no
   trababa: el umbral de similitud de **F3.3** y la **Compuerta F3**, que el
   plan pide calibrar y aprobar contra el catálogo de verdad. Los 26 productos
   sembrados sirven para mirar pantallas, no para aprobarlas.
2. **F1.7 — Google y Facebook.** Hay que crear las apps en Google Cloud y en
   Meta for Developers, con `/auth/v1/callback` como URI de retorno. El código
   ya resuelve la vinculación por email verificado; los botones se muestran
   deshabilitados con el motivo al lado.
3. **F0.5 — restringir Studio.** Está accesible por HTTPS con usuario y
   contraseña; §2.4 pide además restricción por IP.
4. **F0.10 — el backup.** El *Backup Standard* de DonWeb —semanal, del VPS
   entero— está activo y sirve de piso, pero guarda **una sola copia** y se
   restaura por ticket. Falta el volcado de la base y del bucket, con varias
   copias y una restauración probada. Conviene antes de F2.8, que es cuando
   entra el catálogo real: es trabajo de Ana lo que se estaría arriesgando.

---

## Cómo se hace un administrador, hasta que exista F7.4

Hecho por primera vez el **2026-09-07**: producción tiene **un** administrador,
y es la cuenta con la que se verificó F1.7 de punta a punta.

Es un `UPDATE` de una fila y no una carencia: la administración de usuarios es
RF-26 y vive en **F7.4**. Hasta entonces, sumar un administrador es

```sql
UPDATE user_profiles SET role = 'admin', updated_at = now()
 WHERE id = '…' RETURNING id, email, role;
```

El `RETURNING` no es adorno: sin él, un `WHERE` que no encuentra a nadie
devuelve «Success» igual y no hay forma de distinguirlo de uno que funcionó.

Tres cosas que hacen que esto sea seguro, y que conviene no redescubrir:

- **El rol no viaja en el JWT.** `lib/session.ts` lo lee de `user_profiles` en
  cada resolución de sesión y `app/admin/layout.tsx` decide con eso, así que el
  cambio surte efecto en la próxima carga de página, sin cerrar sesión. Está
  diseñado así por RF-27, que exige que bloquear a alguien corte sus sesiones
  activas: un rol escrito en el token queda congelado hasta que el token se
  renueve.
- **Un error de tipeo no entra.** El CHECK `role_valid` sólo acepta `'admin'` o
  `'customer'`; `'Admin'` falla en el momento en vez de dejar una cuenta que no
  entra a ningún lado y no dice por qué.
- **Sin el rol, `/admin` devuelve 404** y no «no tenés permiso»: el panel no se
  delata ante quien no debería saber que existe.

---

## Pendiente detectado, sin tarea propia

**~~Dos controles del encabezado por debajo del mínimo táctil de §9.~~**
Resuelto el 2026-09-08. Se anotaron acá porque el encabezado está en todas las
pantallas y cambiarlo de paso era cambiar algo que nadie había revisado; se
tocaron cuando la revisión existió y alcanzó también al pie y a la ficha. Ver
«El teléfono deja de ser una suposición», más arriba.

**El panel de filtros se corta en el teléfono, y no parece que se corte.** El
contenido mide 708px y la ventana 512 (`max-h-[min(70vh,32rem)]`): el campo
`Hasta`, su botón `Aplicar`, «Solo con descuento» y **`Ver 25 productos`, que
es la acción principal del panel**, quedan detrás de un scroll interno sin
ninguna señal —el corte cae en la mitad del campo `Desde` y el borde
redondeado se lee como el final del panel—. Encima el gesto es ambiguo: el
dedo sobre el panel mueve el panel y un centímetro más abajo mueve la página.
Lo que haría es que en menos de `md` deje de ser un desplegable y pase a ser
una hoja a pantalla completa con `Aplicar` y `Limpiar` fijos abajo, **pero eso
cambia §7.2, que está aprobada**, así que se anota y no se toca.


**El checkout cambió en la especificación y no está construido.** RF-11 pasó de
«elegí una dirección» a **elegir entre envío, retiro o coordinar con la
vendedora**, y sólo el envío pide dirección (2026-09-08). Está en RF-11 y en
F6.1; no está construido porque F6 no empezó. Se anota para que no llegue como
sorpresa el día que se abra la tarea.

**El navegador de esta máquina no entrega cuadros.** `requestAnimationFrame` no
dispara nunca, y de ahí salen tres síntomas que ya costaron tiempo: el cambio de
tamaño de ventana no hace nada, el portapapeles contesta «el documento no tiene
foco», y el desplazamiento suave de la galería no ocurre. **No es un error del
proyecto**, pero sí el motivo por el que hay cosas que sólo se pueden verificar
leyendo el código. La salida está evaluada y es tuya: Playwright, que ya está
elegido en TS §2.1 y §17.2 y anotado como pendiente de F10.2 en `VERSIONS.md`.


**El pie y la ficha enlazan a `/legales/…`, que todavía no existe.** El pie lo
hace desde F1.13 y la ficha lo sumó en F3.5, porque §7.3 dibuja «Garantías y
devoluciones» ahí y sacarlo dejaría la ficha sin decir qué pasa si algo sale
mal. Las cuatro páginas son **F9.3**, y hasta entonces los cinco enlaces caen en
el 404. Queda anotado y no arreglado a propósito: la alternativa sería una
página de relleno con texto legal inventado, y un texto legal inventado es peor
que no tenerlo.

**La ficha no se miró en un teléfono.** Su composición móvil es lo que decide
§6.8 —el carrusel deslizable con puntos, sin miniaturas y sin modal— y está
escrita, pero el navegador de esta máquina no acepta el cambio de tamaño de
ventana, así que lo único verificado es escritorio. Es lo que impide poner ✅
en F3.5, junto con la entrega real del mensaje de WhatsApp de F3.6.

**`images.qualities` sigue sin decidirse, y ahora hay una foto grande delante.**
`next.config.ts` dice que se decide «en F3, con el primer `next/image` real
delante»: ese momento llegó con la galería de §6.8, que sirve el archivo
`detail` de 1400px que sharp ya comprimió al 82%. Hoy `next/image` lo vuelve a
comprimir con el 75 que Next 16 usa por omisión, o sea **dos pasadas con
pérdida sobre la misma foto**. No se tocó todavía porque decidirlo pide medir
—peso contra nitidez, sobre fotos de verdad y no sobre los rellenos del seed—.

**~~«Elegí una marca» sin ninguna marca que elegir.~~** Resuelto preparando la
Compuerta F2, y es el pozo más caro que tenía el panel: en una instalación
nueva, `/admin/productos/nuevo` pintaba el formulario entero con el selector de
marca conteniendo **una sola opción, que es el texto de «no elegiste nada»**.
Ana escribía el nombre, el precio, la descripción y subía las fotos, y recién al
guardar aparecía «Elegí una marca.»: una instrucción imposible de obedecer, sin
decir dónde se crea una. Ahora la pantalla no pinta un formulario que no se
puede completar: dice qué falta, por qué hace falta —marca y categoría arman el
menú de la tienda y son por lo que el comprador filtra— y lleva a crearlo, y
nombra **las dos** cuando faltan las dos, para que nadie cargue una marca,
vuelva, y se encuentre con que ahora falta la categoría. Es de F2.3 y no de
F2.7; se encontró recién ahora porque hasta hoy siempre hubo una marca cargada
de alguna prueba anterior, que es exactamente lo que esconde un problema de
primer uso.

**~~La ayuda de los colores decía lo mismo con diez colores que con ninguno.~~**
Resuelto en la misma pasada, y es más chico porque no es un callejón: con cero
colores el selector igual ofrece «Único — no se vende por color», así que el
producto se puede cargar (RF-16). Pero la ayuda decía «Los colores se cargan en
Catálogo» en los dos casos, y con la lista vacía eso se lee como un paso
obligatorio que falta cuando en realidad es opcional. Ahora dice que se puede
seguir sin colores.

**~~Un comprador con órdenes web no se puede borrar, y nadie decidió eso.~~**
Resuelto el 2026-09-06 (migración `0010`), y ahora sí lo decidió alguien.
Apareció en F4.3 cuando la limpieza de un test reventó: `orders.user_id` era
**`ON DELETE SET NULL`** —«la orden sobrevive a que se cierre la cuenta»— y el
CHECK `web_order_has_user` prohíbe exactamente ese NULL. Las dos cosas estaban
en §5.6, una al lado de la otra. El borrado fallaba igual, pero con una
violación de CHECK que decía que la fila quedaba inválida en vez de decir que
la persona tiene órdenes.

**Se resolvió del lado de conservar, por decisión tuya: los usuarios no se
eliminan.** Y no es una regla nueva — **RF-26 nunca tuvo «eliminar usuario»**
(lista, crea, modifica, resetea contraseña y bloquea) y RF-07 no tiene «cerrar
mi cuenta». Lo que había era un `SET NULL` escrito como si borrar fuera una
función que existe. Con `RESTRICT` la base dice lo mismo que los requisitos, y
el intento desde Studio o la Admin API falla **nombrando el motivo**. Es el
patrón que el esquema ya usaba para no destruir historia (`returns.order_id`).

**Un usuario sin órdenes se sigue pudiendo borrar, y tiene que ser así:** es la
compensación de §13.4 paso 3, que borra la identidad recién creada cuando el
alta del perfil falla. Hay un test para cada mitad.

**«Los índices parciales tienen que ser 5» volvió a envejecer.** Es la misma
lección que F2.6 escribió para las columnas generadas —«una aserción que
cuenta envejece; una que nombra, no»— y que quedó a medias: se arregló la
comprobación que falló ese día y no la de al lado, que contaba igual. F4.3
agregó el índice de la clave de idempotencia y `db:verificar` se puso rojo sin
que nada estuviera mal. Ahora se comprueban por nombre, y el error dice cuál
falta. **Quedan dos que todavía cuentan**: los enums (`length === 4`) y los
índices GIN (`length === 3`).

**Los scripts que escriben ya no pueden correr contra producción.** Nueve de
los once crean marcas, productos y variantes, suben archivos al bucket y
después los borran; contra el stack local no le importa a nadie, contra la base
de Ana son filas y archivos de mentira dentro del catálogo real —y si uno
revienta a mitad, como ya pasó, quedan ahí—. `scripts/solo-local.mts` los frena
salvo que la base sea exactamente la del stack local. **Los tres de solo lectura
—`db:verificar`, `db:drizzle`, `db:markdown`— quedaron sin guarda a propósito**:
`db:verificar` contra producción es justamente cómo se cierra F0.6, y una
guarda que también los frenara sería algo que hay que esquivar. La guarda mira
**host y puerto**, no solo el host, porque el acceso a producción va por túnel
SSH y a través de un túnel producción se ve como `127.0.0.1`; de ahí la regla
que hay que respetar del otro lado: **el túnel nunca usa el puerto 54322**.

**Los once `db:xxx` no son tests, y las especificaciones ya habían elegido
Vitest.** `db:verificar` está en `TECHNICAL-SPEC.md` §18.3 y es legítimo; los
otros diez —`db:catalogo`, `db:descripcion`, `db:markdown`, `db:productos`,
`db:variantes`, `db:listado`, `db:pagos`, `db:configuracion`…— se fueron
agregando de a uno por tarea **sin que ninguna tarea del plan los pidiera y sin
anotarlo acá**, que es lo que la regla 1 de `DEVELOPMENT-PLAN.md` §1.2 prohíbe.
Aciertan en lo importante —corren contra Postgres y Storage de verdad, como
exige §17.1— y fallan en cuatro cosas: **no hay runner ni `npm test`**, así que
hay que acordarse de correrlos a mano y un día no se corren; **§2.1 y §17.1
eligieron Vitest** y no está instalado, de modo que hay una segunda
infraestructura de pruebas al lado de la elegida; `tests/` sigue **vacío** desde
F1 con F4.6 y F10.1–F10.2 esperando ahí; y la limpieza es por convención —un
`finally` en cada uno— en vez de una transacción que se revierte, que es lo que
sí hace `db:restricciones`. Con `db:configuracion` reventando a mitad por un
nombre de columna equivocado la limpieza corrió, pero corrió con suerte.
**Decisión tuya: se trata al entrar en F4**, que es cuando el plan obliga a
tener el runner andando igual (F4.6). Hasta entonces no se agregan más.
**~~Vencida el 2026-09-07~~ (F4.0 y F4.0b).** Primero a medias: Vitest
instalado y `npm test` corriendo, así que F4 nació en el runner elegido. Y
después entera, en cuanto pasó la Compuerta F4, que era la fecha acordada: los
diez migrados, los scripts borrados, **314 tests**. Las cuatro fallas que la
deuda listaba están cerradas: hay runner, es Vitest —el que §2.1 y §17.1 habían
elegido—, `tests/` dejó de estar vacío, y la limpieza dejó de ser una
convención.

**Los dos patrones de limpieza conviven a propósito, y está escrito dónde va
cada uno.** `enTransaccionRevertida` —una transacción que siempre se revierte—
para lo que prueba consultas y restricciones: no hay nada que acordarse de
borrar, y si el test explota a la mitad se revierte igual. Borrado explícito
para lo que llama a las FUNCIONES de la aplicación, que abren su propia
conexión por el pool y no verían nada de lo que una transacción de test
escribió. Elegir mal el patrón no da un test frágil: da uno que falla siempre,
o uno que pasa sin haber escrito nada.

── Lo que apareció migrando, y no se veía leyendo los scripts ──

**El test que protegía la guarda del stock no la probaba.** `db:restricciones`
comprobaba «stock negativo **con reservas vivas**» —el caso que justifica la
guarda `stock_total < 0` de §5.4— justo después de otra comprobación que ya
había puesto `reserved_stock = 0`. Cada `acepta` liberaba su savepoint, así que
el cero persistía y la comprobación interesante llegaba con reserva cero, donde
`reserved <= total` se cumple sola. Migrado con la reserva viva, y comprobado al
revés: quitándole la guarda al CHECK en el stack local, se pone rojo. Sin eso,
el día que alguien «simplificara» esa restricción, RF-24 se rompía sin que
ningún test se quejara.

**Drizzle esconde el motivo del rechazo.** Envuelve el error del driver en un
`DrizzleQueryError` cuyo mensaje es solo «Failed query: …»; la restricción
violada viaja en `cause`. Un `toThrow(/constraint/)` no matchea nunca, y la
salida cómoda ante eso es sacar el motivo y quedarse con un rechazo que se
conforma con que ALGO falle —incluida una consulta mal escrita—. `rechaza()` y
`rechazaLlamada()` desenvuelven la causa y **exigen nombrar la restricción**.

**`db:drizzle` no era un test, y migrarlo perdía algo.** Es lo único que
comprueba que el cliente de la APLICACIÓN —con el usuario del pooler, la
conexión perezosa y el mapeo del esquema— llegue a producción: `db:verificar`
usa el cliente crudo de `postgres`, no el de Drizzle. Convertido en test, solo
habría podido correr contra el stack local, porque la guarda de
`tests/setup/entorno.ts` no tiene escape. Se quedó como script, reclasificado
como sonda. Estuvo migrado y borrado unos minutos.

**Un array de JS no es un array de Postgres.** En una plantilla `sql` de
Drizzle se expande como lista de parámetros —`($1, $2, …)`—, así que
`= ANY(${ids})` falla con «requires array on right side». Lo mordió la limpieza
de un `afterAll`: los 36 tests del archivo pasaban y **la limpieza reventaba
después**, dejando once filas en la base con todo en verde. Se usa `inArray()`.

**`soloLocal()` se fue con los scripts que protegía.** Nueve de los diez
migrados la llamaban y no quedó ninguno: era código muerto con un comentario
que describía un mundo que ya no existe. Queda la REGLA sola —qué cuenta como
stack local— con un solo consumidor, `tests/setup/entorno.ts`.

**`.env.test` dejó de decir «NI UNA VARIABLE MÁS», por decisión tuya del
2026-09-07.** Los tres tests de Storage necesitan cuatro variables, y §17.1
pide Storage de verdad y no un doble. El argumento de la regla seguía siendo
bueno —que nadie pegue ahí una credencial de producción—, así que lo que cambió
es quién lo sostiene: `tests/setup/entorno.ts` ahora verifica **también** que la
API de Supabase sea loopback en el 54321 y aborta si no. Un comentario pide;
esto impide. Comprobado apuntando el archivo a producción a propósito: no corre
un solo test.

Y el mismo día, por la misma conversación, el archivo **salió del
repositorio**: arriba está el porqué y qué costó.

**El aviso de un campo sobrevivía a que se corrigiera el valor, y ningún
formulario del panel valida al salir del campo.** Son la misma grieta vista
desde dos lados, y el lado feo apareció arrastrando la pantalla de F2.7, no
leyendo el código: después de un envío rechazado por el umbral, corregir el
número hasta dejarlo **igual al guardado** apaga el botón —no hay nada que
guardar— y el aviso rojo se queda al lado de un «Todo guardado.», señalando un
problema que ya no existe y que **no hay forma de sacar de la pantalla**: el
único que limpia los errores es enviar, y enviar está deshabilitado. En
`/admin/configuracion` quedó resuelto: escribir en un campo apaga su aviso y el
general. **Los demás formularios del panel siguen igual** —marcas, categorías,
colores, productos, variantes y medios de pago—, donde el callejón no se cierra
porque «Guardar» nunca se deshabilita, pero el aviso viejo se queda igual sobre
un valor ya corregido.

Y hay una pregunta más grande abajo, que no es de esta tarea: **DR §6.6 dice
que los errores aparecen «al salir del campo, no mientras se escribe», y ningún
formulario del panel lo hace** — todos validan solo al enviar. Cuatro tareas
cerradas (F2.1, F2.3, F2.4, F2.6) lo dieron por bueno leyendo la frase como lo
que prohíbe —validar tecla por tecla— y no como lo que manda. Ponerlo en una
sola pantalla la dejaría comportándose distinto de todas las demás, así que la
decisión es del panel entero y hay que tomarla a propósito, no de costado.

**`next/image` se niega a optimizar desde una IP privada.** Next 16 lo bloquea
como defensa contra SSRF, y en local Storage vive en `127.0.0.1:54321`: el
panel mostraba el ícono de imagen rota y el motivo salía solo por la consola
del servidor. Se resolvió con `images.dangerouslyAllowLocalIP` **encendido
solo fuera de producción**. **El riesgo queda para F0.3:** si
`NEXT_PUBLIC_SUPABASE_URL` llegara a apuntar a la IP de la LAN privada entre
los dos servidores (§2.2), esto vuelve a fallar y ahí sí en producción. La
entrega al navegador tiene que salir por el subdominio público (§9.4).

**Una subida por Route Handler necesita refrescar de las dos puntas.** Una
Server Action devuelve la vista nueva con su respuesta; un `fetch` no. Sin
`revalidatePath` en el servidor **y** `router.refresh()` en el cliente, el
logo queda guardado y el listado sigue mostrando la fila sin él. Se descubrió
en el navegador, no leyendo el código. **Se repitió en F2.4**, tal como estaba
anotado: la subida de imágenes de variante hace las dos cosas desde el
principio gracias a esta nota.

**~~Arrastrar una miniatura la volvía a subir.~~** Resuelto en F2.4, y no se
veía leyendo el código. Chrome adjunta el archivo de la imagen cuando se
arrastra un `<img>`, así que una miniatura movida para reordenar llega a la
zona de soltar con `dataTransfer.types` conteniendo `Files`, igual que una
foto traída del escritorio. La galería la aceptaba: soltarla creaba **una
cuarta imagen, que era la miniatura de la primera**. Se ataca de los dos
lados: `draggable={false}` en la imagen —para que el arrastre lo maneje su
recuadro y no ella— y la zona de soltar ignora el evento mientras hay un
arrastre interno en curso.

**~~Reordenar arrastrando no guardaba nada.~~** Resuelto en F2.4. La galería
quedaba reordenada en la pantalla y al recargar volvía como estaba, sin ningún
error a la vista. El motivo: `dragover` y `drop` pueden llegar en la misma
tanda de eventos, y React agrupa las actualizaciones de estado hasta el final,
así que el manejador de `drop` leía el orden **anterior** al arrastre, lo
comparaba con el del servidor, los encontraba iguales y no guardaba. Se arregló
llevando el orden en curso también en un `ref`, que se actualiza al toque. La
lección que vale para toda la fase: **lo que un manejador de arrastre necesita
leer no puede vivir solo en el estado de React.**


**~~El logo de marca de RF-18 no tiene tarea.~~** Resuelto: entró en F2.1. RF-18 pide «logo opcional» y
`brands.logo_url` existe desde F1.5, pero el «Hecho cuando» de F2.1 sólo habla
de alta, edición y baja, y el de F2.2 sólo de la canalización. El logo cayó
justo en el medio: F2.1 está cerrada sin él y F2.2 no lo incluye. **F2.2 lo
desbloqueó** —la canalización ya existe— así que ahora es trabajo, no espera.
Hay que decidir dónde entra: reabrir F2.1 como se hizo con «destacada», o
sumarlo a F2.3 junto con el resto del ABM.

**La descripción todavía no se renderiza en ningún lado.** El sanitizador
expone `nodosDeMarkdown`, que es el árbol ya filtrado listo para pintar, pero
el componente que lo convierte en elementos de React —con la medida, el aire y
los pesos de `DESIGN-REFERENCE.md` §6.11— no se escribió: **no hay ficha
todavía**, y código sin consumidor es código que nadie prueba. Cae en F3.5. Lo
que hay que respetar ahí es la segunda pasada de §16: la ficha vuelve a
filtrar, para que ampliar la lista blanca mañana no publique lo que ya estaba
guardado.

**`rounded-panel` no existía como token.** Cuatro usos en el catálogo de F2.1
—la tabla de escritorio, las tarjetas de móvil, el esqueleto de carga y el
listado— pedían una clase que Tailwind no genera: el token es
`--radius-panel-card`, así que esos contenedores se venían dibujando con las
esquinas cuadradas. Se corrigió al escribir el listado de productos, que
copiaba el mismo patrón. Es de F2.1 y no de F2.3, y se anota acá para que
quede el rastro.

**El bucket declarativo no se aplica sobre un stack que ya existe.**
`[storage.buckets.productos]` en `supabase/config.toml` es lo correcto para
una máquina nueva o un `supabase db reset`, pero `supabase start` sobre un
stack con datos restaura del backup y no lo crea. En esta máquina se creó a
mano una vez. Vale saberlo antes de que alguien clone el repo, levante el
stack sobre datos viejos y no entienda por qué falla la subida.


**~~Un diálogo que se cierra dentro de una transición conserva lo que se
escribió.~~** Resuelto en F2.6, y no se veía leyendo el código: un medio de
pago se guardó con la **descripción del anterior**. El diálogo se limpiaba en
un efecto al abrirse, que es el patrón de siempre, y el efecto no alcanza.
`alCerrar()` corre dentro de la transición de la Server Action, así que entre
que se guarda y que termina de revalidar hay un rato en que la pantalla sigue
mostrando el diálogo con los valores viejos; si en ese rato se vuelve a abrir,
las props no cambiaron, el efecto no se dispara y el formulario arranca con lo
de antes. Se arregla de raíz: **el diálogo no existe mientras está cerrado**
—el listado lo monta al abrir— y el estado sale de las props. Alcanza a los
dos diálogos del panel, el de catálogo (F2.1) y el de medios de pago. **La
lección vale para toda la fase: un `useEffect` que repone estado «al abrir»
depende de ver un cambio de props que la transición se puede comer.**

**~~`db:verificar` fallaba desde F2.3.~~** Corregido en F2.6. La comprobación
de columnas generadas contaba —«tienen que ser 2»— y `description_text`, que
F2.3 agregó con todo derecho, la rompió sin que nada estuviera mal. Se
comprueban por nombre: además de no romperse al agregar una, el error dice
cuál falta. **Una aserción que cuenta envejece; una que nombra, no.**

**Los scripts de verificación quedan fuera del typecheck.** Renombrar las
funciones del logo compiló sin una sola queja y rompió `db:imagenes`, que las
llamaba con el nombre viejo. El motivo es el `await import()` con el que los
scripts cargan los módulos `server-only`: TypeScript no sigue esa cadena, así
que el nombre lo resuelve Node al ejecutarlo. **Al tocar una función que un
script usa, el typecheck no alcanza: hay que correr los scripts.** Se corrió
la suite entera después de generalizar la canalización, que es como apareció.

**Después de guardar, el primer clic en otro botón se pierde.** Mientras la
acción está revalidando, el diálogo sigue abierto —es el mismo rato de arriba—
y ese clic lo recibe su fondo, que lo único que hace es cerrarlo. Se ve al
guardar y querer crear otro enseguida: el segundo clic sí abre. No es grave y
no tiene arreglo limpio sin cerrar el diálogo antes de que la acción termine
—lo que mostraría el listado sin la fila nueva por un instante—, así que queda
anotado y se decide con la primera pantalla que lo sufra de verdad.

**Una utilidad suelta no le gana a la variante `admin:`.** El buscador del
listado pedía `pl-9` para dejarle lugar a la lupa y la lupa igual quedaba
encima de la primera letra: `Input` trae `admin:px-3`, y el `@custom-variant`
usa `:where(...)`, que no suma especificidad, así que decide el orden del CSS
—y Tailwind escribe las variantes **después**—. Se arregla pidiendo el hueco
también en la escala del panel (`pl-9 admin:pl-9`). **Vale para todo
componente con variante `admin:`**: cualquier `px-*`, `h-*` o `rounded-*` que
se le pase por fuera se pierde en silencio, y en el navegador se ve como un
error de diseño y no como uno de CSS.

**Los botones de ícono del panel miden 36×36 también en móvil.** `§9` de
`DESIGN-REFERENCE.md` pide 44px de área táctil ahí, y el propio comentario de
`components/ui/button.tsx` lo dice, pero la variante `admin:size-9` pisa el
`size-11` en toda la escala, no solo en escritorio. Se vio midiendo las
tarjetas de móvil de F2.1; **es anterior a «destacada»** y alcanza a los
cuatro botones de cada fila y a todo el panel. Arreglarlo es tocar el token
compartido, así que no entró acá: cae naturalmente en F10 (endurecimiento) o
antes, si aparece otra tarea que toque `button.tsx`.

---

**La sección de categorías no tiene tarea en ninguna fase.** El canvas
aprobado tiene su pantalla y vos la pediste; el plan no la nombra. Lo más
cercano es RF-01, que pide **chips de categoría en la home** (F3.7), y el menú
del encabezado — ninguno de los dos es un listado de categorías con su imagen.
Anotado y no inventado: decidir si entra en F3.7, si es una tarea nueva de F3 o
si va después del MVP es tuyo, y arrastra a FA-21 —la imagen chica de
categoría, que hoy está sexta en la lista de después del MVP— porque es
justamente la pantalla que la necesitaría.

**Los tests y el desarrollo local comparten base.** `.env.test` y `.env.local`
apuntan hoy al mismo `127.0.0.1:54322`, así que `npm test` le consume el stock
al catálogo sembrado y deja la tienda entera en «Sin stock», además de hacer
que los tests de stock fallen distinto en cada corrida. La guarda de F4.0 no
mira esto: fue escrita para que los tests nunca toquen producción, y eso lo
sigue cumpliendo. Mientras tanto se arregla con `npm run seed`, que es un
parche; la solución es darle a los tests su propia base. **No entró todavía
porque toca `.env.test`, `.env.local` y la guarda de `tests/setup/entorno.ts`
a la vez**, y eso es exactamente lo que no conviene hacer en el medio de una
tarea visual.

---

## Las especificaciones están versionadas

`sdd/` entró al repositorio el 2026-09-02 (commit `bd58808`). Las cuatro
especificaciones y el porqué de cada decisión viajan ahora con el código: el
único punto del proyecto sin red quedó cerrado.
