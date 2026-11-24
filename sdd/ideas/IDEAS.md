# Ideas a futuro

> **Estado:** anotadas el 2026-11-24, **sin especificar y sin prioridad**.
> Todas son posteriores al MVP. Ninguna repite lo que ya está en FA
> (`FUNCTIONAL-SPEC.md`) ni en el backlog (`DEVELOPMENT-PLAN.md` §6). Las que
> crezcan se pasan a su propio directorio, como `sdd/caracteristicas/` o
> `sdd/compras/`, y de ahí a RF, RN y tareas.
>
> Los tamaños son los del plan (S, M, L) y son una primera impresión, no una
> estimación.

**Por dónde empezar, si se empieza:** la 8 (lo más barato, y da información
desde el primer día), la 5 (ahorra trabajo todas las semanas) y la 1
(convierte el «no hay stock» en una venta para después).

## Para vender más

### 1. «Avisame cuando vuelva» · M

Un botón en la ficha de un producto sin stock. Cuando entra stock —por ajuste
o por una compra—, le llega un email a quien lo pidió. En el panel se ve
**cuánta gente espera cada producto**, que ya es un dato de compra.

- Usa los emails transaccionales: conviene hacerlo junto con FA-07.

### 2. Carrito armado por la vendedora · M

Mucha venta empieza en un chat de WhatsApp. Desde el panel, Ana arma un
carrito con lo que habló con el cliente y le manda **un enlace**; el cliente
lo abre, lo tiene cargado y confirma la orden. La charla termina siendo una
orden de la web, con su stock reservado, en vez de una orden manual (RF-24)
cargada después.

### 3. Catálogo para Google, Instagram y WhatsApp Business · M

Un *feed* que se genera solo con productos, precios, stock y fotos. Google
Merchant lo muestra gratis en la pestaña Shopping; Meta lo usa para el
catálogo de Instagram y de WhatsApp Business. Ana no carga los productos dos
veces, y los precios no quedan desactualizados en otro lado.

### 4. Comparar productos · M

Elegir dos o tres productos y verlos lado a lado: precio, marca y, cuando
existan, las características (`sdd/caracteristicas/IDEA.md`). Sin ellas
compara poco: conviene después.

## Para operar mejor

### 5. Actualización masiva de precios · S a M

«Subir 8 % todo lo de la marca Redragon» o «toda la categoría Cables», con una
**vista previa del antes y el después** antes de aplicar. Con la inflación,
cambiar precios de a uno es la tarea más repetida del panel.

- Más adelante: el costo en dólares y el precio recalculado con el cambio del
  día. Se apoya en las compras (`sdd/compras/IDEA.md`).

### 6. Recuento de inventario · M

Un modo «contar el depósito» desde el celular: se recorren las variantes, se
escribe lo que hay, y al final **se aplica todo junto** como ajustes del libro
de stock, con una nota («recuento del 24/11»). Hoy contar es abrir producto
por producto.

- Si las variantes llevan código de barras algún día, se cuenta escaneando
  con la cámara.

### 7. Garantía de cada venta · M

Cada producto lleva sus meses de garantía, y en «Mis compras» el cliente ve
**hasta cuándo** está cubierto lo que compró, con una consulta por WhatsApp
que ya lleva la orden y el producto. Es una pregunta que llega siempre con
productos de tecnología, y Ana deja de buscar «¿cuándo me lo compraste?».

## Para decidir mejor

### 8. Lo que buscan y no encuentran · S

Guardar las búsquedas sin resultados —**sin datos de quién buscó**— y mostrar
en el panel las más repetidas («sillas gamer: 14 veces este mes»). Es el dato
más directo de qué conviene comprar, y la tienda ya detecta la búsqueda vacía
para mostrar el cierre con WhatsApp.
