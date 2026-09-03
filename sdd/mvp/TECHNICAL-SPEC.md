# AnaVende — Especificación Técnica (MVP)

| Campo | Valor |
|---|---|
| Producto | AnaVende — e-commerce de reventa de productos informáticos |
| Versión | 1.0 (MVP) |
| Fecha | 2026-08-31 |
| Documento base | `FUNCTIONAL-SPEC.md` |
| Documentos hermanos | `DESIGN-REFERENCE.md`, `DEVELOPMENT-PLAN.md` |
| Versiones verificadas el | 2026-08-31 (revalidar al momento de instalar) |

---

## 1. Principios de arquitectura

| # | Principio | Consecuencia práctica |
|---|---|---|
| **P1** | **Una sola aplicación, un solo despliegue.** | Todo vive en un proyecto Next.js. No hay backend separado, ni microservicios, ni colas. |
| **P2** | **El servidor es la única fuente de verdad.** | Precios, stock y permisos se calculan y validan siempre en el servidor. El cliente nunca envía un precio ni un total. |
| **P3** | **El stock se toca solo con operaciones atómicas.** | Toda mutación de stock es un `UPDATE` condicional dentro de una transacción. Nunca leer-modificar-escribir en JavaScript. |
| **P4** | **Nada de dinero en punto flotante.** | `numeric(12,2)` en la base, `string` en el transporte, aritmética con decimales exactos. `parseFloat` está prohibido sobre montos. |
| **P5** | **Toda operación sensible deja rastro.** | Cambios de stock, de estado de orden y de usuarios se escriben en tablas de auditoría en la misma transacción que el cambio. |
| **P6** | **Piezas conocidas antes que piezas ingeniosas.** | Se prefiere una consulta SQL explícita sobre una abstracción; se evita agregar servicios que haya que mantener. |
| **P7** | **Fallar fuerte y claro.** | Un error de negocio es un tipo, no un `throw` genérico; llega al usuario como mensaje accionable y a Sentry con contexto. |

---

## 2. Stack

### 2.1 Núcleo

| Pieza | Versión de referencia | Rol |
|---|---|---|
| **Next.js** | 16.3.x (App Router) | Framework único: renderizado, ruteo, Server Actions |
| **React** | 19.2 (canary que acompaña a Next 16) | UI |
| **Node.js** | 22 LTS (mínimo exigido por Next 16: 20.9) | Runtime |
| **TypeScript** | 5.x (mínimo exigido: 5.1) | Tipado, en modo `strict` |
| **PostgreSQL** | 15+ | Base de datos |
| **Drizzle ORM** | 0.45.x + `drizzle-kit` | Acceso a datos y migraciones |
| **Supabase Auth** (GoTrue) | El del stack auto-hospedado | Identidad: contraseñas, OAuth, verificación de email |
| **`@supabase/supabase-js` + `@supabase/ssr`** | Últimas | Cliente de Auth y Storage desde Next.js |
| **Tailwind CSS** | 4.x | Estilos |
| **shadcn/ui** | — | Componentes base sobre Radix UI |
| **Zod** | 4.x | Validación de entrada, compartida cliente/servidor |
| **sharp** | 0.35.x | Conversión y redimensionado de imágenes |
| **Resend** + **React Email** | `resend` 6.x | Emails transaccionales |
| **ExcelJS** | 4.x | Exportación de reportes a `.xlsx` |
| **Sentry** | `@sentry/nextjs` | Captura de errores |
| **Vitest** + **Playwright** | — | Tests unitarios y E2E |

> **Esta tabla es el parámetro de las consultas de documentación.** Al escribir código contra cualquiera de estas piezas se consulta la skill `context7` fijada a la versión de esta columna, no a la última publicada (`DEVELOPMENT-PLAN.md` §1.2, regla 6). Las versiones exactas instaladas se registran en F0.9; si difieren de las de referencia, **manda lo registrado en F0.9** y esta tabla se actualiza.

> **Nota sobre ExcelJS:** se elige por sobre `xlsx`/SheetJS porque este último dejó de publicarse en npm y arrastra vulnerabilidades conocidas en las versiones que sí están allí.

### 2.2 Infraestructura

**Dos Cloud Servers en DonWeb, unidos por red privada (LAN virtual).**

| Servidor | Contiene | Expuesto a internet |
|---|---|---|
| **APP** | Coolify + Next.js | Sí — HTTPS del sitio |
| **DATA** | Supabase auto-hospedado (stack completo) | **Postgres: no.** Storage y Studio: sí, por HTTPS |

| Pieza | Uso |
|---|---|
| **Coolify** (servidor APP) | Orquestación de contenedores, TLS con Let's Encrypt, despliegue desde Git |
| **PostgreSQL** (servidor DATA) | Base de datos. Accedida **solo por la red privada** |
| **Supabase Storage** (servidor DATA) | Almacenamiento y entrega de las imágenes de producto |
| **Supabase Studio** (servidor DATA) | Inspección de datos para desarrollo y soporte |

**Lo que se usa de Supabase y lo que no:**

| Se usa | No se usa |
|---|---|
| PostgreSQL | PostgREST — el acceso a datos es **Drizzle** |
| **Auth (GoTrue)** — identidad y OAuth | **RLS** — la autorización vive en la aplicación (§13.5) |
| Storage | Realtime, Edge Runtime, Supavisor |
| Studio (inspección) | |

> **Auth y datos van por caminos distintos, a propósito.** La identidad se consulta con el SDK de Supabase; el resto de los datos, con Drizzle sobre la conexión directa. No se mezclan: el SDK nunca lee tablas de dominio y Drizzle nunca escribe en `auth`.

### 2.3 Decisiones de stack y sus motivos

| Decisión | Motivo |
|---|---|
| **Supabase Auth en lugar de un sistema propio** | Ya corre en el servidor DATA: no suma una pieza a mantener. Verifica el JWT **localmente** contra el JWKS, sin llamar al servidor de autenticación en cada guardia de página. Y **vincula automáticamente** las identidades con el mismo email verificado, con protección contra apropiación previa de cuenta (RF-06). El costo asumido está en §13.6. |
| **Conexión directa a Postgres, sin PostgREST ni RLS** | La autorización vive en el servidor de Next. RLS se evaluó y se descartó: como el JWT no llega a Postgres por la vía de Drizzle, quedaría inerte salvo un rediseño del acceso a datos (§13.8). |
| **Server Actions en lugar de una API REST** | No hay otro consumidor previsto. Evita mantener una capa de endpoints, tipos de request/response y un cliente HTTP para lo mismo que ya resuelve una función tipada. |
| **`numeric(12,2)` en lugar de centavos enteros** | Decisión del negocio: la base se lee y se audita a mano. Se compensa con la disciplina de P4 (§7.1). |
| **sharp síncrono, sin cola** | Cinco imágenes por variante, cargadas por una sola persona. Una cola sumaría un worker, un broker y estados intermedios en la UI para resolver un problema que no existe a esta escala. |
| **Sin `cacheComponents` en el MVP** | Es opt-in y todavía evoluciona. El catálogo es chico y las consultas se resuelven en milisegundos; la caché se suma después, con medición, y no antes (§12). |
| **Almacenamiento tras una interfaz** | El backend es Supabase Storage, pero un adaptador de tres métodos (§9.4) evita que el SDK se filtre por todo el código y deja abierta la sustitución. |

### 2.4 Infraestructura: decisión y análisis que la respalda

**Decisión adoptada: dos Cloud Servers en DonWeb, unidos por LAN virtual.** El análisis que sigue se conserva porque explica los límites de cada pieza y sirve para dimensionar las ampliaciones futuras.

#### Consumo real de cada pieza

| Componente | RAM en reposo | Fuente |
|---|---|---|
| Coolify (su propio stack) | 0,3 – 1,2 GB | Mediciones de la comunidad; sin cifra oficial |
| **Supabase auto-hospedado, stack completo** | **1,5 – 2,5 GB** | Medición por servicio; Kong y Logflare son los más caros |
| PostgreSQL a secas, ajustado | **< 150 MB** | Configuración por omisión: `shared_buffers` 128 MB |
| Next.js en producción | ~300 MB | — |
| sharp, por imagen concurrente | +150 – 200 MB transitorio | Derivado del modelo de píxeles de libvips |
| MinIO (nodo único) | ~280 MB | Medición de la comunidad |

**Requisito oficial de Coolify: 2 CPU, 2 GB de RAM y 30 GB de disco.** El disco suele ser el límite que se alcanza primero, porque Coolify conserva las imágenes Docker de despliegues anteriores y la caché de build. Existe una **limpieza automática incorporada, pero no viene activada**: hay que configurarla.

#### Opciones evaluadas

| Opción | RAM necesaria | Latencia a la base | Observaciones |
|---|---|---|---|
| **A. Un servidor, Postgres propio + volumen local** | ~1,5 GB | ~0,1 ms | La más simple y la más barata. Dos servicios que operar en lugar de trece |
| **B. Un servidor, Supabase auto-hospedado** | ~4 GB | ~0,1 ms | Se pagan doce servicios para usar dos |
| **C. Dos servidores (app + Supabase)** | 1,5 GB + 2,5 GB | 1 – 30 ms | Suma costo, latencia en cada consulta y exposición de Postgres a la red |
| **D. Supabase Cloud, plan gratuito** | ~1 GB (solo la app) | 25 – 40 ms | **Descartada para producción**, ver abajo |

#### Por qué se descarta el plan gratuito de Supabase Cloud para producción

| Límite | Consecuencia |
|---|---|
| **5 GB de egress + 5 GB cacheado** | Una página de catálogo con 24 productos pesa ~1,2 MB en imágenes ⇒ el corte llega a las **~4.000-8.000 vistas mensuales** |
| **Al cruzar el límite se devuelve HTTP 402 en todos los servicios** | El sitio deja de funcionar por completo hasta el siguiente ciclo de facturación o hasta pagar. No se degrada: se apaga |
| **Sin backups de ningún tipo** | Inaceptable para un sistema con órdenes reales |
| **Pausa automática tras 7 días de inactividad** | — |
| **Latencia de 25-40 ms por consulta** (región São Paulo) | Cinco consultas secuenciales consumen la mitad del presupuesto de 300 ms del §20 |

**Sí es una excelente base de datos de desarrollo**, y así se la recomienda usar: producción en infraestructura propia, desarrollo contra el plan gratuito.

#### La decisión adoptada, y qué resuelve

Se adopta la **opción C** con una precisión importante: **ambos servidores están en DonWeb y se comunican por su red privada**.

| Objeción original | Cómo queda resuelta |
|---|---|
| Latencia de 5-30 ms por consulta | **Resuelta.** La estimación asumía proveedores o regiones distintas. Dentro del mismo datacenter y por LAN virtual, la latencia es de **1-2 ms**: cinco consultas secuenciales cuestan ~10 ms sobre un presupuesto de 300 ms (§20) |
| Postgres expuesto a internet | **Resuelta.** Postgres escucha únicamente en la interfaz privada. La documentación de DonWeb describe exactamente este uso |
| Supabase completo consume 1,5-2,5 GB | **Resuelta.** Con un servidor dedicado, la memoria deja de competir con la aplicación |
| Doce servicios para usar tres | **Aceptada como costo.** A cambio se obtienen Studio para inspeccionar datos y Storage ya resuelto |

#### Requisitos de aprovisionamiento

| Servidor | Mínimo | Motivo |
|---|---|---|
| **APP** | 2 vCPU · 2 GB RAM · **30 GB disco** | Mínimo documentado de Coolify. Con 2 GB, compilar fuera del servidor es obligatorio (§18.2) |
| **DATA** | 2 vCPU · 4 GB RAM · 40 GB disco | Supabase completo ocupa 1,5-2,5 GB; el resto queda para Postgres, Storage y crecimiento |

> **Sobre el firewall de DonWeb:** su firewall virtual **solo aplica a la interfaz pública**. Para restringir el tráfico por la interfaz privada hay que configurar un firewall local (`ufw` / `iptables`) en cada servidor. No hacerlo deja la base accesible a cualquier otra máquina que comparta esa LAN.

#### Reparto de exposición pública

| Servicio | Interfaz | Motivo |
|---|---|---|
| Next.js | Pública, HTTPS | Es el sitio |
| **Postgres** | **Solo privada** | Nunca debe aceptar conexiones desde internet |
| Supabase Storage | Pública, HTTPS, subdominio propio | Las imágenes las descarga el navegador directamente: pasarlas por el servidor APP duplicaría el tráfico y le sumaría carga |
| Supabase Studio | Pública, HTTPS, **con autenticación y restricción por IP** | Herramienta de administración: nunca abierta |

---

## 3. Arquitectura de alto nivel

```
            ┌──────────────────────────┐        ┌──────────────────────────┐
            │   SERVIDOR APP (DonWeb)  │        │  SERVIDOR DATA (DonWeb)  │
            │  ┌────────────────────┐  │        │  ┌────────────────────┐  │
 Navegador  │  │  Coolify           │  │        │  │  Supabase          │  │
   ──HTTPS──┼─▶│  ┌──────────────┐  │  │        │  │  ┌──────────────┐  │  │
            │  │  │ Next.js 16   │  │  │        │  │  │  PostgreSQL  │  │  │
            │  │  │              │  │  │ LAN    │  │  │              │  │  │
            │  │  │ Server Comp. │  │  │ privada│  │  └──────────────┘  │  │
            │  │  │ Server Act.  │──┼──┼────────┼──┼─▶ (solo privada)   │  │
            │  │  │ Route Handl. │  │  │Drizzle │  │                    │  │
            │  │  │ proxy.ts     │  │  │        │  │  ┌──────────────┐  │  │
            │  │  └──────────────┘  │  │        │  │  │   Storage    │  │  │
            │  └────────────────────┘  │        │  │  │   Studio     │  │  │
            └──────────────────────────┘        │  │  └──────┬───────┘  │  │
                          │                     │  └─────────┼──────────┘  │
                          │                     └────────────┼─────────────┘
                          │                                  │
 Navegador ◀──────────────┼──────── HTTPS: imágenes ─────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
        Resend         Sentry      Google / Facebook
        (emails)      (errores)         (OAuth)
```

**Lo que sale del sistema hacia afuera:** emails vía Resend, errores vía Sentry, OAuth con Google y Facebook, y enlaces `wa.me` que abre el propio navegador del usuario. **WhatsApp no tiene integración de servidor**: son enlaces construidos en el cliente. No hay API de PedidosYa (FA-02).

---

## 4. Estructura del proyecto

```
anavende/
├─ app/
│  ├─ (shop)/                    # Sitio público
│  │  ├─ page.tsx                # Home (RF-01)
│  │  ├─ productos/
│  │  │  ├─ page.tsx             # Catálogo (RF-02)
│  │  │  └─ [slug]/page.tsx      # Ficha (RF-03)
│  │  ├─ carrito/page.tsx        # (RF-08)
│  │  ├─ checkout/page.tsx       # (RF-11)
│  │  ├─ orden/[numero]/page.tsx # Confirmación (RF-12)
│  │  ├─ mi-cuenta/…             # Panel comprador (RF-07 a RF-10)
│  │  └─ legales/[slug]/page.tsx # (RF-29)
│  ├─ (auth)/
│  │  ├─ ingresar/page.tsx
│  │  ├─ registro/…
│  │  ├─ recuperar/…
│  │  └─ error/page.tsx
│  ├─ admin/                     # Panel vendedora (RF-14 a RF-28)
│  │  ├─ layout.tsx              # Guardia de rol
│  │  ├─ page.tsx                # Dashboard
│  │  ├─ productos/…
│  │  ├─ ordenes/…
│  │  ├─ devoluciones/…
│  │  ├─ usuarios/…
│  │  ├─ catalogo/…              # categorías, marcas, colores, medios de pago
│  │  ├─ reportes/…
│  │  └─ configuracion/…
│  ├─ api/
│  │  ├─ auth/callback/route.ts  # Callback de OAuth
│  │  ├─ auth/confirmar/route.ts # Confirmación de email (E1, E2, E3)
│  │  ├─ admin/upload/route.ts   # Subida de imágenes (RF-17)
│  │  └─ admin/reportes/export/route.ts  # .xlsx (RF-28)
│  ├─ layout.tsx
│  └─ globals.css                # Tokens del sistema de diseño (DR §12.1)
│
├─ modules/                      # Lógica de negocio, agrupada por dominio
│  ├─ catalog/       { queries.ts, actions.ts, schemas.ts, service.ts }
│  ├─ cart/
│  ├─ orders/
│  ├─ stock/                     # El núcleo delicado (§8)
│  ├─ returns/
│  ├─ users/
│  ├─ recommendations/
│  ├─ reports/
│  └─ media/
│
├─ db/
│  ├─ index.ts                   # Cliente Drizzle
│  ├─ schema/                    # Un archivo por dominio
│  └─ migrations/                # Generadas por drizzle-kit
│
├─ lib/
│  ├─ supabase/                  # Clientes de navegador y servidor (§13.2)
│  ├─ session.ts                 # Identidad + perfil verificados (§13.3)
│  ├─ action.ts                  # Envoltorio de Server Actions (§6.2)
│  ├─ money.ts                   # Aritmética de montos (§7.1)
│  ├─ errors.ts                  # Errores de dominio tipados
│  ├─ env.ts                     # Lectura y validación de variables (§18.3)
│  ├─ storage/                   # Interfaz de almacenamiento + adaptadores (§9.5)
│  ├─ email/                     # Resend + plantillas React Email
│  └─ whatsapp.ts                # Armado de enlaces wa.me
│
├─ components/
│  ├─ ui/                        # shadcn/ui, mapeado a los tokens (DR §12.2)
│  ├─ shop/
│  └─ admin/
│
├─ proxy.ts                      # Antes middleware.ts (Next 16)
├─ drizzle.config.ts
├─ next.config.ts
├─ Dockerfile
└─ tests/ { unit/, e2e/ }
```

> **Sin carpeta `src/`.** Decisión tomada en F1.1: el proyecto ya existía con `app/`, `components/` y `lib/` en la raíz, y moverlos no aportaba nada. `modules/`, `db/` y `tests/` se suman al mismo nivel. El alias `@/*` apunta a la raíz.

**Regla de dependencias:** `app/` depende de `modules/`, `modules/` depende de `db/` y `lib/`. Nunca al revés. Un componente de `app/` no importa `db/` directamente.

---

## 5. Modelo de datos

### 5.1 Diagrama de entidades

```
     users ──┬─── addresses           brands ──┐
             ├─── favorites ──┐                ├──▶ products ──▶ product_variants ──▶ variant_images
             ├─── carts ──▶ cart_items ────────┘         ▲              │      ▲              │
             └─── orders ──▶ order_items ────────────────┘              │      └──────────────┘
                     │             │                                    │       (respaldo de imágenes)
                     │             └──▶ return_items ◀── returns        │
                     │                                                  │
                     └──▶ order_status_history          colors ─────────┘

     categories ──▶ category_relations (auto-referencia)
     stock_movements ──▶ product_variants   (libro mayor de stock)
     payment_methods · legal_pages · site_settings   (independientes)
```

### 5.2 Tipos enumerados

```sql
CREATE TYPE order_status  AS ENUM ('activa', 'finalizada', 'cancelada');
CREATE TYPE order_origin  AS ENUM ('web', 'manual');
CREATE TYPE return_status AS ENUM ('registrada', 'anulada');
CREATE TYPE stock_movement_type AS ENUM (
  'ajuste',        -- carga o corrección manual de stock
  'reserva',       -- orden pasa a activa
  'liberacion',    -- orden cancelada o ítem quitado
  'venta',         -- orden finalizada
  'devolucion'     -- devolución con reposición
);
```

### 5.3 Modelo de usuario

La identidad vive en `auth.users`, gestionada por GoTrue: email, contraseña con hash, estado de verificación, identidades de Google y Facebook, y `banned_until`. **Ese esquema no se toca ni se lee con Drizzle.**

Todo lo que es propio de AnaVende vive en una tabla nuestra:

```sql
CREATE TABLE user_profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  email         text NOT NULL,          -- copia para listar y buscar sin cruzar a auth
  phone         text NOT NULL,          -- RF-05: obligatorio
  role          text NOT NULL DEFAULT 'customer',

  -- RF-27: el motivo de bloqueo no existe en Supabase Auth; es nuestro
  is_banned     boolean NOT NULL DEFAULT false,
  ban_reason    text,
  banned_at     timestamptz,
  banned_by     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT role_valid   CHECK (role IN ('admin', 'customer')),
  CONSTRAINT ban_has_reason CHECK (NOT is_banned OR ban_reason IS NOT NULL)
);
CREATE INDEX user_profiles_email_idx ON user_profiles (lower(email));
```

> **`ban_has_reason` es la regla de negocio, en la base.** RF-27 exige motivo obligatorio; una restricción `CHECK` lo vuelve imposible de olvidar, en vez de confiar en que todo camino del código se acuerde.

**El perfil lo crea nuestro código, nunca un *trigger*.** La documentación de Supabase propone poblar el perfil con un *trigger* sobre `auth.users` y advierte que, si el *trigger* falla, **bloquea los registros**. Se evita: el flujo de alta lo controla la aplicación (§13.4), donde un fallo se puede reportar y compensar.

**Las tablas de dominio referencian `user_profiles(id)`**, no `auth.users`. Así el esquema de la aplicación es autocontenido y las claves foráneas no dependen de un esquema que administra otro servicio.

### 5.4 Catálogo

```sql
CREATE TABLE brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  logo_key    text,                                -- CLAVE en Storage, no URL
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX brands_name_key ON brands (lower(name));

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  is_featured boolean NOT NULL DEFAULT false,   -- RF-18: se muestra primero
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_key ON categories (lower(name));

-- RF-31: afinidad entre categorías. Una fila POR SENTIDO.
CREATE TABLE category_relations (
  category_id         uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  related_category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_reciprocal       boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, related_category_id),
  CONSTRAINT no_self_relation CHECK (category_id <> related_category_id)
);

CREATE TABLE colors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  hex_code    text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX colors_name_key ON colors (lower(name));

CREATE TABLE products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  description  text NOT NULL DEFAULT '',           -- RF-15: Markdown acotado
  -- Proyección en texto plano, SOLO para buscar (§10.1). Ver la nota.
  description_text text GENERATED ALWAYS AS (
                 regexp_replace(description, '[*_#`]', '', 'g')) STORED,
  brand_id     uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price        numeric(12,2) NOT NULL,
  discount     numeric(12,2) NOT NULL DEFAULT 0,   -- RN-04b: MONTO, no porcentaje
  final_price  numeric(12,2) GENERATED ALWAYS AS (price - discount) STORED,
  is_featured  boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT price_positive     CHECK (price > 0),
  CONSTRAINT discount_valid     CHECK (discount >= 0 AND discount < price)
);
```

> **La descripción se guarda en Markdown, y se busca por una proyección aparte.** RF-15 pide formato —negrita, cursiva, listas, un subtítulo—, y §16 ya había elegido Markdown sanitizado para las páginas legales: reusar esa tubería deja **un** formato, **un** sanitizador y **un** renderizador en todo el proyecto, en vez de abrir una segunda para el mismo problema. La vendedora nunca ve la sintaxis: el editor es visual (RF-15) y serializa a Markdown.
>
> El costo es que `description` deja de ser buscable tal cual: `%cable hdmi%` no encuentra `Cable **HDMI** 2.1`, porque los asteriscos parten la subcadena. Por eso existe `description_text`, **columna generada** igual que `final_price` — la proyección se calcula en la base, nunca en JavaScript, y es imposible que la consulta y el contenido discrepen. Se quitan solo `* _ # \``: el guion **no**, porque «USB-C» tiene que seguir siendo «USB-C». Un viñeta `- ` sobrevive como texto y no molesta a una búsqueda por subcadena. `description_text` **no se muestra nunca**: si una descripción con `XT_500` pierde el guion bajo, afecta a qué encuentra la búsqueda, jamás a lo que el comprador lee.

> **`is_featured` es una bandera, no un orden.** RF-18 pide poder adelantar categorías, no numerarlas una por una. Un `sort_order` obligaría a mantener una secuencia y a renumerar al insertar en el medio, para un puñado de filas que ya se ordenan solas por nombre; la bandera es un clic y el desempate alfabético es estable. Es la misma decisión que `products.is_featured`, y por eso las dos superficies se comportan igual. **Sin índice, a propósito:** son decenas de filas y cualquier plan las recorre enteras — un índice ahí es costo de escritura sin beneficio de lectura.

> **`final_price` es una columna generada.** El precio final se calcula en la base, nunca en JavaScript: así filtrar y ordenar por precio con descuento (RF-02) es un índice y no un cálculo por fila, y es imposible que la vista y la consulta discrepen.

```sql
CREATE TABLE product_variants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id           uuid REFERENCES colors(id) ON DELETE RESTRICT,  -- NULL = variante única
  stock_total        integer NOT NULL DEFAULT 0,
  reserved_stock     integer NOT NULL DEFAULT 0,
  images_source_id   uuid REFERENCES product_variants(id) ON DELETE SET NULL, -- RF-16: reutilizar imágenes
  sort_order         integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reserved_not_negative CHECK (reserved_stock >= 0),
  CONSTRAINT reserved_within_total CHECK (stock_total < 0 OR reserved_stock <= stock_total),
  CONSTRAINT images_source_not_self CHECK (images_source_id <> id)
);
CREATE UNIQUE INDEX variant_product_color_key
  ON product_variants (product_id, COALESCE(color_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE variant_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  storage_key text NOT NULL,          -- base sin sufijo de tamaño (§9.2)
  alt_text    text,
  width       integer NOT NULL,
  height      integer NOT NULL,
  bytes       integer NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX variant_images_variant_idx ON variant_images (variant_id, sort_order);
```

**Sobre `stock_total` y valores negativos.** No hay `CHECK (stock_total >= 0)`. RF-24 exige que la vendedora pueda registrar una venta ya ocurrida aunque el sistema crea que no hay stock: bloquearla obligaría a mentirle al sistema. Un `stock_total` negativo es una **señal de discrepancia** entre el sistema y la realidad, se muestra destacada en el panel y se corrige con un ajuste.

> **Por qué `reserved_within_total` lleva la guarda `stock_total < 0`.** En la primera versión la restricción era `reserved_stock <= stock_total` a secas, y eso **anulaba la decisión del párrafo anterior**: junto con `reserved_stock >= 0` implica `stock_total >= 0`, es decir, imponía por la puerta de atrás justamente el `CHECK` que se había decidido no poner. Se detectó en F1.6, probando las restricciones contra Postgres antes de construir F4.
>
> Con la guarda, la garantía sigue intacta donde §8.2 la necesita —la operación normal, con stock no negativo— y se aparta solo en el estado de discrepancia. El caso que lo obliga: una variante con 3 unidades y 3 reservadas por órdenes web, sobre la que la vendedora registra una venta manual ya finalizada de 5. El total queda en −2 con 3 reservas vivas, y eso es exactamente lo que pasó en la realidad.

Lo que sigue siendo invariante en toda circunstancia es que `reserved_stock` **nunca es negativo**. Y mientras el stock no sea negativo, tampoco supera al total.

**Sobre el estado activo de marcas, categorías y colores (RN-11b).** Ningún producto activo puede pertenecer a una marca o categoría inactiva, ni tener variantes activas de un color inactivo. La invariante se sostiene desde los dos lados y **se verifica en la aplicación**, no en la base:

- al **desactivar** una marca, categoría o color se cuenta lo activo que la usa; si hay algo, se rechaza con `ENTITY_IN_USE` diciendo cuántos son;
- al **activar** un producto se verifica que su marca y su categoría estén activas.

> **Por qué en la aplicación y no como restricción de la base.** Es una condición entre dos tablas: en Postgres exigiría un `TRIGGER` en ambas —o una clave foránea compuesta con `is_active` replicado en `products`, que sería un dato duplicado y una fuente de divergencia—. Un `CHECK` no puede consultar otra tabla. Se prefiere un `TRIGGER` explícito solo cuando la invariante protege dinero o stock; ésta protege visibilidad, y toda escritura al catálogo pasa por el envoltorio de Server Actions (§6.2), que es un cuello único y verificable.
>
> **Lo que compra:** que `is_active` del producto sea la única verdad sobre su visibilidad. Las consultas públicas de §10.1 y §11.2 filtran solo por `p.is_active` y no necesitan mirar el estado de la marca; una condición que hay que recordar en cada consulta es una condición que el día que se olvida **muestra de más**, en silencio. La alternativa descartada —que desactivar una marca escondiera sus productos— está discutida en `FUNCTIONAL-SPEC.md` RF-18.

**Sobre `images_source_id`.** Una variante con `images_source_id` no nulo no tiene imágenes propias: las toma de la variante apuntada. La resolución es de **un solo salto** (no se sigue una cadena); si la variante origen tampoco tiene imágenes, se cae al estado sin imagen. Esto se valida al guardar.

### 5.5 Carrito, direcciones y favoritos

```sql
CREATE TABLE carts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   integer NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id),
  CONSTRAINT quantity_positive CHECK (quantity > 0)
);

CREATE TABLE addresses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  label          text NOT NULL,
  recipient_name text NOT NULL,
  phone          text NOT NULL,
  street         text NOT NULL,
  number         text NOT NULL,
  apartment      text,
  notes          text,
  city           text NOT NULL,
  province       text NOT NULL,
  postal_code    text NOT NULL,
  is_default     boolean NOT NULL DEFAULT false,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_default_address_per_user
  ON addresses (user_id) WHERE is_default AND deleted_at IS NULL;

CREATE TABLE favorites (
  user_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
```

> El índice parcial `one_default_address_per_user` hace que «hay una sola dirección predeterminada» sea una garantía de la base, no una convención que la aplicación deba recordar.

**El carrito no existe sin sesión** (RF-08): no hay tabla ni cookie de carrito anónimo. `cart_items` guarda cantidad, nunca precio: el precio siempre se lee del producto en el momento de mostrar (RN-09).

### 5.6 Órdenes

```sql
CREATE TABLE orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      integer NOT NULL UNIQUE GENERATED BY DEFAULT AS IDENTITY (START WITH 1000),
  user_id           uuid REFERENCES user_profiles(id) ON DELETE SET NULL,  -- NULL en órdenes manuales sin cuenta
  status            order_status NOT NULL DEFAULT 'activa',
  origin            order_origin NOT NULL DEFAULT 'web',

  -- Snapshot del comprador (RN-12)
  customer_name     text NOT NULL,
  customer_email    text,
  customer_phone    text NOT NULL,
  shipping_address  jsonb,          -- snapshot; NULL si es manual sin envío

  total             numeric(12,2) NOT NULL DEFAULT 0,
  notes             text,

  created_by        uuid REFERENCES user_profiles(id) ON DELETE SET NULL,  -- admin, en órdenes manuales
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  finalized_at      timestamptz,
  cancelled_at      timestamptz,

  CONSTRAINT total_not_negative CHECK (total >= 0),
  CONSTRAINT web_order_has_user CHECK (origin <> 'web' OR user_id IS NOT NULL)
);
CREATE INDEX orders_status_idx  ON orders (status, created_at DESC);
CREATE INDEX orders_user_idx    ON orders (user_id, created_at DESC);

CREATE TABLE order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id   uuid REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Snapshot (RN-12): la orden se lee igual aunque el catálogo cambie o se borre
  product_name text NOT NULL,
  brand_name   text NOT NULL,
  color_name   text,
  unit_price   numeric(12,2) NOT NULL,
  quantity     integer NOT NULL,
  subtotal     numeric(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT item_quantity_positive CHECK (quantity > 0),
  CONSTRAINT item_price_not_negative CHECK (unit_price >= 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

CREATE TABLE order_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status   order_status,
  to_status     order_status NOT NULL,
  reason        text,
  actor_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

`unit_price` es el **precio final ya con descuento** al momento de crear la orden. No se guarda el descuento por separado: la orden registra lo que se acordó cobrar, no cómo se llegó a ese número.

### 5.7 Devoluciones

```sql
CREATE TABLE returns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status        return_status NOT NULL DEFAULT 'registrada',
  reason        text NOT NULL,
  void_reason   text,
  created_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  voided_at     timestamptz
);

CREATE TABLE return_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  quantity      integer NOT NULL,
  restocks      boolean NOT NULL,       -- false = producto defectuoso, no vuelve al stock
  reason        text,
  CONSTRAINT return_quantity_positive CHECK (quantity > 0)
);
```

### 5.8 Libro mayor de stock

```sql
CREATE TABLE stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type          stock_movement_type NOT NULL,
  quantity      integer NOT NULL,        -- con signo, según el efecto
  stock_after   integer NOT NULL,        -- stock_total resultante
  reserved_after integer NOT NULL,       -- reserved_stock resultante
  order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,
  return_id     uuid REFERENCES returns(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_variant_idx ON stock_movements (variant_id, created_at DESC);
```

Esta tabla es la que responde *«¿por qué esta variante tiene este stock?»* cuando el número no cuadre — que es la pregunta que inevitablemente aparece en producción. **Se escribe en la misma transacción que el cambio de stock, sin excepción** (P5).

### 5.9 Configuración y contenido

```sql
CREATE TABLE site_settings (
  id                    integer PRIMARY KEY DEFAULT 1,
  whatsapp_number       text NOT NULL,
  admin_notification_email text NOT NULL,
  low_stock_threshold   integer NOT NULL DEFAULT 3,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

CREATE TABLE payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  logo_key    text,                                -- CLAVE en Storage, no URL
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE legal_pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,
  content    text NOT NULL,          -- Markdown
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 5.10 Extensiones e índices de búsqueda

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() es STABLE y no sirve en un índice de expresión: se envuelve como IMMUTABLE.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE INDEX products_name_trgm_idx
  ON products USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX products_description_trgm_idx
  ON products USING gin (immutable_unaccent(lower(description)) gin_trgm_ops);
CREATE INDEX brands_name_trgm_idx
  ON brands USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);

-- Filtros y orden del catálogo (RF-02)
CREATE INDEX products_active_category_idx ON products (category_id) WHERE is_active;
CREATE INDEX products_active_brand_idx    ON products (brand_id)    WHERE is_active;
CREATE INDEX products_final_price_idx     ON products (final_price) WHERE is_active;
CREATE INDEX products_created_idx         ON products (created_at DESC) WHERE is_active;
```

> Los índices parciales `WHERE is_active` son deliberados: el sitio público **nunca** consulta productos inactivos (RN-05), así que el índice solo indexa lo que se consulta.

---

## 6. Capa de aplicación

### 6.1 Reparto de responsabilidades

| Mecanismo | Se usa para | Ejemplos |
|---|---|---|
| **Server Components** | Toda lectura de datos | Catálogo, ficha, carrito, panel |
| **Server Actions** | Toda mutación | Agregar al carrito, confirmar orden, ABM del panel |
| **Route Handlers** | Lo que necesita HTTP de verdad | `/api/auth/[...all]`, subida de imágenes (multipart), export `.xlsx` |
| **Client Components** | Solo interacción local | Selector de color, filtros, galería, formularios |
| **`proxy.ts`** | Redirección temprana por sesión ausente | Guardia de `/admin` y `/mi-cuenta` |

> **`proxy.ts` no es el control de acceso.** En Next 16 el archivo `middleware.ts` pasó a llamarse `proxy.ts`; se usa solo para redirigir rápido a quien no tiene cookie de sesión. **La autorización real se verifica en cada Server Component y en cada Server Action**, contra la base. Una guardia que vive únicamente en el proxy es una guardia que se puede saltear.

### 6.2 Envoltorio de Server Actions

Todas las Server Actions se declaran a través de un mismo envoltorio, de modo que autenticación, rol, validación y traducción de errores no dependan de que alguien se acuerde de escribirlas:

```ts
// lib/action.ts  (contrato)
export const action = createActionBuilder();

// Uso:
export const addToCart = action
  .input(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(99) }))
  .auth('customer')                       // 'public' | 'customer' | 'admin'
  .handler(async ({ input, ctx }) => { … });
```

El envoltorio garantiza, en este orden:

1. **Identidad y perfil.** `getClaims()` local, más la lectura de `user_profiles` para rol y estado de bloqueo **frescos** (§13.3). Sin perfil, se rechaza.
2. **Usuario bloqueado.** Un perfil con `is_banned = true` es rechazado en toda acción (RF-27).
3. **Validación con Zod.** Toda entrada se valida en el servidor, aunque el formulario ya la haya validado en el cliente.
4. **Ejecución** dentro de un `try/catch` que distingue **errores de dominio** (esperados: sin stock, precio cambiado, orden ya finalizada) de **errores inesperados**.
5. **Respuesta uniforme:** `{ ok: true, data }` o `{ ok: false, code, message, details? }`. Nunca se propaga un mensaje de Postgres ni un stack trace al cliente.
6. **Reporte a Sentry** solo de los errores inesperados. Un «sin stock» es un resultado del negocio, no un incidente.

### 6.3 Errores de dominio

```ts
type DomainErrorCode =
  | 'INSUFFICIENT_STOCK'      // RF-08, RF-12
  | 'PRICE_CHANGED'           // RN-09
  | 'PRODUCT_UNAVAILABLE'     // RN-05
  | 'EMAIL_NOT_VERIFIED'      // RF-11
  | 'INVALID_ORDER_STATE'     // RF-13
  | 'RETURN_EXCEEDS_SOLD'     // RF-25
  | 'VARIANT_HAS_RESERVATIONS'// RF-16
  | 'ENTITY_IN_USE'           // RN-11
  | 'USER_BANNED'             // RF-27
  | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
  | 'INTERNAL';               // lo inesperado, ya reportado a Sentry
```

Cada código tiene un mensaje en español listo para mostrar. La UI decide cómo presentarlo; nunca lo redacta.

> **`INTERNAL` se agregó en F1.10.** Los demás códigos son resultados del negocio y la vista los presenta donde corresponde: `VALIDATION` cuelga sus mensajes de los campos del formulario, `INSUFFICIENT_STOCK` va junto a la cantidad. Un fallo inesperado no tiene dónde colgarse, y devolverlo como `VALIDATION` haría que el formulario marque un campo que no tiene nada malo. Es el único código que **no** es un resultado esperado y el único que llega a Sentry.

---

## 7. Reglas de negocio en el código

### 7.1 Dinero

`numeric(12,2)` llega a JavaScript como **`string`** (así lo devuelve Drizzle por defecto, para no perder precisión). La regla es:

| Situación | Cómo se resuelve |
|---|---|
| Sumar, restar o multiplicar montos | En **SQL** (columnas generadas, agregaciones) o con **`decimal.js`**. Nunca con operadores de JavaScript sobre números |
| Precio final de un producto | Columna generada `final_price` (§5.4). No se recalcula en la aplicación |
| Total de una orden | `SUM(order_items.subtotal)` en SQL, escrito en `orders.total` dentro de la transacción |
| Mostrar al usuario | `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` → `$ 12.500,50` |
| Recibir del cliente | Solo en el panel (precio de un producto, precio de una orden manual). Se valida como string con formato decimal, jamás como `number` |

**`parseFloat` y `Number()` sobre montos están prohibidos** fuera de la capa de formateo. Es una regla de lint, no una recomendación.

### 7.2 Precio final y descuento (RN-04b)

```
final_price = price − discount        con  0 ≤ discount < price
discount = 0  ⇒  no hay oferta: se muestra un solo precio
discount > 0  ⇒  se muestra final_price, con price tachado y el ahorro
```

Todo filtro y todo orden por precio (RF-02) opera sobre `final_price`.

---

## 8. Stock: el núcleo delicado

Es la parte del sistema donde un error no se nota hasta que ya vendiste dos veces la misma unidad. Se diseña en consecuencia.

### 8.1 Modelo

Cada variante lleva **dos contadores**, nunca uno derivado del otro por conteo de filas:

```
stock_disponible = stock_total − reserved_stock
```

| Operación | Efecto | Origen |
|---|---|---|
| Confirmar orden web | `reserved_stock += q` | RF-12 |
| Finalizar orden | `stock_total −= q` y `reserved_stock −= q` | RF-23 |
| Cancelar orden | `reserved_stock −= q` | RF-23 |
| Quitar/reducir ítem de orden activa | `reserved_stock −= q` | RF-22 |
| Devolución con reposición | `stock_total += q` | RF-25 |
| Devolución sin reposición | sin efecto (se registra igual) | RF-25 |
| Orden manual creada como activa | `reserved_stock += q` | RF-24 |
| Orden manual creada como finalizada | `stock_total −= q` (puede quedar negativo) | RF-24 |
| Ajuste de la vendedora | `stock_total = nuevo valor` | RF-16 |

### 8.2 Reserva: un solo `UPDATE` condicional

La reserva **no** se hace leyendo el stock y después escribiéndolo: se hace en una sola sentencia cuya condición es la propia regla de negocio.

```sql
UPDATE product_variants
   SET reserved_stock = reserved_stock + $qty,
       updated_at     = now()
 WHERE id = $variantId
   AND stock_total - reserved_stock >= $qty;
```

Si `rowCount = 0`, no había stock suficiente: se lanza `INSUFFICIENT_STOCK` y la transacción se revierte entera.

**Por qué así y no con `SELECT ... FOR UPDATE`:** el `UPDATE` condicional toma el bloqueo de fila y evalúa la condición en el mismo paso atómico, sin ventana entre la lectura y la escritura. Dos compradores confirmando la última unidad al mismo tiempo dan un ganador y un `INSUFFICIENT_STOCK` limpio, sin depender de una API de bloqueo explícito del ORM. Es también SQL portable y directamente testeable.

### 8.3 Reglas de la transacción

1. **Todo o nada.** Confirmar una orden reserva *todos* sus ítems o ninguno.
2. **Orden determinístico.** Los ítems se procesan **ordenados por `variant_id`**. Sin esto, dos órdenes con los mismos productos en distinto orden pueden trabarse mutuamente (*deadlock*).
3. **Auditoría dentro de la transacción.** Cada cambio escribe su fila en `stock_movements` (§5.8) antes del `COMMIT`. Si el movimiento no se puede escribir, el cambio de stock tampoco ocurre.
4. **Nada externo adentro.** No se envían emails ni se llama a Sentry dentro de la transacción: se hace después del `COMMIT`.
5. **Revalidación al final.** `revalidateTag` se invoca después del `COMMIT`, nunca antes.

### 8.4 Confirmación de orden, paso a paso (RF-12)

```
BEGIN
  1. Releer el carrito con FOR UPDATE sobre cart_items
  2. Releer productos y variantes: precio final vigente, is_active, disponibilidad
  3. ¿Cambió algo respecto de lo que el comprador vio?
        → sí: ROLLBACK y devolver PRICE_CHANGED / PRODUCT_UNAVAILABLE
               con el detalle, para que reconfirme (RF-11)
  4. INSERT orders (snapshot de comprador y dirección)
  5. INSERT order_items (snapshot de nombre, marca, color, unit_price)
  6. Por cada ítem, ordenado por variant_id:
        UPDATE condicional de reserva (§8.2)  → 0 filas ⇒ INSUFFICIENT_STOCK
        INSERT stock_movements (type = 'reserva')
  7. UPDATE orders.total = SUM(order_items.subtotal)
  8. INSERT order_status_history (NULL → 'activa')
  9. DELETE cart_items
COMMIT
  10. Enviar email E4 a la administradora (si falla: se registra, la orden queda) 
  11. revalidateTag de los productos afectados
```

El paso 3 implementa la **reconfirmación** de RF-11: el cliente envía un identificador del estado que vio (los precios finales de los ítems); si el servidor encuentra otra cosa, no crea la orden a espaldas del comprador.

### 8.5 Idempotencia (RF-12)

Un doble clic o un reintento del navegador no puede generar dos órdenes. La acción de confirmación recibe una **clave de idempotencia** generada al abrir el checkout; si ya existe una orden con esa clave, se devuelve la existente en lugar de crear otra. La clave se guarda en `orders` con un índice único.

---

## 9. Imágenes

### 9.0 Reparto de responsabilidades

Dos piezas distintas que conviene no confundir:

| Pieza | Qué hace | Dónde corre |
|---|---|---|
| **sharp** | **Transforma**: convierte el archivo subido a WEBP y genera tres tamaños | Dentro del contenedor de Next.js, en memoria, durante la subida |
| **Supabase Storage** | **Almacena**: guarda los archivos WEBP resultantes y los sirve por HTTPS | Servidor DATA. Se accede tras una interfaz (§9.4) |
| **Postgres** | Guarda solo la **fila** `variant_images` con la ruta del archivo | Base de datos |

```
Vendedora sube          Next.js (servidor APP)           Storage (servidor DATA)
JPG de 8 MB      ──▶    sharp convierte y          ──▶   guarda 3 archivos:
                        redimensiona a 3 WEBP            -thumb.webp   (~15 KB)
                                                         -card.webp    (~50 KB)
                        el original se descarta          -detail.webp  (~180 KB)
```

**sharp no almacena nada**: es la biblioteca que hace la conversión antes de guardar, para que lo que se sirva pese kilobytes y no megabytes (RF-17).

**Por qué se convierte al subir y no al servir.** Existen servicios que redimensionan sobre la marcha con parámetros en la URL (imgproxy, incluido en el stack de Supabase; los transformadores de los CDN). Se descartan porque (a) obligarían a **conservar el original de 8 MB** para poder transformarlo, que es justo lo que se quiere evitar; (b) la primera petición de cada tamaño paga el costo de la transformación; y (c) suman una pieza más para operar. Convertir una vez al subir y después servir archivos estáticos chicos es más simple, más rápido y ocupa menos espacio.

### 9.1 Flujo de subida (RF-17)

```
Cliente                       Route Handler /api/admin/upload           Storage
──────                        ────────────────────────────────          ───────
selecciona archivo
valida tipo y tamaño  ──────▶ verifica rol admin
(feedback inmediato)          verifica tipo real por magic bytes
                              (no confía en el Content-Type)
                              verifica tamaño ≤ 10 MB
                              verifica ≤ 5 imágenes en la variante
                              sharp: metadata + 3 variantes WEBP ──────▶ sube las 3
                              INSERT variant_images
◀──────────────────────────── devuelve la imagen creada
```

- El proceso es **síncrono**: la respuesta llega con la imagen ya lista o con un error claro. No hay estado «procesando».
- **El archivo original no se almacena ni se sirve.** Solo quedan las tres versiones WEBP.
- Si falla la subida a Storage después de haber subido alguna versión, se **borran las ya subidas** antes de responder: no quedan imágenes huérfanas ni filas a medias.

### 9.2 Tamaños generados y convención de nombres

| Sufijo | Ancho | Calidad | Uso |
|---|---|---|---|
| `-thumb` | 200 px | 75 | Miniaturas de galería y panel |
| `-card` | 600 px | 78 | Tarjetas de catálogo y recomendados |
| `-detail` | 1400 px | 82 | Galería de la ficha |

```
productos/{productId}/{variantId}/{imageId}-thumb.webp
                                  {imageId}-card.webp
                                  {imageId}-detail.webp
```

`variant_images.storage_key` guarda la base (`…/{imageId}`) y el sufijo se agrega al construir la URL. Se redimensiona con `fit: 'inside'` y sin ampliar (`withoutEnlargement`), preservando la relación de aspecto. Se descartan los metadatos EXIF, salvo la orientación, que se aplica antes de recortar.

### 9.3 Entrega

Las imágenes ya están optimizadas al guardarse, así que se sirven **tal cual**, sin volver a procesarlas. Se muestran con `next/image` para aprovechar `srcset`, dimensiones y carga diferida.

El subdominio de Storage se declara en `images.remotePatterns` de `next.config.ts`.

**Atención a los cambios de Next 16:** el valor por omisión de `images.qualities` pasó a ser `[75]`; cualquier otra calidad debe declararse explícitamente en `next.config.ts` o se ajusta sola al valor permitido más cercano.

### 9.4 Interfaz de almacenamiento

El backend es **Supabase Storage** en el servidor DATA, pero se accede tras una interfaz mínima para que sustituirlo no toque el resto del código:

```ts
interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}
```

| Aspecto | Definición |
|---|---|
| Acceso desde el servidor | Con la **clave de servicio**, por la red privada o por HTTPS. Nunca desde el navegador |
| Entrega al navegador | **Directa** desde el subdominio público de Storage. No pasa por el servidor APP: hacerlo duplicaría el tráfico y le sumaría carga |
| Bucket | Público en lectura; la escritura solo con clave de servicio |
| Claves | El resto del código maneja **claves**, no URLs ni SDKs. Solo el adaptador conoce el backend |

> **Las columnas se llaman `…_key`, y el nombre no es cosmética.** `brands.logo_key`, `payment_methods.logo_key` y `variant_images.storage_key` guardan la clave del archivo, nunca su URL. Guardar la URL completa ata la fila al servidor del día que se escribió: un logo cargado contra el stack local queda apuntando a `127.0.0.1` para siempre, y el día del despliegue las imágenes no se ven sin que nadie haya tocado nada. La URL se arma al mostrar, con el backend que corresponda. Las dos primeras se llamaban `logo_url` —venían de antes de esta sección— y se renombraron mientras estaban vacías, que es cuando cuesta una línea.

---

### 9.5 Resolución de imágenes de una variante (RF-16)

```
imágenes(variante) =
   si variante.images_source_id es NULL  → sus propias variant_images
   si no                                 → variant_images de la variante origen
                                           (un solo salto; sin cadenas)
```

---

## 10. Búsqueda y catálogo

### 10.1 Búsqueda tolerante (RF-02)

Combina dos mecanismos sobre los índices GIN de §5.10:

| Mecanismo | Resuelve |
|---|---|
| `ILIKE '%término%'` sobre el texto sin acentos | Coincidencia de subcadena: «mecanico» encuentra «Teclado Mecánico» |
| Similitud por trigramas (`%` de `pg_trgm`) | Errores de tipeo: «lojitech» encuentra «Logitech» |

```sql
WITH q AS (SELECT immutable_unaccent(lower($1)) AS term)
SELECT p.*, GREATEST(
         similarity(immutable_unaccent(lower(p.name)), q.term),
         similarity(immutable_unaccent(lower(b.name)), q.term)
       ) AS score
  FROM products p
  JOIN brands b ON b.id = p.brand_id
  CROSS JOIN q
 WHERE p.is_active
   AND ( immutable_unaccent(lower(p.name)) ILIKE '%' || q.term || '%'
      OR immutable_unaccent(lower(b.name)) ILIKE '%' || q.term || '%'
      OR immutable_unaccent(lower(p.description_text)) ILIKE '%' || q.term || '%'
      OR immutable_unaccent(lower(p.name)) % q.term
      OR immutable_unaccent(lower(b.name)) % q.term )
 ORDER BY score DESC, p.is_featured DESC, p.created_at DESC;
```

El umbral de similitud se fija con `pg_trgm.similarity_threshold` (arranca en `0.3` y se calibra con el catálogo real). Se elige trigramas por sobre `tsvector` porque el problema aquí son **nombres cortos con acentos y errores de tipeo**, no texto largo con semántica: la búsqueda de texto completo no tolera errores de tipeo, que es justamente lo que hay que resolver.

### 10.2 Filtros, orden y paginación

- El estado del catálogo (búsqueda, filtros, orden, página) vive **en la URL** (`searchParams`), no en estado de cliente: así es compartible y funciona con el botón atrás (RF-02).
- **En Next 16, `searchParams` y `params` son asíncronos**: hay que hacerles `await`. El acceso sincrónico fue removido.
- Los filtros se traducen a una sola consulta con `WHERE` compuesto; los conteos de facetas se resuelven en una segunda consulta agregada.
- Las **categorías que se ofrecen** —chips del encabezado (`DESIGN-REFERENCE.md` §5.1), accesos rápidos de la home (RF-01) y filtro del listado (RF-02)— se leen con un solo orden: `WHERE is_active ORDER BY is_featured DESC, immutable_unaccent(lower(name))`. Una sola consulta compartida, para que las tres superficies no puedan discrepar sobre qué va primero.
- Paginación por `LIMIT/OFFSET` con 24 por página. Es adecuada al volumen esperado (S-05); si el catálogo creciera, se migra a paginación por cursor.

---

## 11. Recomendaciones (RF-31 a RF-33)

### 11.1 Categorías relacionadas: reciprocidad

Se guarda **una fila por sentido** (§5.4). Al marcar una relación como recíproca, la aplicación inserta las dos filas en una transacción; al desmarcarla o borrarla, borra las dos.

**Por qué así y no calculando el inverso al consultar:** la consulta de recomendados se ejecuta en cada ficha de producto. Con filas por sentido es un `WHERE category_id = $1` sobre la clave primaria; con reciprocidad implícita sería un `OR` sobre dos columnas en cada lectura. Se paga una vez al escribir —operación rara— en lugar de en cada lectura.

### 11.2 Cascada de complementos

```sql
-- Nivel 1: categorías relacionadas
SELECT p.* FROM products p
  JOIN category_relations cr ON cr.related_category_id = p.category_id
 WHERE cr.category_id = $categoriaDelProducto
   AND p.is_active AND p.id <> $productoActual
 ORDER BY (SELECT COALESCE(SUM(v.stock_total - v.reserved_stock), 0)
             FROM product_variants v WHERE v.product_id = p.id) > 0 DESC,
          cr.sort_order, p.is_featured DESC, p.created_at DESC
 LIMIT $faltantes;

-- Nivel 2 (solo si el nivel 1 no llenó el cupo): destacados con stock
```

Los similares siguen la misma forma: misma categoría con `final_price BETWEEN $p*0.7 AND $p*1.3`, luego misma categoría sin restricción de precio, luego misma marca.

El orden es **determinístico** (nada de `RANDOM()`): así los resultados son cacheables y estables entre recargas, y los tests pueden afirmar sobre ellos.

### 11.3 Vistos recientemente (RF-33)

Los IDs de los últimos 10 productos vistos se guardan en `localStorage` del navegador. El componente es de cliente, lee la lista y pide al servidor los datos vigentes de esos productos, descartando los inactivos. **No se persiste nada en la base ni se requiere sesión**, y los precios que se muestran son siempre los actuales.

---

## 12. Renderizado y caché

| Superficie | Estrategia |
|---|---|
| Home, catálogo, ficha, legales | Server Components con consulta directa. Sin caché explícita en el MVP |
| Carrito, checkout, `/mi-cuenta`, `/admin` | Siempre dinámico y personalizado. Nunca cacheado |
| Imágenes | Caché de `next/image` (por omisión, 4 horas de `minimumCacheTTL` en Next 16) |

**Por qué el MVP arranca sin caché de datos.** El catálogo es de cientos de productos y las consultas están indexadas: se resuelven en milisegundos contra una base que corre en el mismo servidor. Sumar caché ahora significa sumar invalidación, y la invalidación mal hecha produce el peor error posible en un e-commerce: mostrar un precio o un stock que ya no es cierto.

**Cómo se suma después, si hace falta.** El camino está preparado: las mutaciones ya llaman a `revalidateTag` con etiquetas por entidad (`product:{id}`, `catalog`, `categories`). Activar `cacheComponents: true` y marcar las lecturas públicas con `"use cache"` + `cacheTag` es entonces un cambio acotado y medible. **No se hace sin haber medido antes.**

---

## 13. Autenticación y autorización

### 13.1 Reparto: qué resuelve Supabase Auth y qué resolvemos nosotros

| Supabase Auth (GoTrue) | Nuestra aplicación |
|---|---|
| Contraseñas con hash | **Rol** (`admin` / `customer`) |
| Verificación de email | **Teléfono obligatorio** |
| Recuperación de contraseña | **Bloqueo con motivo** y su exposición al ingresar (RF-27) |
| OAuth con Google y Facebook | Reglas de negocio: email verificado para confirmar órdenes |
| Vinculación automática de identidades | Alta de usuarios por la administradora (RF-26) |
| `banned_until`, que impide el ingreso | El motivo, que Supabase Auth **no** almacena |

### 13.2 Clientes

Se usan dos clientes de `@supabase/ssr`, porque el manejo de cookies difiere:

| Cliente | Dónde | Para qué |
|---|---|---|
| Navegador | Client Components | Iniciar sesión, cerrar sesión, redirección a OAuth |
| Servidor | Server Components, Actions, Route Handlers | Leer la identidad de la petición |
| **Servicio** | Solo servidor, con la clave de servicio | Admin API: crear, bloquear y resetear usuarios (RF-26) |

> La **clave de servicio nunca sale del servidor** y jamás lleva prefijo `NEXT_PUBLIC_`. Es la única credencial que puede administrar usuarios.

`proxy.ts` refresca el token y reescribe las cookies, porque los Server Components no pueden escribirlas.

### 13.3 Cómo se resuelve la sesión

```
1. getClaims()            → verifica el JWT LOCALMENTE contra el JWKS cacheado.
                            Da el id del usuario sin salir del servidor APP.
2. SELECT user_profiles   → rol, teléfono y estado de bloqueo, frescos de la base.
```

**Cuándo se hace cada paso:**

| Situación | Verificación |
|---|---|
| Guardia de página (`/admin`, `/mi-cuenta`) | Paso 1, y paso 2 solo si hace falta el rol |
| **Toda Server Action** | **Pasos 1 y 2, siempre** |
| Lectura de datos propios | Paso 1, y se filtra por ese id |

**Por qué las mutaciones consultan la base y no se conforman con el JWT.** Un rol o un bloqueo escritos en el token quedan **congelados hasta que el token se renueve**. RF-27 exige que bloquear invalide las sesiones activas: si la autorización se apoyara solo en el JWT, un usuario recién bloqueado podría seguir operando hasta una hora.

Consecuencia honesta: **la verificación local ahorra la ida a la red en las guardias de página, no en las mutaciones.** Las mutaciones pagan una consulta a `user_profiles` por la LAN, y es el precio correcto por tener el estado fresco.

### 13.4 Alta de usuarios

**Registro con email y contraseña** (RF-05) — Server Action propia, no el `signUp` del cliente, porque el perfil es obligatorio:

```
1. admin.createUser({ email, password })       → id
2. INSERT user_profiles (id, nombre, email, teléfono, role='customer')
3. Si (2) falla → admin.deleteUser(id) y se informa el error
4. Se dispara el email de verificación
```

El paso 3 es una **compensación explícita**: sin ella quedaría una identidad sin perfil, que es un usuario que puede entrar y con el que la aplicación no sabe qué hacer.

**Alta por Google o Facebook** (RF-06) — acá GoTrue crea la identidad en el callback, antes de que intervengamos. Por eso:

```
Callback de OAuth → ¿existe user_profiles para este id?
                     sí  → continuar
                     no  → pantalla «Completá tu perfil» (teléfono obligatorio)
                            → INSERT user_profiles
```

Esa pantalla ya era necesaria: ningún proveedor social entrega teléfono (RF-06). Sirve para las dos cosas.

**Sin perfil no se opera.** Una identidad sin fila en `user_profiles` puede navegar, pero no confirmar órdenes ni acceder al panel del comprador. El envoltorio de Server Actions (§6.2) lo trata como falta de autorización.

### 13.5 Bloqueo con motivo (RF-27)

**Supabase Auth no tiene campo de motivo.** Guarda `banned_until` y nada más; además, un usuario bloqueado que intenta entrar recibe un error genérico, indistinguible de una contraseña equivocada. El requisito se cumple combinando las dos capas:

**Al bloquear:**
```
1. UPDATE user_profiles SET is_banned, ban_reason, banned_at, banned_by
   (la restricción ban_has_reason impide guardar sin motivo)
2. admin.updateUserById(id, { ban_duration: '876000h' })   → impide el ingreso
3. admin.signOut(id, 'global')                             → mata las sesiones activas
```

**Al intentar ingresar:** GoTrue devuelve el código `user_banned` (HTTP 400, mensaje `User is banned`), **distinto** del `invalid_credentials` de una contraseña equivocada. Comprobado en F1.7. Detectado ese código, se busca el email en `user_profiles` y se devuelve el motivo registrado.

> **`user_banned` se devuelve también con la contraseña equivocada.** GoTrue evalúa el bloqueo antes que las credenciales, así que el código llega igual aunque quien intenta no sepa la contraseña. Amplía el alcance de la excepción del párrafo siguiente: no hace falta acertar la contraseña para confirmar que la cuenta existe y está bloqueada. Se acepta, por el mismo motivo.

> **Esto revela que el email existe**, y por eso es una excepción deliberada a la regla de no filtrar existencia de cuentas (RF-06). Es inherente al requisito: no se puede mostrar el motivo sin admitir que la cuenta existe. Se acota devolviendo el motivo **solo** cuando la cuenta está efectivamente bloqueada, nunca en un fallo de contraseña común.

**Desbloquear** revierte los tres pasos y deja registro. Todo bloqueo y desbloqueo se audita con autor y fecha.

### 13.6 Costos asumidos de esta elección

| Costo | Detalle | Mitigación |
|---|---|---|
| **Emails de autenticación fuera de React Email** | E1, E2 y E3 usan las plantillas de Supabase (HTML con variables Go) enviadas por SMTP. E4 sigue por la API de Resend con React Email | Se replica la identidad visual en las plantillas de Supabase. Se **verifica en F0** si el *Send Email Hook* funciona auto-hospedado: si funciona, los cuatro emails vuelven a un solo camino |
| **Identidad en dos lugares** | `auth.users` (GoTrue) y `user_profiles` (nuestro) | El alta la controla nuestro código, con compensación (§13.4). Sin *trigger* |
| **Acoplamiento a Supabase** | La autenticación deja de ser portable | Aceptado: la decisión de infraestructura ya apuesta a Supabase |
| **SMTP obligatorio** | El emisor de correo por omisión de Supabase no sirve para producción: 2 mensajes por hora y solo a direcciones autorizadas | Resend configurado como proveedor SMTP, algo que Supabase documenta explícitamente. **Verificar en F0** |
| **No se puede entrar sin verificar el email** | GoTrue rechaza con `email_not_confirmed` toda identidad sin `email_confirmed_at`, mirando la columna y no la configuración. RF-05 pedía lo contrario | RF-05 se cambió para adoptar el comportamiento de la plataforma. La pantalla de ingreso detecta el código y ofrece reenviar la verificación. Comprobado en F1.7 con las dos configuraciones posibles |

### 13.7 Autorización por capas

```
proxy.ts            → ¿hay cookie de sesión?         (redirección rápida, NO es seguridad)
layout de /admin    → getClaims() + rol del perfil   (contra la base)
Server Action       → identidad + perfil FRESCOS     (envoltorio §6.2, SIEMPRE)
Consulta            → ¿el recurso es de este usuario?  (WHERE user_id = sesión)
```

La última capa es la que evita el error clásico: un comprador que cambia el ID en la URL y ve la orden de otro. **Toda consulta de datos propios filtra por el id de la sesión**, nunca por un ID recibido del cliente.

### 13.8 Por qué no se usa RLS

Se evaluó activar *Row Level Security* de Postgres como segunda línea de defensa y **se decidió no hacerlo**. La autorización vive enteramente en la aplicación.

**Por qué RLS no aporta en esta arquitectura.** Aunque la identidad ahora la emite Supabase, el JWT **no llega a Postgres**: no usamos PostgREST, sino Drizzle sobre una conexión directa.

```
Modelo de Supabase:   Navegador ─JWT─▶ PostgREST ─(setea el JWT, cambia de rol)─▶ Postgres ─▶ auth.uid()
Nuestro modelo:       Navegador ──▶ Next.js ──▶ Drizzle ─(un rol, un pool)─▶ Postgres
```

Tres condiciones lo vuelven inerte si se activa sin más:

1. **Ningún JWT llega a Postgres por la vía de Drizzle**: `auth.uid()` devuelve `NULL` en esas conexiones.
2. **El dueño de una tabla no está sujeto a sus propias políticas** salvo `FORCE ROW LEVEL SECURITY`, y un superusuario las ignora siempre.
3. **Todas las peticiones comparten un mismo rol de base de datos**, así que ninguna política puede distinguir un comprador de otro.

Hacerlo funcionar exigiría un rol dedicado sin privilegios de dueño y `SET LOCAL app.user_id` **dentro de una transacción en cada consulta** — con el agravante de que usar `SET` de sesión sobre un pool filtraría el contexto de un usuario a la consulta del siguiente.

**Consecuencia que hay que asumir explícitamente:** al no haber red de seguridad en la base, **el filtrado por el id de la sesión es la única barrera** entre los datos de un comprador y otro. Por lo tanto:

- Ninguna consulta a `orders`, `order_items`, `carts`, `cart_items`, `addresses` o `favorites` se escribe sin ese filtro.
- Ese filtro **nunca** proviene de un parámetro del cliente: sale de la identidad verificada en el servidor.
- Las pruebas incluyen un caso explícito por cada tabla (§17.2, caso 6).
- Es el punto que más atención merece en revisión de código.

---

## 14. Emails (RF-30)

| Código | Email | Emitido por | Camino | Disparo |
|---|---|---|---|---|
| E1 | Verificación de email | **Supabase Auth** | Plantilla de Supabase → SMTP de Resend | Registro o reenvío |
| E2 | Recuperación de contraseña | **Supabase Auth** | Plantilla de Supabase → SMTP de Resend | Solicitud, o reset desde el panel |
| E3 | Definición de contraseña de cuenta nueva | **Supabase Auth** (`inviteUserByEmail`) | Plantilla de Supabase → SMTP de Resend | Alta manual de usuario (RF-26) |
| E4 | Nueva orden recibida | **Nuestra aplicación** | React Email → API de Resend | Después del `COMMIT` (§8.4) |

> **Dos caminos hacia el mismo proveedor.** Es el costo asumido de usar Supabase Auth (§13.6): E1, E2 y E3 los emite GoTrue con sus propias plantillas; solo E4 pasa por React Email. **F0 verifica si el *Send Email Hook* funciona auto-hospedado**; si funciona, los cuatro vuelven a un único camino.

- **SMTP propio es obligatorio.** El emisor por omisión de Supabase envía 2 mensajes por hora y solo a direcciones autorizadas: no sirve para producción. Resend se configura como proveedor SMTP en Supabase, algo que su documentación contempla de forma explícita.
- Las plantillas de Supabase se personalizan para replicar la identidad visual; **E4 usa React Email** con layout propio y previsualización local.
- El envío ocurre **siempre después del commit** y **nunca bloquea** la operación de negocio: un fallo de Resend se registra en Sentry y la orden queda creada igual (RF-12).
- Dominio propio verificado en Resend para producción.

---

## 15. Reportes y exportación (RF-28)

- Consultas agregadas sobre `orders` con `status = 'finalizada'`, restando `return_items` del período.
- Las sumas de dinero se calculan **en SQL** (`SUM` sobre `numeric`), nunca acumulando en JavaScript (P4).
- La exportación es un **Route Handler** que devuelve un `.xlsx` generado con ExcelJS, respetando exactamente los filtros aplicados en pantalla, con las columnas formateadas como moneda y fecha.
- La comparativa web/manual sale de `orders.origin`, que se fija en la creación y no se edita.

---

## 16. Seguridad

| Área | Medida |
|---|---|
| **Autorización** | Verificada en cada Server Action y en cada consulta, no solo en el proxy (§13.3) |
| **Entrada** | Zod en el servidor sobre absolutamente toda entrada, incluida la que ya validó el cliente |
| **SQL** | Drizzle parametriza. Los fragmentos `sql` de búsqueda usan parámetros, nunca interpolación de strings |
| **Subida de archivos** | Tipo verificado por *magic bytes*, no por `Content-Type`; tamaño limitado; nombre generado por el servidor; sin ejecución del contenido |
| **XSS** | React escapa por omisión. El Markdown de las páginas legales **y el de las descripciones de producto (RF-15)** pasa por el mismo sanitizador, con una lista blanca de nodos: párrafo, salto, negrita, cursiva, lista con viñetas, lista numerada, ítem y un nivel de subtítulo. Todo lo demás —HTML crudo, `script`, imágenes, enlaces, tablas, atributos de estilo— se descarta **al guardar y otra vez al renderizar**: al guardar para que la base nunca contenga lo que no debe, al renderizar para que un cambio futuro de la lista blanca no publique lo que ya está guardado |
| **Contraseñas** | Hash a cargo de Supabase Auth. La aplicación nunca las almacena ni las registra |
| **Datos personales** | Filtrados del contexto que se envía a Sentry (email, teléfono, dirección) |
| **Secretos** | Solo en variables de entorno de Coolify. **La clave de servicio de Supabase nunca lleva prefijo `NEXT_PUBLIC_`**: es la única credencial que puede administrar usuarios |
| **Rate limiting** | En autenticación (Supabase Auth) y en la subida de imágenes |
| **Cabeceras** | CSP, `X-Frame-Options`, `Referrer-Policy` y `Strict-Transport-Security` definidas en `next.config.ts` |
| **Enumeración** | Los mensajes de login y de recuperación no revelan si un email existe (RF-06) |
| **Red entre servidores** | Postgres escucha solo en la interfaz privada; `pg_hba.conf` restringido a la IP del servidor APP; firewall local en ambos servidores, porque el firewall virtual de DonWeb no cubre la interfaz privada |
| **Superficie de Supabase** | De los servicios expuestos públicamente, solo Storage queda abierto (lectura). **Studio requiere autenticación y restricción por IP.** Postgres, Realtime y Edge Runtime no se exponen |
| **Aislamiento entre compradores** | Sin RLS, el filtrado por id de sesión es la única barrera (§13.8). Cubierto por test E2E obligatorio (§17.2) |

---

## 17. Testing

### 17.1 Unitarios (Vitest) — donde duele si falla

| Módulo | Qué se prueba |
|---|---|
| `stock` | Reserva, liberación, venta, devolución con y sin reposición; **stock insuficiente**; concurrencia de dos reservas sobre la última unidad; que la suma del libro mayor coincida con los contadores |
| `orders` | Transiciones válidas e inválidas; recálculo del total al quitar ítems; quitar el último ítem equivale a cancelar; idempotencia |
| `pricing` | `final_price` con y sin descuento; descuento igual o mayor al precio rechazado; formateo `es-AR` |
| `cart` | Revalidación: precio cambiado, stock reducido, variante agotada, producto desactivado (**se elimina con aviso**) |
| `returns` | Cantidad mayor a la vendida rechazada; anulación revierte el efecto en stock |
| `recommendations` | La cascada llena el cupo; sin candidatos no devuelve bloque; nunca incluye inactivos ni el producto actual |

Las pruebas de stock y órdenes corren contra una **Postgres real en Docker**, no contra un doble de prueba: lo que se está verificando son transacciones, `CHECK` constraints y condiciones de carrera, que un *mock* no puede reproducir.

### 17.2 E2E (Playwright) — los caminos que no pueden romperse

1. Visitante busca un producto, filtra, abre la ficha y genera el enlace de WhatsApp.
2. Comprador se registra, agrega al carrito, hace checkout y confirma; la orden aparece en su panel y el stock quedó reservado.
3. Administradora crea un producto con dos colores e imágenes, y aparece publicado en el catálogo.
4. Administradora finaliza una orden; el stock se descuenta correctamente.
5. Administradora bloquea a un usuario; ese usuario ve la razón al intentar entrar.
6. **Aislamiento entre compradores:** un comprador autenticado intenta acceder por ID directo a la orden, el carrito, una dirección y un favorito de otro comprador, y recibe 404 en los cuatro casos. Este test es obligatorio porque, sin RLS, el filtrado en la aplicación es la única barrera (§13.8).

---

## 18. Despliegue

### 18.1 Contenedor

- Build multi-etapa con `output: 'standalone'`.
- **Imagen base `node:22-bookworm-slim`, no Alpine.**

  sharp no es JavaScript puro: envuelve a **libvips**, escrita en C, y al instalarse descarga un **binario compilado** para el sistema donde corre. Existen dos variantes de Linux según su biblioteca de C:

  | Base | Biblioteca C | Binario que descarga sharp |
  |---|---|---|
  | `node:22-alpine` | musl | `linuxmusl-x64` |
  | `node:22-bookworm-slim` (Debian) | glibc | `linux-x64` |

  El Dockerfile habitual de Next con `output: 'standalone'` instala dependencias en una etapa y **copia** `node_modules` a la etapa final. Si las etapas no coinciden, se copia el binario equivocado y la aplicación **arranca sin errores** y recién falla en producción, la primera vez que alguien sube una imagen:

  ```
  Could not load the "sharp" module using the linux-x64 runtime
  'linux-x64' binaries cannot be used on the 'linuxmusl-x64' platform
  ```

  Debian slim pesa unos 300 MB más y a cambio la clase entera de problema deja de existir. Si el tamaño llegara a importar, la solución es instalar sharp **dentro** de la etapa final, no cambiar la base a ciegas.
- Usuario sin privilegios, `NODE_ENV=production`, healthcheck HTTP.

### 18.2 Entorno y flujo

| Aspecto | Definición |
|---|---|
| Entornos | **Solo producción** más el desarrollo local |
| Despliegue | Automático desde `main` en Coolify |
| **Dónde se compila** | **Fuera del servidor APP.** `next build` con Turbopack es exigente en memoria y hay fallas de *out of memory* reportadas por debajo de 4 GB. La imagen se construye en CI y Coolify solo la descarga. Si el servidor APP se aprovisiona con 4 GB o más, compilar en él pasa a ser viable, pero sigue siendo preferible no hacerlo: la caché de build consume disco, que es el recurso más escaso (§2.4) |
| Migraciones | `drizzle-kit migrate` en el arranque del contenedor, antes de levantar el servidor. Instancia única: no hay riesgo de migraciones concurrentes |
| TLS | Let's Encrypt, gestionado por Coolify |
| Base de datos | Supabase en el servidor DATA, alcanzada por la **IP privada**. `DATABASE_URL` apunta a la LAN, nunca a una IP pública |
| Red | LAN virtual de DonWeb entre APP y DATA. **Firewall local obligatorio en ambos**: el firewall virtual de DonWeb no cubre la interfaz privada |
| Postgres | `listen_addresses` limitado a la interfaz privada; `pg_hba.conf` restringido a la IP del servidor APP |

> **Consecuencia de tener un solo entorno:** una migración destructiva no tiene dónde ensayarse. Por eso: toda migración debe ser compatible hacia atrás (agregar antes de borrar), y **no se despliega una migración sin un backup verificado inmediatamente anterior** (§19).

#### El entorno de desarrollo local, y qué NO es

Mientras F0.3 no esté hecha no hay Supabase al que apuntar, así que el desarrollo corre contra el stack local del CLI de Supabase (`npm run dev:stack`): las mismas piezas —Postgres, GoTrue, Storage, Studio— en contenedores, más Mailpit capturando los emails.

**El entorno de verdad es producción.** El local es andamiaje: sirve para escribir y probar código sin depender de la red, y para verificar el esquema antes de tocar la base real. No es una fuente de verdad sobre nada.

| Vale igual en los dos | Solo vale en producción |
|---|---|
| El esquema y sus restricciones (`npm run db:verificar`) | La latencia real de la LAN (§20, V10) |
| El comportamiento de `pg_trgm` y `unaccent` (F0.6) | Que Postgres no responda desde internet (F0.4, V9) |
| La lógica de stock y de órdenes (§8) | Que los emails salgan de verdad: en local los captura Mailpit, en producción hacen falta las credenciales SMTP de Resend (F0.11) |
| La Admin API de Auth (§13.5) | El *Send Email Hook* auto-hospedado (F0.13, V3c) |
| El envoltorio de Server Actions (§6.2) | Los backups y su restauración (§19, F0.10) |
| Google y Facebook, con credenciales reales de OAuth | El consumo de memoria de sharp bajo carga (F10.6, R3) |

**Reglas que se derivan de esto:**

1. **Ninguna verificación de F0 se da por cerrada contra el entorno local.** Las que tienen equivalente local se anotan como «comprobado en local, pendiente en producción», nunca como hechas.
2. **La versión de Postgres del stack local se iguala a la del servidor DATA** en cuanto F0.3 esté hecha (`supabase/config.toml`, `major_version`). Una diferencia de versión mayor es exactamente el tipo de cosa que aparece tarde.
3. **`DATABASE_URL` es lo único que separa un entorno del otro.** Apuntar el desarrollo a la base de producción es posible y a veces útil para diagnosticar, pero **no** para desarrollar: `npm run db:reset` borra la base a la que apunte.
4. **Las claves del stack local no son secretas.** Vienen fijas en el CLI de Supabase y son idénticas en todas las máquinas. Las de producción salen de F0.3 y no van a ningún archivo versionado.

### 18.3 Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Postgres del servidor DATA, **por IP privada** |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API de Auth y escritura en Storage. **Solo servidor** |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de navegador para iniciar y cerrar sesión |
| Credenciales de Google y Facebook | Se configuran **en Supabase**, no en la aplicación |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Storage. **Solo servidor**, nunca con prefijo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_STORAGE_URL` | Subdominio público de Storage, usado para construir las URL de imagen |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email E4. Las credenciales **SMTP** de Resend se cargan en Supabase, no acá |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Errores |
| `NEXT_PUBLIC_SITE_URL` | Enlaces absolutos en emails y metadatos |

El número de WhatsApp y el email de avisos **no son variables de entorno**: viven en `site_settings` y los edita la administradora sin desplegar (RF-20).

---

## 19. Observabilidad y respaldo

| Aspecto | Definición |
|---|---|
| **Errores** | Sentry en servidor y cliente, con *source maps* y datos personales filtrados |
| **Logs** | Salida estructurada en JSON de las operaciones sensibles, visible desde Coolify |
| **Auditoría de negocio** | Vive en la base, no en los logs: `stock_movements` y `order_status_history` (§5.8, §5.6) |
| **Backups** | Volcado diario de Postgres y respaldo del bucket de Storage, **guardados fuera del servidor DATA**, con retención y **una restauración de prueba documentada**. Un backup que nunca se restauró no es un backup, y uno que vive en la máquina que puede fallar tampoco |
| **Salud** | Endpoint de healthcheck que verifica la conexión a la base **y distingue «aplicación caída» de «base inalcanzable»**: con dos servidores, saber cuál de los dos falló es la mitad del diagnóstico |

---

## 20. Rendimiento

| Objetivo | Valor |
|---|---|
| LCP en catálogo y ficha (móvil, 4G) | < 2,5 s |
| Respuesta del servidor en catálogo con filtros | < 300 ms |
| Peso de una imagen de tarjeta (600 px WEBP) | < 60 KB |
| JavaScript inicial en el sitio público | Lo mínimo posible: la mayoría son Server Components |

**La base está en otro servidor.** Cada consulta paga la latencia de la LAN (1-2 ms esperados, a verificar en V10). La consecuencia de diseño: **evitar cascadas de consultas secuenciales**. Las lecturas independientes de una misma pantalla se lanzan en paralelo, y lo que se puede resolver en una consulta con `JOIN` no se parte en tres.

**Medidas concretas:** índices parciales sobre `is_active` (§5.10); `final_price` como columna generada e indexada; `next/image` con `sizes` correctos y `priority` solo en la imagen principal de la ficha; componentes de cliente acotados a la interacción real (selector de color, filtros, galería).

---

## 21. Riesgos técnicos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| **R1** | Error en la aritmética de stock: se vende algo que no hay | Alto | `UPDATE` condicional atómico (§8.2), `CHECK` en la base, libro mayor, tests con Postgres real |
| **R2** | `numeric` como string mal manejado: totales con centavos erróneos | Alto | Aritmética en SQL o con `decimal.js`; prohibición de `parseFloat` como regla de lint (§7.1) |
| **R3** | sharp falla en el build de Docker por musl vs glibc | Medio | Imagen base Debian slim, no Alpine (§18.1) |
| **R4** | Un solo entorno: una migración mala impacta directo en producción | Alto | Migraciones compatibles hacia atrás, backup verificado previo, restauración probada (§18.2, §19) |
| **R5** | Se opera un stack de doce servicios de Supabase para usar tres | Medio | Servidor dedicado, para que su consumo no compita con la aplicación. Solo Storage y Studio se exponen, y Studio con restricción por IP (§2.4) |
| **R6** | Fallas de firma S3 reportadas en Supabase Storage auto-hospedado | Medio | Se valida subida, borrado y descarga extremo a extremo apenas se levanta el servidor DATA, antes de construir encima. El adaptador (§9.4) acota el reemplazo si hiciera falta |
| **R7** | Identidad sin perfil: un usuario que puede entrar y con el que la aplicación no sabe qué hacer | Alto | Compensación explícita en el alta y creación diferida tras OAuth (§13.4). Sin perfil no se opera |
| **R8** | El catálogo crece y `LIMIT/OFFSET` se degrada | Bajo | Volumen esperado bajo (S-05); migración a cursor documentada como paso siguiente |
| **R9** | Cambios de Next 16 aún en evolución (Cache Components) | Bajo | No se adoptan en el MVP; el camino queda preparado pero cerrado (§12) |
| **R10** | `next build` agota la memoria del servidor | Medio | Depende de la infraestructura (§2.4). Se resuelve compilando en CI; si se compila en el servidor, exige swap y límite de heap de Node |
| **R11** | El disco del servidor APP se llena con imágenes Docker y caché de build | Medio | Coolify trae limpieza automática, **pero desactivada**: hay que configurarla explícitamente al aprovisionar (§2.4). Compilar en CI reduce mucho la acumulación |
| **R12** | La LAN privada queda accesible a otros clientes del proveedor, o Postgres escucha en la interfaz pública | **Alto** | Firewall local en ambos servidores, `listen_addresses` y `pg_hba.conf` restringidos. Se verifica desde afuera que el puerto de Postgres no responde (V9) |
| **R13** | Sin RLS, una consulta que olvide filtrar por `user_id` filtra datos entre compradores | **Alto** | Decisión consciente (§13.4). Se compensa con test E2E de aislamiento obligatorio (§17.2) y atención específica en revisión de código |
| **R14** | Caída del servidor DATA deja el sitio inoperable | Medio | Punto único de falla aceptado en el MVP. Ahora también cae la **autenticación**, no solo la base. Healthcheck que distinga «app caída» de «DATA inalcanzable» (§19) |
| **R15** | SMTP mal configurado: los emails de autenticación no llegan | **Alto** | El emisor por omisión de Supabase no sirve para producción. Sin SMTP, **nadie puede verificar su email ni recuperar su contraseña**. Se verifica en F0, no al final |

---

## 22. Trazabilidad: requisito funcional → solución técnica

| Requisito | Dónde se resuelve |
|---|---|
| RF-02 búsqueda tolerante y filtros | §10.1, §10.2, §5.10 |
| RF-03 selector de color sin recargar | §5.4 variantes, cliente con estado en URL |
| RF-04 compra por WhatsApp | `lib/whatsapp.ts`, `site_settings` (§5.9) |
| RF-05 / RF-06 registro, login social, teléfono | §13.4 |
| RF-08 carrito solo con sesión, revalidación, ítems eliminados | §5.5, §8.4 paso 3, §17.1 |
| RF-11 / RF-12 checkout, confirmación, idempotencia | §8.4, §8.5 |
| RF-13 estados de orden | `order_status` (§5.2), `order_status_history` (§5.6) |
| RF-16 stock e imágenes por variante, reutilización | §5.4, §9.4 |
| RF-17 optimización de imágenes | §9.1, §9.2 |
| RF-22 / RF-23 editar, finalizar y cancelar órdenes | §8.1, §8.3 |
| RF-24 órdenes manuales, stock negativo permitido | §5.4 nota, §8.1 |
| RF-25 devoluciones con y sin reposición | §5.7, §8.1 |
| RF-26 / RF-27 usuarios y bloqueo con razón | §13.5, §5.3 |
| RF-28 reportes y exportación | §15 |
| RF-31 categorías relacionadas recíprocas | §5.4, §11.1 |
| RF-32 cascada de recomendados | §11.2 |
| RF-33 vistos recientemente | §11.3 |
| RN-04b descuento como monto | §5.4 `final_price`, §7.2 |
| RN-07 reserva de stock sin expiración | §8.1 — no hay job programado, por diseño |
| RN-12 snapshot en órdenes | §5.6 |
| RNF-05 consistencia de stock | §8.2, §8.3 |
| RNF-06 trazabilidad | §5.8, §5.6 |
| RNF-07 seguridad y aislamiento entre usuarios | §13.7, §13.8, §16 |

---

## 23. Puntos a verificar al iniciar el desarrollo

Estos son datos que dependen de la versión exacta que se instale y deben confirmarse en la primera semana, antes de construir sobre ellos:

| # | A verificar | Por qué |
|---|---|---|
| V1 | Versiones exactas de Next, Drizzle, sharp y los SDK de Supabase al instalar | Las de §2.1 son una foto del 2026-08-31 |
| V2 | **SMTP de Resend configurado en Supabase**, con un email de verificación efectivamente recibido | R15. Sin esto no hay registro posible |
| V3 | Admin API de Auth auto-hospedada: crear, invitar, bloquear y desbloquear usuarios | RF-26 y RF-27 dependen de ella |
| V3b | Si un usuario bloqueado recibe `user_banned` en el **primer** intento de ingreso o un error genérico | Cambia cómo se detecta el bloqueo en §13.5 |
| V3c | Si el *Send Email Hook* funciona auto-hospedado | Decide si los cuatro emails se unifican en React Email (§13.6) |
| V4 | Subida, descarga y borrado contra Supabase Storage auto-hospedado, extremo a extremo | R6: hay fallas de firma S3 reportadas en self-hosted |
| V5 | Que `pg_trgm` y `unaccent` se puedan crear en la Postgres de Supabase | Toda la búsqueda depende de ello (§10.1) |
| V6 | Comportamiento de `numeric` en la versión de Drizzle instalada (`string` por omisión) | §7.1 se apoya en eso |
| V7 | Build de Docker con sharp funcionando end to end | R3 |
| **V8** | Que el servidor APP cumpla el mínimo de Coolify: 2 CPU, 2 GB de RAM y **30 GB de disco** | Bloquea el primer despliegue real |
| **V9** | Que el puerto de Postgres **no responda desde internet**, comprobado desde una máquina externa | R12. Es la verificación más importante del aprovisionamiento |
| **V10** | Latencia real de la LAN entre APP y DATA, medida con una consulta ida y vuelta | Todo el presupuesto de rendimiento (§20) asume 1-2 ms |
