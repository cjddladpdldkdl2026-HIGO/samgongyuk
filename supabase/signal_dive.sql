-- 시그널 다이브(signal) 를 기록·랭킹·게임 저장에 등록 — 2026-11-18
-- 어디서: 동아리 Supabase 프로젝트 "삼공육" (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query → 붙여넣고 Run
-- game_saves 표가 아직 없으면 먼저 supabase/game_saves.sql 을 실행하세요 (이미 signal 이 들어 있어요).
-- 여러 번 실행해도 괜찮아요.

alter table public.runs drop constraint if exists runs_game_check;
alter table public.runs add constraint runs_game_check
  check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'signal'));

do $$ begin
  if to_regclass('public.game_saves') is not null then
    alter table public.game_saves drop constraint if exists game_saves_game_check;
    alter table public.game_saves add constraint game_saves_game_check
      check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'signal'));
  end if;
end $$;
