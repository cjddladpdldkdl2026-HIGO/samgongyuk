/* 삼공육 첫 화면 — 포스터 로그인 (2026-11-27)
 *
 *  사이트에 들어오면 이 화면이 제일 먼저 보여요. 로그인하거나 "게스트로 둘러보기"를 눌러야 허브가 보여요.
 *   - 로그인: 학번 + 비밀번호 (account.js 와 같은 방식: 학번 → s학번@samgongyuk.invalid)
 *   - 회원가입 · 관리자 로그인: ☰ 사이드바의 그 화면을 열어요 (가입 동의서가 거기 있어요). 그냥 닫으면 이 화면으로 돌아와요
 *   - 게스트: 이 창(탭)을 닫을 때까지 게스트. 게스트는 통계에 안 쌓여요
 *       → SamAuth.guest = true 이면 auth.js 가 접속 신호(ops_ping)를, account.js 가 방문·게임 실행 기록(visits)을 안 보내요.
 *         게임 점수(runs) · 문제 기록(answers) 은 원래 회원만 저장돼요.
 *   - 관리자가 "로그인 필수"를 켜 두면(settings.login_required) 게스트 버튼이 잠겨요.
 *  그림: login/poster-art.webp (왼쪽 캐릭터 포스터), login/logo.webp (네온 로고) — 사용자가 만든 시안에서 잘라 씀
 *  허브(highgo.html)에서 account.js 다음에 불러요.
 */
(function () {
  const A = window.SamAuth;
  if (!A || !A.client) return;
  const sb = A.client;
  const GKEY = 'samgongyuk-guest';
  const isGuest = () => { try { return sessionStorage.getItem(GKEY) === '1'; } catch (e) { return false; } };
  const setGuest = (on) => { try { on ? sessionStorage.setItem(GKEY, '1') : sessionStorage.removeItem(GKEY); } catch (e) { /* private mode */ } };
  let hadSession = false;
  try { hadSession = !!localStorage.getItem('samgongyuk-auth'); } catch (e) { /* ignore */ }

  const css = `
  .lg{position:fixed;inset:0;z-index:9000;background:#080111;color:#f4ecff;font-family:'Pretendard Variable','IBM Plex Sans KR',sans-serif;
    display:grid;grid-template-columns:minmax(0,1.18fr) minmax(400px,.82fr);overflow:hidden;transition:opacity .45s ease}
  .lg.hide{opacity:0;pointer-events:none}
  .lg-art{position:relative;overflow:hidden}
  .lg-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:62% 30%;
    -webkit-mask-image:linear-gradient(90deg,#000 78%,transparent);mask-image:linear-gradient(90deg,#000 78%,transparent)}
  .lg-side{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 40px 70px;overflow-y:auto}
  .lg-in{width:100%;max-width:560px}
  .lg-kicker{display:inline-block;margin-left:4px;padding:8px 22px;border:2px solid #2de2e6;background:rgba(5,3,15,.9);font-weight:800;font-size:17px;
    transform:skewX(-12deg);box-shadow:6px 6px 0 #2de2e6;white-space:nowrap}
  .lg-kicker>span{display:inline-block;transform:skewX(12deg)} .lg-kicker b{color:#2de2e6}
  .lg-logo{display:block;width:100%;max-width:560px;margin:14px 0 4px;-webkit-mask-image:radial-gradient(ellipse 70% 78% at 50% 50%,#000 62%,transparent 100%);mask-image:radial-gradient(ellipse 70% 78% at 50% 50%,#000 62%,transparent 100%)}
  .lg-sub{display:flex;align-items:center;gap:14px;margin:6px 0 26px;flex-wrap:wrap}
  .lg-tag{display:inline-block;background:#ff2e88;padding:7px 20px;font-weight:900;font-size:22px;transform:skewX(-12deg);box-shadow:5px 5px 0 #05030f}
  .lg-tag>span{display:inline-block;transform:skewX(12deg)}
  .lg-sub em{font:700 14px 'Chakra Petch',sans-serif;letter-spacing:.34em;color:#cdbfe6;font-style:normal}
  .lg-card{padding:0 34px 26px;background:linear-gradient(170deg,rgba(22,10,60,.92),rgba(8,4,26,.96));border:2px solid rgba(45,226,230,.55);
    box-shadow:0 0 60px rgba(45,226,230,.18),0 30px 70px rgba(0,0,0,.6);clip-path:polygon(0 0,93% 0,100% 7%,100% 100%,0 100%)}
  .lg-tabs{display:flex;margin:0 -34px 24px;border-bottom:2px solid rgba(45,226,230,.35)}
  .lg-tabs button{flex:1;border:0;background:none;padding:15px 0 13px;font:700 16px 'Pretendard Variable',sans-serif;letter-spacing:.12em;color:#cdbfe6;cursor:pointer}
  .lg-tabs button.on{background:#2de2e6;color:#05030f}
  .lg-tabs button:not(.on):hover{color:#fff;background:rgba(45,226,230,.08)}
  .lg-field{display:flex;align-items:center;gap:14px;height:56px;margin-bottom:12px;padding:0 18px;border:1px solid rgba(185,167,216,.35);background:rgba(255,255,255,.04)}
  .lg-field:focus-within{border-color:#2de2e6;box-shadow:0 0 0 1px #2de2e6 inset}
  .lg-field i{font:700 12px 'Chakra Petch',sans-serif;letter-spacing:.14em;color:#2de2e6;font-style:normal;width:52px;flex:none}
  .lg-field input{flex:1;min-width:0;border:0;outline:0;background:none;color:#fff;font:500 16px 'Pretendard Variable',sans-serif}
  .lg-field input::placeholder{color:#8f7fb0}
  .lg-msg{min-height:20px;margin:2px 0 6px;font-size:14px;color:#ff8fb8} .lg-msg.ok{color:#7dffb0}
  .lg-btn,.lg-guest{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:58px;border:0;cursor:pointer;
    clip-path:polygon(3% 0,100% 0,97% 100%,0 100%);transition:transform .12s,filter .12s}
  .lg-btn{background:#2de2e6;color:#05030f;font:900 20px 'Pretendard Variable',sans-serif;box-shadow:0 0 26px rgba(45,226,230,.55)}
  /* 게스트: 로그인 버튼만큼 크고 눈에 띄게, 분홍 */
  .lg-guest{margin-top:12px;background:linear-gradient(90deg,#ff2e88,#ff5fa8);color:#fff;font:900 19px 'Pretendard Variable',sans-serif;
    filter:drop-shadow(0 0 14px rgba(255,46,136,.65))}
  .lg-btn,.lg-guest{white-space:nowrap}
  .lg-gnote{margin:8px 0 0;text-align:center;font-size:12.5px;color:#ff9cc8}
  .lg-btn:hover,.lg-guest:hover{filter:brightness(1.1) drop-shadow(0 0 18px rgba(255,46,136,.5));transform:translateY(-1px)}
  .lg-btn:disabled,.lg-guest:disabled{filter:grayscale(.7) brightness(.7);cursor:default;transform:none}
  .lg-links{display:flex;justify-content:space-between;gap:10px;margin-top:16px;font-size:13px;color:#9d8dbe;flex-wrap:wrap}
  .lg-links a{color:#2de2e6;font-weight:700;text-decoration:none;cursor:pointer} .lg-links a.dim{color:#9d8dbe;font-weight:500}
  .lg-foot{position:absolute;left:40px;bottom:24px;font:700 14px 'Chakra Petch',sans-serif;letter-spacing:.32em;color:#cdbfe6}
  .lg-foot b{color:#2de2e6;letter-spacing:-.1em;margin-right:12px}
  @media (max-width:980px),(orientation:portrait){
    .lg{display:block;overflow-y:auto}
    .lg-art{position:absolute;left:0;right:0;top:0;height:min(62vh,640px)}
    .lg-art img{object-position:50% 20%;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
    .lg-side{min-height:100%;justify-content:flex-end;padding:24vh 16px 54px;overflow:visible}
    .lg-kicker{font-size:13px;padding:6px 12px}
    .lg-logo{width:86%;margin:8px auto 0}
    .lg-sub{margin:4px 0 14px;gap:10px} .lg-sub em{font-size:11px;letter-spacing:.24em}
    .lg-tag{font-size:16px;padding:5px 14px}
    .lg-field{height:50px;margin-bottom:10px} .lg-btn,.lg-guest{height:52px}
    .lg-tabs button{padding:12px 0 10px}
    .lg-card{padding:0 18px 20px} .lg-tabs{margin:0 -18px 18px}
    .lg-foot{left:16px;bottom:18px;font-size:12px}
  }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = document.createElement('div');
  el.className = 'lg hide'; el.id = 'loginGate';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '삼공육 로그인');
  el.innerHTML = `
    <div class="lg-art"><img src="login/poster-art.webp" alt="삼공육 게임 캐릭터들"></div>
    <div class="lg-side"><div class="lg-in">
      <div class="lg-kicker"><span>청암대학교 물리치료과 <b>PTX+AI</b> 동아리가 만든</span></div>
      <img class="lg-logo" src="login/logo.webp" alt="삼공육">
      <div class="lg-sub"><span class="lg-tag"><span>뼛속까지 플레이하라</span></span><em>GAME ON. BRAIN ON</em></div>
      <div class="lg-card">
        <div class="lg-tabs"><button type="button" class="on">로그인</button><button type="button" data-join>회원가입</button></div>
        <form id="lgForm" autocomplete="on" novalidate>
          <label class="lg-field"><i>ID</i><input name="uid" inputmode="numeric" maxlength="7" placeholder="학번 (숫자 7자리)" autocomplete="username"></label>
          <label class="lg-field"><i>PASS</i><input name="pw" type="password" placeholder="비밀번호" autocomplete="current-password"></label>
          <p class="lg-msg" id="lgMsg"></p>
          <button class="lg-btn" type="submit">▶ 게임 시작하기</button>
          <button class="lg-guest" type="button" id="lgGuest">🎮 게스트로 둘러보기</button>
          <p class="lg-gnote">게스트는 기록 · 통계에 남지 않아요</p>
        </form>
        <div class="lg-links"><span>비밀번호를 잊으셨나요? <a data-forgot>찾기</a></span><a class="dim" data-admin>관리자 로그인</a></div>
      </div>
    </div>
    <div class="lg-foot"><b>▶▶▶</b>GAME <span id="lgN">0</span> · PLAYERS ONLINE</div></div>`;
  document.body.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const form = $('#lgForm'), msg = (t, ok) => { $('#lgMsg').textContent = t || ''; $('#lgMsg').classList.toggle('ok', !!ok); };
  let shown = false, waitSide = false;
  function show() {
    if (shown) return; shown = true;
    el.classList.remove('hide'); document.documentElement.style.overflow = 'hidden';
    countGames();
  }
  function countGames() {   // 허브의 게임 목록(APPS) 개수
    try { $('#lgN').textContent = String(APPS.filter(a => a.url).length).padStart(2, '0'); } catch (e) { /* 아직 목록 전 */ }
  }
  addEventListener('DOMContentLoaded', countGames);
  function hide() {
    if (!shown) return; shown = false;
    el.classList.add('hide'); document.documentElement.style.overflow = '';
  }

  // 처음: 게스트로 들어온 창이 아니면 보여요. 로그인했던 기록이 있으면 확인될 때까지 기다렸다가 결정
  if (!isGuest() && !hadSession) show();
  A.ready.then(() => { if (A.user) { setGuest(false); hide(); } else if (!isGuest()) show(); });
  A.onChange((a) => { if (a.user) { setGuest(false); hide(); } });

  // 로그인 필수가 켜져 있으면 게스트 잠금
  sb.from('settings').select('value').eq('key', 'login_required').maybeSingle().then(({ data }) => {
    if (data && data.value === true) {
      const g = $('#lgGuest'); g.disabled = true; g.innerHTML = '🔒 지금은 로그인해야 들어갈 수 있어요'; const n = el.querySelector('.lg-gnote'); if (n) n.remove();
      if (isGuest()) { setGuest(false); show(); }
    }
  }, () => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.uid.value.trim(), pw = form.pw.value;
    if (!/^\d{7}$/.test(id)) return msg('학번은 숫자 7자리예요.');
    if (!pw) return msg('비밀번호를 적어 주세요.');
    const b = form.querySelector('.lg-btn'); b.disabled = true; msg('');
    const { error } = await sb.auth.signInWithPassword({ email: `s${id}@samgongyuk.invalid`, password: pw });
    b.disabled = false;
    if (error) {
      const m = String(error.message || '');
      return msg(/Invalid login credentials/i.test(m) ? '학번 또는 비밀번호가 틀렸어요.' : /fetch|network/i.test(m) ? '인터넷 연결을 확인해 주세요.' : '로그인하지 못했어요. 다시 해 주세요.');
    }
    msg('환영해요! 🎉', true); form.pw.value = '';
    setGuest(false); setTimeout(hide, 300);
  });
  $('#lgGuest').addEventListener('click', () => { setGuest(true); hide(); });
  $('[data-forgot]').addEventListener('click', () => msg('비밀번호를 잊었으면 관리자에게 초기화를 부탁해 주세요.'));

  // 회원가입 · 관리자 로그인: ☰ 사이드바의 그 화면을 열어요. 로그인 안 하고 닫으면 이 화면으로 돌아와요
  function toSide(tab) {
    if (!window.Account || !Account.tab) return msg('잠시 뒤에 다시 눌러 주세요.');
    hide(); waitSide = true; Account.tab(tab);
  }
  $('[data-join]').addEventListener('click', () => toSide('join'));
  $('[data-admin]').addEventListener('click', () => toSide('admin'));
  new MutationObserver(() => {
    if (waitSide && !document.body.classList.contains('acc-open')) { waitSide = false; if (!A.user && !isGuest()) show(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.LoginGate = { show, hide, isGuest };
})();
