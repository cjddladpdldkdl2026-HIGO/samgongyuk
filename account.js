/* 삼공육 계정 — 로그인 · 회원가입 · 사이드바 · 게시판 · 이용자 현황 · 회원 관리 · 내 정보
 *
 *  데이터는 동아리 Supabase(프로젝트 samgongyuk, 서울)에 있어요. 표: profiles, posts, visits, settings, runs
 *  DB 구조는 supabase/schema.sql, 접속(클라이언트)은 auth.js 가 만들어서 여기와 게임들이 같이 써요.
 *  학번 로그인: Supabase 로그인은 이메일 방식이라, 속으로 학번을 가짜 이메일로 바꿔서 써요.
 *     학생   2612113  → s2612113@samgongyuk.invalid   (표시 이름 = 실명)
 *     관리자 admin1   → a.admin1@samgongyuk.invalid   (표시 이름 = 닉네임, 다른 관리자가 승인해야 관리자 권한.
 *                                                       맨 처음 관리자는 자동 승인)
 *  로그인 필수 스위치: settings 표의 login_required (관리자 → 회원 관리 화면에서 켜고 끄기)
 *  허브(highgo.html)가 쓰는 것: Account.logPlay(app) — 게임을 열 때 이용 기록 한 줄
 *  처음 버전: 팀원 soos3497 (e4e4a09). 11-17 동아리 Supabase 로 옮기고 관리자 닉네임으로 바꿈.
 */
(function () {
  const DOMAIN = 'samgongyuk.invalid';
  const DEPTS = ['물리치료과'];
  const VERSION = 'v1.1 (2026-11-17)';

  if (!window.SamAuth || !SamAuth.client) { console.warn('auth.js 가 없어서 계정 기능이 꺼져 있어요'); return; }
  const sb = SamAuth.client, URL_ = SamAuth.url, KEY = SamAuth.key;

  const S = { session: null, me: null, loginRequired: false, page: null, tab: 'login', openPosts: 0 };
  // 다른 파일이 붙이는 메뉴·페이지 (Account.addPage, 예: ops.js 의 랭킹 · 데이터 관리 · 서버 점검)
  const EXTRA = [];
  const extra = (id) => EXTRA.find(p => p.id === id);
  const extraOk = (p) => p.admin ? isAdmin() : (!p.login || !!S.me);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 확인 창: 브라우저 confirm/prompt/alert 는 앱 안 브라우저·카톡 인앱 브라우저에서 안 뜨고 바로 취소돼요.
   * 그래서 사이트 안에 직접 그려요.  ask(글) → true/false,  askText(글) → 입력값 또는 null,  say(글) */
  function dialog(msg, { input = false, cancel = true } = {}) {
    return new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'acc-dlg';
      bg.innerHTML = `<form class="acc-dlg-card acc-form"><p>${esc(msg).replace(/\n/g, '<br>')}</p>
        ${input ? '<input class="acc-in" name="v" type="text" autocomplete="off">' : ''}
        <div class="row">${cancel ? '<button class="abtn" type="button" data-no>취소</button>' : ''}<button class="abtn pri" type="submit">확인</button></div></form>`;
      document.body.appendChild(bg);
      const f = bg.querySelector('form'), inp = f.querySelector('input');
      const done = (v) => { bg.remove(); resolve(v); };
      f.addEventListener('submit', (e) => { e.preventDefault(); done(input ? inp.value : true); });
      f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') done(input ? null : false); });
      bg.querySelector('[data-no]')?.addEventListener('click', () => done(input ? null : false));
      (inp || f.querySelector('button[type=submit]')).focus();
    });
  }
  const ask = (m) => dialog(m);
  const askText = (m) => dialog(m, { input: true });
  const say = (m) => dialog(m, { cancel: false });
  const isAdmin = () => !!(S.me && S.me.kind === 'admin' && S.me.approved);
  const fmtDate = (t, time) => {
    if (!t) return '-';
    const d = new Date(t), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` + (time ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : '');
  };
  const n = (x) => Number(x || 0).toLocaleString('ko-KR');
  const gradeOf = (m) => {
    if (!m || m.kind !== 'student') return null;
    if (m.grade_override) return m.grade_override;
    const now = new Date(); const sy = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
    return Math.max(1, sy - m.entry_year + 1);
  };
  const toEmail = (kind, id) => kind === 'admin' ? `a.${id}@${DOMAIN}` : `s${id}@${DOMAIN}`;
  const KO_ERR = (e) => {
    const m = String((e && e.message) || e || '');
    if (/Invalid login credentials/i.test(m)) return '아이디(학번) 또는 비밀번호가 틀렸어요.';
    if (/already registered|already exists/i.test(m)) return '이미 가입된 아이디(학번)예요.';
    if (/Email not confirmed/i.test(m)) return '가입 확인이 아직 안 됐어요. 관리자에게 알려 주세요. (Supabase 이메일 확인 설정)';
    if (/Password should be/i.test(m)) return '비밀번호는 6자 이상이에요.';
    if (/rate limit/i.test(m)) return '잠시 뒤에 다시 해 주세요. (요청이 너무 많아요)';
    if (/Database error saving new user/i.test(m)) return '가입 정보가 올바르지 않아요. 학번·이름을 다시 확인해 주세요.';
    if (/fetch|network/i.test(m)) return '인터넷 연결을 확인해 주세요.';
    return m || '문제가 생겼어요. 다시 해 주세요.';
  };

  /* ── 상단 바 버튼 · 사이드바 뼈대 ─────────────────────────────────── */
  const header = document.querySelector('header');
  const btn = document.createElement('button');
  btn.className = 'acc-btn'; btn.id = 'accBtn'; btn.type = 'button';
  btn.setAttribute('aria-controls', 'accSide'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="bars"><i></i><i></i><i></i></span><span class="dot"></span><span class="who">로그인</span>';
  header.appendChild(btn);

  const root = document.createElement('div');
  root.innerHTML = `
    <div class="acc-shade" id="accShade"></div>
    <aside class="acc-side" id="accSide" aria-label="계정 메뉴" aria-hidden="true">
      <div class="acc-head"><img src="thumbs/logo.jpg" alt=""><b>삼공육</b>
        <button class="acc-x" id="accX" type="button" aria-label="닫기">✕</button></div>
      <div id="accBody"></div>
    </aside>
    <div class="pg-wrap" id="pgWrap"><section class="pg" id="pg" role="dialog" aria-modal="true"></section></div>`;
  document.body.appendChild(root);

  const side = $('#accSide'), body = $('#accBody'), pgWrap = $('#pgWrap'), pg = $('#pg');
  const openSide = () => { document.body.classList.add('acc-open'); btn.setAttribute('aria-expanded', 'true'); side.setAttribute('aria-hidden', 'false'); };
  const closeSide = () => {
    if (document.body.classList.contains('acc-locked')) return;
    document.body.classList.remove('acc-open'); btn.setAttribute('aria-expanded', 'false'); side.setAttribute('aria-hidden', 'true');
  };
  btn.addEventListener('click', () => document.body.classList.contains('acc-open') ? closeSide() : openSide());
  $('#accX').addEventListener('click', closeSide);
  $('#accShade').addEventListener('click', closeSide);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (pgWrap.classList.contains('open')) closePage(); else closeSide();
  });
  pgWrap.addEventListener('click', (e) => { if (e.target === pgWrap) closePage(); });

  /* ── 사이드바 내용 ──────────────────────────────────────────────────── */
  function renderTopBtn() {
    btn.classList.toggle('in', !!S.me);
    btn.classList.toggle('admin', isAdmin());
    $('.who', btn).textContent = S.me ? S.me.name : '로그인';
  }

  function renderSide() {
    renderTopBtn();
    const locked = S.loginRequired && !S.me;
    document.body.classList.toggle('acc-locked', locked);
    if (locked) openSide();

    const menu = (id, ic, label, badge) =>
      `<li><button type="button" data-page="${id}" class="${S.page === id ? 'on' : ''}"><span class="ic">${ic}</span>${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button></li>`;

    let me = '';
    if (S.me) {
      const g = gradeOf(S.me);
      const tag = S.me.kind === 'admin' ? (S.me.approved ? '<span class="tag admin">관리자</span>' : '<span class="tag pending">승인 대기</span>') : '<span class="tag student">학생</span>';
      me = `<div class="acc-me"><b>${esc(S.me.name)}님</b>${tag}
        <small>${S.me.kind === 'student' ? `${esc(S.me.dept)} · ${g}학년 · ${esc(S.me.login_id)}` : `관리자 아이디 · ${esc(S.me.login_id)}`}</small></div>`;
    }

    const auth = S.me ? '' : authForm();
    const items = [
      '<li class="sec">COMMUNITY</li>',
      menu('board', '📢', '공지사항 · 이용자 게시판'),
      S.me ? menu('mine', '🙋', '내 정보 · 랭킹') : '',
      ...EXTRA.filter(p => !p.admin && extraOk(p)).map(p => menu(p.id, p.ic, p.label)),
    ];
    if (isAdmin()) items.push('<li class="sec">ADMIN</li>', menu('stats', '📊', '이용자 현황'), menu('members', '👥', '회원 관리', S.openPosts ? '' : ''),
      ...EXTRA.filter(p => p.admin).map(p => menu(p.id, p.ic, p.label)));
    body.innerHTML = `${me}${auth}<ul class="acc-menu">${items.join('')}</ul>
      <div class="acc-foot">${S.me ? '<button class="abtn sm" type="button" id="accOut">↩ 로그아웃</button>' : ''}
        <small>삼공육 계정 ${VERSION}${S.loginRequired ? ' · 🔒 로그인 필수' : ''}</small></div>`;

    body.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => openPage(b.dataset.page)));
    const out = $('#accOut', body); if (out) out.addEventListener('click', logout);
    if (!S.me) bindAuth();
  }

  function authForm() {
    const t = S.tab;
    const tabs = `<div class="acc-tabs" role="tablist">
      <button type="button" data-tab="login" class="${t === 'login' ? 'on' : ''}">학생 로그인</button>
      <button type="button" data-tab="join" class="${t === 'join' ? 'on' : ''}">회원가입</button>
      <button type="button" data-tab="admin" class="${t === 'admin' || t === 'adminJoin' ? 'on' : ''}">관리자</button></div>`;
    let f = '';
    if (t === 'login') f = `
      <form class="acc-form" id="fLogin" autocomplete="on">
        <label>학번<input class="acc-in" name="uid" inputmode="numeric" maxlength="7" autocomplete="username" placeholder="예: 2612113" required></label>
        <label>비밀번호<input class="acc-in" name="pw" type="password" autocomplete="current-password" required></label>
        <p class="acc-msg" id="aMsg"></p>
        <button class="abtn pri" type="submit">로그인</button>
        <p class="acc-hint">처음이면 위의 <b>회원가입</b>을 눌러 주세요. 비밀번호를 잊으면 관리자에게 초기화를 부탁해요.</p>
      </form>`;
    if (t === 'join') f = `
      <form class="acc-form" id="fJoin" autocomplete="off">
        <label>학번 (숫자 7자리)<input class="acc-in" name="uid" inputmode="numeric" maxlength="7" placeholder="예: 2612113" required></label>
        <label>이름<input class="acc-in" name="uname" maxlength="20" placeholder="실명" required></label>
        <label>학과<select name="dept">${DEPTS.map(d => `<option>${d}</option>`).join('')}</select></label>
        <label>비밀번호 (6자 이상)<input class="acc-in" name="pw" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>비밀번호 확인<input class="acc-in" name="pw2" type="password" autocomplete="new-password" minlength="6" required></label>
        ${consent('학번, 이름, 학과')}
        <p class="acc-msg" id="aMsg"></p>
        <button class="abtn pri" type="submit">가입하기</button>
      </form>`;
    if (t === 'admin') f = `
      <form class="acc-form" id="fAdmin" autocomplete="on">
        <label>관리자 아이디<input class="acc-in" name="uid" autocomplete="username" placeholder="예: admin1" required></label>
        <label>비밀번호<input class="acc-in" name="pw" type="password" autocomplete="current-password" required></label>
        <p class="acc-msg" id="aMsg"></p>
        <button class="abtn pri" type="submit">관리자 로그인</button>
        <p class="acc-hint">관리자 계정이 없나요? <a href="#" id="toAdminJoin" style="color:var(--cyan-soft)">관리자 계정 만들기</a> — 다른 관리자가 승인해야 쓸 수 있어요.</p>
      </form>`;
    if (t === 'adminJoin') f = `
      <form class="acc-form" id="fAdminJoin" autocomplete="off">
        <label>관리자 아이디 (영문 소문자로 시작, 4~16자)<input class="acc-in" name="uid" maxlength="16" placeholder="예: admin1" required></label>
        <label>닉네임 (게시판·랭킹에 보여요)<input class="acc-in" name="uname" maxlength="20" required></label>
        <label>비밀번호 (6자 이상)<input class="acc-in" name="pw" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>비밀번호 확인<input class="acc-in" name="pw2" type="password" autocomplete="new-password" minlength="6" required></label>
        ${consent('관리자 아이디, 닉네임')}
        <p class="acc-msg" id="aMsg"></p>
        <button class="abtn pri" type="submit">관리자 계정 만들기</button>
        <p class="acc-hint"><a href="#" id="toAdmin" style="color:var(--cyan-soft)">← 관리자 로그인으로</a></p>
      </form>`;
    return `<div class="acc-auth">${tabs}${f}</div>`;
  }

  function consent(items) {
    return `<div class="acc-consent"><b>개인정보 수집·이용 동의</b><br>
      · 수집 항목: ${items}, 게임 기록(점수, 문제별 정답·오답, 대신 고른 답, 걸린 시간), 이용 기록(접속 시각, 머문 시간)<br>
      · 목적: 회원 확인, 랭킹, 학습 분석(내 약점 분석), 이용 통계, 게시판<br>
      · 보관: 탈퇴하거나 졸업하면 삭제. 문제별 기록 · 접속 기록은 1년이 지나면 이름 없는 통계로만 남기고 삭제 (백업 사본은 30일 안에 삭제)<br>
      · 목소리 녹음은 저장하지 않아요 (마이크가 알아들은 글자만 기록)<br>
      · 동의하지 않으면 가입할 수 없지만, 로그인 없이 쓸 수 있는 기능은 그대로 쓸 수 있어요.</div>
      <label class="acc-check"><input type="checkbox" name="ok" required> 위 내용에 동의해요</label>`;
  }

  function bindAuth() {
    body.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderSide(); }));
    const link = (id, tab) => { const a = $('#' + id, body); if (a) a.addEventListener('click', (e) => { e.preventDefault(); S.tab = tab; renderSide(); }); };
    link('toAdminJoin', 'adminJoin'); link('toAdmin', 'admin');
    const msg = (t, ok) => { const m = $('#aMsg', body); if (m) { m.textContent = t; m.classList.toggle('ok', !!ok); } };
    const busy = (f, on) => f.querySelectorAll('button[type=submit]').forEach(b => { b.disabled = on; });

    const fl = $('#fLogin', body) || $('#fAdmin', body);
    if (fl) fl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kind = fl.id === 'fAdmin' ? 'admin' : 'student';
      const id = fl.uid.value.trim().toLowerCase(), pw = fl.pw.value;
      if (kind === 'student' && !/^\d{7}$/.test(id)) return msg('학번은 숫자 7자리예요.');
      busy(fl, true); msg('');
      const { error } = await sb.auth.signInWithPassword({ email: toEmail(kind, id), password: pw });
      busy(fl, false);
      if (error) return msg(KO_ERR(error));
    });

    const fj = $('#fJoin', body) || $('#fAdminJoin', body);
    if (fj) fj.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kind = fj.id === 'fAdminJoin' ? 'admin' : 'student';
      const id = fj.uid.value.trim().toLowerCase(), name = fj.uname.value.trim(), pw = fj.pw.value;
      if (kind === 'student' && !/^\d{7}$/.test(id)) return msg('학번은 숫자 7자리예요.');
      if (kind === 'admin' && !/^[a-z][a-z0-9_]{3,15}$/.test(id)) return msg('관리자 아이디는 영문 소문자로 시작하는 4~16자예요 (숫자, _ 가능).');
      if (name.length < 2) return msg(kind === 'admin' ? '닉네임을 2자 이상 적어 주세요.' : '이름을 2자 이상 적어 주세요.');
      if (pw.length < 6) return msg('비밀번호는 6자 이상이에요.');
      if (pw !== fj.pw2.value) return msg('비밀번호 확인이 달라요.');
      if (!fj.ok.checked) return msg('개인정보 수집·이용에 동의해 주세요.');
      busy(fj, true); msg('');
      const { data, error } = await sb.auth.signUp({
        email: toEmail(kind, id), password: pw,
        options: { data: { kind, login_id: id, name, dept: fj.dept ? fj.dept.value : '물리치료과', consent: true } },
      });
      busy(fj, false);
      if (error) return msg(KO_ERR(error));
      if (!data.session) return msg('가입은 됐는데 바로 로그인이 안 돼요. 관리자에게 알려 주세요. (Supabase 이메일 확인 설정)');
      msg(kind === 'admin' ? '관리자 계정을 만들었어요. 다른 관리자가 승인하면 관리 메뉴가 열려요.' : '가입 완료! 환영해요 🎉', true);
    });
  }

  /* ── 로그인 상태 ─────────────────────────────────────────────────────── */
  async function loadMe() {
    if (!S.session) { S.me = null; return; }
    const { data } = await sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
    S.me = data || null;
    if (S.me) sb.rpc('touch').then(() => {}, () => {});
  }
  async function loadSettings() {
    const { data } = await sb.from('settings').select('key,value');
    const m = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    S.loginRequired = m.login_required === true;
  }
  async function logout() {
    await sb.auth.signOut();
    S.tab = 'login'; closePage();
  }

  sb.auth.onAuthStateChange((event, session) => {
    const changed = (S.session && S.session.user.id) !== (session && session.user.id);
    S.session = session;
    if (!changed && event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
    setTimeout(async () => {   // supabase 안내: 이 콜백 안에서 바로 await 하지 말 것
      await loadMe();
      renderSide();
      if (S.me && document.body.classList.contains('acc-locked') === false && event === 'SIGNED_IN') {
        if (S.page) openPage(S.page);
      }
      if (!S.me && S.page && S.page !== 'board') closePage();
    }, 0);
  });

  /* ── 이용 기록 ───────────────────────────────────────────────────────── */
  function logVisit(game) {
    try {
      const token = S.session && S.session.access_token;
      fetch(`${URL_}/rest/v1/visits`, {
        method: 'POST', keepalive: true,
        headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          token ? { Authorization: `Bearer ${token}` } : {}),
        body: JSON.stringify({ game, user_id: S.me ? S.me.id : null }),
      }).catch(() => {});
    } catch (e) { /* 기록 실패해도 게임은 그대로 */ }
  }

  /* ── 페이지 (가운데 큰 창) ───────────────────────────────────────────── */
  function closePage() {
    pgWrap.classList.remove('open'); S.page = null;
    body.querySelectorAll('[data-page]').forEach(b => b.classList.remove('on'));
  }
  async function openPage(id, arg) {
    if ((id === 'stats' || id === 'members') && !isAdmin()) id = 'board';
    if (id === 'mine' && !S.me) id = 'board';
    if (extra(id) && !extraOk(extra(id))) id = 'board';
    S.page = id;
    body.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === id));
    pg.innerHTML = '<button class="pg-x" type="button" aria-label="닫기">✕</button><p class="empty2">불러오는 중…</p>';
    pgWrap.classList.add('open');
    if (innerWidth < 820) closeSide();
    try {
      const ex = extra(id);
      const html = ex ? await ex.render(arg) : await PAGES[id](arg);
      if (S.page !== id) return;
      pg.innerHTML = '<button class="pg-x" type="button" aria-label="닫기">✕</button>' + html;
      if (ex) { if (ex.bind) ex.bind(arg); } else if (BIND[id]) BIND[id](arg);
    } catch (e) {
      pg.innerHTML = `<button class="pg-x" type="button" aria-label="닫기">✕</button><p class="empty2">${esc(KO_ERR(e))}</p>`;
    }
    $('.pg-x', pg).addEventListener('click', closePage);
    pg.scrollTop = 0;
  }

  const CAT = { notice: '공지사항', update: '업데이트 안내', request: '요구사항', question: '질문', bug: '오류 신고', free: '자유' };
  const STUDENT_CATS = ['request', 'question', 'bug', 'free'];
  let boardFilter = 'all';

  async function authorsOf(posts) {
    const ids = [...new Set(posts.map(p => p.author))];
    if (!ids.length) return {};
    const { data } = await sb.rpc('post_authors', { p_ids: ids });
    return Object.fromEntries((data || []).map(a => [a.id, a]));
  }
  const byLine = (a, p) => {
    if (!a) return '-';
    const who = a.kind === 'admin' ? `${esc(a.name)} (관리자)` : `${esc(a.name)} (${a.grade}학년)`;
    return `${who} · ${fmtDate(p.created_at, true)}`;
  };
  const chips = (p) => [
    p.pinned ? '<span class="chip pin">📌 고정</span>' : '',
    `<span class="chip ${p.category}">${CAT[p.category]}</span>`,
    p.is_private ? '<span class="chip lock">🔒 비공개</span>' : '',
    STUDENT_CATS.includes(p.category) ? `<span class="chip st-${p.status}">${p.status}</span>` : '',
    p.answer ? '<span class="chip update">💬 답변</span>' : '',
  ].join('');

  const PAGES = {
    /* 게시판 목록 */
    async board() {
      const { data, error } = await sb.from('posts').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const A = await authorsOf(data);
      const list = data.filter(p => boardFilter === 'all' || (boardFilter === 'notice' ? ['notice', 'update'].includes(p.category) : p.category === boardFilter));
      const pinned = list.filter(p => p.pinned), rest = list.filter(p => !p.pinned);
      const card = (p) => `<button type="button" class="post ${p.pinned ? 'pin' : ''} ${p.category === 'notice' ? 'notice' : ''}" data-post="${p.id}">
          <span class="meta"><span class="chip">#${p.id}</span>${chips(p)}</span>
          <span class="t">${esc(p.title)}</span><span class="by">${byLine(A[p.author], p)}</span>
          <span class="ex">${esc(p.body.slice(0, 160))}</span></button>`;
      const f = (k, l) => `<button type="button" data-f="${k}" class="${boardFilter === k ? 'on' : ''}">${l}</button>`;
      return `<h2>💬 이용자 게시판</h2>
        <p class="sub">공지사항과 학생 의견(요구사항·질문·오류 신고)을 모아 둔 곳이에요. ${S.me ? '' : '글을 쓰려면 로그인해 주세요.'}</p>
        <div class="row"><div class="filt">${f('all', '전체')}${f('notice', '📢 공지')}${f('request', '💡 요구사항')}${f('question', '❓ 질문')}${f('bug', '🐞 오류')}${f('free', '💬 자유')}</div>
          <span class="spacer"></span>${S.me ? '<button class="abtn pri" type="button" id="newPost">✏️ 글쓰기</button>' : ''}</div>
        ${pinned.length ? `<h3>📌 고정된 글 ${pinned.length}</h3><div class="posts">${pinned.map(card).join('')}</div>` : ''}
        <h3>📂 전체 글</h3><div class="posts">${rest.map(card).join('') || '<p class="empty2">아직 글이 없어요.</p>'}</div>`;
    },
    /* 글 보기 */
    async post(id) {
      const { data: p, error } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!p) return '<p class="empty2">글이 없거나 볼 수 없어요.</p><button class="abtn" type="button" data-back>← 목록</button>';
      const A = await authorsOf([p]);
      const mine = S.me && p.author === S.me.id;
      const admin = isAdmin();
      return `<button class="abtn sm" type="button" data-back>← 목록</button>
        <div class="post-view" style="margin-top:14px">
          <div class="meta row"><span class="chip">#${p.id}</span>${chips(p)}</div>
          <h2 style="margin-top:8px">${esc(p.title)}</h2>
          <p class="sub">${byLine(A[p.author], p)}${p.updated_at && p.updated_at !== p.created_at ? ' · 수정됨' : ''}</p>
          <div class="body">${esc(p.body)}</div>
          ${p.answer ? `<div class="answer"><b>💬 관리자 답변</b> <small style="color:var(--ink-faint)">${fmtDate(p.answered_at, true)}</small><div class="body" style="margin-top:6px">${esc(p.answer)}</div></div>` : ''}
          ${admin ? `<h3>관리자</h3><form class="acc-form" id="fAdminPost">
              <div class="row">
                <label class="acc-check"><input type="checkbox" name="pinned" ${p.pinned ? 'checked' : ''}> 📌 위에 고정</label>
                ${STUDENT_CATS.includes(p.category) ? `<label>처리 상태 <select name="status">${['접수', '처리중', '완료'].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
              </div>
              <label>답변<textarea name="answer" placeholder="학생에게 보일 답변">${esc(p.answer || '')}</textarea></label>
              <p class="acc-msg" id="pMsg"></p>
              <div class="row"><button class="abtn pri" type="submit">저장</button></div></form>` : ''}
          ${mine || admin ? `<div class="row" style="margin-top:16px">${mine ? '<button class="abtn" type="button" id="editPost">✏️ 수정</button>' : ''}<button class="abtn warn" type="button" id="delPost">🗑 삭제</button></div>` : ''}
        </div>`;
    },
    /* 글쓰기 / 수정 */
    async write(id) {
      let p = { category: isAdmin() ? 'notice' : 'request', title: '', body: '', is_private: false, pinned: false };
      if (id) { const { data } = await sb.from('posts').select('*').eq('id', id).maybeSingle(); if (data) p = data; }
      const cats = isAdmin() ? Object.keys(CAT) : STUDENT_CATS;
      return `<button class="abtn sm" type="button" data-back>← 목록</button>
        <h2 style="margin-top:14px">${id ? '✏️ 글 수정' : '✏️ 글쓰기'}</h2>
        <p class="sub">${isAdmin() ? '공지사항·업데이트 안내는 관리자만 쓸 수 있어요.' : '요구사항, 질문, 오류 신고 모두 환영해요. 관리자가 확인하고 답변해요.'}</p>
        <form class="acc-form" id="fPost" data-id="${id || ''}">
          <label>분류<select name="category" ${id && !isAdmin() ? 'disabled' : ''}>${cats.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${CAT[c]}</option>`).join('')}</select></label>
          <label>제목<input class="acc-in" name="ptitle" maxlength="100" value="${esc(p.title)}" required></label>
          <label>내용<textarea name="pbody" maxlength="5000" required>${esc(p.body)}</textarea></label>
          <div class="row"><label class="acc-check"><input type="checkbox" name="is_private" ${p.is_private ? 'checked' : ''}> 🔒 비공개 (나와 관리자만 보기)</label>
            ${isAdmin() ? `<label class="acc-check"><input type="checkbox" name="pinned" ${p.pinned ? 'checked' : ''}> 📌 위에 고정</label>` : ''}</div>
          <p class="acc-msg" id="pMsg"></p>
          <div class="row"><button class="abtn pri" type="submit">${id ? '저장' : '올리기'}</button></div>
        </form>`;
    },
    /* 이용자 현황 (관리자) */
    async stats() {
      const { data: s, error } = await sb.rpc('admin_stats', { p_days: 14 });
      if (error) throw error;
      const days = s.days || [];
      const maxP = Math.max(1, ...days.map(d => d.plays)), maxV = Math.max(1, ...days.map(d => d.visits));
      const sumP = days.reduce((a, d) => a + d.plays, 0), sumV = days.reduce((a, d) => a + d.visits, 0);
      const W = ['일', '월', '화', '수', '목', '금', '토'];
      const lab = (day) => { const d = new Date(day + 'T00:00:00'); return `<span class="lab ${d.getDay() % 6 === 0 ? 'we' : ''}">${d.getMonth() + 1}/${d.getDate()} ${W[d.getDay()]}</span>`; };
      const bar = (label, v, max, extra) => `<div class="bar2">${label}<div class="track"><div class="fill" style="width:${(v / max * 100).toFixed(1)}%"></div><span class="val">${n(v)}회${extra ? `<i>${extra}</i>` : ''}</span></div></div>`;
      const games = s.games || [], maxG = Math.max(1, ...games.map(g => g.plays));
      return `<h2>📈 이용자 현황</h2>
        <p class="sub">게임을 연 기록(허브에서 ▶ 플레이)과 사이트 방문을 날짜별로 모았어요. 로그인 안 한 방문도 횟수에는 들어가요. · 집계 ${fmtDate(new Date(), true)}</p>
        <div class="kpis">
          <div class="kpi c1"><small>최근 7일 이용 학생</small><b>${n(s.users7)}명</b><span>가입 ${n(s.members)}명 중 (로그인한 학생)</span></div>
          <div class="kpi c2"><small>최근 7일 게임 실행</small><b>${n(s.plays7)}회</b><span>사이트 방문 ${n(s.visits7)}회</span></div>
          <div class="kpi c3"><small>관리자</small><b>${n(s.admins)}명</b><span>${s.pending ? `승인 대기 ${n(s.pending)}명` : '승인 대기 없음'}</span></div>
          <div class="kpi c4"><small>답변 기다리는 글</small><b>${n(s.posts_open)}개</b><span>요구사항·질문·오류</span></div>
        </div>
        <div class="two">
          <div><h3>🎮 최근 14일 게임 실행</h3><p class="note" style="margin:-4px 0 10px">14일 합계 ${n(sumP)}회 · 👤 = 로그인한 학생 수</p>
            <div class="bars2">${days.map(d => bar(lab(d.day), d.plays, maxP, d.users ? `👤 ${d.users}명` : '')).join('')}</div></div>
          <div><h3>🌐 최근 14일 방문 (허브 + 게임)</h3><p class="note" style="margin:-4px 0 10px">14일 합계 ${n(sumV)}회</p>
            <div class="bars2">${days.map(d => bar(lab(d.day), d.visits, maxV)).join('')}</div></div>
        </div>
        <h3>🕹 게임별 (최근 14일)</h3>
        <div class="bars2">${games.map(g => bar(`<span class="lab" style="width:auto">${esc(g.game)}</span>`, g.plays, maxG, g.users ? `👤 ${g.users}명` : '')).join('') || '<p class="empty2">아직 게임 실행 기록이 없어요.</p>'}</div>
        <p class="note">기록은 허브에서 ▶ 플레이를 누를 때 남아요. 게임 주소로 바로 들어간 경우는 세지 않아요.</p>`;
    },
    /* 회원 관리 (관리자) */
    async members() {
      const [{ data: rows, error }] = await Promise.all([sb.rpc('admin_members'), loadSettings()]);
      if (error) throw error;
      const tr = (m) => {
        const pending = m.kind === 'admin' && !m.approved;
        const self = m.id === S.me.id;
        return `<tr data-uid="${m.id}">
          <td>${m.kind === 'admin' ? (pending ? '<span class="tag pending">승인 대기</span>' : '<span class="tag admin">관리자</span>') : '<span class="tag student">학생</span>'}</td>
          <td class="num">${esc(m.login_id)}</td><td>${esc(m.name)}</td><td>${esc(m.dept)}</td>
          <td>${m.kind === 'student' ? `<select data-grade title="학년 (휴학·복학 등으로 다르면 고르기)"><option value="">${m.grade}학년 (자동)</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${m.grade_override === g ? 'selected' : ''}>${g}학년 (직접)</option>`).join('')}</select>` : '-'}</td>
          <td>${fmtDate(m.created_at)}</td><td>${fmtDate(m.last_seen_at, true)}</td><td class="num">${n(m.plays)}</td>
          <td><div class="acts">
            ${m.kind === 'admin' && !self ? `<button class="abtn sm" type="button" data-approve="${pending ? 1 : 0}">${pending ? '✅ 승인' : '권한 해제'}</button>` : ''}
            <button class="abtn sm" type="button" data-reset>🔑 비번 초기화</button>
            ${self ? '' : '<button class="abtn sm warn" type="button" data-del>삭제</button>'}
          </div></td></tr>`;
      };
      const students = rows.filter(r => r.kind === 'student'), admins = rows.filter(r => r.kind === 'admin');
      return `<h2>👥 회원 관리</h2>
        <p class="sub">학생 ${students.length}명 · 관리자 ${admins.filter(a => a.approved).length}명${admins.some(a => !a.approved) ? ` · <b style="color:#ff8ab8">승인 대기 ${admins.filter(a => !a.approved).length}명</b>` : ''}</p>
        <h3>⚙️ 사이트 설정</h3>
        <div class="switch"><div class="txt"><b>🔒 로그인 필수</b>
          <small>켜면 로그인한 학생만 사이트를 쓸 수 있어요. 끄면 누구나 쓰고, 로그인은 선택이에요.</small></div>
          <button type="button" class="tog ${S.loginRequired ? 'on' : ''}" id="togLogin" aria-pressed="${S.loginRequired}" aria-label="로그인 필수"></button></div>
        <h3>회원 목록</h3>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>구분</th><th>아이디 / 학번</th><th>이름</th><th>학과</th><th>학년</th><th>가입일</th><th>최근 접속</th><th>게임 실행</th><th></th></tr></thead>
          <tbody>${rows.map(tr).join('') || '<tr><td colspan="9" class="empty2">아직 회원이 없어요.</td></tr>'}</tbody></table></div>
        <p class="note">비밀번호 초기화: 임시 비밀번호를 정해 학생에게 직접 알려 주고, 로그인한 뒤 '내 정보'에서 바꾸게 해 주세요.</p>`;
    },
    /* 내 정보 · 랭킹 */
    async mine() {
      const m = S.me;
      const { count } = await sb.from('visits').select('id', { count: 'exact', head: true }).eq('user_id', m.id).neq('game', 'hub');
      const { data: recent } = await sb.from('visits').select('game,created_at').eq('user_id', m.id).neq('game', 'hub').order('created_at', { ascending: false }).limit(8);
      return `<h2>🙋 내 정보</h2>
        <p class="sub">${esc(m.name)}님의 계정이에요.</p>
        <div class="kpis">
          <div class="kpi c1"><small>${m.kind === 'student' ? '학번' : '관리자 아이디'}</small><b style="font-size:24px">${esc(m.login_id)}</b><span>${esc(m.dept)}${m.kind === 'student' ? ` · ${gradeOf(m)}학년` : ''}</span></div>
          <div class="kpi c2"><small>게임 실행</small><b>${n(count)}회</b><span>가입 ${fmtDate(m.created_at)}</span></div>
          <div class="kpi c3"><small>랭킹 표시 이름</small><b style="font-size:24px">${m.kind === 'student' ? `${esc(maskName(m.name))} (${String(m.login_id).slice(0, 2)})` : esc(m.name)}</b><span>${m.kind === 'student' ? '랭킹에서는 이름 가운데를 가려서 보여요' : '관리자 닉네임 그대로 보여요'}</span></div>
        </div>
        <h3>🏆 내 최고 기록</h3>
        ${await myBests(m.id)}
        <h3>🕹 최근 플레이</h3>
        ${(recent || []).length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${recent.map(r => `<tr><td>${esc(r.game)}</td><td>${fmtDate(r.created_at, true)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty2">아직 기록이 없어요. 허브에서 ▶ 플레이로 게임을 열면 쌓여요.</p>'}
        <h3>🔑 비밀번호 바꾸기</h3>
        <form class="acc-form" id="fPw" style="max-width:420px">
          <label>새 비밀번호 (6자 이상)<input class="acc-in" name="pw" type="password" autocomplete="new-password" minlength="6" required></label>
          <label>새 비밀번호 확인<input class="acc-in" name="pw2" type="password" autocomplete="new-password" minlength="6" required></label>
          <p class="acc-msg" id="pMsg"></p>
          <div class="row"><button class="abtn pri" type="submit">바꾸기</button></div>
        </form>
        <h3>탈퇴</h3>
        <p class="note" style="margin-top:0">탈퇴하면 계정과 기록이 지워지고 되살릴 수 없어요. (내가 쓴 글도 함께 지워져요)</p>
        <button class="abtn warn" type="button" id="leave" style="margin-top:8px">회원 탈퇴</button>`;
    },
  };
  /* 게임 기록(runs): 게임·모드별 내 최고 점수 */
  const GAME_KO = { landmark: 'LandMark', ddan: '딴딴/딴', wizard: '뭐라구요!?', neoege: '너에게 닿기를' };
  async function myBests(uid) {
    const { data } = await sb.from('runs').select('game,mode,score,created_at').eq('user_id', uid).order('score', { ascending: false }).limit(500);
    const best = new Map();
    (data || []).forEach(r => { const k = r.game + '|' + r.mode; if (!best.has(k)) best.set(k, r); });
    const rows = [...best.values()];
    return rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>게임</th><th>모드</th><th>최고 점수</th><th>날짜</th></tr></thead><tbody>${
      rows.map(r => `<tr><td>${esc(GAME_KO[r.game] || r.game)}</td><td>${esc(r.mode || '-')}</td><td class="num">${n(r.score)}</td><td>${fmtDate(r.created_at)}</td></tr>`).join('')
    }</tbody></table></div>` : '<p class="empty2">아직 기록이 없어요. 로그인한 채로 게임을 끝까지 하면 쌓여요.</p>';
  }
  const maskName = (p) => p.length <= 1 ? p : p.length === 2 ? p[0] + '*' : p[0] + '*'.repeat(p.length - 2) + p[p.length - 1];

  const BIND = {
    board() {
      pg.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { boardFilter = b.dataset.f; openPage('board'); }));
      pg.querySelectorAll('[data-post]').forEach(b => b.addEventListener('click', () => openPage('post', b.dataset.post)));
      const nb = $('#newPost', pg); if (nb) nb.addEventListener('click', () => openPage('write'));
    },
    post(id) {
      pg.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => openPage('board')));
      const ed = $('#editPost', pg); if (ed) ed.addEventListener('click', () => openPage('write', id));
      const del = $('#delPost', pg);
      if (del) del.addEventListener('click', async () => {
        if (!await ask('이 글을 지울까요? 되살릴 수 없어요.')) return;
        const { error } = await sb.from('posts').delete().eq('id', id);
        if (error) return say(KO_ERR(error));
        openPage('board');
      });
      const f = $('#fAdminPost', pg);
      if (f) f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const upd = { pinned: f.pinned.checked, answer: f.answer.value.trim() || null };
        if (f.status) upd.status = f.status.value;
        const { error } = await sb.from('posts').update(upd).eq('id', id);
        if (error) { $('#pMsg', pg).textContent = KO_ERR(error); return; }
        openPage('post', id);
      });
    },
    write(id) {
      pg.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => openPage(id ? 'post' : 'board', id)));
      const f = $('#fPost', pg);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const row = { title: f.ptitle.value.trim(), body: f.pbody.value.trim(), is_private: f.is_private.checked };
        if (!f.category.disabled) row.category = f.category.value;
        if (f.pinned) row.pinned = f.pinned.checked;
        if (!row.title || !row.body) { $('#pMsg', pg).textContent = '제목과 내용을 적어 주세요.'; return; }
        const q = id ? sb.from('posts').update(row).eq('id', id).select('id').single() : sb.from('posts').insert(row).select('id').single();
        const { data, error } = await q;
        if (error) { $('#pMsg', pg).textContent = KO_ERR(error); return; }
        openPage('post', data.id);
      });
    },
    members() {
      const tog = $('#togLogin', pg);
      tog.addEventListener('click', async () => {
        const next = !S.loginRequired;
        if (!await ask(next
          ? '로그인 필수를 켤까요?\n\n· 로그인 안 한 사람은 사이트에 들어오면 로그인 화면만 보여요.\n· 랭킹 초기화는 따로 해요 (자동으로 지우지 않아요).'
          : '로그인 필수를 끌까요?\n\n누구나 로그인 없이 사이트를 쓸 수 있게 돼요.')) return;
        const { error } = await sb.from('settings').update({ value: next, updated_at: new Date().toISOString() }).eq('key', 'login_required');
        if (error) return say(KO_ERR(error));
        S.loginRequired = next; renderSide(); openPage('members');
      });
      pg.querySelectorAll('tr[data-uid]').forEach(tr => {
        const uid = tr.dataset.uid, name = tr.children[2].textContent;
        const g = $('[data-grade]', tr);
        if (g) g.addEventListener('change', async () => {
          const { error } = await sb.from('profiles').update({ grade_override: g.value ? +g.value : null }).eq('id', uid);
          if (error) say(KO_ERR(error)); else openPage('members');
        });
        const ap = $('[data-approve]', tr);
        if (ap) ap.addEventListener('click', async () => {
          const on = ap.dataset.approve === '1';
          if (!await ask(on ? `${name}님을 관리자로 승인할까요?` : `${name}님의 관리자 권한을 해제할까요?`)) return;
          const { error } = await sb.from('profiles').update({ approved: on }).eq('id', uid);
          if (error) say(KO_ERR(error)); else openPage('members');
        });
        const rs = $('[data-reset]', tr);
        if (rs) rs.addEventListener('click', async () => {
          const pw = await askText(`${name}님의 임시 비밀번호를 정해 주세요 (6자 이상).\n로그인한 뒤 '내 정보'에서 바꾸라고 알려 주세요.`);
          if (pw == null) return;
          if (pw.length < 6) return say('6자 이상이어야 해요.');
          const { error } = await sb.rpc('admin_reset_password', { p_user: uid, p_password: pw });
          say(error ? KO_ERR(error) : '바꿨어요. 학생에게 직접 알려 주세요.');
        });
        const del = $('[data-del]', tr);
        if (del) del.addEventListener('click', async () => {
          if (!await ask(`${name}님 계정을 삭제할까요?\n계정, 기록, 쓴 글이 모두 지워지고 되살릴 수 없어요.`)) return;
          const { error } = await sb.rpc('admin_delete_user', { p_user: uid });
          if (error) say(KO_ERR(error)); else openPage('members');
        });
      });
    },
    mine() {
      const f = $('#fPw', pg);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const m = $('#pMsg', pg);
        if (f.pw.value.length < 6) { m.textContent = '비밀번호는 6자 이상이에요.'; return; }
        if (f.pw.value !== f.pw2.value) { m.textContent = '비밀번호 확인이 달라요.'; return; }
        const { error } = await sb.auth.updateUser({ password: f.pw.value });
        m.classList.toggle('ok', !error); m.textContent = error ? KO_ERR(error) : '비밀번호를 바꿨어요.';
        if (!error) f.reset();
      });
      $('#leave', pg).addEventListener('click', async () => {
        if (!await ask('정말 탈퇴할까요?\n계정과 기록, 내가 쓴 글이 지워지고 되살릴 수 없어요.')) return;
        const { error } = await sb.rpc('delete_me');
        if (error) return say(KO_ERR(error));
        await sb.auth.signOut();
        say('탈퇴했어요. 그동안 고마웠어요!');
      });
    },
  };

  /* ── 시작 ────────────────────────────────────────────────────────────── */
  window.Account = {
    logPlay(app) { logVisit(app && app.title ? app.title : 'unknown'); },
    open: openSide, page: openPage,
    /* 메뉴·페이지 붙이기: { id, ic, label, admin?, login?, render(arg) → html, bind?(arg) }
     * admin: 승인된 관리자만 (ADMIN 칸), login: 로그인한 사람만, 둘 다 없으면 누구나 (COMMUNITY 칸) */
    addPage(p) { if (!extra(p.id)) EXTRA.push(p); renderSide(); },
    kit: { sb, pg, $, esc, n, fmtDate, ask, askText, say, KO_ERR, isAdmin, me: () => S.me, current: () => S.page },
  };
  (async () => {
    renderSide();
    await loadSettings().catch(() => {});
    renderSide();
    try { if (!sessionStorage.getItem('samgongyuk-hub-visit')) { sessionStorage.setItem('samgongyuk-hub-visit', '1'); setTimeout(() => logVisit('hub'), 1500); } } catch (e) { /* private mode */ }
  })();
})();
