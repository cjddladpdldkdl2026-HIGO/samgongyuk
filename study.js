/* 삼공육 — 문항 분석 (2026-11-24)
 *   📚 내 약점 분석            로그인한 회원   게임 · 묶음별 정답률, 자주 틀리는 문제, 최근 14일 정답률
 *   🧑‍🎓 회원 활동 · 문항 분석   관리자          요일×시간 표, 회원별 활동(게임별 · 주 시간대 · 정답률), 모두가 자주 틀리는 문제
 *
 *  게임이 문제를 판정할 때마다 SamAuth.answer(...) 로 남긴 기록(answers 표)을 읽어요.
 *  DB: supabase/answers.sql 을 SQL Editor 에서 한 번 실행해야 열려요 (안 돌렸으면 "준비 중" 안내).
 *  ☰ 사이드바(account.js)에 Account.addPage 로 붙어요. 허브에서 ops.js 다음에 불러요.
 */
(function () {
  if (!window.Account || !Account.addPage) return;
  const K = Account.kit, sb = K.sb, esc = K.esc, n = K.n;

  const GAMES = [
    { id: 'landmark', ko: 'LandMark', ic: '🎯', unit: '랜드마크', url: 'HIGO_뼈게임_사이트판.html' },
    { id: 'neoege', ko: '너에게 닿기를', ic: '💘', unit: '근육 부착점', url: '너에게닿기를.html' },
    { id: 'ddan', ko: '딴딴/딴', ic: '🎤', unit: '용어', url: 'games/DdanDdan/index.html' },
    { id: 'wizard', ko: '뭐라구요!?', ic: '🧙', unit: '용어', url: 'games/Vertebral_Wizard/index.html' },
    { id: 'golf', ko: '사랑하는 그대에게 기대세요', ic: '⛳', unit: '기출문제', url: 'games/LongDrive/index.html' },
  ];
  const G = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const gname = (id) => (G[id] ? `${G[id].ic} ${G[id].ko}` : id);
  const MISSING = (e) => /PGRST202|42883|Could not find the function/i.test(`${e && e.code} ${e && e.message}`);
  const missingMsg = '<p class="empty2">아직 준비 중이에요.<br>관리자가 Supabase SQL Editor 에서 <b>supabase/answers.sql</b> 을 한 번 실행하면 열려요.</p>';
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  const pct = (right, tries) => (tries ? Math.round(right * 100 / tries) : 0);
  const tone = (rate) => (rate >= 80 ? 'good' : rate >= 60 ? 'mid' : 'low');
  const rateBar = (label, rate, sub) =>
    `<div class="bar2 st-rate ${tone(rate)}"><span class="lab" style="width:auto">${label}</span><div class="track"><div class="fill" style="width:${Math.max(2, rate)}%"></div>
      <span class="val">${rate}%${sub ? `<i>${sub}</i>` : ''}</span></div></div>`;
  const W = ['일', '월', '화', '수', '목', '금', '토'];
  const filt = (attr, cur, list) => `<div class="filt">${list.map(([v, l]) =>
    `<button type="button" data-${attr}="${v ?? ''}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  /* ═════════ 📚 내 약점 분석 (로그인한 회원) ═════════ */
  const M = { game: null, days: null };
  const dataNote = `<details class="st-data"><summary>ℹ️ 어떤 기록을 모으나요?</summary>
    <p>로그인한 채로 게임을 하면 문제마다 <b>문제 이름 · 맞았는지 · 대신 고른 것 · 걸린 시간</b>을 남겨요. 목소리 녹음은 남기지 않고, 마이크가 알아들은 글자만 남겨요.</p>
    <p>내 기록은 나와 관리자만 볼 수 있고, 랭킹에는 가린 이름(김*수)만 보여요. 문제 기록은 1년이 지나면 이름 없는 통계로만 남기고 지워요.
      탈퇴하면 바로 모두 지워져요 (☰ → 내 정보 → 회원 탈퇴).</p></details>`;


  /* 게임 기록 표 — runs 표의 내 기록 (끝까지 한 판). answers.sql 없이도 바로 보여요. */
  const DIFF = { easy: '쉬움', normal: '보통', medium: '보통', hard: '어려움' };
  const REGION = { arm: '어깨·위팔', forearm: '아래팔', hip: '엉덩이·넙다리', leg: '종아리·발' };
  const DDAN_MAP = { brain: '뇌·뇌신경', tract: '신경로', nuclei: '바닥핵·신경핵', bone: '뼈·랜드마크', muscle: '근육', headbone: '머리·얼굴뼈', headmuscle: '머리·얼굴 근육', all: '전부 섞기' };
  const modeKo = (game, m) => {
    if (!m) return game === 'golf' ? '롱드라이브' : '기본';
    if (game === 'neoege') { const [r, d] = m.split(':'); return `${REGION[r] || r}${d ? ' · ' + (DIFF[d] || d) : ''}`; }
    if (game === 'ddan') return DDAN_MAP[m] || m;
    return DIFF[m] || m;
  };
  const verdict = (acc, rank, total) => {
    if (acc != null) return acc >= 80 ? '<span class="st-pill good">💪 강점</span>' : acc < 60 ? '<span class="st-pill low">⚠ 약점</span>' : '<span class="st-pill mid">보통</span>';
    if (rank && total >= 3) return rank <= Math.ceil(total / 3) ? '<span class="st-pill good">💪 강점</span>' : rank > total - Math.ceil(total / 3) ? '<span class="st-pill low">⚠ 약점</span>' : '<span class="st-pill mid">보통</span>';
    return '-';
  };
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const scoreText = (game, v) => (game === 'golf' ? `${n(v)}m` : game === 'wizard' ? (v ? '이김' : '-') : n(v));

  async function gameRecordsHtml() {
    const me = K.me();
    let q = sb.from('runs').select('game,mode,score,accuracy,detail,created_at').eq('user_id', me.id).order('created_at', { ascending: true }).limit(2000);
    if (M.game) q = q.eq('game', M.game);
    if (M.days) q = q.gte('created_at', new Date(Date.now() - M.days * 864e5).toISOString());
    const { data: runs, error } = await q;
    if (error) return `<h2 class="st-h2">🎮 내 게임 성적표</h2><p class="empty2">${esc(K.KO_ERR(error))}</p>`;
    if (!runs.length) return `<h2 class="st-h2">🎮 내 게임 성적표</h2><p class="empty2">${M.game || M.days ? '이 조건에는' : '아직'} 끝까지 한 게임이 없어요. 로그인한 채로 한 판 끝까지 해 보세요! 🎮</p>`;

    // ① 게임 · 모드별
    const groups = new Map();
    runs.forEach(r => { const k = r.game + '|' + r.mode; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const ranks = await Promise.all([...groups.keys()].map(k => {
      const [game, mode] = k.split('|');
      return rpc('ranking_board', { p_game: game, p_mode: mode, p_days: null, p_limit: 1 }).catch(() => null);
    }));
    const rows = [...groups.entries()].map(([k, rs], i) => {
      const [game, mode] = k.split('|');
      const accs = rs.map(r => r.accuracy).filter(a => a != null).map(Number);
      const first = accs[0], last = accs[accs.length - 1];
      const rk = ranks[i] || {};
      const best = game === 'wizard' ? rs.filter(r => r.score > 0).length : Math.max(...rs.map(r => r.score));
      return { game, mode, plays: rs.length, best, acc: avg(accs), recent: avg(accs.slice(-3)), diff: accs.length >= 2 ? Math.round(last - first) : null,
        rank: rk.myRank, total: rk.total, last: rs[rs.length - 1].created_at };
    }).sort((a, b) => GAMES.findIndex(g => g.id === a.game) - GAMES.findIndex(g => g.id === b.game) || b.plays - a.plays);
    const withAcc = rows.filter(r => r.acc != null);
    const allAcc = avg(runs.map(r => r.accuracy).filter(a => a != null).map(Number));
    const strong = withAcc.slice().sort((a, b) => b.acc - a.acc)[0], weakest = withAcc.slice().sort((a, b) => a.acc - b.acc)[0];
    const label = (r) => `${esc(G[r.game] ? G[r.game].ko : r.game)} · ${esc(modeKo(r.game, r.mode))}`;

    // ② 날짜 × 게임
    const day = (t) => K.fmtDate(t);
    const gamesIn = GAMES.filter(g => runs.some(r => r.game === g.id));
    const byDay = new Map();
    runs.forEach(r => { const d0 = day(r.created_at); if (!byDay.has(d0)) byDay.set(d0, []); byDay.get(d0).push(r); });
    const days = [...byDay.keys()].sort().reverse();
    M.csv = [['날짜', ...gamesIn.map(g => g.ko), '합계(판)', '평균 정확도(%)'],
      ...days.map(d0 => { const rs = byDay.get(d0); return [d0, ...gamesIn.map(g => rs.filter(r => r.game === g.id).length), rs.length, avg(rs.map(r => r.accuracy).filter(a => a != null).map(Number)) ?? '']; })];

    // ③ 게임 기록 안에서 찾은 약한 부분 (너에게 닿기를: 근육별 · 딴딴/딴: 놓친 용어 · 뭐라구요!?: 단계별)
    const parts = [];
    const mus = new Map();
    runs.filter(r => r.game === 'neoege').forEach(r => ((r.detail || {}).muscles || []).forEach(t => {
      const m = /^(.*)\s(\d+)\/(\d+)$/.exec(String(t)); if (!m) return;
      const o = mus.get(m[1]) || { hit: 0, of: 0 }; o.hit += +m[2]; o.of += +m[3]; mus.set(m[1], o);
    }));
    mus.forEach((o, name) => o.of && parts.push({ game: 'neoege', part: name, kind: '근육 부착점', rec: `${o.hit} / ${o.of} 맞힘`, rate: pct(o.hit, o.of) }));
    const miss = new Map(), ddanPlays = runs.filter(r => r.game === 'ddan').length;
    runs.filter(r => r.game === 'ddan').forEach(r => ((r.detail || {}).missed || []).forEach(w => miss.set(w, (miss.get(w) || 0) + 1)));
    miss.forEach((c, w) => parts.push({ game: 'ddan', part: w, kind: '놓친 용어', rec: `${c}번 놓침 (${ddanPlays}판 중)`, rate: Math.max(0, 100 - pct(c, ddanPlays)) }));
    const wz = new Map();
    runs.filter(r => r.game === 'wizard').forEach(r => { const d0 = r.detail || {}; const o = wz.get(r.mode) || { tries: 0, hits: 0, wrong: 0, silent: 0, win: 0, n: 0 };
      o.tries += d0.tries || 0; o.hits += d0.hits || 0; o.wrong += d0.wrong || 0; o.silent += d0.silent || 0; o.win += r.score > 0 ? 1 : 0; o.n++; wz.set(r.mode, o); });
    wz.forEach((o, stage) => o.tries && parts.push({ game: 'wizard', part: `스테이지 ${stage}`, kind: '주문',
      rec: `성공 ${o.hits} · 틀림 ${o.wrong} · 못 들음 ${o.silent} (이김 ${o.win}/${o.n})`, rate: pct(o.hits, Math.max(1, o.tries - o.silent)) }));
    parts.sort((a, b) => a.rate - b.rate);

    return `<h2 class="st-h2">🎮 내 게임 성적표 <small class="st-hint">끝까지 한 판 기준</small></h2>
      <div class="kpis">
        <div class="kpi c1"><small>끝까지 한 판</small><b>${n(runs.length)}</b><span>${gamesIn.length}개 게임 · 마지막 ${K.fmtDate(runs[runs.length - 1].created_at)}</span></div>
        <div class="kpi c3"><small>평균 정확도</small><b>${allAcc == null ? '-' : `${allAcc}%`}</b><span>정확도를 남기는 게임만</span></div>
        <div class="kpi c4"><small>💪 가장 잘하는 것</small><b style="font-size:18px">${strong ? label(strong) : '-'}</b><span>${strong ? `정확도 ${strong.acc}%` : ''}</span></div>
        <div class="kpi c2"><small>⚠ 가장 약한 것</small><b style="font-size:18px">${weakest && weakest !== strong ? label(weakest) : '-'}</b><span>${weakest && weakest !== strong ? `정확도 ${weakest.acc}%` : ''}</span></div>
      </div>

      <h3>📋 게임 · 모드별 성적표</h3>
      <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>게임</th><th>난이도 · 맵</th><th class="num">판 수</th><th class="num">최고 기록</th>
        <th class="num">평균 정확도</th><th class="num">최근 3판</th><th class="num">처음→최근</th><th class="num">내 순위</th><th>판정</th><th>마지막</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${esc(gname(r.game))}</td><td>${esc(modeKo(r.game, r.mode))}</td><td class="num">${n(r.plays)}</td>
          <td class="num">${r.game === 'wizard' ? `이김 ${r.best}` : scoreText(r.game, r.best)}</td>
          <td class="num">${r.acc == null ? '-' : `<span class="st-pill ${tone(r.acc)}">${r.acc}%</span>`}</td><td class="num">${r.recent == null ? '-' : `${r.recent}%`}</td>
          <td class="num">${r.diff == null ? '-' : r.diff > 0 ? `<b style="color:#6ff0a8">▲ ${r.diff}</b>` : r.diff < 0 ? `<b style="color:#ff8ab8">▼ ${-r.diff}</b>` : '='}</td>
          <td class="num">${r.rank ? `${r.rank}위 / ${r.total}명` : '-'}</td><td>${verdict(r.acc, r.rank, r.total)}</td><td>${K.fmtDate(r.last)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">판정: 정확도 80% 이상 💪 강점 · 60% 미만 ⚠ 약점. 정확도가 없는 게임(롱드라이브 등)은 회원 중 내 순위로 정해요. 처음→최근 = 첫 판과 마지막 판 정확도 차이.</p>

      <h3>📅 날짜별 기록 <button class="abtn sm pri" type="button" id="stMyCsv" style="margin-left:8px">⬇ 엑셀(CSV)</button></h3>
      <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>날짜</th>${gamesIn.map(g => `<th class="num">${g.ic} ${esc(g.ko)}</th>`).join('')}<th class="num">합계</th><th class="num">평균 정확도</th></tr></thead>
        <tbody>${M.csv.slice(1).map(row => `<tr><td class="${[0, 6].includes(new Date(row[0] + 'T00:00:00').getDay()) ? 'we' : ''}">${esc(row[0].slice(5).replace('-', '/'))} ${W[new Date(row[0] + 'T00:00:00').getDay()]}</td>
          ${row.slice(1, -2).map(v => `<td class="num">${v ? n(v) : '<span style="color:var(--ink-faint)">·</span>'}</td>`).join('')}<td class="num"><b>${n(row[row.length - 2])}</b></td>
          <td class="num">${row[row.length - 1] === '' ? '-' : `<span class="st-pill ${tone(row[row.length - 1])}">${row[row.length - 1]}%</span>`}</td></tr>`).join('')}</tbody></table></div>

      ${parts.length ? `<h3>🔍 게임 기록에서 찾은 약한 부분 <small class="st-hint">낮은 순</small></h3>
        <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>게임</th><th>부분</th><th>종류</th><th>기록</th><th class="num">정답률</th><th>판정</th></tr></thead>
          <tbody>${parts.slice(0, 40).map(x => `<tr><td>${esc(gname(x.game))}</td><td class="st-item">${esc(x.part)}</td><td>${esc(x.kind)}</td><td>${esc(x.rec)}</td>
            <td class="num"><span class="st-pill ${tone(x.rate)}">${x.rate}%</span></td><td>${verdict(x.rate)}</td></tr>`).join('')}</tbody></table></div>
        <p class="note">너에게 닿기를은 근육별 맞힌 수, 딴딴/딴은 놓친 용어, 뭐라구요!? 는 스테이지별 주문 성공을 모았어요 (못 들음은 정답률에서 빼요).</p>` : ''}`;
  }

  Account.addPage({
    id: 'weak', ic: '📚', label: '내 약점 분석', login: true,
    async render() {
      const [recHtml, d] = await Promise.all([gameRecordsHtml(), rpc('my_weak', { p_game: M.game, p_days: M.days }).catch(e => ({ _err: e }))]);
      const tabs = filt('wg', M.game, [[null, '전체'], ...GAMES.map(g => [g.id, `${g.ic} ${g.ko}`])]);
      const per = filt('wd', M.days, [[null, '전체 기간'], [30, '최근 30일'], [7, '최근 7일']]).replace('class="filt"', 'class="filt sm"');
      const head = `<h2>📚 내 약점 분석</h2>
        <p class="sub">내가 한 게임 기록으로 잘하는 것 · 약한 것을 표로 보여 줘요. 로그인한 채로 게임을 끝까지 하면 쌓여요.</p>${tabs}${per}`;
      const qHead = `<h2 class="st-h2">📝 문제별 분석 <small class="st-hint">문제 하나하나 맞았는지 · 헷갈린 것 · 걸린 시간</small></h2>`;
      if (d._err) {
        return head + recHtml + qHead + (MISSING(d._err)
          ? '<p class="empty2">문제별 기록은 곧 시작돼요. (관리자가 Supabase 에서 <b>answers.sql</b> 을 실행하면 그다음 게임부터 쌓여요)</p>'
          : `<p class="empty2">${esc(K.KO_ERR(d._err))}</p>`) + dataNote;
      }
      if (!d.total) {
        return head + recHtml + qHead + `<p class="empty2">${M.game || M.days ? '이 조건에는' : '아직'} 문제별 기록이 없어요.<br>로그인한 채로 게임을 하면 문제마다 맞았는지 틀렸는지가 쌓여요 🎮</p>` + dataNote;
      }
      const rate = pct(d.right, d.total);
      const weakestCat = d.cats.filter(c => c.tries >= 3)[0] || d.cats[0];
      const game = M.game && G[M.game];
      const days = d.days || [];
      const maxT = Math.max(1, ...days.map(x => x.tries));

      return head + recHtml + qHead + `
        <div class="kpis">
          <div class="kpi c1"><small>문제 정답률</small><b>${rate}%</b><span>${n(d.total)}문제 중 ${n(d.right)}개 맞힘</span></div>
          <div class="kpi c2"><small>가장 약한 부분</small><b style="font-size:20px">${weakestCat ? esc(weakestCat.cat) : '-'}</b>
            <span>${weakestCat ? `${M.game ? '' : esc(G[weakestCat.game] ? G[weakestCat.game].ko : weakestCat.game) + ' · '}정답률 ${weakestCat.rate}% (${weakestCat.tries}문제)` : '묶음 기록이 아직 없어요'}</span></div>
          <div class="kpi c3"><small>다시 볼 문제</small><b>${n(d.weak.length)}</b><span>한 번 이상 틀린 문제${d.weak.length >= 20 ? ' (많은 순 20개)' : ''}</span></div>
        </div>
        ${game ? `<div class="row" style="margin-top:12px"><a class="abtn pri" href="${esc(game.url)}">▶ ${esc(game.ko)} 다시 연습하러 가기</a></div>` : ''}

        ${!M.game && d.games.length > 1 ? `<h3>🎮 게임별 정답률</h3><div class="bars2">${d.games.map(g =>
          rateBar(esc(gname(g.game)), pct(g.right, g.tries), `${n(g.tries)}문제`)).join('')}</div>` : ''}

        <h3>🧩 부분별 정답률 <small class="st-hint">낮은 순 · 빨간 막대부터 공부해 보세요</small></h3>
        <div class="bars2">${d.cats.slice(0, 15).map(c =>
          rateBar(`${esc(c.cat)}${M.game ? '' : ` <small class="st-g">${esc(G[c.game] ? G[c.game].ko : c.game)}</small>`}`, c.rate, `${n(c.tries)}문제`)).join('')
          || '<p class="empty2">묶음 기록이 아직 없어요.</p>'}</div>

        <h3>❗ 자주 틀리는 문제 <small class="st-hint">틀린 횟수 많은 순</small></h3>
        ${d.weak.length ? `<div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>문제</th>${M.game ? '' : '<th>게임</th>'}<th>부분</th>
            <th class="num">틀림</th><th class="num">정답률</th><th>대신 고른 것</th><th>마지막</th></tr></thead><tbody>${d.weak.map(w => `<tr>
            <td class="st-item">${esc(w.item)}</td>${M.game ? '' : `<td>${esc(G[w.game] ? G[w.game].ko : w.game)}</td>`}<td>${esc(w.cat || '-')}</td>
            <td class="num">${n(w.wrong)} / ${n(w.tries)}</td><td class="num"><span class="st-pill ${tone(w.rate)}">${w.rate}%</span></td>
            <td class="st-item"><small>${w.last_picked ? esc(w.last_picked) : '-'}</small></td>
            <td>${w.last_ok ? '✅ 맞힘' : '❌ 틀림'} <small style="color:var(--ink-faint)">${K.fmtDate(w.last_at)}</small></td></tr>`).join('')}</tbody></table></div>
          <p class="note">✅ 최근엔 맞힌 문제는 거의 다 익힌 거예요. ❌ 인 문제부터 다시 보세요.</p>`
          : '<p class="empty2">틀린 문제가 없어요! 👏</p>'}

        ${d.confuse.length ? `<h3>🔀 자주 헷갈리는 짝 <small class="st-hint">이 문제에서 대신 고른 것</small></h3>
          <div class="st-pairs">${d.confuse.map(c => `<div class="st-pair"><b>${esc(c.item)}</b><span class="vs">↔</span><span>${esc(c.picked)}</span>
            <small>${n(c.n)}번${M.game ? '' : ` · ${esc(G[c.game] ? G[c.game].ko : c.game)}`}</small></div>`).join('')}</div>
          <p class="note">두 개를 나란히 놓고 위치 · 모양 · 이름의 차이를 비교해 보세요.</p>` : ''}

        ${d.slow.length ? `<h3>🐢 맞혔지만 오래 걸린 문제 <small class="st-hint">내 보통 속도보다 1.5배 넘게 걸림</small></h3>
          <div class="st-chips">${d.slow.map(s => `<span class="chip" title="${n(s.n)}번 맞힘">${esc(s.item)} · ${(s.avg_ms / 1000).toFixed(1)}초 (×${s.ratio})</span>`).join(' ')}</div>
          <p class="note">맞히긴 했지만 아직 확실하지 않은 문제예요. 바로 떠오를 때까지 한 번 더!</p>` : ''}

        ${d.no_voice ? `<p class="note">🎤 마이크가 소리를 못 들은 ${n(d.no_voice)}번은 정답률에서 뺐어요. 조용한 곳에서 크게 말해 보세요.</p>` : ''}

        ${d.strong.length ? `<h3>💪 잘하는 문제</h3><div class="st-chips">${d.strong.map(s =>
          `<span class="chip update" title="${n(s.tries)}번 중 ${s.rate}%">${esc(s.item)}</span>`).join(' ')}</div>` : ''}

        ${days.length ? `<h3>📈 최근 14일 정답률</h3>
          <div class="ops-cols">${days.map(x => `<div class="c" title="${esc(x.day)}: ${x.rate}% (${x.tries}문제)">
            <i class="${tone(x.rate)}" style="height:${Math.max(4, x.rate)}%;opacity:${(0.45 + 0.55 * x.tries / maxT).toFixed(2)}"></i>
            <span>${esc(x.day.slice(5).replace('-', '/'))}</span></div>`).join('')}</div>
          <p class="note">막대 높이 = 정답률, 진할수록 그날 많이 풀었어요.</p>` : ''}
        ${dataNote}`;
    },
    bind() {
      const pg = K.pg;
      pg.querySelectorAll('[data-wg]').forEach(b => b.addEventListener('click', () => { M.game = b.dataset.wg || null; Account.page('weak'); }));
      pg.querySelectorAll('[data-wd]').forEach(b => b.addEventListener('click', () => { M.days = b.dataset.wd ? +b.dataset.wd : null; Account.page('weak'); }));
      const cb = pg.querySelector('#stMyCsv');
      if (cb) cb.addEventListener('click', () => { if (M.csv) download(`samgongyuk_my_records_${K.fmtDate(new Date())}.csv`, '\uFEFF' + M.csv.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8'); });
    },
  });

  /* ═════════ 🧑‍🎓 회원 활동 · 문항 분석 (관리자) ═════════ */
  const A = { days: 30, game: null, sort: 'plays', csv: null };

  Account.addPage({
    id: 'activity', ic: '🧑‍🎓', label: '회원 활동 · 문항 분석', admin: true,
    async render() {
      let act, it, plays;
      try {
        [act, it, plays] = await Promise.all([rpc('admin_activity', { p_days: A.days }), rpc('admin_items', { p_game: A.game, p_days: A.days }),
          rpc('admin_plays', { p_days: A.days })]);
      }
      catch (e) { return '<h2>🧑‍🎓 회원 활동 · 문항 분석</h2>' + (MISSING(e) ? missingMsg : `<p class="empty2">${esc(K.KO_ERR(e))}</p>`); }

      // 요일 × 시간 표
      const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
      act.heat.forEach(h => { heat[h.dow][h.h] = h.n; });
      const maxH = Math.max(1, ...act.heat.map(h => h.n));
      const order = [1, 2, 3, 4, 5, 6, 0];   // 월요일부터
      const heatHtml = `<div class="st-heat"><div class="hr"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hh">${h % 3 === 0 ? h : ''}</span>`).join('')}</div>
        ${order.map(d => `<div class="hr"><span class="dl ${d % 6 === 0 ? 'we' : ''}">${W[d]}</span>${heat[d].map((v, h) =>
          `<i title="${W[d]}요일 ${h}시: ${v}회" style="--a:${v ? (0.15 + 0.85 * v / maxH).toFixed(2) : 0}">${v || ''}</i>`).join('')}</div>`).join('')}</div>`;
      const byHour = Array(24).fill(0); act.heat.forEach(h => { byHour[h.h] += h.n; });
      const peakH = byHour.indexOf(Math.max(...byHour));
      const byDow = Array(7).fill(0); act.heat.forEach(h => { byDow[h.dow] += h.n; });
      const peakD = byDow.indexOf(Math.max(...byDow));

      // 회원 표
      const active = act.users.filter(u => u.plays || u.answers || u.runs);
      const sorters = { plays: (a, b) => b.plays - a.plays, rate: (a, b) => (a.rate ?? 101) - (b.rate ?? 101), days: (a, b) => b.active_days - a.active_days, mins: (a, b) => b.minutes - a.minutes, seen: (a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')) };
      const users = act.users.slice().sort(sorters[A.sort] || sorters.plays);
      const gameCols = [...new Set(act.users.flatMap(u => Object.keys(u.by_game || {})))];
      A.csv = [['구분', '아이디/학번', '이름', '학년', '게임 실행', ...gameCols, '활동한 날', '주로 하는 시간', '머문 시간(분)', '끝까지 한 판', '푼 문제', '정답률(%)', '최근 접속'],
        ...users.map(u => [u.kind === 'admin' ? '관리자' : '학생', u.login_id, u.name, u.kind === 'admin' ? '' : u.grade, u.plays,
          ...gameCols.map(g => (u.by_game || {})[g] || 0), u.active_days, u.top_hour == null ? '' : `${u.top_hour}시`, u.minutes, u.runs, u.answers, u.rate ?? '',
          u.last_seen_at ? K.fmtDate(u.last_seen_at, true) : ''])];
      const ses = act.sessions || {}, ret = act.retention || {};
      const backRate = ret.new ? Math.round(ret.back7 * 100 / ret.new) : null;
      const bk = ses.buckets || {}, maxB = Math.max(1, ...Object.values(bk));
      const bucketLab = { '1-5': '1~5분', '5-15': '5~15분', '15-30': '15~30분', '30+': '30분 넘게' };
      const QUIT = ['1-3', '4-6', '7-10', '11-20', '21+'];
      const playsHtml = (plays || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>게임</th><th class="num">시작한 판</th><th class="num">끝까지</th>
          <th class="num">끝까지 한 비율</th><th class="num">끝낸 판 평균</th><th class="num">그만둔 판 평균</th><th>그만둔 지점 (몇 문제째)</th></tr></thead><tbody>${plays.map(g => {
            const r = pct(g.done, g.plays), mq = Math.max(1, ...QUIT.map(k => g.quit_at[k] || 0));
            return `<tr><td>${esc(gname(g.game))}</td><td class="num">${n(g.plays)}</td><td class="num">${n(g.done)}</td>
              <td class="num"><span class="st-pill ${tone(r)}">${r}%</span></td>
              <td class="num">${g.avg_steps_done == null ? '-' : `${g.avg_steps_done}문제${g.avg_min_done != null ? ` · ${g.avg_min_done}분` : ''}`}</td>
              <td class="num">${g.avg_steps_quit == null ? '-' : `${g.avg_steps_quit}문제`}</td>
              <td><div class="st-quit">${QUIT.map(k => `<span title="${k}문제째에서 그만둠: ${g.quit_at[k] || 0}판"><i style="height:${Math.round((g.quit_at[k] || 0) / mq * 100)}%"></i><small>${k}</small></span>`).join('')}</div></td></tr>`;
          }).join('')}</tbody></table></div>
          <p class="note">로그인한 회원이 문제를 하나라도 푼 판만 세요. 막대가 높은 곳에서 많이 그만둬요 → 그 구간이 너무 어렵거나 길지 않은지 살펴보세요.</p>`
        : '<p class="empty2">아직 기록이 없어요. (로그인한 회원이 게임에서 문제를 풀면 쌓여요)</p>';
      const sortBtn = (k, l) => `<button type="button" data-as="${k}" class="${A.sort === k ? 'on' : ''}">${l}</button>`;
      const per = filt('ad', A.days, [[7, '7일'], [14, '14일'], [30, '30일'], [90, '90일'], [365, '1년']]);
      const tabs = filt('ag', A.game, [[null, '전체'], ...GAMES.map(g => [g.id, `${g.ic} ${g.ko}`])]);

      return `<h2>🧑‍🎓 회원 활동 · 문항 분석</h2>
        <p class="sub">누가 · 언제 · 어떤 게임을 얼마나 하는지, 그리고 회원들이 어떤 문제를 많이 틀리는지 모아 봐요. 최근 ${act.days}일 (한국 시간)</p>
        <div class="row">${per}<span class="spacer"></span><button class="abtn sm pri" type="button" id="stCsv">⬇ 회원 활동 엑셀(CSV)</button></div>

        <div class="kpis" style="margin-top:12px">
          <div class="kpi c1"><small>활동한 회원</small><b>${n(active.length)}</b><span>전체 회원 ${n(act.users.length)}명 중</span></div>
          <div class="kpi c3"><small>가장 붐비는 때</small><b style="font-size:22px">${act.heat.length ? `${W[peakD]}요일 · ${peakH}시` : '-'}</b><span>게임 실행 기준</span></div>
          <div class="kpi c2"><small>푼 문제 (전체 회원)</small><b>${n(it.total)}</b><span>정답률 ${pct(it.right, it.total)}% · ${n(it.users)}명</span></div>
          <div class="kpi c4"><small>한 번 오면 머무는 시간</small><b>${ses.median_min == null ? '-' : `${ses.median_min}분`}</b><span>가운데값 · 평균 ${ses.avg_min ?? '-'}분 · ${n(ses.count || 0)}번 방문</span></div>
          <div class="kpi c1"><small>7일 안에 다시 온 회원</small><b>${backRate == null ? '-' : `${backRate}%`}</b><span>이 기간 처음 온 회원 ${n(ret.new || 0)}명 중 ${n(ret.back7 || 0)}명</span></div>
        </div>

        <h3>🗓 요일 × 시간 (게임 실행 수)</h3>
        ${act.heat.length ? heatHtml + '<p class="note">진할수록 많이 했어요. 칸에 마우스를 올리면 숫자가 보여요. 로그인 안 한 실행도 포함돼요.</p>'
          : '<p class="empty2">이 기간에는 게임 실행 기록이 없어요.</p>'}

        <div class="two">
          <div><h3>⏱ 한 번에 머무는 시간</h3>
            ${ses.count ? `<div class="bars2">${Object.keys(bucketLab).map(k => `<div class="bar2"><span class="lab">${bucketLab[k]}</span><div class="track"><div class="fill" style="width:${((bk[k] || 0) / maxB * 100).toFixed(1)}%"></div><span class="val">${n(bk[k] || 0)}번</span></div></div>`).join('')}</div>`
              : '<p class="empty2">아직 기록이 없어요. (창을 닫고 10분 뒤에 쌓여요)</p>'}</div>
          <div><h3>📄 화면별 평균 머문 시간</h3>
            <div class="bars2">${(act.session_pages || []).slice(0, 8).map(pg2 => { const mx = Math.max(1, ...act.session_pages.map(x => x.avg_min));
              return `<div class="bar2"><span class="lab" style="width:auto">${esc(pg2.page || '?')}</span><div class="track"><div class="fill" style="width:${(pg2.avg_min / mx * 100).toFixed(1)}%"></div><span class="val">${pg2.avg_min}분<i>${n(pg2.n)}번</i></span></div></div>`; }).join('')
              || '<p class="empty2">아직 기록이 없어요.</p>'}</div></div>
        </div>
        <p class="note">창 하나를 열고 닫을 때까지예요 (1분 미만 제외). 화면은 마지막에 보던 곳 기준이에요.</p>

        <h3>🏁 게임별 끝까지 한 비율 · 어디서 그만두나</h3>
        ${playsHtml}

        <h3>👥 회원별 활동</h3>
        <div class="filt sm">${sortBtn('plays', '많이 한 순')}${sortBtn('days', '자주 온 순')}${sortBtn('mins', '오래 머문 순')}${sortBtn('rate', '정답률 낮은 순')}${sortBtn('seen', '최근 접속 순')}</div>
        <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>이름</th><th>학번</th><th>학년</th><th class="num">게임 실행</th><th>게임별</th>
          <th class="num">활동한 날</th><th>주로 하는 시간</th><th class="num">머문 시간</th><th class="num">끝까지 한 판</th><th class="num">푼 문제</th><th class="num">정답률</th><th>최근 접속</th></tr></thead>
          <tbody>${users.map(u => `<tr${u.plays || u.answers || u.runs ? '' : ' class="st-idle"'}>
            <td>${esc(u.name)}${u.kind === 'admin' ? ' <span class="tag admin">관리자</span>' : ''}</td><td class="num">${esc(u.login_id)}</td>
            <td>${u.kind === 'admin' ? '-' : `${u.grade}학년`}</td><td class="num">${n(u.plays)}</td>
            <td><small>${Object.entries(u.by_game || {}).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${esc(g)} ${n(c)}`).join(' · ') || '-'}</small></td>
            <td class="num">${n(u.active_days)}</td><td>${u.top_hour == null ? '-' : `${u.top_hour}시대`}</td><td class="num">${u.minutes ? `${n(u.minutes)}분` : '-'}</td><td class="num">${n(u.runs)}</td>
            <td class="num">${n(u.answers)}</td><td class="num">${u.rate == null ? '-' : `<span class="st-pill ${tone(u.rate)}">${u.rate}%</span>`}</td>
            <td>${u.last_seen_at ? K.fmtDate(u.last_seen_at, true) : '-'}</td></tr>`).join('') || '<tr><td colspan="12" class="empty2">회원이 없어요.</td></tr>'}</tbody></table></div>
        <p class="note">흐리게 보이는 줄은 이 기간에 활동이 없는 회원이에요. 게임 실행은 허브에서 ▶ 플레이를 누른 횟수예요.</p>

        <h3>📝 문항 분석 · 회원들이 자주 틀리는 문제</h3>
        ${tabs}
        <div class="two">
          <div><h3 style="margin-top:4px">🧩 부분별 정답률 (낮은 순)</h3>
            <div class="bars2">${it.cats.slice(0, 15).map(c => rateBar(`${esc(c.cat)}${A.game ? '' : ` <small class="st-g">${esc(G[c.game] ? G[c.game].ko : c.game)}</small>`}`,
              c.rate, `${n(c.tries)}문제 · 👤${n(c.users)}`)).join('') || '<p class="empty2">기록이 아직 없어요.</p>'}</div></div>
          <div><h3 style="margin-top:4px">🎮 게임별</h3>
            <div class="bars2">${it.games.map(g => rateBar(esc(gname(g.game)), pct(g.right, g.tries), `${n(g.tries)}문제 · 👤${n(g.users)}${g.no_voice ? ` · 🎤못 들음 ${n(g.no_voice)}` : ''}${g.avg_ms ? ` · ${(g.avg_ms / 1000).toFixed(1)}초` : ''}`)).join('')
              || '<p class="empty2">기록이 아직 없어요.</p>'}</div></div>
        </div>
        <h3>❗ 정답률 낮은 문제 TOP 30 <small class="st-hint">3번 넘게 풀린 문제만</small></h3>
        ${it.hard.length ? `<div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>문제</th>${A.game ? '' : '<th>게임</th>'}<th>부분</th>
            <th class="num">푼 횟수</th><th class="num">회원</th><th class="num">정답률</th><th>많이 고른 오답</th><th class="num">맞힐 때</th></tr></thead><tbody>${it.hard.map(h => `<tr>
            <td class="st-item">${esc(h.item)}</td>${A.game ? '' : `<td>${esc(G[h.game] ? G[h.game].ko : h.game)}</td>`}<td>${esc(h.cat || '-')}</td>
            <td class="num">${n(h.tries)}</td><td class="num">${n(h.users)}</td><td class="num"><span class="st-pill ${tone(h.rate)}">${h.rate}%</span></td>
            <td class="st-item"><small>${h.top_picked ? esc(h.top_picked) : '-'}</small></td><td class="num">${h.avg_ms ? `${(h.avg_ms / 1000).toFixed(1)}초` : '-'}</td></tr>`).join('')}</tbody></table></div>
          <p class="note">정답률이 낮은 문제는 수업에서 한 번 더 짚거나, 문제 · 보기가 헷갈리게 되어 있지 않은지 확인해 보세요.</p>`
          : '<p class="empty2">아직 3번 넘게 풀린 문제가 없어요.</p>'}

        <h3>🔀 회원들이 자주 헷갈리는 짝 TOP 20</h3>
        ${it.confuse.length ? `<div class="st-pairs">${it.confuse.map(c => `<div class="st-pair"><b>${esc(c.item)}</b><span class="vs">↔</span><span>${esc(c.picked)}</span>
            <small>${n(c.n)}번 · 👤${n(c.users)}${A.game ? '' : ` · ${esc(G[c.game] ? G[c.game].ko : c.game)}`}</small></div>`).join('')}</div>
          <p class="note">수업에서 두 개를 나란히 비교해 주면 좋아요.</p>` : '<p class="empty2">아직 기록이 없어요.</p>'}

        ${!A.game || A.game === 'wizard' ? `<h3>🎤 음성 인식 점검 (뭐라구요!?)</h3>
          ${(() => { const w = it.games.find(g => g.game === 'wizard');
            return `<p class="sub" style="margin-top:0">마이크가 아무 소리도 못 들은 횟수 <b>${n(w ? w.no_voice : 0)}번</b> (정답률에서 뺐어요).
              아래는 틀렸을 때 <b>무엇으로 들렸는지</b>예요. 발음은 맞는데 엉뚱하게 들린다면 음성 인식 문제일 수 있어요.</p>`; })()}
          ${it.voice.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>정답 용어</th><th>들린 말</th><th class="num">횟수</th></tr></thead><tbody>${it.voice.map(v =>
            `<tr><td>${esc(v.item)}</td><td>“${esc(v.heard)}”</td><td class="num">${n(v.n)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty2">아직 기록이 없어요.</p>'}` : ''}`;
    },
    bind() {
      const pg = K.pg;
      pg.querySelectorAll('[data-ad]').forEach(b => b.addEventListener('click', () => { A.days = +b.dataset.ad; Account.page('activity'); }));
      pg.querySelectorAll('[data-ag]').forEach(b => b.addEventListener('click', () => { A.game = b.dataset.ag || null; Account.page('activity'); }));
      pg.querySelectorAll('[data-as]').forEach(b => b.addEventListener('click', () => { A.sort = b.dataset.as; Account.page('activity'); }));
      const c = pg.querySelector('#stCsv');
      if (c) c.addEventListener('click', () => {
        if (!A.csv) return;
        download(`samgongyuk_members_${K.fmtDate(new Date())}_${A.days}d.csv`, '﻿' + A.csv.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
      });
    },
  });
})();
