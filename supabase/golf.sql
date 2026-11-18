-- 삼공육 · 롱드라이브(골프 비거리 게임) 추가 — 2026-11-18
-- 어디서: 동아리 Supabase 프로젝트 "삼공육" (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요 (데이터는 안 지워요).
--
-- 하는 일: 게임 기록(runs)과 게임 저장(game_saves) 표가 새 게임 이름 'golf' 도 받도록 허용 목록을 늘려요.
--   runs        → 비거리 기록 · 🏆 랭킹 (한 사람당 최고 기록 1개, 기존 ranking() 함수 그대로)
--   game_saves  → 캐쉬 · 산 아이템 저장 (다른 컴퓨터·폰에서도 이어서)
-- 이걸 안 돌리면 게임은 되지만 기록·캐쉬가 이 기기(브라우저)에만 남아요.

alter table public.runs drop constraint if exists runs_game_check;
alter table public.runs add constraint runs_game_check
  check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf'));

do $$ begin
  if to_regclass('public.game_saves') is not null then
    alter table public.game_saves drop constraint if exists game_saves_game_check;
    alter table public.game_saves add constraint game_saves_game_check
      check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf'));
  end if;
end $$;
