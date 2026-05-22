-- 0002 — make games.mode free-text so new game modes need no schema change.
--
-- The API already validates `mode` with zod before every write (and only the
-- service role writes), so the enum constraint was redundant. Switching to text
-- lets us add modes ("capitals", and anything later) without further DDL.
--
-- Run with: supabase db push   (or paste in the Supabase SQL editor)

alter table games alter column mode type text using mode::text;

-- The old enum type is now unused; drop it if nothing else references it.
do $$ begin
  drop type if exists game_mode;
exception when dependent_objects_still_exist then null; end $$;
