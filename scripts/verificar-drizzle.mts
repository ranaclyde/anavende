/** F1.4: el cliente de la aplicación se conecta y lee el esquema. */
try { process.loadEnvFile(".env.local"); } catch {}
const { db } = await import("../db/index.ts");
const { sql } = await import("drizzle-orm");
const { userProfiles, products } = await import("../db/schema/index.ts");

const tablas = await db.execute(
  sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
);
console.log(`✅ Drizzle conectado — ${tablas[0].n} tablas en public`);

const perfiles = await db.select().from(userProfiles).limit(1);
const prods = await db.select().from(products).limit(1);
console.log(`✅ Consulta tipada: user_profiles(${perfiles.length}) products(${prods.length})`);
process.exit(0);
