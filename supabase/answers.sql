-- 삼공육 · 문항 기록 · 내 약점 분석 · 관리자 회원 활동 분석 (2026-11-24)
-- 어디서: 동아리 Supabase 프로젝트 samgongyuk (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: schema.sql · ops.sql 다음에, 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요 (데이터는 안 지워요).
--
-- answers  게임에서 문제 하나를 풀 때마다 한 줄 (로그인한 회원만). "어느 뼈 · 근육 · 용어 · 기출을 자주 틀리나"
--          item = 문제 이름 (예: 관절오목 (Glenoid cavity)), cat = 묶음 (예: 어깨뼈 · 어깨·위팔 · 신경로 · 2019년)
--          게임은 auth.js 의 SamAuth.answer({ game, item, cat, ok, mode }) 로 남겨요 (모아서 한 번에 보내요)
--
-- 함수
--   log_answers(rows)          게임이 보내는 기록 저장 (회원만, 한 번에 300줄까지)
--   my_weak(game, days)        학생: 내 정답률 · 묶음별 정답률 · 자주 틀리는 문제 · 날짜별 정답률
--   admin_items(game, days)    관리자: 모든 회원이 자주 틀리는 문제 · 묶음별 정답률
--   admin_activity(days)       관리자: 회원별 활동 (게임별 실행 · 주로 하는 시간 · 정답률) · 요일×시간 표

create table if not exists public.answers (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  game       text not null check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf')),
  item       text not null check (char_length(item) between 1 and 120),
  cat        text not null default '' check (char_length(cat) <= 60),
  mode       text not null default '' check (char_length(mode) <= 30),
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists answers_user_idx on public.answers (user_id, game, created_at desc);
create index if not exists answers_item_idx on public.answers (game, item);
create index if not exists answers_created_idx on public.answers (created_at);
alter table public.answers enable row level security;
drop policy if exists "문항: 본인·관리자 보기" on public.answers;
create policy "문항: 본인·관리자 보기" on public.answers for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "문항: 관리자가 지우기" on public.answers;
create policy "문항: 관리자가 지우기" on public.answers for delete to authenticated using (public.is_admin());
revoke insert, update on public.answers from anon, authenticated;   -- 저장은 log_answers 로만
grant select, delete on public.answers to authenticated;

-- 게임이 보낸 기록 저장: rows = [{ game, item, cat, ok, mode }, ...]
create or replace function public.log_answers(p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then return 0; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then return 0; end if;
  if jsonb_array_length(p_rows) > 300 then raise exception 'too many rows'; end if;
  -- 너무 빨리 많이 들어오면 (1분에 600줄 넘게) 이번 것은 버려요
  if (select count(*) from public.answers where user_id = auth.uid() and created_at > now() - interval '1 minute') > 600 then return 0; end if;
  insert into public.answers (user_id, game, item, cat, mode, ok)
  select auth.uid(), r.game, left(btrim(r.item), 120), left(coalesce(r.cat, ''), 60), left(coalesce(r.mode, ''), 30), r.ok
  from jsonb_to_recordset(p_rows) as r(game text, item text, cat text, mode text, ok boolean)
  where r.game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf') and r.ok is not null and char_length(btrim(coalesce(r.item, ''))) > 0;
  get diagnostics n = row_count;
  return n;
end $$;

-- 학생: 내 약점 (p_game 비우면 모든 게임, p_days 비우면 전체 기간)
create or replace function public.my_weak(p_game text default null, p_days int default null) returns json
language sql stable security definer set search_path = '' as $$
  with a as (
    select * from public.answers
    where user_id = auth.uid() and (p_game is null or game = p_game)
      and (p_days is null or created_at > now() - make_interval(days => least(greatest(p_days, 1), 365)))
  )
  select json_build_object(
    'total', (select count(*) from a),
    'right', (select count(*) from a where ok),
    'games', (select coalesce(json_agg(x order by x.tries desc), '[]'::json) from (
        select game, count(*) as tries, count(*) filter (where ok) as "right" from a group by game) x),
    'cats', (select coalesce(json_agg(x order by x.rate, x.tries desc), '[]'::json) from (
        select game, cat, count(*) as tries, count(*) filter (where ok) as "right",
               round(100.0 * count(*) filter (where ok) / count(*)) as rate
        from a where cat <> '' group by game, cat) x),
    -- 자주 틀리는 문제: 한 번이라도 틀린 것 중 틀린 횟수 · 틀린 비율 순
    'weak', (select coalesce(json_agg(x order by x.wrong desc, x.rate, x.last_at desc), '[]'::json) from (
        select game, item, max(cat) as cat, count(*) as tries, count(*) filter (where not ok) as wrong,
               round(100.0 * count(*) filter (where ok) / count(*)) as rate, max(created_at) as last_at,
               (array_agg(ok order by id desc))[1] as last_ok   -- 가장 마지막에 푼 결과 (한 번에 보낸 줄은 시각이 같아서 번호 순)
        from a group by game, item having count(*) filter (where not ok) > 0
        order by count(*) filter (where not ok) desc, 6 limit 20) x),
    -- 잘하는 문제 (3번 넘게 풀고 90% 이상)
    'strong', (select coalesce(json_agg(x order by x.tries desc), '[]'::json) from (
        select game, item, count(*) as tries, round(100.0 * count(*) filter (where ok) / count(*)) as rate
        from a group by game, item having count(*) >= 3 and count(*) filter (where ok) >= 0.9 * count(*)
        order by count(*) desc limit 8) x),
    -- 최근 14일 날짜별 정답률
    'days', (select coalesce(json_agg(x order by x.day), '[]'::json) from (
        select to_char((created_at at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD') as day, count(*) as tries,
               round(100.0 * count(*) filter (where ok) / count(*)) as rate
        from a where created_at > now() - interval '14 days' group by 1) x)
  );
$$;

-- 관리자: 모든 회원이 자주 틀리는 문제 (수업 · 문제 개선용)
create or replace function public.admin_items(p_game text default null, p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return (with a as (
      select * from public.answers where (p_game is null or game = p_game) and created_at > now() - make_interval(days => d)
    )
    select json_build_object(
      'total', (select count(*) from a), 'right', (select count(*) from a where ok),
      'users', (select count(distinct user_id) from a),
      'games', (select coalesce(json_agg(x order by x.tries desc), '[]'::json) from (
          select game, count(*) as tries, count(*) filter (where ok) as "right", count(distinct user_id) as users from a group by game) x),
      'cats', (select coalesce(json_agg(x order by x.rate, x.tries desc), '[]'::json) from (
          select game, cat, count(*) as tries, count(distinct user_id) as users,
                 round(100.0 * count(*) filter (where ok) / count(*)) as rate
          from a where cat <> '' group by game, cat) x),
      -- 3번 넘게 풀린 문제 중 정답률이 낮은 순
      'hard', (select coalesce(json_agg(x order by x.rate, x.tries desc), '[]'::json) from (
          select game, item, max(cat) as cat, count(*) as tries, count(distinct user_id) as users,
                 round(100.0 * count(*) filter (where ok) / count(*)) as rate
          from a group by game, item having count(*) >= 3
          order by 6, 4 desc limit 30) x)
    ));
end $$;

-- 관리자: 회원별 활동 · 요일×시간
create or replace function public.admin_activity(p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365);
        t0 timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return json_build_object(
    'days', d,
    -- 요일(0=일) × 시간(0~23) 게임 실행 수 (한국 시간, 로그인 안 한 사람 포함)
    'heat', (select coalesce(json_agg(x), '[]'::json) from (
        select extract(dow from v.created_at at time zone 'Asia/Seoul')::int as dow,
               extract(hour from v.created_at at time zone 'Asia/Seoul')::int as h, count(*) as n
        from public.visits v where v.game <> 'hub' and v.created_at >= t0 group by 1, 2) x),
    -- 회원별: 게임 실행 · 게임별 · 주로 하는 시간대 · 활동한 날 · 끝까지 한 판 · 문제 정답률
    'users', (select coalesce(json_agg(x order by x.plays desc, x.answers desc), '[]'::json) from (
        select p.id, p.kind, p.login_id, p.name, public.grade_of(p.entry_year, p.grade_override) as grade, p.last_seen_at,
               coalesce(v.plays, 0) as plays, coalesce(v.days, 0) as active_days, v.by_game, v.top_hour,
               coalesce(r.runs, 0) as runs, coalesce(an.n, 0) as answers, an.rate
        from public.profiles p
        left join lateral (
          select count(*) filter (where vv.game <> 'hub') as plays,
                 count(distinct (vv.created_at at time zone 'Asia/Seoul')::date) as days,
                 (select json_object_agg(g.game, g.n) from (select game, count(*) as n from public.visits
                    where user_id = p.id and game <> 'hub' and created_at >= t0 group by game) g) as by_game,
                 (select extract(hour from created_at at time zone 'Asia/Seoul')::int from public.visits
                    where user_id = p.id and game <> 'hub' and created_at >= t0
                    group by 1 order by count(*) desc limit 1) as top_hour
          from public.visits vv where vv.user_id = p.id and vv.created_at >= t0) v on true
        left join lateral (select count(*) as runs from public.runs where user_id = p.id and created_at >= t0) r on true
        left join lateral (select count(*) as n, round(100.0 * count(*) filter (where ok) / nullif(count(*), 0)) as rate
                           from public.answers where user_id = p.id and created_at >= t0) an on true
      ) x)
  );
end $$;

revoke all on function public.log_answers(jsonb), public.my_weak(text, int), public.admin_items(text, int),
  public.admin_activity(int) from public, anon;
grant execute on function public.log_answers(jsonb), public.my_weak(text, int), public.admin_items(text, int),
  public.admin_activity(int) to authenticated;
