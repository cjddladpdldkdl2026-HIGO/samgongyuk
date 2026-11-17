-- 삼공육 로그인·기록 DB (Supabase 프로젝트 samgongyuk, 서울)
-- 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 괜찮아요.
--
-- 가입 흐름: 구글 로그인 → join_club(학번, 닉네임, 동의) 한 번 → 그다음부터 기록 저장
--   · 학번은 private 스키마에만 있어서 사이트(브라우저)에서는 아무도 못 읽어요. 운영진은 대시보드에서만 봐요.
--   · 학번 하나에 계정 하나.
--   · 학번 확인: private.roster 에 명단이 한 줄이라도 있으면 명단에 있는 학번만, 비어 있으면 형식(private.settings)만 봐요.
-- 화면에 보이는 건 닉네임과 점수뿐이에요.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── 운영진만 보는 표 ──────────────────────────────────────────────
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings values ('student_no_pattern', '^[0-9]{6,12}$') on conflict (key) do nothing;

create table if not exists private.roster (student_no text primary key);   -- 학번 명단 (선택)

create table if not exists private.students (
  user_id    uuid primary key references auth.users on delete cascade,
  student_no text not null unique,
  agreed_at  timestamptz not null default now()
);

-- 운영진 표에도 RLS (함수만 접근)
alter table private.settings enable row level security;
alter table private.roster   enable row level security;
alter table private.students enable row level security;

-- ── 공개 표 ──────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text not null unique check (char_length(nickname) between 2 and 12),
  banned     boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "닉네임은 모두 볼 수 있음" on public.profiles;
create policy "닉네임은 모두 볼 수 있음" on public.profiles for select using (true);
-- 닉네임 바꾸기·가입은 join_club / set_nickname 함수로만 (직접 insert·update 금지)
revoke insert, update, delete on public.profiles from anon, authenticated;

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
drop policy if exists "내 기록만 보기" on public.runs;
create policy "내 기록만 보기" on public.runs for select to authenticated using (user_id = auth.uid());
drop policy if exists "가입한 학생만 기록 저장" on public.runs;
create policy "가입한 학생만 기록 저장" on public.runs for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.banned));
revoke update, delete on public.runs from anon, authenticated;

-- ── 함수 ────────────────────────────────────────────────────────
-- 처음 한 번: 학번 확인 + 닉네임 정하기
create or replace function public.join_club(p_student_no text, p_nickname text, p_agree boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sno text := regexp_replace(coalesce(p_student_no, ''), '\s', '', 'g');
  nick text := btrim(coalesce(p_nickname, ''));
  pat text;
begin
  if uid is null then return json_build_object('ok', false, 'error', '로그인이 필요해요'); end if;
  if not coalesce(p_agree, false) then return json_build_object('ok', false, 'error', '학번 수집·이용에 동의해 주세요'); end if;
  select value into pat from private.settings where key = 'student_no_pattern';
  if sno !~ coalesce(pat, '^[0-9]{6,12}$') then return json_build_object('ok', false, 'error', '학번 형식이 맞지 않아요'); end if;
  if exists (select 1 from private.roster) and not exists (select 1 from private.roster where student_no = sno) then
    return json_build_object('ok', false, 'error', '명단에 없는 학번이에요. 운영진에게 문의해 주세요');
  end if;
  if exists (select 1 from private.students where student_no = sno and user_id <> uid) then
    return json_build_object('ok', false, 'error', '이미 다른 계정이 쓰고 있는 학번이에요');
  end if;
  if char_length(nick) < 2 or char_length(nick) > 12 then return json_build_object('ok', false, 'error', '닉네임은 2~12자로 정해 주세요'); end if;
  if exists (select 1 from public.profiles where nickname = nick and id <> uid) then
    return json_build_object('ok', false, 'error', '이미 있는 닉네임이에요');
  end if;
  insert into private.students (user_id, student_no) values (uid, sno)
    on conflict (user_id) do update set student_no = excluded.student_no, agreed_at = now();
  insert into public.profiles (id, nickname) values (uid, nick)
    on conflict (id) do update set nickname = excluded.nickname;
  return json_build_object('ok', true, 'nickname', nick);
end $$;

-- 닉네임만 바꾸기
create or replace function public.set_nickname(p_nickname text)
returns json language plpgsql security definer set search_path = '' as $$
declare nick text := btrim(coalesce(p_nickname, ''));
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    return json_build_object('ok', false, 'error', '먼저 가입해 주세요');
  end if;
  if char_length(nick) < 2 or char_length(nick) > 12 then return json_build_object('ok', false, 'error', '닉네임은 2~12자로 정해 주세요'); end if;
  if exists (select 1 from public.profiles where nickname = nick and id <> auth.uid()) then
    return json_build_object('ok', false, 'error', '이미 있는 닉네임이에요');
  end if;
  update public.profiles set nickname = nick where id = auth.uid();
  return json_build_object('ok', true, 'nickname', nick);
end $$;

-- 랭킹: 사람마다 최고 점수 1개로 TOP n, 내 최고·순위, 전체 인원
create or replace function public.ranking(p_game text, p_mode text default '', p_limit int default 10)
returns json language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.accuracy, r.created_at
    from public.runs r join public.profiles p on p.id = r.user_id and not p.banned
    where r.game = p_game and r.mode = coalesce(p_mode, '')
    order by r.user_id, r.score desc, r.created_at asc
  ), ranked as (
    select b.*, p.nickname, rank() over (order by b.score desc) as rnk,
           row_number() over (order by b.score desc, b.created_at asc) as rn
    from best b join public.profiles p on p.id = b.user_id
  )
  select json_build_object(
    'top',   coalesce((select json_agg(json_build_object('nickname', nickname, 'score', score, 'accuracy', accuracy) order by rn)
                       from ranked where rn <= least(greatest(p_limit, 1), 50)), '[]'::json),
    'myBest', (select score from ranked where user_id = auth.uid()),
    'myRank', (select rnk from ranked where user_id = auth.uid()),
    'total',  (select count(*) from ranked)
  );
$$;

-- 탈퇴: 학번·닉네임·기록 지우기 (구글 로그인 정보는 남지만, 다시 가입하기 전에는 아무것도 저장되지 않아요)
create or replace function public.leave_club()
returns json language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', '로그인이 필요해요'); end if;
  delete from public.profiles where id = auth.uid();          -- runs 는 on delete cascade 로 같이 지워져요
  delete from private.students where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.join_club(text, text, boolean), public.set_nickname(text), public.leave_club() from public, anon;
grant execute on function public.join_club(text, text, boolean), public.set_nickname(text), public.leave_club() to authenticated;
grant execute on function public.ranking(text, text, int) to anon, authenticated;
