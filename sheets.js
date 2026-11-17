/* 삼공육 × 구글 시트 — 모든 게임이 같이 쓰는 연결 파일
 *
 *  SHEET_URL 에 Apps Script 웹 앱 주소(…/exec)를 넣으면 켜져요. 비어 있으면 아무것도 안 해요
 *  (게임은 원래대로 돌고, LandMark 랭킹은 예전 Supabase 를 써요).
 *
 *  기록  Samgongyuk.record({ game, mode, score, accuracy, detail })  — 한 판 끝날 때, 실패해도 게임은 그대로
 *  랭킹  Samgongyuk.rank(game, mode, nick) / Samgongyuk.submit(row)  — LandMark TOP 10
 *  용어  Samgongyuk.terms(game) → 시트 줄 배열 또는 null
 *        시트에서 받아 둔 사본(이 브라우저에 저장)을 바로 돌려주고, 새 내용은 뒤에서 받아 다음번에 써요.
 *        허브(highgo.html)에 들어올 때마다 모든 게임 용어를 미리 받아 둬요.
 *
 *  시트·스크립트 설명: sheets/Code.gs
 */
(function () {
  const SHEET_URL = '';   // ← 예: 'https://script.google.com/macros/s/AKfy…/exec'

  const NICK_KEYS = ['samgongyuk-nickname', 'landmark-nickname'];
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
  async function post(body) {
    // text/plain 이면 브라우저가 사전 확인(CORS preflight)을 안 해서 Apps Script 가 바로 받아요
    const res = await fetch(SHEET_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'sheet');
    return j;
  }

  function nickname() {
    for (const k of NICK_KEYS) { const v = ls.get(k); if (v) return v; }
    return '익명';
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
    nickname,
    setNickname(n) { NICK_KEYS.forEach(k => ls.set(k, n)); },

    record(row) {
      if (!SHEET_URL) return Promise.resolve(null);
      return post({ nickname: nickname(), ...row }).catch(() => null);
    },
    submit(row) { return post({ ...row, withRank: true }); },
    rank(game, mode, nick) { return get({ action: 'rank', game, mode, nick: nick || '' }); },

    terms(game) {
      if (!SHEET_URL) return null;
      const c = cached(game);
      refresh(game);
      return c && c.rows.length ? c.rows : null;
    },
    refreshAll() { return Promise.all(TERM_GAMES.map(g => refresh(g, true))); },
  };
})();
