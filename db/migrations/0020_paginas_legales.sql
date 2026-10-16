-- Las cuatro páginas legales con su primer texto — RF-29, F9.3.
--
-- Es CONTENIDO y no esquema, y va en una migración a propósito: el pie
-- enlaza a las cuatro desde F1.13, y sin filas las cuatro dan 404 hasta que
-- alguien entre al panel. Desde acá en adelante el texto es de la
-- vendedora: lo edita en /admin/legales y ninguna migración lo vuelve a
-- tocar. Por eso `ON CONFLICT DO NOTHING`: correr esto sobre una base donde
-- ya se editó no pisa nada.
--
-- El borrador sale de las condiciones que la vendedora ya publicaba, más lo
-- que RF-29 pide que diga. Los datos de quién vende quedan marcados para
-- completar desde el panel. El email de contacto NO está acá: la página lo
-- pone abajo leyéndolo de la configuración, así cambia en un solo lugar.
--
-- El Markdown es el que emite el sanitizador (§16): `###`, `**` y `-`.

INSERT INTO legal_pages (slug, title, content) VALUES
('como-comprar', 'Cómo comprar', $md$AnaVende vende productos de informática y gaming en Viedma, Carmen de Patagones y alrededores. La página no cobra: elegís lo que querés acá, y el pago y la entrega los coordinamos por WhatsApp.

### Antes de comprar

Leé la descripción y fijate que el producto sea el que necesitás. Si te queda una duda, preguntanos antes de comprar: estamos para eso.

Todos los productos son nuevos y vienen en su empaque original.

### Dos formas de comprar

1. **Con tu cuenta.** Agregás los productos al carrito, elegís si te lo enviamos o lo retirás y confirmás el pedido. Guardamos el stock para vos y el pedido queda en **Mis compras**, donde podés seguirlo.
2. **Por WhatsApp, sin cuenta.** En cualquier producto tocás **Comprá ya por WhatsApp** y nos llega un mensaje con el producto, el color y el precio.

### Qué pasa después

1. Te confirmamos por WhatsApp el stock, el precio y la forma de pago.
2. Coordinamos la entrega a domicilio o el retiro.
3. Cuando lo recibís, la compra queda cerrada.

### Envío y retiro

Entregamos a domicilio en Viedma, Carmen de Patagones y alrededores, o lo retirás por nuestro punto de entrega. El costo del envío no está en el total del pedido: se coordina y se paga aparte.

El envío a domicilio es un compromiso de compra y en la entrega no se hacen pruebas. Si querés probar el producto, podés hacerlo cuando lo retirás.

### Pago

La página nunca te pide datos de tarjeta ni cobra en línea. Los medios de pago que aceptamos están al pie de cada página, y el pago se coordina por WhatsApp.$md$),

('garantias', 'Garantías y devoluciones', $md$Todos los productos son nuevos, vienen en su empaque original y tienen la garantía de su marca.

### Garantía

La garantía la da la marca de cada producto, con el plazo y las condiciones que fija el fabricante. AnaVende se hace cargo cuando el producto no funciona o tiene una falla de fábrica: escribinos y lo resolvemos.

### Cambios y devoluciones

- Aceptamos devoluciones solo por fallas de fabricación.
- El producto tiene que volver en perfectas condiciones, con su empaque original y con todos sus accesorios y manuales.
- Los cambios y las devoluciones se hacen en nuestro punto de entrega. Si preferís que te lo busquemos o te lo llevemos, el envío lo pagás vos.
- El costo del envío a domicilio de la compra no se reintegra.

### Antes de comprar

Leé la descripción y fijate que el producto sea el que necesitás: si al recibirlo no te sirve, el envío corre por tu cuenta. El envío a domicilio es un compromiso de compra y en la entrega no se hacen pruebas. Si querés probarlo, podés hacerlo cuando lo retirás.

### Cómo arrepentirte de una compra

Tenés 10 días corridos desde que hiciste el pedido para arrepentirte, mientras la orden siga activa, es decir, antes de que te la entreguemos:

- **Si compraste con tu cuenta**, entrá a **Mis compras**, abrí el pedido y tocá **Cancelar el pedido**. No tenés que explicar por qué.
- **Si compraste por WhatsApp**, avisanos por el mismo chat.

Una vez que recibiste el producto, la orden queda finalizada y valen las condiciones de cambios y devoluciones de arriba.

### Cómo pedir una garantía, un cambio o una devolución

Escribinos por WhatsApp con tu número de pedido y contanos qué pasa. Coordinamos cuándo traerlo al punto de entrega.$md$),

('terminos', 'Términos y condiciones', $md$### Quién vende

**Completar: nombre o razón social, CUIT y domicilio.**

### Uso del sitio

Al usar este sitio y hacer un pedido aceptás estas condiciones. Para comprar con cuenta tenés que registrarte con datos verdaderos y cuidar tu contraseña.

### Pedidos, precios y stock

- Los precios están en pesos argentinos. El de tu pedido es el que figura al confirmarlo.
- Confirmar un pedido guarda el stock para vos. La venta se cierra cuando te confirmamos por WhatsApp el stock, el precio y la forma de pago.

### Pago

La página no cobra en línea ni pide datos de tarjeta. El pago se coordina por WhatsApp con los medios que figuran al pie del sitio.

### Entrega

Entregamos solo en Viedma, Carmen de Patagones y alrededores, a domicilio o con retiro en nuestro punto de entrega. El costo del envío se coordina y se paga aparte.

### Garantías, cambios y arrepentimiento

Están explicados en **Garantías y devoluciones**, al pie de cada página.

### Tu cuenta

Podés pedir la baja de tu cuenta desde **Mi cuenta**. Podemos bloquear una cuenta que se use de mala fe.

### Cambios en estas condiciones

Podemos actualizar estas condiciones. La fecha de la última actualización está arriba de esta página.$md$),

('privacidad', 'Política de privacidad', $md$### Quién es responsable de tus datos

**Completar: nombre o razón social, CUIT y domicilio.**

Para cualquier consulta sobre tus datos, escribinos al email que figura al final de esta página.

### Qué datos guardamos

- Los de tu cuenta: nombre, apellido, email y teléfono.
- Las direcciones de entrega que cargás.
- Tus pedidos, tu carrito y tus favoritos.

### Para qué los usamos

Para preparar tus pedidos, coordinar el pago y la entrega por WhatsApp, y mandarte los emails de tu cuenta, como la verificación o el cambio de contraseña. No vendemos tus datos ni los compartimos con nadie, salvo lo necesario para entregarte el pedido y con los servicios que usamos para que el sitio funcione, como el envío de emails.

### Lo que se guarda en tu navegador

El sitio usa cookies propias, y ninguna es de publicidad ni de seguimiento:

- **La sesión**, para que no tengas que ingresar en cada página. Se borra cuando cerrás la sesión.
- **La compra pendiente**, cuando agregás algo al carrito o a favoritos sin haber ingresado. Recuerda ese producto para terminar la acción después de ingresar o registrarte, y dura una hora.
- **Vistos recientemente**, con los últimos diez productos que miraste, para mostrártelos en el inicio y en las fichas. Dura 90 días.
- **La vista de favoritos**, si elegís verlos como lista o como tarjetas. Dura un año.

Podés borrarlas cuando quieras desde la configuración de tu navegador. Sin la de la sesión no vas a poder ingresar a tu cuenta; las demás solo se olvidan de lo que recordaban.

### Tus derechos

Podés pedirnos ver, corregir o borrar tus datos. Tu nombre, teléfono y direcciones los podés cambiar desde **Mi cuenta**, y desde ahí también podés pedir la baja. Al dar de baja la cuenta no se borran tus pedidos, porque son el registro de las ventas.

El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a ellos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley 25.326. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.$md$)
ON CONFLICT (slug) DO NOTHING;
