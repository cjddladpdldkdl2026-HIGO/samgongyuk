/* 삼공육 게임 메뉴 — ⏸ 버튼 · 일시정지 · 이어하기 · 저장하고 나가기 (게임마다 같이 쓰는 파일)
 *
 *  누가 무엇을 보나
 *    로그인 안 함  ⏸ → "그만할까요?"  [그만하기] [취소]
 *    로그인한 회원 ⏸ → 일시정지        [▶ 계속하기] [💾 저장하고 나가기] [■ 그만하기]
 *    Esc 키도 같은 메뉴를 열고 닫아요.
 *
 *  저장: 회원만. Supabase 표 game_saves (supabase/game_saves.sql) 에 계정별·게임별로 1개.
 *        표가 아직 없거나 인터넷이 끊기면 이 브라우저(localStorage)에만 저장해요.
 *
 *  게임에서 쓰는 법
 *    GameMenu.mount({
 *      game: 'wizard',                      // 저장 이름 (landmark · ddan · wizard · neoege)
 *      parent: Element, style: {top, right…}, // 버튼을 넣을 곳과 위치
 *      theme: { font, bg, ink, accent, accentInk, line, radius, shadow, overlay, btnSize },
 *      playing: () => bool,                 // 지금 게임 중인가 (이때만 버튼이 보여요)
 *      pause: () => bool,                   // 멈추기. 지금 못 멈추면 false (예: 공격 연출 중) → 잠시 뒤 다시 시도
 *      resume: () => void,                  // 이어서 하기
 *      quit: () => void,                    // 게임의 원래 "그만하기" (게임 첫 화면으로)
 *      saveQuit: () => void,                // (선택) 저장하고 나갈 때. 없으면 quit. 기록·랭킹을 남기지 않고 나갈 때 써요
 *      snapshot: () => object | null,       // 저장할 내용 (없으면 저장 버튼 숨김)
 *      label: (data) => string,             // 저장 내용 한 줄 설명 (이어하기 물어볼 때)
 *    })
 *    await GameMenu.askResume()   → 저장이 있으면 [이어하기]/[새로 시작] 을 물어보고 data 또는 null
 *    GameMenu.clear()             → 저장 지우기 (한 판을 끝까지 했을 때 등)
 *    GameMenu.isMember()          → 로그인한 회원인가
 */
(function () {
  const LOCAL = (uid, game) => `samgongyuk-save/${uid}/${game}`;
  let cfg = null, root = null, btn = null, open = false, pausedByMenu = false, retry = null;

  const auth = () => window.SamAuth;
  const isMember = () => !!(auth() && auth().joined && auth().user);
  const uid = () => (auth() && auth().user ? auth().user.id : null);

  /* ── 저장소 (계정 → 안 되면 이 브라우저) ───────────────────────────────── */
  async function remote(op, data) {
    const A = auth(); if (!A || !A.client || !isMember()) throw new Error('no member');
    const t = A.client.from('game_saves');
    if (op === 'get') {
      const { data: row, error } = await t.select('data, updated_at').eq('user_id', uid()).eq('game', cfg.game).maybeSingle();
      if (error) throw error;
      return row ? { ...row.data, _at: row.updated_at } : null;
    }
    if (op === 'put') {
      const { error } = await t.upsert({ user_id: uid(), game: cfg.game, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,game' });
      if (error) throw error; return true;
    }
    const { error } = await t.delete().eq('user_id', uid()).eq('game', cfg.game);
    if (error) throw error; return true;
  }
  const local = {
    get() { try { return JSON.parse(localStorage.getItem(LOCAL(uid(), cfg.game)) || 'null'); } catch { return null; } },
    put(d) { try { localStorage.setItem(LOCAL(uid(), cfg.game), JSON.stringify({ ...d, _at: new Date().toISOString() })); return true; } catch { return false; } },
    del() { try { localStorage.removeItem(LOCAL(uid(), cfg.game)); } catch { /* ignore */ } },
  };
  async function load() {
    if (!isMember()) return null;
    let r = null, l = local.get();
    try { r = await remote('get'); } catch { r = undefined; }
    if (r && l) return new Date(r._at) >= new Date(l._at) ? r : l;
    return r || l || null;
  }
  async function save(data) {
    data = { ...data, v: 1 };
    try { await remote('put', data); local.del(); return 'account'; }
    catch { return local.put(data) ? 'device' : null; }
  }
  async function clear() {
    if (!isMember()) return;
    local.del();
    try { await remote('del'); } catch { /* ignore */ }
  }

  /* ── 화면 ──────────────────────────────────────────────────────────────── */
  const CSS = `
  .gm-btn { position:absolute; z-index:2147483000; display:none; align-items:center; justify-content:center; gap:6px;
    height:var(--gm-btn,40px); min-width:var(--gm-btn,40px); padding:0 12px; cursor:pointer;
    font:700 15px var(--gm-font); color:var(--gm-ink); background:var(--gm-bg); border:var(--gm-line);
    border-radius:var(--gm-radius); box-shadow:var(--gm-shadow); }
  .gm-btn.on { display:inline-flex; }
  .gm-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
  .gm-btn:active { transform:translateY(1px); }
  .gm-btn .gm-ic { display:inline-flex; gap:3px; } .gm-btn .gm-ic i { width:4px; height:14px; background:currentColor; display:block; }
  .gm-root { position:fixed; inset:0; z-index:2147483600; display:none; align-items:center; justify-content:center; padding:16px;
    background:var(--gm-overlay); font-family:var(--gm-font); }
  .gm-root.on { display:flex; }
  .gm-panel { width:min(400px, 100%); padding:24px 22px 20px; text-align:center; color:var(--gm-ink); background:var(--gm-bg);
    border:var(--gm-line); border-radius:var(--gm-radius); box-shadow:var(--gm-shadow); }
  .gm-panel h2 { margin:0 0 6px; font:var(--gm-title, 800 24px var(--gm-font)); color:var(--gm-accent); letter-spacing:.02em; }
  .gm-panel p { margin:0 0 16px; font-size:14px; line-height:1.55; opacity:.85; }
  .gm-panel .gm-acts { display:grid; gap:10px; }
  .gm-panel button { width:100%; padding:12px 14px; cursor:pointer; font:700 16px var(--gm-font); color:var(--gm-ink);
    background:transparent; border:var(--gm-line); border-radius:var(--gm-radius); }
  .gm-panel button.gm-main { color:var(--gm-accent-ink); background:var(--gm-accent); }
  .gm-panel button:hover { filter:brightness(1.1); }
  .gm-panel button:disabled { opacity:.5; cursor:default; }
  .gm-panel .gm-note { margin:14px 0 0; font-size:12px; opacity:.7; }
  .gm-panel .gm-msg { min-height:1.2em; margin:10px 0 0; font-size:13px; color:var(--gm-accent); }`;

  function themeVars(t) {
    const m = { font: '--gm-font', bg: '--gm-bg', ink: '--gm-ink', accent: '--gm-accent', accentInk: '--gm-accent-ink',
      line: '--gm-line', radius: '--gm-radius', shadow: '--gm-shadow', overlay: '--gm-overlay', btnSize: '--gm-btn', title: '--gm-title' };
    const d = { font: 'sans-serif', bg: '#15102a', ink: '#fff', accent: '#ffd75e', accentInk: '#1b1300', line: '2px solid #ffd75e',
      radius: '12px', shadow: '0 10px 30px rgba(0,0,0,.5)', overlay: 'rgba(0,0,0,.6)', btnSize: '40px' };
    return Object.entries(m).map(([k, v]) => (t[k] ?? d[k]) != null ? `${v}:${t[k] ?? d[k]};` : '').join('');
  }

  function dialog(title, text, actions, note) {
    root.innerHTML = `<div class="gm-panel" role="dialog" aria-modal="true" aria-label="${title}">
      <h2>${title}</h2>${text ? `<p>${text}</p>` : ''}<div class="gm-acts"></div>
      <p class="gm-msg" aria-live="polite"></p>${note ? `<p class="gm-note">${note}</p>` : ''}</div>`;
    const box = root.querySelector('.gm-acts');
    actions.forEach((a, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label;
      if (a.main) b.className = 'gm-main';
      b.addEventListener('click', () => a.run(b));
      box.appendChild(b);
      if (i === 0) setTimeout(() => b.focus(), 30);
    });
    root.classList.add('on');
  }
  const msg = (t) => { const m = root.querySelector('.gm-msg'); if (m) m.textContent = t; };
  function closeDialog() { root.classList.remove('on'); root.innerHTML = ''; }

  /* ── 메뉴 열고 닫기 ────────────────────────────────────────────────────── */
  function openMenu() {
    if (open || !cfg || !cfg.playing()) return;
    if (cfg.pause() === false) {                 // 지금은 못 멈춤 (연출 중) → 끝나면 열기
      clearTimeout(retry); retry = setTimeout(openMenu, 150); return;
    }
    open = true; pausedByMenu = true;
    if (isMember()) {
      const canSave = !!(cfg.snapshot && cfg.snapshot());
      dialog('일시정지', '', [
        { label: '▶ 계속하기', main: true, run: () => closeMenu(true) },
        ...(canSave ? [{ label: '💾 저장하고 나가기', run: async (b) => {
          b.disabled = true; msg('저장하는 중…');
          const where = await save(cfg.snapshot());
          if (!where) { b.disabled = false; msg('저장하지 못했어요. 다시 해 주세요.'); return; }
          msg(where === 'account' ? '계정에 저장했어요!' : '이 기기에 저장했어요 (계정 저장은 준비 중)');
          setTimeout(() => { closeMenu(false); (cfg.saveQuit || cfg.quit)(); }, 700);
        } }] : []),
        { label: '■ 그만하기', run: () => { closeMenu(false); cfg.quit(); } },
      ], canSave ? '저장하면 다음에 이 게임을 시작할 때 이어서 할 수 있어요.' : '');
    } else {
      dialog('그만할까요?', '지금 판은 저장되지 않아요.', [
        { label: '■ 그만하기', main: true, run: () => { closeMenu(false); cfg.quit(); } },
        { label: '취소', run: () => closeMenu(true) },
      ], '로그인하면 멈췄다가 이어서 하거나, 저장해 두고 나중에 이어할 수 있어요.');
    }
  }
  function closeMenu(resume) {
    if (!open) return;
    open = false; closeDialog();
    if (pausedByMenu && resume) cfg.resume();
    pausedByMenu = false;
  }

  /* ── 붙이기 ────────────────────────────────────────────────────────────── */
  function mount(c) {
    cfg = c;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const vars = themeVars(c.theme || {});
    root = document.createElement('div'); root.className = 'gm-root'; root.setAttribute('style', vars);
    root.addEventListener('mousedown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(root);

    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'gm-btn ' + (c.btnClass || '');
    btn.setAttribute('aria-label', '일시정지 · 그만하기 (Esc)'); btn.title = '일시정지 · 그만하기 (Esc)';
    btn.innerHTML = `<span class="gm-ic" aria-hidden="true"><i></i><i></i></span>${c.btnText == null ? '' : `<span>${c.btnText}</span>`}`;
    btn.setAttribute('style', vars + Object.entries(c.style || { top: '12px', right: '12px' }).map(([k, v]) => `${k}:${v};`).join(''));
    ['mousedown', 'touchstart', 'pointerdown'].forEach(ev => btn.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
    btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); openMenu(); });
    (c.parent || document.body).appendChild(btn);

    // Esc: 게임 중이면 메뉴 열기, 메뉴가 열려 있으면 닫고 이어하기 (게임의 원래 Esc 보다 먼저)
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.repeat) return;
      if (open) { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(true); return; }
      if (cfg.playing()) { e.preventDefault(); e.stopImmediatePropagation(); openMenu(); }
    }, true);

    setInterval(() => { btn.classList.toggle('on', !!cfg.playing() && !open); }, 150);
  }

  /** 저장이 있으면 이어할지 물어봐요 → data 또는 null (새로 시작) */
  async function askResume() {
    if (window.SamAuth && SamAuth.ready) await SamAuth.ready;
    const d = await load();
    if (!d) return null;
    return new Promise((done) => {
      const when = d._at ? new Date(d._at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      dialog('저장된 게임이 있어요', `${cfg.label ? cfg.label(d) : ''}${when ? `<br><small>${when} 저장</small>` : ''}`, [
        { label: '▶ 이어하기', main: true, run: () => { closeDialog(); done(d); } },
        { label: '새로 시작', run: () => { closeDialog(); clear(); done(null); } },
      ]);
    });
  }

  window.GameMenu = { mount, askResume, clear, isMember, open: openMenu, isOpen: () => open };
})();
