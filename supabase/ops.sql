-- 삼공육 · part3 데이터베이스 관리 — 데이터 관리 창 · 자동 백업 · 매일 서버 점검 · 랭킹 (2026-11-18)
-- 어디서: 동아리 Supabase 프로젝트 samgongyuk (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: schema.sql 을 먼저 실행한 뒤, 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요 (데이터는 안 지워요).
--
-- 만드는 것
--   live_sessions  지금 접속 중인 창 (페이지가 1분마다 ops_ping 으로 "나 여기 있어요"를 보내요. 2분 동안 소식이 없으면 나간 걸로 봐요)
--   ops_presence   5분마다 잰 동시 접속자 수 (60일 보관) → 데이터 관리 창 그래프, 매일 보고서의 "최대 동시 접속"
--   ops_backups    백업 사본 (회원·글·설정·게임 기록·게임 저장·방문 요약). 최근 N개만 남겨요 (settings.backup_keep, 처음 10)
--   ops_reports    매일 서버 점검 보고서 (180일 보관)
--
-- 자동으로 도는 일 (pg_cron — Supabase 무료 요금제에서도 돼요)
--   5분마다      ops_tick()          동시 접속자 수 기록. 기준(settings.backup_threshold, 처음 40000명)을 넘으면 자동 백업 (6시간에 한 번까지)
--   매일 09:05   ops_daily_report()  어제(한국 시간) 보고서 만들기
--   매주 일 04:00 ops_make_backup()  정기 백업 (기준을 못 넘어도 사본이 하나는 있게)
--   pg_cron 이 안 켜져 있으면 이 파일이 켜 보고, 안 되면 알림만 남겨요. 그래도 관리자 화면의 버튼으로는 다 할 수 있어요.
--   켜는 곳: Database → Extensions → pg_cron (또는 Integrations → Cron)
--
-- 주의: 백업은 같은 DB 안에 저장돼요. 프로젝트 자체가 사라지는 경우를 대비해 관리자 화면에서 가끔 ⬇ 내려받아 두세요.
--       비밀번호는 백업에 들어가지 않아요 (auth 쪽은 Supabase 가 관리).

-- ── 지금 접속 중 ────────────────────────────────────────────────────
create table if not exists public.live_sessions (
  sid        text primary key check (char_length(sid) between 8 and 64),
  user_id    uuid references auth.users(id) on delete cascade,
  page       text not null default '' check (char_length(page) <= 60),
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists live_sessions_seen_idx on public.live_sessions (last_seen);
alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from anon, authenticated;   -- 표는 직접 못 보고, 아래 함수로만

create or replace function public.ops_ping(p_sid text, p_page text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_sid is null or char_length(p_sid) not between 8 and 64 then return; end if;
  insert into public.live_sessions as l (sid, user_id, page, last_seen)
  values (p_sid, auth.uid(), left(coalesce(p_page, ''), 60), now())
  on conflict (sid) do update
    set last_seen = now(), page = excluded.page, user_id = coalesce(excluded.user_id, l.user_id);
end $$;

-- ── 동시 접속 기록 · 백업 · 보고서 ─────────────────────────────────────
create table if not exists public.ops_presence (
  at    timestamptz primary key default now(),
  live  int not null,          -- 열려 있는 창 수 (로그인 안 한 사람 포함)
  users int not null           -- 그중 로그인한 회원 수
);
alter table public.ops_presence enable row level security;
revoke all on public.ops_presence from anon, authenticated;

create table if not exists public.ops_backups (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('load', 'weekly', 'manual')),
  reason     text not null default '',
  rows       jsonb not null default '{}'::jsonb,   -- 표별 줄 수
  bytes      bigint not null default 0,
  data       jsonb not null
);
create index if not exists ops_backups_created_idx on public.ops_backups (created_at desc);
alter table public.ops_backups enable row level security;
revoke all on public.ops_backups from anon, authenticated;

create table if not exists public.ops_reports (
  day        date primary key,                       -- 한국 날짜
  created_at timestamptz not null default now(),
  status     text not null check (status in ('ok', 'warn', 'bad')),
  data       jsonb not null
);
alter table public.ops_reports enable row level security;
revoke all on public.ops_reports from anon, authenticated;

insert into public.settings (key, value) values
  ('backup_threshold', '40000'),   -- 동시 접속이 이 수를 넘으면 자동 백업
  ('backup_keep', '10')            -- 백업 사본을 몇 개까지 남길지
on conflict (key) do nothing;

create or replace function public.ops_setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric::int end
                   from public.settings where key = p_key), p_default);
$$;

-- 백업 만들기 → 새 백업 번호
create or replace function public.ops_make_backup(p_kind text, p_reason text default '')
returns bigint language plpgsql security definer set search_path = '' as $$
declare d jsonb; r jsonb; nid bigint; keep int;
begin
  d := jsonb_build_object(
    'format', 'samgongyuk-backup-1', 'made_at', now(), 'kind', p_kind, 'reason', coalesce(p_reason, ''),
    'profiles', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.profiles t), '[]'::jsonb),
    'posts',    coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.posts t), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(t) order by t.key) from public.settings t), '[]'::jsonb),
    'runs',     coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.runs t), '[]'::jsonb),
    -- 방문 기록은 양이 많아서: 전체 기간은 날짜·게임별 요약, 원본 줄은 최근 30일만
    'visits_daily', coalesce((select jsonb_agg(x order by x.day, x.game) from (
        select (v.created_at at time zone 'Asia/Seoul')::date as day, v.game, count(*) as plays, count(distinct v.user_id) as users
        from public.visits v group by 1, 2) x), '[]'::jsonb),
    'visits_30d', coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.visits v
                            where v.created_at > now() - interval '30 days'), '[]'::jsonb)
  );
  if to_regclass('public.game_saves') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.game_saves t' into r;
    d := d || jsonb_build_object('game_saves', r);
  end if;
  select coalesce(jsonb_object_agg(k, jsonb_array_length(v)), '{}'::jsonb) into r
    from jsonb_each(d) as e(k, v) where jsonb_typeof(v) = 'array';
  insert into public.ops_backups (kind, reason, rows, bytes, data)
    values (p_kind, left(coalesce(p_reason, ''), 200), r, octet_length(d::text), d) returning id into nid;
  keep := greatest(public.ops_setting_int('backup_keep', 10), 1);
  delete from public.ops_backups where id in (select id from public.ops_backups order by created_at desc, id desc offset keep);
  return nid;
end $$;

-- 5분마다: 접속자 세기 · 오래된 접속 지우기 · 기준을 넘으면 자동 백업
create or replace function public.ops_tick() returns json
language plpgsql security definer set search_path = '' as $$
declare lv int; us int; th int; bid bigint;
begin
  delete from public.live_sessions where last_seen < now() - interval '10 minutes';
  select count(*), count(distinct user_id) into lv, us from public.live_sessions where last_seen > now() - interval '2 minutes';
  insert into public.ops_presence (at, live, users) values (now(), lv, us) on conflict (at) do nothing;
  delete from public.ops_presence where at < now() - interval '60 days';
  th := public.ops_setting_int('backup_threshold', 40000);
  if lv > th and not exists (select 1 from public.ops_backups where kind = 'load' and created_at > now() - interval '6 hours') then
    bid := public.ops_make_backup('load', format('동시 접속 %s명 — 기준 %s명을 넘어서 자동 백업', lv, th));
  end if;
  return json_build_object('live', lv, 'users', us, 'threshold', th, 'backup', bid);
end $$;

-- 매일 서버 점검 보고서 (p_day = 한국 날짜, 비우면 어제)
create or replace function public.ops_daily_report(p_day date default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  dday date := coalesce(p_day, (now() at time zone 'Asia/Seoul')::date - 1);
  t0 timestamptz := dday::timestamp at time zone 'Asia/Seoul';
  t1 timestamptz := (dday + 1)::timestamp at time zone 'Asia/Seoul';
  db_bytes bigint := pg_database_size(current_database());
  db_limit bigint := 500::bigint * 1024 * 1024;     -- 무료 요금제 DB 용량
  th int := public.ops_setting_int('backup_threshold', 40000);
  checks jsonb := '[]'::jsonb;
  st text := 'ok';
  d jsonb; tables jsonb := '{}'::jsonb; nrows bigint; tname text;
  last_backup timestamptz; peak int; peak_at timestamptz; cron_on boolean; cron_fail int := 0; ticks int;
  pend int; old_posts int; pct numeric;
begin
  -- 표 크기
  foreach tname in array array['profiles', 'posts', 'visits', 'runs', 'settings', 'game_saves',
                               'live_sessions', 'ops_presence', 'ops_backups', 'ops_reports'] loop
    if to_regclass('public.' || tname) is not null then
      execute format('select count(*) from public.%I', tname) into nrows;
      tables := tables || jsonb_build_object(tname, jsonb_build_object(
        'rows', nrows, 'bytes', pg_total_relation_size(('public.' || tname)::regclass)));
    end if;
  end loop;

  select max(live) into peak from public.ops_presence where at >= t0 and at < t1;
  select at into peak_at from public.ops_presence where at >= t0 and at < t1 and live = peak order by at limit 1;
  select count(*) into ticks from public.ops_presence where at >= t0 and at < t1;
  select max(created_at) into last_backup from public.ops_backups;
  cron_on := exists (select 1 from pg_extension where extname = 'pg_cron');
  if cron_on then
    begin
      execute $q$select count(*) from cron.job_run_details r join cron.job j on j.jobid = r.jobid
                 where j.jobname like 'samgongyuk-%' and r.status = 'failed' and r.start_time >= $1 and r.start_time < $2$q$
        into cron_fail using t0, t1;
    exception when others then cron_fail := null;
    end;
  end if;
  select count(*) into pend from public.profiles where kind = 'admin' and not approved;
  select count(*) into old_posts from public.posts
    where category in ('request', 'question', 'bug') and status <> '완료' and created_at < now() - interval '3 days';

  -- 점검 항목: level = ok / warn / bad
  pct := round(db_bytes * 100.0 / db_limit, 1);
  checks := checks || jsonb_build_object('name', 'DB 용량', 'level', case when pct >= 90 then 'bad' when pct >= 70 then 'warn' else 'ok' end,
    'msg', format('%s MB / 500 MB (%s%%)', round(db_bytes / 1048576.0, 1), pct));
  checks := checks || jsonb_build_object('name', '자동 작업 (pg_cron)',
    'level', case when not cron_on then 'warn' when cron_fail is null or cron_fail > 0 then 'warn'
                  when ticks < 200 and dday < (now() at time zone 'Asia/Seoul')::date then 'warn' else 'ok' end,
    'msg', case when not cron_on then 'pg_cron 이 꺼져 있어요. 자동 백업·보고서가 안 돌아요 (Database → Extensions → pg_cron).'
                when cron_fail is null then '실패 기록을 읽지 못했어요.'
                when cron_fail > 0 then format('실패 %s번 — Integrations → Cron 에서 기록을 확인해 주세요.', cron_fail)
                else format('접속자 확인 %s번 (하루 288번이 정상)', ticks) end);
  checks := checks || jsonb_build_object('name', '백업',
    'level', case when last_backup is null or last_backup < now() - interval '8 days' then 'warn' else 'ok' end,
    'msg', case when last_backup is null then '아직 백업이 없어요. 관리자 화면에서 "지금 백업"을 눌러 주세요.'
                else format('마지막 백업 %s', to_char(last_backup at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')) end);
  checks := checks || jsonb_build_object('name', '동시 접속',
    'level', case when coalesce(peak, 0) > th then 'bad' when coalesce(peak, 0) >= th * 0.8 then 'warn' else 'ok' end,
    'msg', format('최대 %s명 (자동 백업 기준 %s명)', coalesce(peak, 0), th));
  checks := checks || jsonb_build_object('name', '관리자 승인 대기',
    'level', case when pend > 0 then 'warn' else 'ok' end, 'msg', format('%s명', pend));
  checks := checks || jsonb_build_object('name', '3일 넘게 답이 없는 글',
    'level', case when old_posts > 0 then 'warn' else 'ok' end, 'msg', format('%s개 (요구사항·질문·오류)', old_posts));

  if exists (select 1 from jsonb_array_elements(checks) c where c->>'level' = 'bad') then st := 'bad';
  elsif exists (select 1 from jsonb_array_elements(checks) c where c->>'level' = 'warn') then st := 'warn';
  end if;

  d := jsonb_build_object(
    'day', dday, 'made_at', now(), 'status', st,
    'visits',      (select count(*) from public.visits where created_at >= t0 and created_at < t1),
    'plays',       (select count(*) from public.visits where game <> 'hub' and created_at >= t0 and created_at < t1),
    'users',       (select count(distinct user_id) from public.visits where user_id is not null and created_at >= t0 and created_at < t1),
    'new_members', (select count(*) from public.profiles where created_at >= t0 and created_at < t1),
    'runs',        (select count(*) from public.runs where created_at >= t0 and created_at < t1),
    'posts',       (select count(*) from public.posts where created_at >= t0 and created_at < t1),
    'peak_live', coalesce(peak, 0), 'peak_at', peak_at,
    'games', coalesce((select jsonb_agg(x order by x.plays desc) from (
        select game, count(*) as plays, count(distinct user_id) as users from public.visits
        where game <> 'hub' and created_at >= t0 and created_at < t1 group by game) x), '[]'::jsonb),
    'db_bytes', db_bytes, 'db_limit', db_limit, 'tables', tables,
    'backups', jsonb_build_object('count', (select count(*) from public.ops_backups), 'last', last_backup),
    'checks', checks);

  insert into public.ops_reports (day, status, data) values (dday, st, d)
    on conflict (day) do update set status = excluded.status, data = excluded.data, created_at = now();
  delete from public.ops_reports where day < (now() at time zone 'Asia/Seoul')::date - 180;
  return d;
end $$;

-- ── 관리자 화면용 ────────────────────────────────────────────────
-- 데이터 관리 창: 날짜 × 콘텐츠 표, 시간대, 학년, 지금 접속
create or replace function public.admin_data(p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  today date := (now() at time zone 'Asia/Seoul')::date;
  t0 timestamptz := (today - (d - 1))::timestamp at time zone 'Asia/Seoul';
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return json_build_object(
    'days', d, 'from', today - (d - 1), 'to', today,
    -- 날짜·콘텐츠별 (hub = 허브 방문)
    'matrix', (select coalesce(json_agg(x order by x.day, x.game), '[]'::json) from (
        select to_char((v.created_at at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD') as day, v.game,
               count(*) as plays, count(distinct v.user_id) as users
        from public.visits v where v.created_at >= t0 group by 1, 2) x),
    -- 콘텐츠별 기간 합계
    'contents', (select coalesce(json_agg(x order by x.plays desc), '[]'::json) from (
        select v.game, count(*) as plays, count(distinct v.user_id) as users
        from public.visits v where v.created_at >= t0 group by v.game) x),
    -- 날짜별 합계 (방문 · 게임 실행 · 로그인 학생 · 새 회원 · 게임 기록)
    'daily', (select coalesce(json_agg(x order by x.day), '[]'::json) from (
        select to_char(g.day, 'YYYY-MM-DD') as day,
          (select count(*) from public.visits v where (v.created_at at time zone 'Asia/Seoul')::date = g.day) as visits,
          (select count(*) from public.visits v where v.game <> 'hub' and (v.created_at at time zone 'Asia/Seoul')::date = g.day) as plays,
          (select count(distinct v.user_id) from public.visits v where v.user_id is not null and (v.created_at at time zone 'Asia/Seoul')::date = g.day) as users,
          (select count(*) from public.profiles p where (p.created_at at time zone 'Asia/Seoul')::date = g.day) as joins,
          (select count(*) from public.runs r where (r.created_at at time zone 'Asia/Seoul')::date = g.day) as runs,
          (select coalesce(max(o.live), 0) from public.ops_presence o where (o.at at time zone 'Asia/Seoul')::date = g.day) as peak
        from generate_series(today - (d - 1), today, interval '1 day') as g(day)) x),
    -- 시간대별 게임 실행 (한국 시간 0~23시)
    'hours', (select coalesce(json_agg(x order by x.h), '[]'::json) from (
        select h, (select count(*) from public.visits v where v.game <> 'hub' and v.created_at >= t0
                     and extract(hour from v.created_at at time zone 'Asia/Seoul') = h) as plays
        from generate_series(0, 23) h) x),
    -- 학년별 (로그인한 회원만)
    'grades', (select coalesce(json_agg(x order by x.ord, x.label), '[]'::json) from (
        select case when p.kind = 'admin' then '관리자' else public.grade_of(p.entry_year, p.grade_override) || '학년' end as label,
               case when p.kind = 'admin' then 99 else public.grade_of(p.entry_year, p.grade_override) end as ord,
               count(distinct v.user_id) as users, count(*) filter (where v.game <> 'hub') as plays
        from public.visits v join public.profiles p on p.id = v.user_id
        where v.created_at >= t0 group by 1, 2) x),
    -- 게임 기록(runs) 게임별
    'runs', (select coalesce(json_agg(x order by x.runs desc), '[]'::json) from (
        select r.game, count(*) as runs, count(distinct r.user_id) as players, max(r.score) as best, round(avg(r.accuracy), 1) as avg_acc
        from public.runs r where r.created_at >= t0 group by r.game) x),
    'live', json_build_object(
        'now',   (select count(*) from public.live_sessions where last_seen > now() - interval '2 minutes'),
        'users', (select count(distinct user_id) from public.live_sessions where last_seen > now() - interval '2 minutes'),
        'pages', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
            select page, count(*) as n from public.live_sessions where last_seen > now() - interval '2 minutes' group by page) x),
        'peak_today', (select coalesce(max(live), 0) from public.ops_presence where at >= today::timestamp at time zone 'Asia/Seoul'),
        'last24', (select coalesce(json_agg(x order by x.h), '[]'::json) from (
            select to_char(date_trunc('hour', at at time zone 'Asia/Seoul'), 'MM-DD HH24') as h, max(live) as live
            from public.ops_presence where at > now() - interval '24 hours' group by 1) x),
        'threshold', public.ops_setting_int('backup_threshold', 40000))
  );
end $$;

-- 서버 점검 · 백업 화면
create or replace function public.admin_ops() returns json
language plpgsql stable security definer set search_path = '' as $$
declare jobs json := '[]'::json; cron_on boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if cron_on then
    begin
      execute $q$select coalesce(json_agg(x order by x.jobname), '[]'::json) from (
          select j.jobname, j.schedule, j.active,
                 (select r.status from cron.job_run_details r where r.jobid = j.jobid order by r.start_time desc limit 1) as last_status,
                 (select r.start_time from cron.job_run_details r where r.jobid = j.jobid order by r.start_time desc limit 1) as last_run
          from cron.job j where j.jobname like 'samgongyuk-%') x$q$ into jobs;
    exception when others then jobs := '[]'::json;
    end;
  end if;
  return json_build_object(
    'cron', cron_on, 'jobs', jobs,
    'threshold', public.ops_setting_int('backup_threshold', 40000),
    'keep', public.ops_setting_int('backup_keep', 10),
    'db_bytes', pg_database_size(current_database()), 'db_limit', 500::bigint * 1024 * 1024,
    'backups', (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
        select id, created_at, kind, reason, rows, bytes from public.ops_backups) x),
    'reports', (select coalesce(json_agg(x order by x.day desc), '[]'::json) from (
        select day, status, created_at, data->'checks' as checks, (data->>'visits')::int as visits, (data->>'plays')::int as plays,
               (data->>'users')::int as users, (data->>'peak_live')::int as peak_live
        from public.ops_reports order by day desc limit 60) x)
  );
end $$;

create or replace function public.admin_report(p_day date) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return (select data::json from public.ops_reports where day = p_day);
end $$;

-- 지금 점검하기 (오늘 지금까지로 보고서 만들기. 내일 아침 자동 보고서가 하루 전체로 다시 써요)
create or replace function public.admin_report_now() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return public.ops_daily_report((now() at time zone 'Asia/Seoul')::date);
end $$;

create or replace function public.admin_backup_now() returns bigint
language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select name into who from public.profiles where id = auth.uid();
  return public.ops_make_backup('manual', format('관리자 %s 님이 직접 백업', coalesce(who, '?')));
end $$;

create or replace function public.admin_backup_get(p_id bigint) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return (select data::json from public.ops_backups where id = p_id);
end $$;

create or replace function public.admin_backup_delete(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  delete from public.ops_backups where id = p_id;
end $$;

create or replace function public.admin_set_ops(p_threshold int, p_keep int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_threshold is null or p_threshold < 1 or p_threshold > 10000000 then raise exception 'threshold must be 1..10000000'; end if;
  if p_keep is null or p_keep < 1 or p_keep > 50 then raise exception 'keep must be 1..50'; end if;
  insert into public.settings (key, value, updated_at) values ('backup_threshold', to_jsonb(p_threshold), now()), ('backup_keep', to_jsonb(p_keep), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- ── 랭킹 (누구나) ────────────────────────────────────────────────
-- 이름은 schema.sql 의 display_name (학생 김*수 (26), 관리자 닉네임) 만 보여요.

-- 게임별로 기록이 있는 모드 목록
create or replace function public.ranking_modes(p_game text)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(x order by x.players desc, x.mode), '[]'::json) from (
    select r.mode, count(distinct r.user_id) as players, count(*) as runs
    from public.runs r where r.game = p_game group by r.mode) x;
$$;

-- 게임·모드 랭킹. p_days 를 주면 최근 며칠 기록만 (예: 7 = 이번 주 랭킹)
create or replace function public.ranking_board(p_game text, p_mode text default '', p_days int default null, p_limit int default 20)
returns json language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.score, r.accuracy, r.created_at
    from public.runs r
    where r.game = p_game and r.mode = coalesce(p_mode, '')
      and (p_days is null or r.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365)))
    order by r.user_id, r.score desc, r.created_at asc
  ), ranked as (
    select b.*, public.display_name(p) as nickname, rank() over (order by b.score desc) as rnk,
           row_number() over (order by b.score desc, b.created_at asc) as rn
    from best b join public.profiles p on p.id = b.user_id
  )
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rank', rnk, 'nickname', nickname, 'score', score, 'accuracy', accuracy,
                                                       'at', created_at, 'me', user_id = auth.uid()) order by rn)
                     from ranked where rn <= least(greatest(coalesce(p_limit, 20), 1), 100)), '[]'::json),
    'myBest', (select score from ranked where user_id = auth.uid()),
    'myRank', (select rnk from ranked where user_id = auth.uid()),
    'total',  (select count(*) from ranked)
  );
$$;

-- 종합 랭킹: 게임·모드마다 내 최고 기록이 상위 몇 %인지를 점수로 (1등 = 100점) 바꿔서 더해요.
-- 여러 게임·모드를 골고루 잘할수록 높아요. plays = 기간 안에 끝까지 한 판 수.
create or replace function public.ranking_overall(p_days int default null, p_limit int default 20)
returns json language sql stable security definer set search_path = '' as $$
  with runs as (
    select r.* from public.runs r
    where p_days is null or r.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  ), best as (
    select distinct on (user_id, game, mode) user_id, game, mode, score from runs
    order by user_id, game, mode, score desc
  ), pts as (
    select user_id, game, round(100 * cume_dist() over (partition by game, mode order by score))::int as pt from best
  ), per_user as (
    select user_id, sum(pt) as points, count(*) as boards, count(distinct game) as games from pts group by user_id
  ), ranked as (
    select u.*, (select count(*) from runs x where x.user_id = u.user_id) as plays,
           public.display_name(p) as nickname,
           rank() over (order by u.points desc) as rnk,
           row_number() over (order by u.points desc, u.games desc, u.user_id) as rn
    from per_user u join public.profiles p on p.id = u.user_id
  )
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rank', rnk, 'nickname', nickname, 'points', points, 'games', games,
                                                       'boards', boards, 'plays', plays, 'me', user_id = auth.uid()) order by rn)
                     from ranked where rn <= least(greatest(coalesce(p_limit, 20), 1), 100)), '[]'::json),
    'myPoints', (select points from ranked where user_id = auth.uid()),
    'myRank',   (select rnk from ranked where user_id = auth.uid()),
    'total',    (select count(*) from ranked)
  );
$$;

-- ── 권한 ────────────────────────────────────────────────────────
revoke all on function public.ops_setting_int(text, int), public.ops_make_backup(text, text), public.ops_tick(),
  public.ops_daily_report(date) from public, anon, authenticated;
revoke all on function public.ops_ping(text, text), public.admin_data(int), public.admin_ops(), public.admin_report(date),
  public.admin_report_now(), public.admin_backup_now(), public.admin_backup_get(bigint), public.admin_backup_delete(bigint),
  public.admin_set_ops(int, int), public.ranking_modes(text), public.ranking_board(text, text, int, int),
  public.ranking_overall(int, int) from public, anon;
grant execute on function public.ops_ping(text, text), public.ranking_modes(text), public.ranking_board(text, text, int, int),
  public.ranking_overall(int, int) to anon, authenticated;
grant execute on function public.admin_data(int), public.admin_ops(), public.admin_report(date), public.admin_report_now(),
  public.admin_backup_now(), public.admin_backup_get(bigint), public.admin_backup_delete(bigint), public.admin_set_ops(int, int)
  to authenticated;

-- ── 자동 작업 등록 (pg_cron) ─────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
    exception when others then
      raise notice 'pg_cron 을 켜지 못했어요: %. Database → Extensions 에서 pg_cron 을 켠 뒤 이 파일을 다시 실행해 주세요.', sqlerrm;
    end;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 같은 이름이면 덮어써요 (여러 번 실행해도 하나씩만). 시간은 UTC 라서 한국 시간 -9시간이에요.
    perform cron.schedule('samgongyuk-tick', '*/5 * * * *', 'select public.ops_tick()');
    perform cron.schedule('samgongyuk-daily-report', '5 0 * * *', 'select public.ops_daily_report()');           -- 매일 09:05 (한국)
    perform cron.schedule('samgongyuk-weekly-backup', '0 19 * * 6', $c$select public.ops_make_backup('weekly', '매주 일요일 정기 백업')$c$);  -- 일 04:00 (한국)
    raise notice '자동 작업 3개를 등록했어요: samgongyuk-tick, samgongyuk-daily-report, samgongyuk-weekly-backup';
  end if;
end $$;
