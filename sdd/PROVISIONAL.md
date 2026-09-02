# AnaVende

Un e-commerce llamado AnaVende que se encarga de revender productos informaticos tales como mouses, teclados, auriculares, pasta termica, cables, memorias, entre otros.

## Listado de funcionalidades

Del lado del comprador:

- Una web similar a shop.app, cuyo sistema de diseño se encuentra en el archivo DESIGN-SHOPAPP.md
- Un catalogo, con un buscador, paginación y filtros por categorias, marcas y colores. Mostrar medios de pagos definidos por el vendedor
- Pagina con detalle del producto: imagenes, precio, marca, descuento, etc. Con la posiblidad de agregar al carrito o comprar directamente.
- Dos maneras de comprar, una con usuario logueado y otra sin loguearse. La primera te deja persistir un carrito de compras, mientras la segunda solo envia un mensaje de whatsapp con el producto a comprar.
- Un carrito persistente que actualiza los precios y/o informa al usuario de algun cambio de stock
- Un panel del comprador con sus datos, las compras que efectuo, favoritos y carrito de compras actual
- Al finalizar el carrito, una pagina de checkout donde muestre sus datos y la posibilidad de elegir otra direccion. Al confirmar, mostrar otra pantalla y posterior envio de mail.
- Informar en algun lado que los envios se realizan por pedidosYA
- Una sección de legales donde se explique tema de garantias y devoluciones.
- La web no cuenta con proceso de pago online en este mvp, ya que se manejaria por medio de whatsapp una vez creada la orden.

Del lado del vendedor:

- Un panel protegido para gestionar el catalogo, stock, ordenes de compras, marcas, categorias, colores disponibles y usuarios.
- Poder crear, modificar y/o eliminar productos con imagenes incluidas.
- Cada producto podrá tener un máximo de 5 imagenes. Cada imagen subido debe pasar por una sección de reducción y optimización para la página. El usuario tendrá como limite por imagen hasta 10mb, pero el sistema tiene que poder convertirlas en wepb y reducir considerablemente su peso.
- El vendedor tendrá la posibilidad de crear, modificar, resetear contraseña y bloquear usuarios. El bloqueo debe contener una razón y posterior aviso al usuario cuando intente iniciar sesión.
- Un listado de las ordenes de compras activas, finalizadas, canceladas. (No haria falta otro estado por el momento ya que se manejaria el resto por otro medio)
- Cada orden se puede completar completamente o no. El vendedor debe tener la posibilidad de eliminar productos de la orden.
- Las ordenes activas, reducen temporalmente el stock del producto hasta que se finalicen o cancelen (ya sea por el comprador o vendedor).
- El vendedor puede crear ordenes de compra de ventas realizadas fuera de la pagina web, con el fin de mantener el stock.
- Un manejo de stock de acuerdo a color. Es decir, un producto puede tener mas de un color. A su vez se cargarian distintas imagenes y stock para cada color, dando la posiblidad de utilizar (en caso de ser ncesario) las imagenes de otro color.
- Un sección de devoluciones que se hcieron, el cual aumente el stock o no (puede ser que el producto este defectuoso y ya no se venda)
- Un reporte de las ventas realizadas en la pagina segun las ordenes creadas. No tener en cuenta a los usuarios no registrados.
- El vendedor se hara cargo de mantener el stock por las ventas realizadas fuera de la pagina o por compradores que no tengan usuario creado en la misma (ventas por whatsapp)

## Stack técnico

- NextJS 16
- Better Auth (no se implementó, en su defecto se utiliza supabase auth)
- TailwindCSS
- Componentes de shadcn/ui o similiar, con el fin de simplicar
- PostgreSQL + Drizzle
- Supabase
- Resend para emails
- Proyecto deployado en VPS con Coolify para nextjs y un vps para supabase
