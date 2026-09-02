-- TECHNICAL-SPEC §5.10 · verificado en F0.6.
-- Va PRIMERO: los índices GIN de 0001 dependen de immutable_unaccent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint

-- unaccent() es STABLE y Postgres no acepta funciones STABLE en un índice de
-- expresión. Se la envuelve como IMMUTABLE, indicándole el diccionario de
-- forma explícita: sin el primer argumento la función depende del search_path
-- y deja de ser realmente inmutable.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;
