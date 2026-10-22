# Arquitectura

Cómo está armado AnaVende hoy y por qué cada pieza está donde está. Para el
detalle de cada decisión, este documento remite a su sección de la
[especificación técnica](../sdd/mvp/TECHNICAL-SPEC.md) (TS).

## El mapa

```mermaid
flowchart LR
    nav([Navegador])

    subgraph cf [Cloudflare]
        dns[DNS y caché]
    end

    subgraph app [Servidor APP · Coolify]
        traefik[Traefik]
        next[Next.js<br/>Server Components<br/>Server Actions<br/>proxy.ts]
        tareas[Tareas programadas<br/>limpiar-cuentas]
    end

    subgraph data [Servidor DATA · Supabase auto-hospedado]
        nginx[nginx]
        kong[Kong]
        gotrue[GoTrue<br/>autenticación]
        storage[Storage<br/>fotos]
        pg[(PostgreSQL 15)]
    end

    resend[Resend<br/>emails]
    sentry[Sentry<br/>errores]
    wa[WhatsApp]

    nav -- HTTPS --> dns --> traefik --> next
    nav -- fotos --> nginx
    nginx --> kong --> gotrue & storage
    next -- "Drizzle · LAN privada" --> pg
    next -- "Auth y Storage" --> nginx
    gotrue --> pg
    tareas --> pg
    gotrue -- SMTP --> resend
    next -- E4 --> resend
    next --> sentry
    nav -. enlace wa.me .-> wa
```

Dos servidores, y un solo entorno de verdad: producción. El desarrollo local
levanta las mismas piezas de Supabase en Docker (TS §18.2).

- **El servidor APP** corre la tienda en un contenedor que Coolify construye
  con el `Dockerfile` en cada push a `main`. A la tienda solo se llega a
  través de Cloudflare: Traefik rechaza lo que no venga de sus rangos.
- **El servidor DATA** corre Supabase con su _docker compose_ oficial.
  Postgres escucha solo en la red privada entre los dos servidores; nginx
  atiende el HTTPS y le pasa a Kong lo que va a GoTrue y a Storage.
- **WhatsApp no tiene integración de servidor.** La tienda arma enlaces
  `wa.me` con el mensaje ya escrito y los abre el navegador de quien compra.
  No se cobra online: la venta se cierra en esa conversación.

## Qué hace Supabase y qué no

Supabase pone la **identidad** (GoTrue) y el **almacenamiento de fotos**
(Storage). Los datos los lee y escribe la tienda con **Drizzle sobre una
conexión directa a Postgres**: no se usa PostgREST ni RLS (TS §2.3, §13.8).

La consecuencia es la regla más importante del proyecto: **la autorización
vive en el servidor de Next, no en la base.** Un comprador no ve los datos de
otro porque cada consulta suya filtra por el id de la sesión, y un test de
extremo a extremo lo comprueba (`tests/e2e/aislamiento.spec.ts`).

## Cómo está organizado el código

```
app/          Rutas. Solo arman pantallas y llaman a modules/
  (shop)/     La tienda: home, catálogo, ficha, carrito, checkout, mi cuenta
  (auth)/     Ingreso, registro, recuperación y completar el perfil
  admin/      El panel de Ana
  api/        Callback y confirmación de Auth, subida de fotos, healthcheck
modules/      Lógica de negocio, una carpeta por dominio
db/           Cliente de Drizzle, esquema por dominio y migraciones
lib/          Piezas transversales: sesión, envoltorio de acciones, dinero,
              errores, clientes de Supabase, almacenamiento, emails
components/   ui/ (shadcn), shop/ y admin/
scripts/      Migrar al arrancar, limpiar cuentas, sembrar, verificar
tests/        unit/ (Vitest) y e2e/ (Playwright)
proxy.ts      El antiguo middleware.ts, con nombre de Next 16
```

**Regla de dependencias:** `app/` depende de `modules/`, y `modules/` de
`db/` y `lib/`. Nunca al revés, y una pantalla no importa `db/` directamente
(TS §4).

Los dominios de `modules/`: `catalog` (productos, variantes, categorías,
marcas, colores), `cart`, `orders`, `stock`, `returns`, `users`, `media`,
`reports`, `settings`, `content` (páginas legales y textos) y `panel` (el
tablero de inicio). Adentro, los archivos se separan por lo que hacen:
`queries.ts` lee, `actions.ts` son las Server Actions y `schemas.ts` las
validaciones de Zod. **Las lecturas del panel van en archivos aparte de las
del comprador** (`queries-panel.ts`): las del comprador filtran siempre por
usuario y las del panel no, así que mezclarlas invita a llamar a la que no
corresponde (TS §10).

## Lectura y escritura

**Leer** es un Server Component que llama a una función de `queries.ts`. No
hay caché de datos: las consultas están indexadas y tardan milisegundos, y
una caché mal invalidada muestra un precio o un stock que ya no es cierto.
Las mutaciones ya llaman a `revalidateTag`, así que sumarla después es un
cambio acotado, que solo se hace después de medir (TS §12).

**Escribir** es siempre una Server Action, y **todas pasan por el envoltorio
de `lib/action.ts`** (TS §6.2). En este orden:

1. lee la identidad y el perfil frescos de la base;
2. rechaza a un usuario bloqueado, y a un comprador con la baja pedida
   salvo en las acciones marcadas para eso;
3. valida la entrada con Zod en el servidor, aunque el formulario ya lo haya
   hecho;
4. ejecuta, distinguiendo los errores de negocio (`lib/errors.ts`) de los
   inesperados;
5. devuelve `{ ok, data }` o `{ ok: false, code, message }`, sin dejar pasar
   nunca un mensaje de Postgres;
6. manda a Sentry solo lo inesperado: un «sin stock» no es un incidente.

Una acción nueva queda cubierta con solo declararse con el envoltorio, sin que
nadie tenga que acordarse de nada.

## Autenticación y permisos

Hay dos roles, `customer` y `admin`, en `user_profiles.role` (TS §13).

- **`lib/session.ts`** resuelve la sesión en dos pasos: verifica el JWT de
  forma local, sin salir del servidor, y después lee el perfil de la base.
  El rol y el bloqueo se leen siempre frescos, porque dentro de un token
  quedarían congelados hasta que se renueve, y bloquear a alguien tiene que
  cortarlo en el momento (TS §13.3).
- **`proxy.ts`** manda a ingresar a quien no tiene sesión y entra en
  `/admin`, `/mi-cuenta`, `/carrito`, `/checkout` u `/orden`. Es una
  comodidad, **no el control de acceso**.
- **El control de acceso** está en el layout de `/admin` y al principio de
  cada página del panel (`exigirAdmin()`), en el envoltorio de cada acción y
  en el filtro por usuario de cada consulta del comprador.
- **Contra las altas falsas** (TS §16): Turnstile en el alta, el ingreso, el
  reenvío y la recuperación, validado por GoTrue; límites de intentos por
  persona, con la IP real del comprador que la tienda le pasa a GoTrue
  (`lib/supabase/cliente-ip.ts`); y una tarea que borra a las 48 horas las
  cuentas que nunca confirmaron el email (`scripts/limpiar-cuentas.mjs`).

## Stock: el núcleo delicado

Es la parte donde un error no se nota hasta que la misma unidad se vendió dos
veces (TS §8). Todo pasa por `modules/stock/operaciones.ts`, y nada más
escribe los contadores.

- Cada variante (producto y color) tiene **dos contadores**:
  `stock_total` y `reserved_stock`. Lo disponible es la resta.
- Confirmar una orden **reserva**; finalizarla **descuenta** del total y
  libera la reserva; cancelarla **libera**.
- Cada cambio es **un solo `UPDATE` condicional**: la condición del `WHERE`
  es la regla de negocio. Dos compradores que confirman la última unidad a la
  vez dan un ganador y un `INSUFFICIENT_STOCK`, nunca dos ventas.
- Cada movimiento deja un asiento en un **libro mayor**, con el estado que
  dejó, sacado del `RETURNING` y no de una segunda lectura. La suma de los
  asientos tiene que dar el stock total, y los tests lo verifican.

## Fotos

Las fotos se convierten **al subirlas**, no al mostrarlas (TS §9).

1. El panel sube el original a `app/api/admin/upload`.
2. `modules/media/procesar.ts` lo pasa por sharp, en memoria: tres WEBP de
   distintos tamaños para la pantalla y un JPEG para la vista previa al
   compartir. **El original no se guarda.**
3. `lib/storage/` los sube a Storage. El resto del código maneja claves,
   nunca URLs: cambiar de proveedor es reescribir ese adaptador.
4. El navegador las pide **directo a Storage**, sin pasar por el servidor
   APP. La excepción es la vista previa al compartir, que sale del dominio
   de la tienda (`app/vista-previa/`) porque desde el de Storage WhatsApp no
   la mostraba.

## Emails

- **Los de la cuenta** (confirmar el alta, recuperar la contraseña, la
  invitación del panel y el reenvío) los manda **GoTrue** por el SMTP de
  Resend. Las plantillas están en `lib/email/`, y `npm run email` las
  convierte en el HTML que GoTrue descarga de `public/emails/`.
- **El aviso de nueva orden a Ana** (E4) lo manda la tienda por la API de
  Resend (`lib/email/enviar.ts`). Sale después de que la orden quedó
  guardada, y un fallo de envío nunca la revierte: queda registrado en
  Sentry.

## Despliegue y arranque

- Un push a `main` dispara a Coolify, que construye la imagen **en el
  servidor APP**. No hay CI (TS §18.2).
- Al arrancar, el contenedor corre `scripts/migrar.mjs` **antes** de levantar
  Next. Si una migración falla, el contenedor no arranca, en vez de quedar
  sirviendo contra un esquema que no es el suyo.
- `/api/salud` es el healthcheck. A propósito, no consulta la base: un hipo
  de Postgres reiniciaría el contenedor en cadena.
- La compilación no tiene acceso a la base. Por eso la conexión de
  `db/index.ts` es perezosa, y por eso se prueba `DATABASE_URL= npx next build`
  antes de commitear.
- **Modo mantenimiento** (`modules/settings/mantenimiento.ts`): con el
  interruptor del panel, la tienda contesta 503 al público y sigue normal
  para quien administra.
- Sentry recibe los errores del servidor y del navegador; lo del navegador
  entra por `/monitoring`, en el mismo dominio, para que no lo frenen los
  bloqueadores. Antes de enviar, `lib/sentry-scrub.ts` le quita los datos
  personales.

## Dónde seguir

| Para                                    | Leé                                                               |
| --------------------------------------- | ----------------------------------------------------------------- |
| El modelo de datos, tabla por tabla     | TS §5 y `db/schema/`                                              |
| Las reglas de negocio                   | [Especificación funcional](../sdd/mvp/FUNCTIONAL-SPEC.md) y TS §7 |
| La creación de una orden, paso a paso   | TS §8.4 y `modules/orders/crear.ts`                               |
| Búsqueda y catálogo                     | TS §10                                                            |
| Seguridad                               | TS §16                                                            |
| Qué se apartó de lo planeado, y por qué | La tabla de desviaciones de [PROGRESO.md](../PROGRESO.md)         |
