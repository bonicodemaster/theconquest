-- Per-round wrong-guess tracking for Pays Mystère + Capitales, so a round can
-- end early once every present player has used up their guesses (no waiting out
-- the timer when the country has effectively been settled).
--
-- Shape: { "r": <round_index>, "m": { "<user_id>": <wrong_count> } }
-- The round index `r` lets the app self-reset the counts when the round
-- changes, so no reset writes are needed in the start/advance paths.
--
-- Run with: supabase db push  (or paste in the Supabase SQL editor)

alter table games
  add column if not exists round_misses jsonb not null default '{}'::jsonb;
