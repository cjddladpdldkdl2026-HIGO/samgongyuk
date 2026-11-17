/**
 * 삼공육 × 구글 시트 — Apps Script (시트의 [확장 프로그램 → Apps Script]에 통째로 붙여 넣어요)
 *
 * 하는 일
 *  - 기록: 게임이 끝나면 한 판씩 '기록' 탭에 한 줄로 쌓여요. LandMark 랭킹(TOP 10)도 여기서 계산해요.
 *  - 용어: '딴딴딴_용어', '뭐라구요_용어', '너에게_근육' 탭의 내용을 게임이 읽어 가요.
 *
 * 처음 한 번
 *  1. 위쪽 함수 고르기에서 setup 을 골라 ▶ 실행 → 권한 허용
 *     (탭 4개가 생기고, 지금 게임에 들어 있는 용어가 채워져요)
 *  2. 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스: 모든 사용자 → 배포
 *  3. 나온 웹 앱 주소(…/exec)를 사이트의 sheets.js 맨 위 SHEET_URL 에 넣기
 *
 * 코드를 고친 뒤에는 배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포 (주소는 그대로예요)
 */

// 시트 밖(script.google.com)에서 만든 스크립트면 시트 주소의 /d/…/edit 사이 ID를 넣어요. 시트 안에서 만들었으면 비워 둬도 돼요.
const SHEET_ID = '1MwGZkFaDAW_h1-WwFeUSQwXSKkeXtroDAitb1v7GB48';
function book() { return SpreadsheetApp.getActive() || SpreadsheetApp.openById(SHEET_ID); }

const SITE = 'https://samgongyuk.vercel.app/sheets/';
const TABS = {
  // seed: 예전 Supabase 에 있던 LandMark 기록 (11-17 옮김)
  records: { name: '기록',          head: ['시간', '게임', '닉네임', '모드', '점수', '정확도', '상세'], seed: 'records_supabase.csv' },
  ddan:    { name: '딴딴딴_용어',    head: ['map', 'english', 'korean', 'reading'],          csv: 'ddan.csv' },
  wizard:  { name: '뭐라구요_용어',  head: ['skill', 'english', 'korean', 'tier', 'hear'],   csv: 'wizard.csv' },
  neoege:  { name: '너에게_근육',    head: ['id', 'english', 'korean', 'action', 'nerve'],   csv: 'neoege.csv' },
};
const GAMES = ['landmark', 'ddan', 'wizard', 'neoege'];

/* ── 처음 한 번: 탭 만들고 지금 용어 채우기 ───────────────────────────── */
function setup() {
  const ss = book();
  Object.keys(TABS).forEach(function (k) {
    const t = TABS[k];
    let sh = ss.getSheetByName(t.name);
    if (!sh) sh = ss.insertSheet(t.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(t.head);
      sh.getRange(1, 1, 1, t.head.length).setFontWeight('bold').setBackground('#efe6ff');
      sh.setFrozenRows(1);
    }
    // 탭이 비어 있을 때만 사이트의 CSV로 채워요 (이미 고친 내용은 덮어쓰지 않아요)
    const src = t.csv || t.seed;
    if (src && sh.getLastRow() === 1) {
      let rows = Utilities.parseCsv(UrlFetchApp.fetch(SITE + src).getContentText('UTF-8')).slice(1);
      if (t.seed) rows = rows.map(function (r) { return [new Date(r[0]), r[1], r[2], r[3], Number(r[4]), Number(r[5]), r[6]]; });
      const range = rows.length ? sh.getRange(2, 1, rows.length, t.head.length) : null;
      if (range && t.csv) range.setNumberFormat('@');   // 용어는 글자 그대로 (숫자·날짜로 바뀌지 않게)
      if (range) range.setValues(rows);
    }
  });
  const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

/* ── 읽기: 용어 / 랭킹 ─────────────────────────────────────────────── */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'terms') return json({ ok: true, rows: terms(p.game) });
    if (p.action === 'rank') return json(Object.assign({ ok: true }, rank(p.game, p.mode, p.nick)));
    return json({ ok: true, hello: '삼공육' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ── 쓰기: 한 판 기록 ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (GAMES.indexOf(b.game) < 0) throw new Error('unknown game');
    const score = Number(b.score);
    if (!isFinite(score) || Math.abs(score) > 1e7) throw new Error('bad score');
    const acc = b.accuracy === undefined || b.accuracy === null || b.accuracy === '' ? '' : Number(b.accuracy);
    const row = [new Date(), b.game, clean(b.nickname, 12) || '익명', clean(b.mode, 20), Math.round(score),
      acc === '' || !isFinite(acc) ? '' : acc, clean(JSON.stringify(b.detail || {}), 2000)];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { sheet('records').appendRow(row); } finally { lock.releaseLock(); }
    const out = { ok: true };
    if (b.withRank) Object.assign(out, rank(b.game, b.mode, row[2]));
    return json(out);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ── 계산 ──────────────────────────────────────────────────────────── */
function terms(game) {
  const t = TABS[game];
  if (!t || !t.csv) throw new Error('unknown game');
  const v = sheet(game).getDataRange().getDisplayValues();
  const head = v.shift().map(function (h) { return String(h).trim(); });
  return v.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); })
    .map(function (r) { const o = {}; head.forEach(function (h, i) { o[h] = String(r[i] || '').trim(); }); return o; });
}

/** 닉네임마다 최고 점수 1개로 TOP 10, 내 최고 점수·순위, 전체 인원 */
function rank(game, mode, nick) {
  const v = sheet('records').getDataRange().getValues().slice(1);
  const best = {};   // nickname -> { score, accuracy, t }
  v.forEach(function (r) {
    if (r[1] !== game || String(r[3]) !== String(mode || '')) return;
    const n = String(r[2]), s = Number(r[4]), t = new Date(r[0]).getTime();
    const b = best[n];
    if (!b || s > b.score || (s === b.score && t < b.t)) best[n] = { nickname: n, score: s, accuracy: r[5], t: t };
  });
  const all = Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return b.score - a.score || a.t - b.t; });
  const me = nick ? best[String(nick)] : null;
  return {
    top: all.slice(0, 10).map(function (b) { return { nickname: b.nickname, score: b.score, accuracy: b.accuracy }; }),
    myBest: me ? me.score : null,
    myRank: me ? all.filter(function (b) { return b.score > me.score; }).length + 1 : null,
    total: all.length,
  };
}

/* ── 도우미 ────────────────────────────────────────────────────────── */
function sheet(k) {
  const sh = book().getSheetByName(TABS[k].name);
  if (!sh) throw new Error('탭이 없어요: ' + TABS[k].name + ' (setup 을 먼저 실행해 주세요)');
  return sh;
}
/** 길이 제한 + 수식으로 읽히지 않게 (=, +, -, @ 로 시작하면 앞에 ' 붙이기) */
function clean(s, max) {
  s = String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
