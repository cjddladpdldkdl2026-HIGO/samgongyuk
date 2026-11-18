/* 삼공육 로그인 접속 — 허브와 게임이 같이 쓰는 파일 (동아리 Supabase 프로젝트 samgongyuk, 서울)
 *
 *  쓰기 전에: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
 *  로그인·회원가입 화면은 허브의 ☰ 사이드바(account.js)에 있어요. 게임은 같은 로그인 상태를 읽기만 해요.
 *
 *  SamAuth.client               → Supabase 클라이언트 (account.js 도 이걸 써요)
 *  SamAuth.ready                → Promise, 로그인 상태를 다 읽으면 끝나요
 *  SamAuth.user / .profile      → 로그인한 사람 / { kind: 'student'|'admin', name, login_id, approved }
 *  SamAuth.displayName          → 랭킹에 보이는 이름 (학생: 김*수 (26), 관리자: 닉네임)
 *  SamAuth.record({ game, mode, score, accuracy, detail })  → 로그인한 사람만 저장, 실패해도 게임은 그대로
 *  SamAuth.ranking(game, mode)  → { top: [{ nickname, score, accuracy }], myBest, myRank, total }
 *  SamAuth.onChange(fn)
 *  (part3) 화면을 보는 동안 1분마다 ops_ping — 지금 접속자 수 (supabase/ops.sql)
 *
 *  키는 Supabase 의 공개용(publishable) 키예요. 웹 페이지에 넣는 용도이고, 표마다 RLS 로 막혀 있어요.
 *  DB 구조: supabase/schema.sql
 */
(function () {
  const URL_ = 'https://ptlhjxtvwcoyrhemimjw.supabase.co';
  const KEY_ = 'sb_publishable_cuv4DoFYqHSJFiL2FF28aQ_B03qGNkl';
  const GAMES = ['landmark', 'ddan', 'wizard', 'neoege', 'golf'];

  const listeners = [];
  const mask = (p) => p.length <= 1 ? p : p.length === 2 ? p[0] + '*' : p[0] + '*'.repeat(p.length - 2) + p[p.length - 1];
  const A = {
    url: URL_, key: KEY_, client: null, user: null, profile: null,
    get loggedIn() { return !!this.user; },
    get joined() { return !!this.profile; },
    get displayName() {
      const p = this.profile; if (!p) return '';
      return p.kind === 'student' ? `${mask(p.name)} (${String(p.login_id).slice(0, 2)})` : p.name;
    },
    onChange(fn) { listeners.push(fn); try { fn(A); } catch { /* ignore */ } },
  };
  const emit = () => listeners.forEach(fn => { try { fn(A); } catch { /* ignore */ } });
  window.SamAuth = A;

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[SamAuth] supabase-js 가 없어요');
    A.ready = Promise.resolve(A);
    A.record = async () => null;
    A.ranking = async () => { throw new Error('auth unavailable'); };
    return;
  }

  const sb = A.client = window.supabase.createClient(URL_, KEY_, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'samgongyuk-auth' },
  });

  async function loadProfile() {
    if (!A.user) { A.profile = null; return; }
    const { data } = await sb.from('profiles').select('id, kind, name, login_id, approved').eq('id', A.user.id).maybeSingle();
    A.profile = data || null;
  }

  A.ready = (async () => {
    try {
      const { data } = await sb.auth.getSession();
      A.user = data.session ? data.session.user : null;
      await loadProfile();
    } catch { /* offline */ }
    emit();
    return A;
  })();

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return;
    const was = A.user && A.user.id;
    A.user = session ? session.user : null;
    if ((A.user && A.user.id) !== was || event === 'SIGNED_OUT') {
      setTimeout(async () => { await loadProfile(); emit(); }, 0);   // 콜백 안에서 바로 await 하지 않기 (supabase 안내)
    }
  });

  A.record = async (row) => {
    try {
      await A.ready;
      if (!A.profile || GAMES.indexOf(row.game) < 0) return null;
      const acc = Number(row.accuracy);
      const { error } = await sb.from('runs').insert({
        game: row.game, mode: String(row.mode || '').slice(0, 30), score: Math.round(Number(row.score) || 0),
        accuracy: row.accuracy === '' || row.accuracy == null || !isFinite(acc) ? null : Math.max(0, Math.min(100, acc)),
        detail: row.detail || {},
      });
      return error ? null : true;
    } catch { return null; }
  };

  A.ranking = async (game, mode) => {
    await A.ready;
    const { data, error } = await sb.rpc('ranking', { p_game: game, p_mode: mode || '', p_limit: 10 });
    if (error) throw error;
    return data;
  };

  /* 지금 접속 중 알리기 (part3 · supabase/ops.sql) — 화면을 보고 있을 때 1분마다 한 번.
   * 관리자 '데이터 관리'의 동시 접속 숫자와 자동 백업 기준(동시 접속 4만 명)에 쓰여요.
   * 창(탭)마다 번호 하나. ops.sql 을 아직 안 돌렸으면 한 번 실패하고 조용히 멈춰요. */
  (function heartbeat() {
    let sid;
    try {
      sid = sessionStorage.getItem('samgongyuk-sid');
      if (!sid) { sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('samgongyuk-sid', sid); }
    } catch { sid = 'tmp-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
    const PAGE_KO = { highgo: 'hub', index: 'hub', '': 'hub', DdanDdan: '딴딴/딴', Vertebral_Wizard: '뭐라구요!?',
      'HIGO_뼈게임_사이트판': 'LandMark', '너에게닿기를': '너에게 닿기를', LongDrive: '롱드라이브' };
    let path = location.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep */ }
    const raw = (/\/games\/([^/]+)/.exec(path) || /([^/]*?)(?:\.html)?$/.exec(path) || [])[1] || '';
    const page = (PAGE_KO[raw] || raw || 'hub').slice(0, 60);
    let stop = false, last = 0;
    const ping = async () => {
      if (stop || document.visibilityState === 'hidden' || Date.now() - last < 50000) return;
      last = Date.now();
      try {
        await A.ready;
        const { error } = await sb.rpc('ops_ping', { p_sid: sid, p_page: page });
        if (error && (error.code === 'PGRST202' || error.code === '42883')) stop = true;   // 함수가 아직 없음
      } catch { /* offline */ }
    };
    setTimeout(ping, 2000);
    setInterval(ping, 60000);
    document.addEventListener('visibilitychange', ping);
  })();
})();
