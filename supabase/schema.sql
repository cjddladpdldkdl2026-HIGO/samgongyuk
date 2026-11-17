-- 삼공육 계정·게시판·기록 DB (동아리 Supabase 프로젝트 samgongyuk, 서울)
-- 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요 (만들기만 하고 데이터는 안 지워요).
--
-- 로그인: 학번/관리자 아이디 + 비밀번호. Supabase 는 이메일 로그인이라 가짜 이메일로 바꿔 써요 (account.js).
--   학생   2612113 → s2612113@samgongyuk.invalid   표시 이름 = 실명
--   관리자 admin1  → a.admin1@samgongyuk.invalid   표시 이름 = 닉네임, 다른 관리자가 승인해야 권한 (맨 처음 관리자는 자동 승인)
--   ⚠ Authentication → Sign In / Providers 에서 "Confirm email" 을 꺼야 가입하자마자 로그인돼요.
-- 표: profiles(회원) · posts(공지·게시판) · visits(방문·게임 실행) · settings(로그인 필수 등) · runs(게임 기록)

create extension if not exists pgcrypto with schema extensions;

-- ── 회원 ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  kind           text not null check (kind in ('student', 'admin')),
  login_id       text not null unique,
  name           text not null check (char_length(name) between 2 and 20),
  dept           text not null default '물리치료과',
  entry_year     int,
  grade_override int check (grade_override between 1 and 6),
  approved       boolean not null default false,
  consent_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and kind = 'admin' and approved);
$$;

create or replace function public.grade_of(p_entry int, p_override int) returns int
language sql stable set search_path = '' as $$
  select coalesce(p_override, greatest(1,
    (extract(year from now())::int - case when extract(month from now()) < 3 then 1 else 0 end) - coalesce(p_entry, extract(year from now())::int) + 1));
$$;

drop policy if exists "회원: 본인과 관리자만 보기" on public.profiles;
create policy "회원: 본인과 관리자만 보기" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "회원: 관리자만 고치기" on public.profiles;
create policy "회원: 관리자만 고치기" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (approved, grade_override) on public.profiles to authenticated;

-- 가입하면 auth.users 에 들어온 정보(kind, login_id, name, dept, consent)로 회원 줄을 만들어요
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  k text := m->>'kind';
  lid text := lower(btrim(coalesce(m->>'login_id', '')));
  nm text := btrim(coalesce(m->>'name', ''));
begin
  if coalesce((m->>'consent')::boolean, false) is not true then raise exception 'consent required'; end if;
  if k = 'student' then
    if lid !~ '^\d{7}$' or new.email <> ('s' || lid || '@samgongyuk.invalid') then raise exception 'bad student id'; end if;
  elsif k = 'admin' then
    if lid !~ '^[a-z][a-z0-9_]{3,15}$' or new.email <> ('a.' || lid || '@samgongyuk.invalid') then raise exception 'bad admin id'; end if;
  else
    raise exception 'bad kind';
  end if;
  if char_length(nm) < 2 or char_length(nm) > 20 then raise exception 'bad name'; end if;
  insert into public.profiles (id, kind, login_id, name, dept, entry_year, approved)
  values (new.id, k, lid, nm, coalesce(nullif(m->>'dept', ''), '물리치료과'),
          case when k = 'student' then 2000 + left(lid, 2)::int end,
          -- 맨 처음 관리자는 자동 승인 (승인해 줄 사람이 없으니까)
          k = 'admin' and not exists (select 1 from public.profiles where kind = 'admin' and approved));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 마지막 접속 시각
create or replace function public.touch() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

-- ── 공지사항 · 이용자 게시판 ─────────────────────────────────────────
create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category    text not null check (category in ('notice', 'update', 'request', 'question', 'bug', 'free')),
  title       text not null check (char_length(title) between 1 and 100),
  body        text not null check (char_length(body) between 1 and 5000),
  is_private  boolean not null default false,
  pinned      boolean not null default false,
  status      text not null default '접수' check (status in ('접수', '처리중', '완료')),
  answer      text check (char_length(answer) <= 5000),
  answered_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "글: 공개글은 모두, 비공개는 쓴 사람·관리자" on public.posts;
create policy "글: 공개글은 모두, 비공개는 쓴 사람·관리자" on public.posts for select
  using (not is_private or author = auth.uid() or public.is_admin());
drop policy if exists "글: 로그인한 회원이 쓰기" on public.posts;
create policy "글: 로그인한 회원이 쓰기" on public.posts for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.profiles where id = auth.uid())
              and (public.is_admin() or (category in ('request', 'question', 'bug', 'free') and not pinned)));
drop policy if exists "글: 쓴 사람·관리자가 고치기" on public.posts;
create policy "글: 쓴 사람·관리자가 고치기" on public.posts for update to authenticated
  using (author = auth.uid() or public.is_admin()) with check (author = auth.uid() or public.is_admin());
drop policy if exists "글: 쓴 사람·관리자가 지우기" on public.posts;
create policy "글: 쓴 사람·관리자가 지우기" on public.posts for delete to authenticated
  using (author = auth.uid() or public.is_admin());

-- 학생은 고정·답변·처리 상태·분류를 못 바꿔요
create or replace function public.posts_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.pinned := old.pinned; new.answer := old.answer; new.status := old.status;
    new.answered_at := old.answered_at; new.category := old.category; new.author := old.author;
  elsif new.answer is distinct from old.answer then
    new.answered_at := case when new.answer is null then null else now() end;
  end if;
  if new.title is distinct from old.title or new.body is distinct from old.body or new.is_private is distinct from old.is_private then
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before update on public.posts for each row execute function public.posts_guard();

-- 글쓴이 표시 (이름·관리자 여부·학년만)
create or replace function public.post_authors(p_ids uuid[])
returns table (id uuid, kind text, name text, grade int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.kind, p.name, public.grade_of(p.entry_year, p.grade_override) from public.profiles p where p.id = any(p_ids);
$$;

-- ── 방문 · 게임 실행 기록 ─────────────────────────────────────────
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  game       text not null check (char_length(game) <= 60),
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists visits_created_idx on public.visits (created_at);
alter table public.visits enable row level security;
drop policy if exists "방문: 누구나 남기기" on public.visits;
create policy "방문: 누구나 남기기" on public.visits for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "방문: 본인·관리자 보기" on public.visits;
create policy "방문: 본인·관리자 보기" on public.visits for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant insert on public.visits to anon;

-- ── 사이트 설정 ─────────────────────────────────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values ('login_required', 'false') on conflict (key) do nothing;
alter table public.settings enable row level security;
drop policy if exists "설정: 모두 보기" on public.settings;
create policy "설정: 모두 보기" on public.settings for select using (true);
drop policy if exists "설정: 관리자만 고치기" on public.settings;
create policy "설정: 관리자만 고치기" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 게임 기록 · 랭킹 ─────────────────────────────────────────────
create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  game       text not null check (game in ('landmark', 'ddan', 'wizard', 'neoege')),
  mode       text not null default '' check (char_length(mode) <= 30),
  score      integer not null check (abs(score) <= 10000000),
  accuracy   numeric check (accuracy between 0 and 100),
  detail     jsonb not null default '{}' check (pg_column_size(detail) < 4000),
  created_at timestamptz not null default now()
);
create index if not exists runs_rank_idx on public.runs (game, mode, score desc);
alter table public.runs enable row level security;
drop policy if exists "기록: 본인·관리자 보기" on public.runs;
create policy "기록: 본인·관리자 보기" on public.runs for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "기록: 회원만 저장" on public.runs;
create policy "기록: 회원만 저장" on public.runs for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid()));
drop policy if exists "기록: 관리자가 지우기" on public.runs;
create policy "기록: 관리자가 지우기" on public.runs for delete to authenticated using (public.is_admin());
revoke update on public.runs from anon, authenticated;

-- 랭킹 이름: 학생은 김*수 (26), 관리자는 닉네임
create or replace function public.display_name(p public.profiles) returns text
language sql stable set search_path = '' as $$
  select case when p.kind = 'admin' then p.name
    else (case when char_length(p.name) <= 1 then p.name
               when char_length(p.name) = 2 then left(p.name, 1) || '*'
               else left(p.name, 1) || repeat('*', char_length(p.name) - 2) || right(p.name, 1) end)
         || ' (' || left(p.login_id, 2) || ')' end;
$$;

create or replace function public.ranking(p_game text, p_mode text default '', p_limit int default 10)
returns json language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.accuracy, r.created_at
    from public.runs r
    where r.game = p_game and r.mode = coalesce(p_mode, '')
    order by r.user_id, r.score desc, r.created_at asc
  ), ranked as (
    select b.*, public.display_name(p) as nickname, rank() over (order by b.score desc) as rnk,
           row_number() over (order by b.score desc, b.created_at asc) as rn
    from best b join public.profiles p on p.id = b.user_id
  )
  select json_build_object(
    'top',    coalesce((select json_agg(json_build_object('nickname', nickname, 'score', score, 'accuracy', accuracy) order by rn)
                        from ranked where rn <= least(greatest(p_limit, 1), 50)), '[]'::json),
    'myBest', (select score from ranked where user_id = auth.uid()),
    'myRank', (select rnk from ranked where user_id = auth.uid()),
    'total',  (select count(*) from ranked)
  );
$$;

-- ── 관리자 화면용 ────────────────────────────────────────────────
create or replace function public.admin_members()
returns table (id uuid, kind text, login_id text, name text, dept text, grade int, grade_override int,
               approved boolean, created_at timestamptz, last_seen_at timestamptz, plays bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
    select p.id, p.kind, p.login_id, p.name, p.dept, public.grade_of(p.entry_year, p.grade_override), p.grade_override,
           p.approved, p.created_at, p.last_seen_at,
           (select count(*) from public.visits v where v.user_id = p.id and v.game <> 'hub')
    from public.profiles p order by p.kind, p.login_id;
end $$;

create or replace function public.admin_stats(p_days int default 14)
returns json language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 14), 1), 60);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return json_build_object(
    'members',    (select count(*) from public.profiles where kind = 'student'),
    'admins',     (select count(*) from public.profiles where kind = 'admin' and approved),
    'pending',    (select count(*) from public.profiles where kind = 'admin' and not approved),
    'users7',     (select count(distinct user_id) from public.visits where user_id is not null and created_at > now() - interval '7 days'),
    'plays7',     (select count(*) from public.visits where game <> 'hub' and created_at > now() - interval '7 days'),
    'visits7',    (select count(*) from public.visits where created_at > now() - interval '7 days'),
    'posts_open', (select count(*) from public.posts where category in ('request', 'question', 'bug') and status <> '완료'),
    'days', (select coalesce(json_agg(x order by x.day), '[]'::json) from (
        select to_char(g.day, 'YYYY-MM-DD') as day,
               (select count(*) from public.visits v where v.game <> 'hub' and (v.created_at at time zone 'Asia/Seoul')::date = g.day) as plays,
               (select count(*) from public.visits v where (v.created_at at time zone 'Asia/Seoul')::date = g.day) as visits,
               (select count(distinct v.user_id) from public.visits v where v.user_id is not null and v.game <> 'hub'
                  and (v.created_at at time zone 'Asia/Seoul')::date = g.day) as users
        from generate_series((now() at time zone 'Asia/Seoul')::date - (d - 1), (now() at time zone 'Asia/Seoul')::date, interval '1 day') as g(day)
      ) x),
    'games', (select coalesce(json_agg(y order by y.plays desc), '[]'::json) from (
        select v.game, count(*) as plays, count(distinct v.user_id) as users
        from public.visits v where v.game <> 'hub' and v.created_at > now() - make_interval(days => d) group by v.game
      ) y)
  );
end $$;

create or replace function public.admin_reset_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if char_length(coalesce(p_password, '')) < 6 then raise exception 'Password should be at least 6 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_user = auth.uid() then raise exception 'cannot delete yourself'; end if;
  delete from auth.users where id = p_user;   -- profiles · posts · visits · runs 는 cascade 로 같이 지워져요
end $$;

create or replace function public.delete_me()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.admin_members(), public.admin_stats(int), public.admin_reset_password(uuid, text),
  public.admin_delete_user(uuid), public.delete_me(), public.touch() from public, anon;
grant execute on function public.admin_members(), public.admin_stats(int), public.admin_reset_password(uuid, text),
  public.admin_delete_user(uuid), public.delete_me(), public.touch() to authenticated;
grant execute on function public.ranking(text, text, int), public.post_authors(uuid[]), public.is_admin() to anon, authenticated;
revoke all on function public.handle_new_user(), public.posts_guard() from public, anon, authenticated;
