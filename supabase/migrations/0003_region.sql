-- Optional region (continent) filter for round-based modes (Pays Mystère + Capitales).
-- NULL = whole world (default, unchanged behaviour). A continent value restricts the
-- round deck to that continent's countries — and the round count becomes all of them.
alter table games add column if not exists region text;
