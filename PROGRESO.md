# AnaVende — Estado del desarrollo

Estado tarea por tarea de `sdd/mvp/DEVELOPMENT-PLAN.md`. Los IDs son los del
plan. Se actualiza al cerrar cada tarea, en el mismo commit que la cierra.

Última actualización: 2026-09-05.

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
| F1.8 | Plantillas de email E1–E4 | ⬜ | Ya no depende de F0.13: **GoTrue carga las plantillas por HTTP contra `SITE_URL`, no las lee de un archivo** (probado en el VPS, abajo). Así que van en `public/` de la aplicación, versionadas con el código, y se pueden hacer recién cuando la app esté desplegada y `SITE_URL` sea alcanzable desde el VPS. Hoy los cuatro emails salen con la plantilla por defecto de Supabase, en inglés |
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
| F2.7 | Configuración del sitio | ✅ | Número de WhatsApp, email de avisos y umbral de stock bajo, editables desde `/admin/configuracion`. `db:configuracion` prueba 22 reglas contra Postgres de verdad, y las cuatro que importan no se ven leyendo el código: que **guardar la primera vez CREE la fila** —es un UPSERT, y con un UPDATE la pantalla diría «se guardó» sin haber guardado nada—, que la segunda pise a la primera sin que aparezca una segunda fila, que `updated_at` avance al pisar, y que **el umbral guardado llegue al listado**: con 5, un producto con 5 disponibles entra en «Para reponer»; con 4, sale. La normalización del teléfono se sacó a `lib/telefono.ts` y ahora es **una sola** para el comprador y para el sitio; el script prueba que las dos den lo mismo. Probado en el navegador: el estado sin configurar, un envío vacío que señala los dos campos y lleva el foco al primero, el número que vuelve normalizado a `+549…`, el email recortado y en minúsculas, el 101 rechazado por el servidor con su motivo y el campo vacío por el formulario con el mismo texto que usaría el servidor, en claro y en oscuro y a 390px. Arrastrando el flujo apareció **un callejón sin salida que no se veía leyendo el código**: está abajo. Pasó por `impeccable` y `ui-ux-pro-max` como pide DR §12.4, y de ahí salieron seis correcciones que sí se ven mirando: el campo del umbral dejó de ser `type="number"` y pasó a `inputMode="numeric"`, **por la misma razón que ya estaba escrita en el stock de una variante** —el campo numérico del navegador sube y baja con la rueda del mouse encima, y acá eso cambiaría el umbral de todo el catálogo mientras alguien baja la página—; el botón «Guardar» deshabilitado **dice por qué con palabras** («Todo guardado.») en vez de colgarlo de un `title`, que sobre un botón deshabilitado puede no llegar a aparecer nunca (§8); la unidad «unidades» entró en la descripción accesible del campo, que si no se lee «avisar stock bajo a partir de: 3» sin decir de qué; el esqueleto de carga usaba separaciones distintas de las de la pantalla de verdad y **la página saltaba 40px** al llegar los datos, así que ahora comparte las tres medidas y hasta la cantidad de renglones de cada ayuda; y dos textos se acortaron: la bajada del encabezado, que hablaba de «tocar el código» —vocabulario que la vendedora no tiene por qué tener (§10)—, y la de «Avisos», que decía en dos renglones lo que dice en uno. **La fila se borró al terminar**: el número de prueba no es el de nadie, y dejarlo puesto sería peor que dejarlo vacío |
| F2.8 | Cargar el catálogo real | ⬜ | **Desbloqueada el 2026-09-05.** Lo que la trababa —F0.3 y F0.7— está hecho: la base y el bucket de producción existen y están probados, así que lo que Ana cargue queda donde va y no hay que volcarlo ni volver a subirlo. Sigue conviniendo hacer antes la **Compuerta F2**, que es la prueba de usabilidad del panel |

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
| **Las plantillas de email van en `public/` de la aplicación** | `PROGRESO.md` F1.8; F0.13 | GoTrue **no lee plantillas de un archivo**: toma `GOTRUE_MAILER_TEMPLATES_*` como URL y la busca por HTTP contra `SITE_URL`. Probado en el VPS montando la carpeta en el contenedor: el archivo estaba ahí y el log decía `Get "http://localhost:3000/etc/gotrue/email-templates/confirm.html": connection refused`. Servirlas hoy exigiría un contenedor más —en un stack que R5 ya marca como pesado— para tirarlo cuando la app se despliegue. Como GoTrue las resuelve contra `SITE_URL`, que **es la aplicación**, el lugar donde terminan es `public/`: versionadas con el código y sin infraestructura nueva. El intento se revirtió entero; el `docker-compose.yml` del VPS no quedó tocado |
---

## Qué está esperando algo tuyo

1. **F1.7 — Google y Facebook.** Hay que crear las apps en Google Cloud y en
   Meta for Developers, con `/auth/v1/callback` como URI de retorno. El código
   ya resuelve la vinculación por email verificado; los botones se muestran
   deshabilitados con el motivo al lado.
2. **F2.7 — el número y la casilla de verdad.** La pantalla está y anda, pero
   la fila quedó **vacía a propósito**: el número con el que se probó no es el
   de nadie, y un `wa.me` apuntando a un número inventado es peor que un botón
   que todavía no está. Hay que entrar a `/admin/configuracion` y cargar el
   número de WhatsApp real y la casilla donde querés los avisos. Hasta que eso
   pase, el aviso de stock bajo funciona con 3 unidades.
3. **F0.5 — restringir Studio.** Está accesible por HTTPS con usuario y
   contraseña; §2.4 pide además restricción por IP.
4. **F0.10 — el backup.** El *Backup Standard* de DonWeb —semanal, del VPS
   entero— está activo y sirve de piso, pero guarda **una sola copia** y se
   restaura por ticket. Falta el volcado de la base y del bucket, con varias
   copias y una restauración probada. Conviene antes de F2.8, que es cuando
   entra el catálogo real: es trabajo de Ana lo que se estaría arriesgando.

---

## Pendiente detectado, sin tarea propia

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

## Las especificaciones están versionadas

`sdd/` entró al repositorio el 2026-09-02 (commit `bd58808`). Las cuatro
especificaciones y el porqué de cada decisión viajan ahora con el código: el
único punto del proyecto sin red quedó cerrado.
