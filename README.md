# AnaVende

Tienda online de productos de informática y gaming para Viedma, Carmen de
Patagones y alrededores. **No cobra online**: la web es catálogo, carrito y
generadora de órdenes, y la venta se cierra por WhatsApp con Ana, la
vendedora, que ya recibe el producto, el color, la cantidad y el precio.

Tiene dos lados:

- **La tienda**, para quien compra: catálogo con filtros y búsqueda, ficha de
  producto, carrito, favoritos, direcciones e historial de órdenes. Quien no
  tiene cuenta navega todo y consulta por WhatsApp.
- **El panel** (`/admin`), para Ana: productos con sus fotos y su stock por
  color, órdenes, devoluciones, usuarios y reportes. El stock del sistema es
  la única fuente de verdad, incluidas las ventas por WhatsApp o en persona.

## Documentación

**Para entender el sistema**

- [Arquitectura](docs/ARQUITECTURA.md): cómo está armado y cómo se conectan
  las piezas.
- [Funcionamiento](docs/FUNCIONAMIENTO.md): los recorridos importantes, paso
  a paso: comprar, gestionar una orden, cargar un producto, las cuentas.

**Para trabajar en el código**

- [Cómo se trabaja](CLAUDE.md): idioma, ramas, PR y lo que se revisa antes
  de commitear.
- [Diseño](DESIGN.md): tokens, componentes y la lista de accesibilidad de
  cada pantalla.
- [Versiones](VERSIONS.md): las versiones exactas del stack, que son las que
  se consultan en la documentación de cada biblioteca.

**Para operar**

- [Operación](docs/OPERACION.md): despliegue, migraciones, variables de
  entorno, tareas programadas y qué mirar cuando algo falla.
- [Seguridad](SECURITY.md): cómo reportar una vulnerabilidad.

**El porqué de cada cosa**

- [Producto](PRODUCT.md): para quién es, qué resuelve y cómo se posiciona.
- [Especificación funcional](sdd/mvp/FUNCTIONAL-SPEC.md): qué tiene que
  hacer el sistema, con sus requisitos y reglas de negocio.
- [Especificación técnica](sdd/mvp/TECHNICAL-SPEC.md): arquitectura, modelo
  de datos, stock, autenticación y despliegue, tal como se planearon.
- [Referencia de diseño](sdd/mvp/DESIGN-REFERENCE.md): la identidad visual y
  cada pantalla.
- [Plan de desarrollo](sdd/mvp/DEVELOPMENT-PLAN.md): las fases y sus tareas.
- [Progreso](PROGRESO.md): el estado tarea por tarea y las decisiones que se
  apartaron de las especificaciones.

Las especificaciones mandan: si el código o este README dicen otra cosa, se
corrige uno de los dos y la diferencia se anota en `PROGRESO.md`.

## Stack

Next.js 16 (App Router) con React 19 y TypeScript, Tailwind CSS 4 y
shadcn/ui. Supabase auto-hospedado para la autenticación y el almacenamiento
de fotos, con Drizzle sobre Postgres 15 para los datos. Sharp convierte las
fotos, React Email arma los correos y Sentry recibe los errores. Vitest para
los tests y Playwright para los de extremo a extremo. Las versiones exactas
están en [VERSIONS.md](VERSIONS.md).

Producción son dos servidores: uno corre la aplicación con Coolify y el otro,
Supabase. Hay un solo entorno: producción y el desarrollo local.

## Levantarlo en local

Hace falta Node 22, Docker y el [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started),
que no viene entre las dependencias del proyecto.

```sh
npm ci
npm run dev:stack            # Postgres, Auth, Storage, Studio y Mailpit en Docker
cp .env.example .env.local   # y completarlo con los valores del stack local
npm run db:reset             # crea el esquema y lo verifica
npm run seed                 # carga un catálogo de prueba
npm run dev                  # http://localhost:3000
```

Las claves de `.env.local` salen de `npx supabase status`. Son las del stack
local, fijas e iguales en todas las máquinas; las de producción no van en
ningún archivo del repositorio. Con el stack levantado:

| Qué                            | Dónde                    |
| ------------------------------ | ------------------------ |
| La tienda                      | <http://localhost:3000>  |
| Studio, para mirar la base     | <http://localhost:54323> |
| Mailpit, donde caen los emails | <http://localhost:54324> |

Una cuenta nueva nace como `customer`. Para entrar al panel, se le da el rol
desde Studio:

```sql
UPDATE user_profiles SET role = 'admin', updated_at = now()
 WHERE email = 'tu@email' RETURNING id, email, role;
```

**`npm run db:reset` borra la base a la que apunte `DATABASE_URL`.** En local
es lo que se quiere; contra cualquier otra cosa, no.

## Scripts

| Script                                 | Qué hace                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                          | La aplicación en modo desarrollo                                                                                                           |
| `npm run dev:stack` / `dev:stack:stop` | Levanta o apaga el stack local de Supabase                                                                                                 |
| `npm test`                             | Los tests de Vitest. Corren solo contra el stack local, y se niegan a arrancar si `.env.test` apunta a otro lado (ver `.env.test.example`) |
| `npm run e2e`                          | Los tests de Playwright. Levantan `npm run dev` si no está corriendo                                                                       |
| `npm run lint` / `typecheck`           | ESLint y el chequeo de tipos                                                                                                               |
| `npm run db:generate`                  | Genera una migración a partir de cambios en `db/`                                                                                          |
| `npm run db:migrate`                   | Aplica las migraciones pendientes                                                                                                          |
| `npm run db:reset`                     | Recrea la base local desde cero y verifica el esquema                                                                                      |
| `npm run seed` / `seed:limpiar`        | Siembra el catálogo de prueba, o borra solo lo que sembró                                                                                  |
| `npm run email`                        | Convierte las plantillas de `lib/email/` en el HTML que usa Auth                                                                           |

Antes de commitear algo que lea la base, `DATABASE_URL= npx next build`:
producción compila sin base, y `next dev` no muestra ese error.

## Cómo llega a producción

Nada va directo a `main`: rama, PR y merge con _merge commit_. Un push a
`main` hace que Coolify construya la imagen con el `Dockerfile` y la levante;
las migraciones se aplican al arrancar el contenedor. No hay CI.
