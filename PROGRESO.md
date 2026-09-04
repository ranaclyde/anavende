# AnaVende — Estado del desarrollo

Estado tarea por tarea de `sdd/mvp/DEVELOPMENT-PLAN.md`. Los IDs son los del
plan. Se actualiza al cerrar cada tarea, en el mismo commit que la cierra.

Última actualización: 2026-09-03.

**Qué significa cada estado**

| | |
|---|---|
| ✅ | Cumple su «Hecho cuando» y está verificado |
| 🟡 | El código está, falta una verificación o una pieza externa |
| ⬜ | Sin empezar |
| ⛔ | Bloqueada por algo que no depende de mí |

---

## F0 — Infraestructura

**Ninguna tarea de F0 está cerrada.** Lo comprobado contra el stack local de
desarrollo **no cierra una tarea de F0** (`TECHNICAL-SPEC.md` §18.2): el
entorno de verdad es el Supabase auto-hospedado del VPS. El detalle de qué se
probó en local vive en `VERSIONS.md`.

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F0.1 | Servidores en DonWeb unidos por LAN | ⬜ | |
| F0.2 | Coolify + limpieza de Docker | ⬜ | Postergada por decisión tuya |
| F0.3 | Supabase en el servidor DATA | ⬜ | |
| F0.4 | Cerrar Postgres al mundo | ⬜ | **Compuerta F0** |
| F0.5 | Restringir Studio | ⬜ | |
| F0.6 | `pg_trgm` y `unaccent` | 🟡 | **Compuerta F0.** Verificado en local con `scripts/verificar-esquema.mts`; falta producción |
| F0.7 | Storage: subir, leer, borrar | ⬜ | |
| F0.8 | Latencia real de la LAN | ⬜ | |
| F0.9 | Fijar versiones del stack | 🟡 | Parte de aplicación registrada en `VERSIONS.md`; falta la de infraestructura |
| F0.10 | Backup con restauración de prueba | ⬜ | |
| F0.11 | Resend como SMTP de Supabase | ⬜ | **Compuerta F0. Es la que muerde primero: sin esto no hay registro en producción** |
| F0.12 | Admin API de Auth | 🟡 | Sondeada en local (`scripts/sondear-auth.mts`); tres hallazgos abajo. Falta producción |
| F0.13 | *Send Email Hook* auto-hospedado | ⬜ | Su respuesta define cómo se hace F1.8 |

---

## F1 — Cimientos

| ID | Tarea | Estado | Nota |
|---|---|---|---|
| F1.1 | Proyecto Next.js 16 + estructura | ✅ | Sin `src/`, por decisión tuya. `TECHNICAL-SPEC.md` §4 actualizado |
| F1.2 | Tailwind 4 con los tokens | ✅ | |
| F1.3 | shadcn/ui mapeado a los tokens | ✅ | |
| F1.4 | Drizzle y la conexión a Postgres | ✅ | Contra el stack local. En producción cambia solo `DATABASE_URL` |
| F1.5 | Esquema completo de la base | ✅ | |
| F1.6 | Primera migración y extensiones | ✅ | Cuatro migraciones; la base se crea desde cero de una corrida |
| F1.7 | Supabase Auth: los tres métodos | ⛔ | Email completo y probado. **Google y Facebook necesitan que crees las apps en las consolas de Google y Meta** |
| F1.7b | `user_profiles` y alta con compensación | ✅ | La compensación se probó sola: un fallo real dejó cero identidades huérfanas |
| F1.7c | Resolución de sesión | ✅ | |
| F1.8 | Plantillas de email E1–E4 | ⬜ | **Depende de F0.13**: define si se unifican en React Email o se personalizan las de Supabase |
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
| F2.5 | Listado de productos | ⬜ | El listado **existe** desde F2.3, con lo mínimo para llegar al formulario y volver. Falta lo que le da nombre a la tarea: búsqueda, filtros por categoría/marca/estado, orden, y stock total/reservado/disponible con el cero destacado. F2.4 le agregó lo mínimo que no podía esperar: la etiqueta **«Sin colores»**, porque desde el alta en dos pasos un producto puede quedar cargado y sin nada que vender |
| F2.6 | ABM de medios de pago | ⬜ | |
| F2.7 | Configuración del sitio | ⬜ | |
| F2.8 | Cargar el catálogo real | ⬜ | |

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
| **Un color «en uso por algo activo» se mide por la variante, no por el producto** | `modules/catalog/queries.ts`, `modules/catalog/actions.ts` | RN-11b habla de «variantes activas de un color inactivo», pero el conteo miraba solo `products.is_active`. Hasta F2.4 no había variantes y no se podía ver; con variantes es un callejón sin salida: desactivás el color en el producto, volvés a intentar desactivar el color y el aviso te pide desactivar un producto que ya no lo ofrece. Ahora bloquea lo que RN-11b dice que bloquea, ni más ni menos |
---

## Qué está esperando algo tuyo

1. **F0.11 — Resend como SMTP.** Sin esto no hay registro en producción, y no
   se descubre hasta que alguien intenta crearse una cuenta. En local no se
   nota porque Mailpit captura todo.
2. **F1.7 — Google y Facebook.** Hay que crear las apps en Google Cloud y en
   Meta for Developers, con `/auth/v1/callback` como URI de retorno. El código
   ya resuelve la vinculación por email verificado; los botones se muestran
   deshabilitados con el motivo al lado.
3. **F0.13 — el *Send Email Hook*.** Su respuesta define cómo se hace F1.8.
4. **F0.7 — el bucket en producción.** `supabase/config.toml` declara
   `productos` para el stack local, pero eso no lo crea en el VPS. En
   producción lo crea F0.7, con los mismos tres valores: público en lectura,
   10 MiB de tope y `image/webp` como único tipo permitido.

---

## Pendiente detectado, sin tarea propia

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
