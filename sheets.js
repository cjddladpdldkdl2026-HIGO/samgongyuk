/* 삼공육 × 구글 시트 — 모든 게임이 같이 쓰는 연결 파일
 *
 *  용어: SHEET_URL 에 Apps Script 웹 앱 주소(…/exec)를 넣으면 켜져요. 비어 있으면 게임에 들어 있는 용어를 써요.
 *  기록: 11-17부터 구글 시트가 아니라 로그인 계정(auth.js → Supabase)에 저장해요.
 *
 *  기록  Samgongyuk.record({ game, mode, score, accuracy, detail })  — SamAuth.record 로 넘겨요 (가입한 학생만, 실패해도 게임은 그대로)
 *  용어  Samgongyuk.terms(game) → 시트 줄 배열 또는 null
 *        시트에서 받아 둔 사본(이 브라우저에 저장)을 바로 돌려주고, 새 내용은 뒤에서 받아 다음번에 써요.
 *        허브(highgo.html)에 들어올 때마다 모든 게임 용어를 미리 받아 둬요.
 *
 *  시트·스크립트 설명: sheets/Code.gs
 */
(function () {
  const SHEET_URL = '';   // ← 예: 'https://script.google.com/macros/s/AKfy…/exec'

  const TERM_GAMES = ['ddan', 'wizard', 'neoege'];
  const MAX_AGE = 10 * 60 * 1000;   // 용어 사본을 새로 받는 간격 (10분)
  const key = (g) => 'samgongyuk-terms/' + g;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  async function get(params) {
    const res = await fetch(SHEET_URL + '?' + new URLSearchParams(params));
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'sheet');
    return j;
  }

  /** 시트 사본: 이 주소(SHEET_URL)에서 받은 것만 써요 */
  function cached(game) {
    try {
      const c = JSON.parse(ls.get(key(game)) || 'null');
      return c && c.src === SHEET_URL && Array.isArray(c.rows) ? c : null;
    } catch { return null; }
  }
  async function refresh(game, force) {
    if (!SHEET_URL) return null;
    const c = cached(game);
    if (!force && c && Date.now() - c.at < MAX_AGE) return c.rows;
    try {
      const { rows } = await get({ action: 'terms', game });
      ls.set(key(game), JSON.stringify({ src: SHEET_URL, at: Date.now(), rows }));
      return rows;
    } catch { return c ? c.rows : null; }
  }

  window.Samgongyuk = {
    enabled: !!SHEET_URL,

    record(row) {
      return window.SamAuth ? SamAuth.record(row) : Promise.resolve(null);
    },

    terms(game) {
      if (!SHEET_URL) return null;
      const c = cached(game);
      refresh(game);
      return c && c.rows.length ? c.rows : null;
    },
    refreshAll() { return Promise.all(TERM_GAMES.map(g => refresh(g, true))); },
  };
})();
