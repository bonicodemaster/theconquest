-- World Conquest Quiz — initial schema
-- Run with: supabase db push  (or paste in Supabase SQL editor)

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin
  create type game_mode as enum ('conquest', 'mystery');
exception when duplicate_object then null; end $$;
do $$ begin
  create type game_status as enum ('lobby', 'playing', 'finished');
exception when duplicate_object then null; end $$;
do $$ begin
  create type difficulty as enum ('easy', 'normal');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists games (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique not null,
  mode                  game_mode not null,
  status                game_status not null default 'lobby',
  difficulty            difficulty not null default 'easy',
  duration_sec          integer not null,
  max_players           integer not null,
  is_private            boolean not null default false,
  total_countries       integer,          -- mystery only
  host_user_id          uuid not null,    -- client-generated guest uuid

  started_at            timestamptz,
  ends_at               timestamptz,      -- conquest: game end ; mystery: round end

  round_index           integer not null default 0,
  total_rounds          integer,
  mystery_iso           text,
  mystery_deck          text[],
  mystery_winner_user_id uuid,
  mystery_revealed_name text,
  mystery_round_started_at timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists games_code_idx on games(code);
create index if not exists games_status_idx on games(status);

create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  user_id     uuid not null,           -- guest uuid from localStorage
  username    text not null,
  color       text not null,
  ready       boolean not null default false,
  score       integer not null default 0,
  is_host     boolean not null default false,
  joined_at   timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, username)
);

create index if not exists players_game_idx on players(game_id);

create table if not exists conquests (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  iso_code      text not null,
  player_id     uuid not null references players(id) on delete cascade,
  user_id       uuid not null,
  conquered_at  timestamptz not null default now(),
  unique (game_id, iso_code)
);

create index if not exists conquests_game_idx on conquests(game_id);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  username    text not null,
  color       text not null,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists chat_game_idx on chat_messages(game_id, created_at);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

drop trigger if exists games_set_updated_at on games;
create trigger games_set_updated_at before update on games
  for each row execute function set_updated_at();

-- ---------- RLS ----------
-- All client writes go through the Vercel API (service role); clients only need read.
alter table games          enable row level security;
alter table players        enable row level security;
alter table conquests      enable row level security;
alter table chat_messages  enable row level security;

drop policy if exists games_read   on games;
drop policy if exists players_read on players;
drop policy if exists conq_read    on conquests;
drop policy if exists chat_read    on chat_messages;

create policy games_read   on games          for select using (true);
create policy players_read on players        for select using (true);
create policy conq_read    on conquests      for select using (true);
create policy chat_read    on chat_messages  for select using (true);

-- (No insert/update/delete policies → only the service-role key can write.)
