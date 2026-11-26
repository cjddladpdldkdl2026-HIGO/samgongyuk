-- 삼공육 · 게임 저장 표 + 공용 캐쉬 지갑 — 2026-11-26
-- 어디서: 동아리 Supabase 프로젝트 "삼공육" (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요.
--
-- 2026-11-26 확인: 이 프로젝트에는 game_saves 표가 아직 없었어요 (game_saves.sql 미실행).
--   → 그래서 이 파일이 표 만들기(game_saves.sql 과 같은 내용)까지 같이 해요.
-- 문제풀기(말해 YES OR NO)에서 번 캐쉬를 모든 게임이 같이 써요: game_saves 에 game = 'wallet' 줄 하나.
--   data = { v: 1, cash, earned, spent, updated }   (wallet.js 가 읽고 써요)

create table if not exists public.game_saves (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game text not null,
  data jsonb not null check (octet_length(data::text) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_saves drop constraint if exists game_saves_game_check;
alter table public.game_saves add constraint game_saves_game_check
  check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'golf', 'wallet'));
alter table public.game_saves enable row level security;

drop policy if exists "저장: 본인만 보기" on public.game_saves;
drop policy if exists "저장: 본인만 만들기" on public.game_saves;
drop policy if exists "저장: 본인만 고치기" on public.game_saves;
drop policy if exists "저장: 본인만 지우기" on public.game_saves;
create policy "저장: 본인만 보기" on public.game_saves for select to authenticated using (user_id = auth.uid());
create policy "저장: 본인만 만들기" on public.game_saves for insert to authenticated with check (user_id = auth.uid());
create policy "저장: 본인만 고치기" on public.game_saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "저장: 본인만 지우기" on public.game_saves for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.game_saves to authenticated;
revoke all on public.game_saves from anon;
