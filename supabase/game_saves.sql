-- 삼공육 · 게임 저장 (나갔다가 나중에 와서 이어하기) — 2026-11-17
-- 어디서: 동아리 Supabase 프로젝트 "삼공육" (ptlhjxtvwcoyrhemimjw) → SQL Editor → New query
-- 하는 법: 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 괜찮아요.
--
-- 로그인한 회원만, 게임마다 1개씩 저장해요. 본인 것만 보고 고치고 지울 수 있어요.
-- 이 표가 없으면 게임은 "이 기기(브라우저)에만" 저장해요. 표를 만들면 계정에 저장돼서 다른 컴퓨터·폰에서도 이어할 수 있어요.

create table if not exists public.game_saves (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game text not null check (game in ('landmark', 'ddan', 'wizard', 'neoege', 'signal')),
  data jsonb not null check (octet_length(data::text) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
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
