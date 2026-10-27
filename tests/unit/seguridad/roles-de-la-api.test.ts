import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";

/**
 * F0.5 — La base cerrada a los roles de la API de Supabase. TS §13.8, §16;
 * migración `0025_cerrar_postgrest.sql`.
 *
 * La tienda nunca pasa por PostgREST, pero Supabase les da a `anon` y
 * `authenticated` todos los permisos sobre cada tabla nueva de `public`. Hasta
 * el 2026-10-27, con la clave pública se leían y modificaban las tablas por
 * `/rest/v1/`. nginx corta esa ruta en producción; esto prueba la segunda
 * capa, y falla si una tabla nueva nace sin RLS o con permisos.
 */

describe("roles de la API de Supabase", () => {
  test("todas las tablas de public tienen RLS", async () => {
    const sinRls = await db.execute<{ tablename: string }>(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND NOT rowsecurity`);
    expect(sinRls.map((t) => t.tablename)).toEqual([]);
  });

  test("anon y authenticated no tienen permisos sobre tablas, vistas ni secuencias", async () => {
    const permisos = await db.execute<{ objeto: string; rol: string }>(sql`
      SELECT c.relname AS objeto, a.grantee::regrole::text AS rol
      FROM pg_class c, aclexplode(c.relacl) a
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind IN ('r', 'v', 'm', 'S', 'p', 'f')
        AND a.grantee <> 0
        AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)`);
    expect(permisos).toEqual([]);
  });

  test("las tablas y secuencias que cree postgres nacen sin esos permisos", async () => {
    const porOmision = await db.execute<{ tipo: string; rol: string }>(sql`
      SELECT d.defaclobjtype AS tipo, a.grantee::regrole::text AS rol
      FROM pg_default_acl d, aclexplode(d.defaclacl) a
      WHERE d.defaclrole = 'postgres'::regrole
        AND d.defaclnamespace = 'public'::regnamespace
        AND d.defaclobjtype IN ('r', 'S')
        AND a.grantee <> 0
        AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)`);
    expect(porOmision).toEqual([]);
  });

  test("con la clave pública, PostgREST no lee ni modifica user_profiles", async () => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles`;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    const lectura = await fetch(`${url}?select=id&limit=1`, {
      headers: { apikey: clave },
    });
    expect(lectura.status).toBe(401);
    expect((await lectura.json()).code).toBe("42501");

    const cambio = await fetch(
      `${url}?id=eq.00000000-0000-0000-0000-000000000000`,
      {
        method: "PATCH",
        headers: { apikey: clave, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      },
    );
    expect(cambio.status).toBe(401);
    expect((await cambio.json()).code).toBe("42501");
  });
});
