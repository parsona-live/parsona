-- ============================================================
-- 069_fix_ai_knowledge_semantic_distance_type.sql
--
-- Fixes PostgreSQL runtime error in match_ai_knowledge_semantic:
-- "structure of query does not match function result type:
--  Returned type double precision does not match expected type real in column 3"
--
-- pgvector's <=> cosine distance operator evaluates to double precision
-- (FLOAT8). Casting to ::real ensures strict type compatibility with
-- the declared RETURNS TABLE (id uuid, content text, distance real).
-- Preserves SECURITY INVOKER from migration 032.
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
  p_account_id      uuid,
  p_query_embedding text,
  p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
  SELECT c.id,
         c.content,
         (c.embedding <=> p_query_embedding::vector(1536))::real AS distance
  FROM ai_knowledge_chunks c
  WHERE c.account_id = p_account_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding::vector(1536)
  LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) TO authenticated, service_role;

