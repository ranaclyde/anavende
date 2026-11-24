# Compras a proveedores — idea

> **Estado:** idea anotada el 2026-11-24, **sin especificar**. Es posterior al
> MVP y está en el backlog de `DEVELOPMENT-PLAN.md` §6, sin prioridad. **La
> lectura del PDF o la foto de la factura (§6) es opcional**: se puede hacer
> todo lo demás sin ella. Si se retoma, se especifica en serio en este mismo
> directorio y se baja a RF, RN y tareas en `sdd/mvp/`.

## 1. El problema

Hoy el stock entra por dos caminos: el **ajuste manual** (`ajustar` en
`modules/stock/operaciones.ts`), donde la vendedora cuenta y **escribe el
total**, y la **devolución con reposición** (`reponer`), que suma lo que
vuelve. Reserva, liberación y venta mueven stock que ya estaba. Todo queda en
el libro `stock_movements`.

Falta la entrada más común: **la mercadería que se le compra a un
proveedor**. Cargarla como ajuste pierde de dónde vino, cuánto costó y contra
qué factura, y obliga a que el producto exista antes de poder anotar nada.

## 2. La idea

La administradora carga la compra como viene en la factura, **vincula** cada
renglón a una variante cuando puede —ya o más adelante— y **suma al stock**
cuando la mercadería está en la caja. Vincular y sumar son dos pasos
separados: vincular responde «qué producto es», sumar responde «ya está acá».

**Tablas, a grandes rasgos:**

- `suppliers`: los proveedores (nombre, contacto).
- `purchases`: la compra (proveedor, fecha, número de factura o remito, nota).
- `purchase_items`: los renglones tal como vienen en la factura (descripción,
  código del proveedor si tiene, cantidad, **costo unitario**), con la
  variante —opcional— y si ya está en stock.
- `supplier_products`: «el código ABC-123 de este proveedor es esta variante».
  Se llena sola al vincular, y la próxima compra del mismo producto al mismo
  proveedor llega vinculada.

## 3. Los renglones y el botón

Cada renglón tiene tres estados:

| Estado | Qué quiere decir | Qué se puede hacer |
|---|---|---|
| **Sin vincular** | Solo el texto de la factura | Vincularlo a una variante existente, o crear el producto con el formulario precargado |
| **Vinculado** | Se sabe qué variante es; el stock todavía no se tocó | Cambiar el vínculo, la cantidad o el costo |
| **En stock ✓** | Ya se sumó, con su asiento en el libro | Queda fijo, salvo «Sacar del stock» (abajo) |

```
Compra · Proveedor A · Factura 0003-00012345 · 12/11
───────────────────────────────────────────────────────
Auriculares Redragon H510 ×5  → Negro         En stock ✓
Mouse Genius DX-120       ×10 → Negro         Vinculado
Cable HDMI 2 m            ×20 → —             Sin vincular  [Vincular]
───────────────────────────────────────────────────────
                     [Guardar]  [Guardar y sumar al stock (1)]
```

- **«Guardar»** guarda sin tocar el stock.
- **«Guardar y sumar al stock (x)»**: x son los renglones **vinculados que
  todavía no están en stock**, no todos los vinculados. Con x en cero, el
  botón está deshabilitado y dice por qué.
- **Antes de sumar, una confirmación con el detalle**: «Mouse Genius DX-120 ·
  Negro: 4 → 14». Es el único paso que mueve stock real, y ver el total nuevo
  es lo que hace notar un cero de más.
- **Suma, no escribe el total**: como `reponer`, no como `ajustar`. Una venta
  entre medio no descuadra nada. Cada renglón deja un asiento de un tipo
  nuevo, `compra`, enlazado a la compra.
- **El tilde «En stock» es la garantía contra sumar dos veces**, y la sostiene
  la base: un renglón no se suma de nuevo aunque se toque el botón dos veces o
  haya dos pestañas abiertas.
- **El momento lo decide quien carga.** Una compra se puede cargar el día del
  pedido y sumar cuando llega; no hace falta una marca aparte de «llegó».

**La compra calcula su estado sola**: *pendiente* (nada en stock), *parcial*
(algo) y *completa* (todo). Los renglones sin vincular aparecen en el
dashboard como algo para hacer.

**Casos que hay que contemplar:**

- **Un renglón que son varias variantes** («Auriculares X ×10»: 5 negros y 5
  blancos): el renglón se divide en dos, cada uno con su variante, y cada uno
  sigue su camino.
- **Un renglón en stock que estaba mal**: «Sacar del stock» resta lo que sumó,
  con su asiento, y el renglón vuelve a *vinculado* para corregirlo. Si esas
  unidades ya están reservadas o vendidas, no deja y lo explica, como hoy el
  ajuste manual.
- **El costo se edita siempre**: no toca el stock.
- **RN-11 se extiende**: una variante que aparece en una compra no se borra,
  se desactiva.

## 4. Más de un proveedor por producto

Viene solo: el proveedor está en la compra, no en el producto. El mismo
producto puede aparecer en compras de proveedores distintos, y como el costo
está en cada renglón, la ficha del panel puede mostrar el último costo de cada
uno («$ 8.000 en Proveedor A el 12/11, $ 7.500 en Proveedor B el 03/10»).

## 5. Lo que trae de regalo, y lo que hay que decidir

- **Ganancia en los reportes** (RF-28): con el costo, margen además de ventas.
- **Moneda**: muchos proveedores cotizan en dólares. Lo más simple, el costo
  siempre en pesos, al cambio del día de la compra.
- **Flete e IVA**: costo unitario final, con todo, o el flete aparte repartido
  entre los renglones. Lo más simple, el final.
- **El archivo de la factura**: la compra guarda su PDF o su foto en Storage,
  como hoy las imágenes. Sirve sin leer nada: la factura queda a mano junto a
  la compra.

## 6. Opcional: leer el PDF o la foto de la factura

Se sube el archivo y se manda a un **modelo de lenguaje con visión**, que
devuelve proveedor, fecha, número y renglones. Con eso se arma una compra en
**borrador**, con cada renglón marcado «a revisar»; la administradora corrige
y recién al aceptar es una compra de verdad. **Nunca suma stock por su
cuenta.**

- **Con visión y no con un extractor de texto**: las facturas de papel
  fotografiadas son justo donde un extractor falla.
- **La pantalla de revisión muestra el archivo al lado** de lo leído, para
  comparar renglón por renglón. Leer mal una cantidad o un costo es el riesgo,
  y la revisión obligatoria es lo que lo cubre.
- **Con `supplier_products`, la lectura además vincula**: un código conocido
  de ese proveedor llega vinculado.
- **Lo que cuesta**: una clave de API como secreto del servidor —nunca en el
  repositorio—, un costo bajo por factura, y que la factura del proveedor
  viaje a un servicio externo. No lleva datos de clientes, pero es información
  del negocio.

## 7. Tamaño y orden

| Paso | Qué | Tamaño |
|---|---|---|
| 1 | Proveedores, compras, renglones con los tres estados, vincular, dividir, sumar y sacar del stock | L |
| 2 | Adjuntar el archivo de la factura | S |
| 3 | Margen en los reportes | M |
| 4 | **Opcional**: leer el PDF o la foto | L |

La lectura va al final porque se apoya en todo lo anterior, y es mucho más
útil cuando `supplier_products` ya recuerda los códigos.
