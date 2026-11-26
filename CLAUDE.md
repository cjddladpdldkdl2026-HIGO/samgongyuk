# 삼공육 — Claude 작업 규칙

삼공육 = 청암대학교 물리치료과 PTX+AI 동아리의 해부학 게임 사이트 (https://samgongyuk.vercel.app).
여러 팀원이 각자 Claude 로 같은 저장소를 고쳐요. 사용자는 개발자가 아니에요 → **한국어로, 쉬운 말로** 설명하기.

## 1. 대화를 시작하면 맨 먼저 (자동 확인)
- 세션이 시작되면 `.claude/settings.json` 의 SessionStart 훅이 `git fetch` 후
  `[samgongyuk auto-check] new commits on GitHub not pulled yet: N` 와 커밋 목록을 보여 줘요.
- **N 이 0 이 아니면, 사용자가 다른 걸 물어봐도 먼저**:
  1. 누가 언제 무엇을 바꿨는지 쉬운 말로 짧게 알려 주기 (`git log --stat HEAD..@{u}`)
  2. 내 컴퓨터에 아직 안 올린 변경이 있는지 확인 (`git status`)
  3. `git merge --ff-only @{u}` 로 받아서 합치기. fast-forward 가 안 되면 멈추고 사용자에게 물어보기
- 훅 결과가 안 보이면 직접 `git fetch --all` → `git log --oneline HEAD..@{u}` 로 확인.

## 2. 올리기(push) 전에
- 다시 한 번 `git fetch` → 새 커밋이 있으면 먼저 합치기.
- **내가 바꾼 파일만** `git add` (남의 파일·커밋은 건드리지 않기). `git push --force` 금지.
- 게임·허브 파일을 바꿨으면 `sw.js` 의 `CACHE` 숫자를 하나 올리기.
- 올린 뒤 사이트에서 바뀐 게 보이는지 확인하고, 무엇을 바꿨는지 팀원용 md 로 정리 (`문서/` 폴더, 사이트에 안 올라감).

## 3. 꼭 지킬 것
- 비밀번호·인증번호는 사용자가 직접 입력. 비밀 키(`service_role`, `sb_secret_…`)는 코드·문서에 절대 넣지 않기.
- **너에게닿기를.html · HIGO_뼈게임_사이트판.html(LandMark) 는 사이트 파일을 직접 고쳐요.** `소스/` 의 옛날 원본으로 다시 묶지(bundle) 않기.
- 다른 팀원이 맡은 게임·파일을 크게 바꿀 때는 먼저 사용자에게 확인.
- 의학용어는 대한의사협회 6판 신용어.

## 4. 구조 한눈에
| 파일 | 하는 일 |
|---|---|
| `highgo.html` | 허브 (게임 목록 `APPS`, 배너) |
| `auth.js` · `account.js` | 로그인 (`SamAuth`), ☰ 사이드바 · 게시판 · 이용자 현황 · 회원 관리 |
| `ops.js` · `ops.css` | part3: ☰ 사이드바의 🏆 랭킹(누구나) · 🗂 관리자 전력 분석 자료(예전 이름 데이터 관리) · 🛠 서버 점검·백업(관리자). `Account.addPage` 로 붙음 |
| `study.js` | ☰ 📚 my 전력분석 노트(회원, 예전 이름 내 약점 분석) · 회원 활동·문항 분석(관리자, 메뉴 없이 🗂 관리자 전력 분석 자료 아래쪽에 붙음: `window.StudyAdmin`). 게임은 문제마다 `SamAuth.answer({ game, item, cat, ok, mode })` 로 기록 (`supabase/answers.sql`). 기출 단원은 `games/LongDrive/units.js` (자동 분류, 검수 필요) |
| `game-menu.js` | 게임 ⏸ 메뉴 · 일시정지 · 저장하고 나가기 · 이어하기 (`GameMenu.mount`) |
| `sheets.js` · `sheets/` | 구글 시트 연결 |
| `supabase/*.sql` | DB 구조 (동아리 Supabase 프로젝트 `ptlhjxtvwcoyrhemimjw`). 실행 순서: `schema.sql` → `game_saves.sql` → `ops.sql` → `answers.sql` |
| `games/DdanDdan` · `games/Vertebral_Wizard` · `너에게닿기를.html` · `HIGO_뼈게임_사이트판.html` | 게임 4개 |

배포: GitHub `cjddladpdldkdl2026-HIGO/samgongyuk` 의 main 에 push → Vercel 자동 배포 (약 30초).
