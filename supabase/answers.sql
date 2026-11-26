-- 삼공육 · 문항 기록 · 내 약점 분석 · 관리자 회원 활동 분석 (2026-11-24, 2판)
-- 어디서: 동아리 Supabase 프로젝트 samgongyuk (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: schema.sql · ops.sql 다음에, 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요 (데이터는 안 지워요).
--          예전 판(1판)을 이미 돌렸어도 그대로 다시 돌리면 새 칸 · 새 기능이 더해져요.
--
-- answers  게임에서 문제 하나를 풀 때마다 한 줄 (로그인한 회원만)
--   item    문제 이름 (관절오목 (Glenoid cavity))          cat   묶음 · 단원 (어깨뼈 · 어깨·위팔 · 신경계)
--   ok      맞았나 (첫 시도 기준)                           mode  난이도 · 맵
--   picked  틀렸을 때 무엇을 골랐나 (헷갈린 짝)               ms    맞히는 데 걸린 시간 (밀리초)
--   reason  timeout = 시간 초과, no_voice = 마이크가 아무 소리도 못 들음 (정답률에서 빼요)
--   play_id 한 판 (시작 ~ 끝) 번호. 끝까지 하면 runs.detail.play 에 같은 번호가 들어가요 → 어디서 그만두나
--   게임은 auth.js 의 SamAuth.answer({ game, item, cat, ok, mode, picked, ms, reason }) 로 남겨요
--
-- visit_sessions  한 번 들어와서 나갈 때까지 (창 하나). 머문 시간 · 재방문 분석용 (live_sessions 가 지워질 때 옮겨 담아요)
-- answer_stats    1년 지난 문항 기록은 이름 없는 월별 통계로만 남기고 지워요 (보관 기간)
--
-- 함수
--   log_answers(rows)          게임이 보내는 기록 저장 (회원만, 한 번에 300줄까지)
--   my_weak(game, days)        학생: 정답률 · 단원별 · 자주 틀리는 문제 · 헷갈린 짝 · 맞혔지만 느린 문제 · 날짜별
--   admin_items(game, days)    관리자: 모두가 자주 틀리는 문제 · 헷갈린 짝 · 단원별 · 음성 인식 실패
--   admin_activity(days)       관리자: 회원별 활동 (게임별 · 주 시간대 · 머문 시간 · 정답률) · 요일×시간 · 머문 시간 · 재방문
--   admin_plays(days)          관리자: 게임별 끝까지 한 비율 · 몇 문제째에서 그만두나
--   ops_purge()                보관 기간 정리 (매달 1일 자동, pg_cron 이 켜져 있으면)

-- ── 문항 기록 ─────────────────────────────────────────────────────
create table if not exists public.answers (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  game       text not null,
  item       text not null check (char_length(item) between 1 and 120),
  cat        text not null default '' check (char_length(cat) <= 60),
  mode       text not null default '' check (char_length(mode) <= 30),
  ok         boolean not null,
  created_at timestamptz not null default now()
);
-- 게임 이름 허용 목록 (새 게임이 생기면 여기와 아래 log_answers 두 곳에 추가). 2026-11-26: yesno = 말해 YES OR NO
alter table public.answers drop constraint if exists answers_game_check;
alter table public.answers add constraint answers_game_check check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf', 'yesno'));
alter table public.answers add column if not exists picked text not null default '' check (char_length(picked) <= 120);
alter table public.answers add column if not exists ms int check (ms between 0 and 600000);
alter table public.answers add column if not exists reason text not null default '' check (reason in ('', 'timeout', 'no_voice'));
alter table public.answers add column if not exists play_id uuid;
create index if not exists answers_user_idx on public.answers (user_id, game, created_at desc);
create index if not exists answers_item_idx on public.answers (game, item);
create index if not exists answers_created_idx on public.answers (created_at);
create index if not exists answers_play_idx on public.answers (play_id) where play_id is not null;
create index if not exists runs_play_idx on public.runs ((detail->>'play')) where detail ? 'play';
alter table public.answers enable row level security;
drop policy if exists "문항: 본인·관리자 보기" on public.answers;
create policy "문항: 본인·관리자 보기" on public.answers for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "문항: 관리자가 지우기" on public.answers;
create policy "문항: 관리자가 지우기" on public.answers for delete to authenticated using (public.is_admin());
revoke insert, update on public.answers from anon, authenticated;   -- 저장은 log_answers 로만
grant select, delete on public.answers to authenticated;

-- 1년 지난 기록의 월별 통계 (누가 풀었는지는 없음)
create table if not exists public.answer_stats (
  month date not null, game text not null, item text not null, cat text not null default '',
  tries int not null, "right" int not null,
  primary key (month, game, item)
);
alter table public.answer_stats enable row level security;
revoke all on public.answer_stats from anon, authenticated;

-- ── 머문 시간 (창 하나가 열려 있던 동안) ─────────────────────────────
create table if not exists public.visit_sessions (
  sid        text primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  page       text not null default '',
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  minutes    numeric generated always as (round(extract(epoch from (ended_at - started_at)) / 60.0, 1)) stored
);
create index if not exists visit_sessions_started_idx on public.visit_sessions (started_at);
create index if not exists visit_sessions_user_idx on public.visit_sessions (user_id, started_at);
alter table public.visit_sessions enable row level security;
revoke all on public.visit_sessions from anon, authenticated;

-- live_sessions(ops.sql)에서 지워질 때(10분 동안 소식 없음) 여기로 옮겨요
create or replace function public.keep_visit_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.visit_sessions (sid, user_id, page, started_at, ended_at)
  values (old.sid, old.user_id, old.page, old.started_at, greatest(old.last_seen, old.started_at))
  on conflict (sid) do update set ended_at = greatest(public.visit_sessions.ended_at, excluded.ended_at),
    user_id = coalesce(excluded.user_id, public.visit_sessions.user_id), page = excluded.page;
  return old;
end $$;
do $$ begin
  if to_regclass('public.live_sessions') is not null then
    drop trigger if exists keep_visit_session on public.live_sessions;
    create trigger keep_visit_session before delete on public.live_sessions for each row execute function public.keep_visit_session();
  else
    raise notice 'live_sessions 가 없어요. ops.sql 을 먼저 실행한 뒤 이 파일을 다시 실행해 주세요 (머문 시간 기록).';
  end if;
end $$;

-- ── 저장 ───────────────────────────────────────────────────────────
-- 게임이 보낸 기록 저장: rows = [{ game, item, cat, ok, mode, picked, ms, reason, play }, ...]
create or replace function public.log_answers(p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then return 0; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then return 0; end if;
  if jsonb_array_length(p_rows) > 300 then raise exception 'too many rows'; end if;
  -- 너무 빨리 많이 들어오면 (1분에 600줄 넘게) 이번 것은 버려요
  if (select count(*) from public.answers where user_id = auth.uid() and created_at > now() - interval '1 minute') > 600 then return 0; end if;
  insert into public.answers (user_id, game, item, cat, mode, ok, picked, ms, reason, play_id)
  select auth.uid(), r.game, left(btrim(r.item), 120), left(coalesce(r.cat, ''), 60), left(coalesce(r.mode, ''), 30), r.ok,
         left(btrim(coalesce(r.picked, '')), 120),
         case when r.ms between 0 and 600000 then r.ms end,
         case when r.reason in ('timeout', 'no_voice') then r.reason else '' end,
         case when r.play ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then r.play::uuid end
  from jsonb_to_recordset(p_rows) as r(game text, item text, cat text, mode text, ok boolean, picked text, ms int, reason text, play text)
  where r.game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf', 'yesno') and r.ok is not null and char_length(btrim(coalesce(r.item, ''))) > 0;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 학생: 내 약점 (p_game 비우면 모든 게임, p_days 비우면 전체 기간) ──────────
-- 정답률은 마이크가 아무 소리도 못 들은 것(no_voice)을 빼고 계산해요
create or replace function public.my_weak(p_game text default null, p_days int default null) returns json
language sql stable security definer set search_path = '' as $$
  with a0 as (
    select * from public.answers
    where user_id = auth.uid() and (p_game is null or game = p_game)
      and (p_days is null or created_at > now() - make_interval(days => least(greatest(p_days, 1), 365)))
  ), a as (select * from a0 where reason <> 'no_voice'),
  speed as (   -- 게임별 내가 맞힌 문제의 보통 걸린 시간
    select game, percentile_cont(0.5) within group (order by ms) as med from a where ok and ms is not null group by game
  )
  select json_build_object(
    'total', (select count(*) from a),
    'right', (select count(*) from a where ok),
    'no_voice', (select count(*) from a0 where reason = 'no_voice'),
    'timeouts', (select count(*) from a where reason = 'timeout'),
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
               (array_agg(ok order by id desc))[1] as last_ok,   -- 가장 마지막에 푼 결과 (한 번에 보낸 줄은 시각이 같아서 번호 순)
               (array_agg(picked order by id desc) filter (where not ok and picked <> ''))[1] as last_picked
        from a group by game, item having count(*) filter (where not ok) > 0
        order by count(*) filter (where not ok) desc, 6 limit 20) x),
    -- 헷갈린 짝: 이 문제에서 무엇을 골랐나
    'confuse', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select game, item, picked, count(*) as n from a where not ok and picked <> ''
        group by game, item, picked order by count(*) desc limit 10) x),
    -- 맞혔지만 느린 문제: 두 번 넘게 맞혔고, 걸린 시간이 내 보통 시간의 1.5배 넘는 것
    'slow', (select coalesce(json_agg(x order by x.ratio desc), '[]'::json) from (
        select a.game, a.item, count(*) as n, round(avg(a.ms)) as avg_ms, round((avg(a.ms) / nullif(s.med, 0))::numeric, 1) as ratio
        from a join speed s on s.game = a.game where a.ok and a.ms is not null
        group by a.game, a.item, s.med having count(*) >= 2 and avg(a.ms) > 1.5 * s.med
        order by avg(a.ms) / nullif(s.med, 0) desc limit 8) x),
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

-- ── 관리자: 모든 회원이 자주 틀리는 문제 (수업 · 문제 개선용) ───────────────
create or replace function public.admin_items(p_game text default null, p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return (with a0 as (
      select * from public.answers where (p_game is null or game = p_game) and created_at > now() - make_interval(days => d)
    ), a as (select * from a0 where reason <> 'no_voice')
    select json_build_object(
      'total', (select count(*) from a), 'right', (select count(*) from a where ok),
      'users', (select count(distinct user_id) from a),
      'games', (select coalesce(json_agg(x order by x.tries desc), '[]'::json) from (
          select game, count(*) filter (where reason <> 'no_voice') as tries, count(*) filter (where ok and reason <> 'no_voice') as "right",
                 count(distinct user_id) as users, count(*) filter (where reason = 'no_voice') as no_voice,
                 count(*) filter (where reason = 'timeout') as timeouts, round(avg(ms) filter (where ok)) as avg_ms
          from a0 group by game) x),
      'cats', (select coalesce(json_agg(x order by x.rate, x.tries desc), '[]'::json) from (
          select game, cat, count(*) as tries, count(distinct user_id) as users,
                 round(100.0 * count(*) filter (where ok) / count(*)) as rate
          from a where cat <> '' group by game, cat) x),
      -- 3번 넘게 풀린 문제 중 정답률이 낮은 순 (+ 많이 고른 오답, 맞힐 때 걸린 시간)
      'hard', (select coalesce(json_agg(x order by x.rate, x.tries desc), '[]'::json) from (
          select game, item, max(cat) as cat, count(*) as tries, count(distinct user_id) as users,
                 round(100.0 * count(*) filter (where ok) / count(*)) as rate,
                 round(avg(ms) filter (where ok)) as avg_ms,
                 mode() within group (order by nullif(picked, '')) as top_picked
          from a group by game, item having count(*) >= 3
          order by 6, 4 desc limit 30) x),
      -- 헷갈린 짝 TOP 20
      'confuse', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
          select game, item, picked, count(*) as n, count(distinct user_id) as users from a
          where not ok and picked <> '' group by game, item, picked order by count(*) desc limit 20) x),
      -- 음성 인식: 아무 소리도 못 들은 횟수 · 엉뚱하게 들린 말 (뭐라구요!?)
      'voice', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
          select item, picked as heard, count(*) as n from a0
          where game = 'wizard' and not ok and picked <> '' group by item, picked order by count(*) desc limit 15) x)
    ));
end $$;

-- ── 관리자: 회원별 활동 · 요일×시간 · 머문 시간 · 재방문 ────────────────────
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
    -- 머문 시간: 창 하나가 열려 있던 동안 (1분 미만은 빼고)
    'sessions', (select json_build_object(
        'count', count(*), 'members', count(*) filter (where user_id is not null),
        'avg_min', round(avg(minutes), 1), 'median_min', round((percentile_cont(0.5) within group (order by minutes))::numeric, 1),
        'buckets', json_build_object('1-5', count(*) filter (where minutes < 5), '5-15', count(*) filter (where minutes >= 5 and minutes < 15),
                                     '15-30', count(*) filter (where minutes >= 15 and minutes < 30), '30+', count(*) filter (where minutes >= 30)))
      from public.visit_sessions where started_at >= t0 and minutes >= 1),
    'session_pages', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select page, count(*) as n, round(avg(minutes), 1) as avg_min from public.visit_sessions
        where started_at >= t0 and minutes >= 1 group by page) x),
    -- 재방문: 기간 안에 처음 온 회원 중, 다른 날 다시 온 회원 (7일 안)
    'retention', (with first as (
          select user_id, min((created_at at time zone 'Asia/Seoul')::date) as d0 from public.visits
          where user_id is not null group by user_id having min(created_at) >= t0
        )
        select json_build_object('new', count(*),
          'back7', count(*) filter (where exists (select 1 from public.visits v where v.user_id = f.user_id
                     and (v.created_at at time zone 'Asia/Seoul')::date between f.d0 + 1 and f.d0 + 7)),
          'back_any', count(*) filter (where exists (select 1 from public.visits v where v.user_id = f.user_id
                     and (v.created_at at time zone 'Asia/Seoul')::date > f.d0)))
        from first f),
    -- 회원별: 게임 실행 · 게임별 · 주로 하는 시간대 · 활동한 날 · 머문 시간 · 끝까지 한 판 · 문제 정답률
    'users', (select coalesce(json_agg(x order by x.plays desc, x.answers desc), '[]'::json) from (
        select p.id, p.kind, p.login_id, p.name, public.grade_of(p.entry_year, p.grade_override) as grade, p.last_seen_at,
               coalesce(v.plays, 0) as plays, coalesce(v.days, 0) as active_days, v.by_game, v.top_hour,
               coalesce(r.runs, 0) as runs, coalesce(an.n, 0) as answers, an.rate, coalesce(s.minutes, 0) as minutes
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
                           from public.answers where user_id = p.id and created_at >= t0 and reason <> 'no_voice') an on true
        left join lateral (select round(sum(minutes)) as minutes from public.visit_sessions
                           where user_id = p.id and started_at >= t0) s on true
      ) x)
  );
end $$;

-- ── 관리자: 한 판을 끝까지 하나, 어디서 그만두나 ─────────────────────────
-- 한 판 = 같은 play_id 의 문제들. runs.detail.play 에 같은 번호가 있으면 끝까지 한 판이에요.
create or replace function public.admin_plays(p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return (with pl as (
      select a.play_id, a.game, a.user_id, count(*) as steps, min(a.created_at) as t0, max(a.created_at) as t1,
             exists (select 1 from public.runs r where r.detail->>'play' = a.play_id::text) as done
      from public.answers a where a.play_id is not null and a.created_at > now() - make_interval(days => d)
      group by a.play_id, a.game, a.user_id
    )
    select coalesce(json_agg(x order by x.plays desc), '[]'::json) from (
      select game, count(*) as plays, count(*) filter (where done) as done,
             round(avg(steps) filter (where done), 1) as avg_steps_done,
             round(avg(steps) filter (where not done), 1) as avg_steps_quit,
             round(avg(extract(epoch from (t1 - t0)) / 60.0) filter (where done)::numeric, 1) as avg_min_done,
             json_build_object(
               '1-3',   count(*) filter (where not done and steps <= 3),
               '4-6',   count(*) filter (where not done and steps between 4 and 6),
               '7-10',  count(*) filter (where not done and steps between 7 and 10),
               '11-20', count(*) filter (where not done and steps between 11 and 20),
               '21+',   count(*) filter (where not done and steps > 20)) as quit_at
      from pl group by game) x);
end $$;

-- ── 보관 기간 정리 (가입 동의문과 같아요) ─────────────────────────────
--   문항 기록: 1년 지나면 이름 없는 월별 통계(answer_stats)로 옮기고 지워요
--   머문 시간 기록: 1년 지나면 지워요 · 방문 기록: 1년 지나면 누가 왔는지(user_id)를 지워요 (횟수만 남음)
--   탈퇴 · 계정 삭제 때는 cascade 로 바로 같이 지워져요 (schema.sql)
create or replace function public.ops_purge() returns json
language plpgsql security definer set search_path = '' as $$
declare cut timestamptz := now() - interval '365 days'; a int; s int; v int;
begin
  insert into public.answer_stats (month, game, item, cat, tries, "right")
  select date_trunc('month', created_at at time zone 'Asia/Seoul')::date, game, item, max(cat), count(*), count(*) filter (where ok)
  from public.answers where created_at < cut and reason <> 'no_voice' group by 1, 2, 3
  on conflict (month, game, item) do update set tries = public.answer_stats.tries + excluded.tries, "right" = public.answer_stats."right" + excluded."right";
  delete from public.answers where created_at < cut; get diagnostics a = row_count;
  delete from public.visit_sessions where started_at < cut; get diagnostics s = row_count;
  update public.visits set user_id = null where created_at < cut and user_id is not null; get diagnostics v = row_count;
  if to_regclass('public.ops_backups') is not null then   -- 동의문: 백업 사본은 30일 안에 삭제
    delete from public.ops_backups where created_at < now() - interval '30 days';
  end if;
  return json_build_object('answers_moved', a, 'sessions_deleted', s, 'visits_anonymized', v);
end $$;

revoke all on function public.log_answers(jsonb), public.my_weak(text, int), public.admin_items(text, int),
  public.admin_activity(int), public.admin_plays(int) from public, anon;
revoke all on function public.ops_purge(), public.keep_visit_session() from public, anon, authenticated;
grant execute on function public.log_answers(jsonb), public.my_weak(text, int), public.admin_items(text, int),
  public.admin_activity(int), public.admin_plays(int) to authenticated;

-- 매달 1일 04:30 (한국) 보관 기간 정리 — pg_cron 이 켜져 있을 때만
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('samgongyuk-purge', '30 19 1 * *', 'select public.ops_purge()');
    -- 가입 동의문: "백업 사본은 30일 안에 삭제" → 매일 03:40 (한국) 30일 지난 백업 지우기
    perform cron.schedule('samgongyuk-backup-expire', '40 18 * * *', $c$delete from public.ops_backups where created_at < now() - interval '30 days'$c$);
    raise notice '자동 작업을 등록했어요: samgongyuk-purge (매달 1일 보관 기간 정리), samgongyuk-backup-expire (매일 30일 지난 백업 삭제)';
  end if;
end $$;
