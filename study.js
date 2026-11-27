/* 삼공육 — 문항 분석 (2026-11-24)
 *   📋 진료 차트        로그인한 회원   게임 · 묶음별 정답률, 자주 틀리는 문제, 최근 14일 정답률
 *   (관리자) 회원 활동 · 문항 분석 — 메뉴는 없고 🗂 관리자 전력 분석 자료(ops.js) 아래쪽에 붙어요          요일×시간 표, 회원별 활동(게임별 · 주 시간대 · 정답률), 모두가 자주 틀리는 문제
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
    { id: 'yesno', ko: '말해 YES OR NO', ic: '📝', unit: '뼈·근육', url: 'games/YesOrNo/index.html' },
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
  const rateBar = (label, rate, sub) =>   // 숫자는 막대 밖 오른쪽에
    `<div class="bar2 out st-rate ${tone(rate)}"><span class="lab">${label}</span><div class="track"><div class="fill" style="width:${Math.max(2, rate)}%"></div></div>
      <span class="v"><b>${rate}%</b>${sub ? `<i>${sub}</i>` : ''}</span></div>`;
  const outBar = (label, w, val, extra) =>
    `<div class="bar2 out"><span class="lab">${label}</span><div class="track"><div class="fill" style="width:${Math.max(1, w).toFixed(1)}%"></div></div>
      <span class="v"><b>${val}</b>${extra ? `<i>${extra}</i>` : ''}</span></div>`;
  const ALIAS2 = { '롱드라이브': '사랑하는 그대에게 기대세요', '뭐라구요!?': '뭐라구요!? 안들려요' };
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

  /* ═════════ 📋 진료 차트 (로그인한 회원) — 예전 이름: 내 약점 분석 ═════════ */
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
    if (acc != null) return acc >= 80 ? '<span class="st-pill good">💪 건강</span>' : acc < 60 ? '<span class="st-pill low">⚠ 치료 필요</span>' : '<span class="st-pill mid">👀 관찰</span>';
    if (rank && total >= 3) return rank <= Math.ceil(total / 3) ? '<span class="st-pill good">💪 건강</span>' : rank > total - Math.ceil(total / 3) ? '<span class="st-pill low">⚠ 치료 필요</span>' : '<span class="st-pill mid">👀 관찰</span>';
    return '-';
  };
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const scoreText = (game, v) => (game === 'golf' ? `${n(v)}m` : game === 'wizard' ? (v ? '이김' : '-') : n(v));

  // 차트 머리: 제목 · 차트 번호 · 종합 소견 도장 · 환자 정보
  function chartHead(acc, plays, lastAt) {
    const me = K.me() || {};
    const now = new Date(), sy = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
    const grade = me.kind === 'student' ? (me.grade_override || Math.max(1, sy - (me.entry_year || sy) + 1)) : null;
    const st = acc == null ? ['none', '진찰 대기', '기록이 쌓이면 나와요'] : acc >= 80 ? ['good', '건강 양호', '지금처럼!'] : acc >= 60 ? ['mid', '경과 관찰', '조금만 더!'] : ['low', '집중 치료', '처방대로 연습해요'];
    return `<div class="chart-head"><div><h3>진료 차트</h3><span class="no">No. ${esc(me.login_id || '-')} · 청암대학교 물리치료과</span></div>
        <div class="stamp ${st[0]}">${st[1]}<small>${st[2]}</small></div></div>
      <div class="pt-info">
        <div><small>환자명</small><b>${esc(me.name || '-')}</b></div>
        <div><small>${me.kind === 'student' ? '학번 · 학년' : '구분'}</small><b>${me.kind === 'student' ? `${esc(me.login_id)} · ${grade}학년` : '관리자'}</b></div>
        <div><small>첫 내원</small><b>${me.created_at ? K.fmtDate(me.created_at) : '-'}</b></div>
        <div><small>최근 내원</small><b>${lastAt ? K.fmtDate(lastAt) : '-'}</b></div>
        <div><small>총 진료</small><b>${n(plays)}회</b></div>
      </div>`;
  }

  async function gameRecords() {   // 진료 차트 계산 (보여 주기는 아래 칸 · 팝업)
    const me = K.me();
    let q = sb.from('runs').select('game,mode,score,accuracy,detail,created_at').eq('user_id', me.id).order('created_at', { ascending: true }).limit(2000);
    if (M.game) q = q.eq('game', M.game);
    if (M.days) q = q.gte('created_at', new Date(Date.now() - M.days * 864e5).toISOString());
    const { data: runs, error } = await q;
    if (error) return { head: chartHead(null, 0, null) + `<p class="empty2">${esc(K.KO_ERR(error))}</p>` };
    if (!runs.length) return { head: chartHead(null, 0, null) };

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

    // ④ 진료 차트 — 한눈에 보기 (환자 정보 · 바이탈 · 오늘의 처방 · 칸 8개) + 칸을 누르면 팝업 (11-27: 휠 없이 한 화면에)
    const week = runs.filter(r => Date.now() - new Date(r.created_at) < 7 * 864e5).length;
    const visitDays = byDay.size;
    const rxRows = withAcc.filter(r => r.acc < 80).sort((a, b) => a.acc - b.acc).slice(0, 2);
    const rxParts = parts.filter(x => x.rate < 60).slice(0, 2);
    const untried = GAMES.filter(g => g.id !== 'yesno' && !runs.some(r => r.game === g.id) && !M.game)[0];
    const rx = [
      ...rxRows.map(r => ({ txt: `<b>${label(r)}</b> 3판 더 연습하기 <small>지금 정확도 ${r.acc}% → 목표 80%</small>`, url: G[r.game] && G[r.game].url })),
      ...rxParts.map(x => ({ txt: `<b>${esc(x.part)}</b> 다시 보기 <small>${esc(G[x.game] ? G[x.game].ko : x.game)} · ${esc(x.kind)} · ${x.rate}%</small>`, url: G[x.game] && G[x.game].url })),
    ];
    if (!rx.length) rx.push(untried
      ? { txt: `지금처럼 꾸준히! <b>${esc(untried.ko)}</b>에도 도전해 보세요 <small>아직 안 해 본 게임</small>`, url: untried.url }
      : { txt: '<b>건강 양호!</b> 지금처럼 꾸준히 해 주세요 <small>모든 게임 정확도 80% 이상</small>', url: '' });
    return { head: chartHead(allAcc, runs.length, runs[runs.length - 1].created_at), runs, allAcc, week, visitDays, gamesIn, strong, weakest, label, rx, rows, parts, days };
  }
  const accTone = (a) => (a == null ? '' : tone(a));
  const dxTone = (r) => (r.acc != null ? tone(r.acc) : (r.rank && r.total >= 3 ? (r.rank <= Math.ceil(r.total / 3) ? 'good' : r.rank > r.total - Math.ceil(r.total / 3) ? 'low' : 'mid') : ''));
  const dxCard = (r) => {
    const st = dxTone(r);
    return `<div class="dx ${st}"><div class="t"><b>${esc(gname(r.game))}</b>${verdict(r.acc, r.rank, r.total)}</div>
      <div class="md">${esc(modeKo(r.game, r.mode))}</div>
      ${r.acc != null ? `<div class="acc ${st}">${r.acc}<small>%</small></div><div class="bar"><i class="${st}" style="width:${Math.max(3, r.acc)}%"></i></div>`
        : `<div class="acc">${r.game === 'wizard' ? `이김 ${r.best}` : scoreText(r.game, r.best)}</div><div class="bar"></div>`}
      <dl><dt>최고 기록</dt><dd>${r.game === 'wizard' ? `이김 ${r.best}` : scoreText(r.game, r.best)}</dd><dt>진료 횟수</dt><dd>${n(r.plays)}판</dd>
        <dt>처음 → 최근</dt><dd>${r.diff == null ? '-' : r.diff > 0 ? `<span class="up">▲ ${r.diff}%p</span>` : r.diff < 0 ? `<span class="down">▼ ${-r.diff}%p</span>` : '그대로'}</dd>
        <dt>내 순위</dt><dd>${r.rank ? `${r.rank}위 / ${r.total}명` : '-'}</dd></dl></div>`;
  };
  const needRow = (x) => `<li><span class="nm"><b>${esc(x.part)}</b><small>${esc(gname(x.game))} · ${esc(x.kind)}</small></span>
    <span class="bar"><i class="${tone(x.rate)}" style="width:${Math.max(3, x.rate)}%"></i></span><span class="pc ${tone(x.rate)}">${x.rate}%</span><small class="rec">${esc(x.rec)}</small></li>`;
  const catRow = (c) => `<li><span class="nm"><b>${esc(c.cat)}</b><small>${M.game ? '' : esc(gname(c.game)) + ' · '}${n(c.tries)}문제</small></span>
    <span class="bar"><i class="${tone(c.rate)}" style="width:${Math.max(3, c.rate)}%"></i></span><span class="pc ${tone(c.rate)}">${c.rate}%</span></li>`;

  /* ── 팝업 (칸을 누르면 · 오른쪽 위 ✕ · 바깥 누르기 · Esc 로 닫기) ── */
  const PER = 5;
  function pager(id, len, per) {
    const p = (M.pg && M.pg[id]) || 0, max = Math.ceil(len / per);
    return max > 1 ? `<div class="st-pager"><button type="button" data-stpg="${id}" data-d="-1" ${p ? '' : 'disabled'}>◀ 이전</button><span>${p + 1} / ${max}</span>
      <button type="button" data-stpg="${id}" data-d="1" ${p < max - 1 ? '' : 'disabled'}>다음 ${per}개 ▶</button></div>` : '';
  }
  const slice = (id, list, per) => { const p = (M.pg && M.pg[id]) || 0; return list.slice(p * per, p * per + per); };
  function popHtml(id) {
    const R = M.R || {}, d = M.d || {}, qOk = !d._err && d.total;
    const qMsg = d._err ? (MISSING(d._err) ? '<p class="empty2">문제별 기록은 곧 시작돼요. (관리자가 Supabase 에서 <b>answers.sql</b> 을 실행하면 그다음 게임부터 쌓여요)</p>'
      : `<p class="empty2">${esc(K.KO_ERR(d._err))}</p>`) : '<p class="empty2">아직 문제별 기록이 없어요.<br>로그인한 채로 게임을 하면 문제마다 맞았는지가 쌓여요 🎮</p>';
    const noRuns = '<p class="empty2">아직 끝까지 한 게임 기록이 없어요. 로그인한 채로 한 판 끝까지 해 보세요 🎮</p>';
    const h = (t, s) => `<h4>${t}${s ? ` <small>${s}</small>` : ''}</h4>`;
    if (id === 'rx') return h('💊 처방전', '지금 하면 좋은 것') + `<ul class="rx">${(R.rx || []).map(x => `<li><span>${x.txt}</span>${x.url ? `<a class="go" href="${esc(x.url)}">▶ 처방대로 연습하기</a>` : ''}</li>`).join('')}</ul>`;
    if (id === 'dx') return h('📋 검사 결과표', '게임 · 모드별 진찰 · 💪 건강 80%↑ · 👀 관찰 60~79% · ⚠ 치료 필요 60%↓') + (R.rows ? `<div class="dx-grid">${R.rows.map(dxCard).join('')}</div>` : noRuns);
    if (id === 'need') return h('⚠ 치료가 필요한 부위', '게임 기록에서 찾은 약한 부분 · 낮은 순') + (R.parts && R.parts.length
      ? `<ul class="need">${slice('need', R.parts, PER).map(needRow).join('')}</ul>${pager('need', R.parts.length, PER)}
        <p class="note">너에게 닿기를은 근육별 맞힌 수, 딴딴/딴은 놓친 용어, 뭐라구요!? 는 스테이지별 주문 성공이에요 (못 들음은 빼요).</p>` : '<p class="empty2">아직 찾은 약한 부분이 없어요 👏</p>');
    if (id === 'cat') {
      if (!qOk) return h('🧩 부분별 정답률') + qMsg;
      const games = !M.game && d.games.length > 1 ? `<div class="bars2" style="margin-bottom:12px">${d.games.map(g => rateBar(esc(gname(g.game)), pct(g.right, g.tries), `${n(g.tries)}문제`)).join('')}</div>` : '';
      return h('🧩 부분별 정답률', '낮은 순 · 빨간 막대부터 공부해 보세요') + games + (d.cats.length ? `<ul class="need">${slice('cat', d.cats, PER).map(catRow).join('')}</ul>${pager('cat', d.cats.length, PER)}` : '<p class="empty2">묶음 기록이 아직 없어요.</p>');
    }
    if (id === 'wrong') {
      if (!qOk) return h('❗ 자주 틀린 문제') + qMsg;
      return h('❗ 반복되는 증상', '자주 틀리는 문제 · 틀린 횟수 많은 순') + (d.weak.length
        ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>문제</th>${M.game ? '' : '<th>게임</th>'}<th>부분</th><th class="num">틀림</th><th class="num">정답률</th><th>대신 고른 것</th><th>마지막</th></tr></thead><tbody>${slice('wrong', d.weak, PER).map(w => `<tr>
            <td class="st-item">${esc(w.item)}</td>${M.game ? '' : `<td>${esc(G[w.game] ? G[w.game].ko : w.game)}</td>`}<td>${esc(w.cat || '-')}</td>
            <td class="num">${n(w.wrong)} / ${n(w.tries)}</td><td class="num"><span class="st-pill ${tone(w.rate)}">${w.rate}%</span></td>
            <td class="st-item"><small>${w.last_picked ? esc(w.last_picked) : '-'}</small></td>
            <td>${w.last_ok ? '✅ 맞힘' : '❌ 틀림'} <small style="color:var(--p-dim)">${K.fmtDate(w.last_at)}</small></td></tr>`).join('')}</tbody></table></div>${pager('wrong', d.weak.length, PER)}
          <p class="note">✅ 최근엔 맞힌 문제는 거의 다 익힌 거예요. ❌ 인 문제부터 다시 보세요.</p>` : '<p class="empty2">틀린 문제가 없어요! 👏</p>');
    }
    if (id === 'pair') {
      if (!qOk) return h('🔀 자주 헷갈리는 짝') + qMsg;
      return h('🔀 자주 헷갈리는 짝', '이 문제에서 대신 고른 것') + (d.confuse.length ? `<div class="st-pairs">${d.confuse.map(c => `<div class="st-pair"><b>${esc(c.item)}</b><span class="vs">↔</span><span>${esc(c.picked)}</span>
        <small>${n(c.n)}번${M.game ? '' : ` · ${esc(G[c.game] ? G[c.game].ko : c.game)}`}</small></div>`).join('')}</div>
        <p class="note">두 개를 나란히 놓고 위치 · 모양 · 이름의 차이를 비교해 보세요.</p>` : '<p class="empty2">헷갈린 짝이 없어요 👏</p>');
    }
    if (id === 'trend') {
      if (!qOk || !(d.days || []).length) return h('📈 최근 14일 정답률') + (qOk ? '<p class="empty2">최근 14일 기록이 없어요.</p>' : qMsg);
      const maxT = Math.max(1, ...d.days.map(x => x.tries));
      return h('📈 최근 14일 정답률', '막대 높이 = 정답률 · 진할수록 그날 많이 풀었어요') + `<div class="ops-cols">${d.days.map(x => `<div class="c" title="${esc(x.day)}: ${x.rate}% (${x.tries}문제)">
        <i class="${tone(x.rate)}" style="height:${Math.max(4, x.rate)}%;opacity:${(0.45 + 0.55 * x.tries / maxT).toFixed(2)}"></i><span>${esc(x.day.slice(5).replace('-', '/'))}</span></div>`).join('')}</div>`;
    }
    if (id === 'ss') {
      if (!qOk) return h('💪 잘하는 문제 · 🐢 느린 문제') + qMsg;
      return h('💪 잘하는 문제') + (d.strong.length ? `<div class="st-chips">${d.strong.map(s => `<span class="chip update" title="${n(s.tries)}번 중 ${s.rate}%">${esc(s.item)}</span>`).join(' ')}</div>` : '<p class="note">아직 없어요.</p>')
        + h('🐢 맞혔지만 오래 걸린 문제', '내 보통 속도보다 1.5배 넘게 걸림') + (d.slow.length ? `<div class="st-chips">${d.slow.map(s => `<span class="chip" title="${n(s.n)}번 맞힘">${esc(s.item)} · ${(s.avg_ms / 1000).toFixed(1)}초 (×${s.ratio})</span>`).join(' ')}</div>
          <p class="note">맞히긴 했지만 아직 확실하지 않은 문제예요. 바로 떠오를 때까지 한 번 더!</p>` : '<p class="note">느린 문제가 없어요 👏</p>')
        + (d.no_voice ? `<p class="note">🎤 마이크가 소리를 못 들은 ${n(d.no_voice)}번은 정답률에서 뺐어요. 조용한 곳에서 크게 말해 보세요.</p>` : '');
    }
    if (id === 'days') {
      if (!R.days) return h('📅 날짜별 기록') + noRuns;
      const gi = R.gamesIn, rowsD = M.csv.slice(1);
      return h('📅 날짜별 기록', `${n(R.days.length)}일`) + `<div class="row" style="margin:0 0 8px"><button class="abtn sm pri" type="button" id="stMyCsv">⬇ 엑셀(CSV)로 내려받기</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>날짜</th>${gi.map(g => `<th class="num">${g.ic} ${esc(g.ko)}</th>`).join('')}<th class="num">합계</th><th class="num">평균 정확도</th></tr></thead>
        <tbody>${slice('days', rowsD, 7).map(row => `<tr><td class="${[0, 6].includes(new Date(row[0] + 'T00:00:00').getDay()) ? 'we' : ''}">${esc(row[0].slice(5).replace('-', '/'))} ${W[new Date(row[0] + 'T00:00:00').getDay()]}</td>
          ${row.slice(1, -2).map(v => `<td class="num">${v ? n(v) : '<span class="dim">·</span>'}</td>`).join('')}<td class="num"><b>${n(row[row.length - 2])}</b></td>
          <td class="num">${row[row.length - 1] === '' ? '-' : `<span class="st-pill ${tone(row[row.length - 1])}">${row[row.length - 1]}%</span>`}</td></tr>`).join('')}</tbody></table></div>${pager('days', rowsD.length, 7)}`;
    }
    if (id === 'info') return h('ℹ️ 어떤 기록을 모으나요?') + dataNote.replace(/<\/?details[^>]*>|<summary>.*?<\/summary>/g, '');
    return '';
  }
  function popEl() {
    let m = document.getElementById('stPop');
    if (m) return m;
    m = document.createElement('div'); m.id = 'stPop'; m.className = 'st-pop-wrap';
    m.innerHTML = '<div class="chart st-pop" role="dialog" aria-modal="true"><button class="st-x" type="button" aria-label="닫기">✕</button><div class="st-pop-body"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('.st-x')) return closePop();
      const pg = e.target.closest('[data-stpg]');
      if (pg) { M.pg[pg.dataset.stpg] = ((M.pg[pg.dataset.stpg]) || 0) + +pg.dataset.d; drawPop(); return; }
      if (e.target.closest('#stMyCsv') && M.csv) download(`samgongyuk_my_records_${K.fmtDate(new Date())}.csv`, '﻿' + M.csv.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
    });
    // Esc: 팝업만 닫고 진료 차트 창은 그대로 (account.js 의 Esc 보다 먼저 받아요)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('open')) { e.stopPropagation(); closePop(); } }, true);
    return m;
  }
  function drawPop() { const m = popEl(); m.querySelector('.st-pop-body').innerHTML = popHtml(M.pop); }
  function openPop(id) { M.pop = id; M.pg = {}; drawPop(); const m = popEl(); m.classList.add('open'); m.querySelector('.st-x').focus(); }
  function closePop() { const m = document.getElementById('stPop'); if (m) m.classList.remove('open'); M.pop = null; }

  // 칸 8개: 눌러 보기 전에 핵심 숫자가 보이게
  function tilesHtml() {
    const R = M.R || {}, d = M.d || {}, qOk = !d._err && d.total;
    const t = (id, ic, title, big, sm, cls, extra) => `<button class="st-tile" type="button" data-sttile="${id}"><span class="ti">${ic} ${title}<i>↗</i></span>
      <span class="big ${cls || ''}">${big}</span>${extra || ''}<small>${sm}</small></button>`;
    const none = (msg) => ['-', msg || '기록이 쌓이면 보여요', ''];
    const out = [];
    // 검사 결과표
    if (R.rows) { const c = { good: 0, mid: 0, low: 0 }; R.rows.forEach(r => { const s = dxTone(r); if (c[s] != null) c[s]++; });
      out.push(t('dx', '📋', '검사 결과표', `${R.rows.length}개 기록`, `💪 ${c.good} · 👀 ${c.mid} · ⚠ ${c.low}`, c.low ? 'mid' : 'good')); }
    else out.push(t('dx', '📋', '검사 결과표', ...none('게임을 끝까지 하면 생겨요')));
    // 치료가 필요한 부위
    if (R.parts && R.parts.length) out.push(t('need', '⚠', '치료가 필요한 부위', `${R.parts.length}곳`, `가장 낮음 · ${esc(R.parts[0].part)} ${R.parts[0].rate}%`, tone(R.parts[0].rate)));
    else out.push(t('need', '⚠', '치료가 필요한 부위', R.rows ? '없음 👏' : '-', R.rows ? '약한 부분을 못 찾았어요' : '기록이 쌓이면 보여요', R.rows ? 'good' : ''));
    // 부분별 정답률
    const lowCat = qOk && (d.cats.filter(c => c.tries >= 3)[0] || d.cats[0]);
    out.push(lowCat ? t('cat', '🧩', '부분별 정답률', `최저 ${lowCat.rate}%`, `${esc(lowCat.cat)}${M.game ? '' : ' · ' + esc(G[lowCat.game] ? G[lowCat.game].ko : lowCat.game)}`, tone(lowCat.rate))
      : t('cat', '🧩', '부분별 정답률', ...none()));
    // 자주 틀린 문제
    out.push(qOk ? t('wrong', '❗', '자주 틀린 문제', `${n(d.weak.length)}문제`, `❌ 아직 틀림 ${d.weak.filter(w => !w.last_ok).length}개 · 문제 정답률 ${pct(d.right, d.total)}%`, d.weak.length ? 'mid' : 'good')
      : t('wrong', '❗', '자주 틀린 문제', ...none()));
    // 헷갈리는 짝
    out.push(qOk ? t('pair', '🔀', '헷갈리는 짝', d.confuse.length ? `${d.confuse.length}쌍` : '없음 👏', d.confuse.length ? `${esc(d.confuse[0].item)} ↔ ${esc(d.confuse[0].picked)}` : '헷갈린 짝이 없어요')
      : t('pair', '🔀', '헷갈리는 짝', ...none()));
    // 최근 14일
    const dd = qOk ? (d.days || []) : [];
    if (dd.length) {
      const half = Math.ceil(dd.length / 2), a = Math.round(dd.slice(0, half).reduce((s, x) => s + x.rate, 0) / half),
        b = dd.length > half ? Math.round(dd.slice(half).reduce((s, x) => s + x.rate, 0) / (dd.length - half)) : a;
      const spark = `<span class="spark">${dd.map(x => `<i class="${tone(x.rate)}" style="height:${Math.max(10, x.rate)}%"></i>`).join('')}</span>`;
      out.push(t('trend', '📈', '최근 14일', b > a + 2 ? '▲ 오르는 중' : b < a - 2 ? '▼ 내려가는 중' : '— 그대로', `앞 ${a}% → 최근 ${b}%`, b > a + 2 ? 'good' : b < a - 2 ? 'low' : '', spark));
    } else out.push(t('trend', '📈', '최근 14일', ...none()));
    // 잘하는 · 느린
    out.push(qOk ? t('ss', '💪', '잘하는 · 느린 문제', `💪 ${d.strong.length} · 🐢 ${d.slow.length}`, '확실한 것과 아직 느린 것') : t('ss', '💪', '잘하는 · 느린 문제', ...none()));
    // 날짜별 기록
    out.push(R.days ? t('days', '📅', '날짜별 기록', `${n(R.days.length)}일`, '엑셀(CSV)로 내려받기') : t('days', '📅', '날짜별 기록', ...none()));
    return `<div class="st-tiles">${out.join('')}</div>`;
  }

  Account.addPage({
    id: 'weak', ic: '📋', label: '진료 차트', login: true,
    async render() {
      const [R, d] = await Promise.all([gameRecords(), rpc('my_weak', { p_game: M.game, p_days: M.days }).catch(e => ({ _err: e }))]);
      M.R = R; M.d = d; M.pg = {};
      const tabs = filt('wg', M.game, [[null, '전체'], ...GAMES.map(g => [g.id, `${g.ic} ${g.ko}`])]);
      const per = filt('wd', M.days, [[null, '전체 기간'], [30, '최근 30일'], [7, '최근 7일']]).replace('class="filt"', 'class="filt sm"');
      const qOk = !d._err && d.total;
      const vitals = R.rows ? `<div class="vitals st-v5">
          <div class="vital ${accTone(R.allAcc)}"><small>평균 정확도</small><b>${R.allAcc == null ? '-' : `${R.allAcc}%`}</b><span>${qOk ? `문제 정답률 ${pct(d.right, d.total)}%` : '정확도를 남기는 게임만'}</span></div>
          <div class="vital"><small>진료 횟수</small><b>${n(R.runs.length)}판</b><span>끝까지 한 판 · ${R.gamesIn.length}개 게임</span></div>
          <div class="vital"><small>최근 7일</small><b>${n(R.week)}판</b><span>내원 ${n(R.visitDays)}일째</span></div>
          <div class="vital ${R.strong ? 'good' : ''}"><small>💪 가장 건강한 부위</small><b class="sm">${R.strong ? R.label(R.strong) : '-'}</b><span>${R.strong ? `정확도 ${R.strong.acc}%` : ''}</span></div>
          <div class="vital ${R.weakest && R.weakest !== R.strong ? 'low' : ''}"><small>⚠ 치료가 가장 필요한</small><b class="sm">${R.weakest && R.weakest !== R.strong ? R.label(R.weakest) : '-'}</b><span>${R.weakest && R.weakest !== R.strong ? `정확도 ${R.weakest.acc}%` : ''}</span></div>
        </div>` : `<p class="empty2">${M.game || M.days ? '이 조건에는' : '아직'} 진료 기록이 없어요. 로그인한 채로 게임을 한 판 끝까지 하면 첫 진찰 결과가 나와요 🎮</p>`;
      const rx1 = R.rx ? `<div class="st-rx1"><span class="ic">💊</span><span class="sp"><b>오늘의 처방</b> ${R.rx[0].txt}</span>
          ${R.rx.length > 1 ? `<button class="more" type="button" data-sttile="rx">처방 ${R.rx.length - 1}개 더 ↗</button>` : ''}${R.rx[0].url ? `<a class="go" href="${esc(R.rx[0].url)}">▶ 처방대로 연습하기</a>` : ''}</div>` : '';
      return `<h2>📋 진료 차트</h2>
        <p class="sub">내 게임 기록으로 진찰한 결과예요. 아래 칸을 누르면 자세한 내용이 창으로 떠요.</p>${tabs}${per}
        <div class="chart">${R.head}${vitals}${rx1}${tilesHtml()}
          <div class="st-foot"><button type="button" data-sttile="info">ℹ️ 어떤 기록을 모으나요?</button><span>칸을 누르면 창이 떠요 · 오른쪽 위 ✕ 로 닫기</span></div></div>`;
    },
    bind() {
      const pg = K.pg;
      closePop();
      pg.querySelectorAll('[data-wg]').forEach(b => b.addEventListener('click', () => { M.game = b.dataset.wg || null; Account.page('weak'); }));
      pg.querySelectorAll('[data-wd]').forEach(b => b.addEventListener('click', () => { M.days = b.dataset.wd ? +b.dataset.wd : null; Account.page('weak'); }));
      pg.querySelectorAll('[data-sttile]').forEach(b => b.addEventListener('click', () => openPop(b.dataset.sttile)));
    },
  });

  /* ═════════ 🧑‍🎓 회원 활동 · 문항 분석 (관리자) ═════════ */
  const A = { days: 30, game: null, sort: 'plays', csv: null };

  // 관리자 전력 분석 자료(ops.js) 페이지 아래쪽에 붙는 부분 — 예전엔 따로 있던 '회원 활동 · 문항 분석' 메뉴
  window.StudyAdmin = {
    async render(days) {
      if (days) A.days = days;   // 위쪽 기간 버튼과 같은 기간
      let act, it, plays;
      try {
        [act, it, plays] = await Promise.all([rpc('admin_activity', { p_days: A.days }), rpc('admin_items', { p_game: A.game, p_days: A.days }),
          rpc('admin_plays', { p_days: A.days })]);
      }
      catch (e) { return '<hr class="st-sep">' + (MISSING(e) ? '<p class="empty2">회원별 활동 · 문항 분석은 Supabase 에서 <b>supabase/answers.sql</b> 을 한 번 실행하면 여기에 이어서 보여요.</p>' : `<p class="empty2">${esc(K.KO_ERR(e))}</p>`); }

      // 요일 × 시간 표
      const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
      act.heat.forEach(h => { heat[h.dow][h.h] = h.n; });
      const maxH = Math.max(1, ...act.heat.map(h => h.n));
      const order = [1, 2, 3, 4, 5, 6, 0];   // 월요일부터
      const heatHtml = `<div class="st-heat"><div class="hr"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hh">${h % 3 === 0 ? h : ''}</span>`).join('')}</div>
        ${order.map(d => `<div class="hr"><span class="dl ${d % 6 === 0 ? 'we' : ''}">${W[d]}</span>${heat[d].map((v, h) =>
          `<i title="${W[d]}요일 ${h}시: ${v}회" style="--a:${v ? (0.15 + 0.85 * v / maxH).toFixed(2) : 0}"></i>`).join('')}</div>`).join('')}</div>
        <div class="st-heat-lg"><span>적음</span>${[0.15, 0.36, 0.57, 0.78, 1].map(a => `<i style="--a:${a}"></i>`).join('')}<span>많음 (${n(maxH)}회)</span></div>`;
      const byHour = Array(24).fill(0); act.heat.forEach(h => { byHour[h.h] += h.n; });
      const peakH = byHour.indexOf(Math.max(...byHour));
      const byDow = Array(7).fill(0); act.heat.forEach(h => { byDow[h.dow] += h.n; });
      const peakD = byDow.indexOf(Math.max(...byDow));

      // 회원 표
      const active = act.users.filter(u => u.plays || u.answers || u.runs);
      const sorters = { plays: (a, b) => b.plays - a.plays, rate: (a, b) => (a.rate ?? 101) - (b.rate ?? 101), days: (a, b) => b.active_days - a.active_days, mins: (a, b) => b.minutes - a.minutes, seen: (a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')) };
      const users = act.users.slice().sort(sorters[A.sort] || sorters.plays);
      act.users.forEach(u => { if (!u.by_game) return; const m = {}; Object.entries(u.by_game).forEach(([g, c]) => { const k = ALIAS2[g] || g; m[k] = (m[k] || 0) + c; }); u.by_game = m; });
      const gameCols = [...new Set(act.users.flatMap(u => Object.keys(u.by_game || {})))];
      const GCOL = { '딴딴/딴': '#338ced', '너에게 닿기를': '#e76624', 'LandMark': '#00a888', '뭐라구요!? 안들려요': '#d28e05',
        '사랑하는 그대에게 기대세요': '#e24d8b', '말해 YES OR NO': '#0aac23', '시그널 슬래시': '#9887ef' };
      const gcol = (g) => GCOL[g] || '#8a86a3';
      const mini = (bg) => { const e = Object.entries(bg || {}).sort((a, b) => b[1] - a[1]), t = e.reduce((a, x) => a + x[1], 0);
        return t ? `<span class="st-mini" title="${esc(e.map(([g, c]) => `${g} ${c}`).join(' · '))}">${e.map(([g, c]) => `<i style="width:${(c / t * 100).toFixed(1)}%;background:${gcol(g)}"></i>`).join('')}</span>` : '-'; };
      const legend = gameCols.map(g => `<span><i style="background:${gcol(g)}"></i>${esc(g)}</span>`).join('');
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
          <p class="note">막대가 높은 곳 = 많이 그만둔 구간</p>`
        : '<p class="empty2">아직 기록이 없어요. (로그인한 회원이 게임에서 문제를 풀면 쌓여요)</p>';
      const sortBtn = (k, l) => `<button type="button" data-as="${k}" class="${A.sort === k ? 'on' : ''}">${l}</button>`;
      const per = filt('ad', A.days, [[7, '7일'], [14, '14일'], [30, '30일'], [90, '90일'], [365, '1년']]);
      const tabs = filt('ag', A.game, [[null, '전체'], ...GAMES.map(g => [g.id, `${g.ic} ${g.ko}`])]);

      return `<hr class="st-sep">
        <div class="row"><span class="st-hint" style="margin:0">👥 회원 · 📝 문항 (최근 ${act.days}일)</span>
          <span class="spacer"></span><button class="abtn sm pri" type="button" id="stCsv">⬇ 회원 활동 엑셀(CSV)</button></div>

        <div class="kpis" style="margin-top:12px">
          <div class="kpi c1"><small>활동한 회원</small><b>${n(active.length)}</b><span>전체 회원 ${n(act.users.length)}명 중</span></div>
          <div class="kpi c3"><small>가장 붐비는 때</small><b style="font-size:22px">${act.heat.length ? `${W[peakD]}요일 · ${peakH}시` : '-'}</b><span>게임 실행 기준</span></div>
          <div class="kpi c2"><small>푼 문제 (전체 회원)</small><b>${n(it.total)}</b><span>정답률 ${pct(it.right, it.total)}% · ${n(it.users)}명</span></div>
          <div class="kpi c4"><small>한 번 오면 머무는 시간</small><b>${ses.median_min == null ? '-' : `${ses.median_min}분`}</b><span>가운데값 · 평균 ${ses.avg_min ?? '-'}분 · ${n(ses.count || 0)}번 방문</span></div>
          <div class="kpi c1"><small>7일 안에 다시 온 회원</small><b>${backRate == null ? '-' : `${backRate}%`}</b><span>이 기간 처음 온 회원 ${n(ret.new || 0)}명 중 ${n(ret.back7 || 0)}명</span></div>
        </div>

        <h3>🗓 요일 × 시간 (게임 실행 수)</h3>
        ${act.heat.length ? heatHtml
          : '<p class="empty2">이 기간에는 게임 실행 기록이 없어요.</p>'}

        <div class="two">
          <div><h3>⏱ 한 번에 머무는 시간</h3>
            ${ses.count ? `<div class="bars2">${Object.keys(bucketLab).map(k => outBar(bucketLab[k], (bk[k] || 0) / maxB * 100, `${n(bk[k] || 0)}번`)).join('')}</div>`
              : '<p class="empty2">아직 기록이 없어요. (창을 닫고 10분 뒤에 쌓여요)</p>'}</div>
          <div><h3>📄 화면별 평균 머문 시간</h3>
            <div class="bars2">${(act.session_pages || []).slice(0, 8).map(pg2 => { const mx = Math.max(1, ...act.session_pages.map(x => x.avg_min));
              return outBar(esc(pg2.page || '?'), pg2.avg_min / mx * 100, `${pg2.avg_min}분`, `${n(pg2.n)}번`); }).join('')
              || '<p class="empty2">아직 기록이 없어요.</p>'}</div></div>
        </div>

        <h3>🏁 게임별 끝까지 한 비율 · 어디서 그만두나</h3>
        ${playsHtml}

        <h3 id="sec-members">👥 회원별 활동</h3>
        <div class="filt sm">${sortBtn('plays', '많이 한 순')}${sortBtn('days', '자주 온 순')}${sortBtn('mins', '오래 머문 순')}${sortBtn('rate', '정답률 낮은 순')}${sortBtn('seen', '최근 접속 순')}</div>
        ${legend ? `<div class="st-legend">${legend}</div>` : ''}
        <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>이름</th><th>학번 · 학년</th><th class="num">게임 실행</th><th style="min-width:150px">게임별 (색)</th>
          <th class="num">활동한 날</th><th class="num">머문 시간</th><th class="num">정답률</th><th>최근 접속</th></tr></thead>
          <tbody>${users.map(u => `<tr${u.plays || u.answers || u.runs ? '' : ' class="st-idle"'}>
            <td><b>${esc(u.name)}</b>${u.kind === 'admin' ? ' <span class="tag admin">관리자</span>' : ''}</td>
            <td>${esc(u.login_id)}${u.kind === 'admin' ? '' : ` · ${u.grade}학년`}</td><td class="num">${n(u.plays)}</td><td>${mini(u.by_game)}</td>
            <td class="num">${n(u.active_days)}일</td><td class="num">${u.minutes ? `${n(u.minutes)}분` : '-'}</td>
            <td class="num" title="푼 문제 ${n(u.answers)}개">${u.rate == null ? '-' : `<span class="st-pill ${tone(u.rate)}">${u.rate}%</span>`}</td>
            <td>${u.last_seen_at ? K.fmtDate(u.last_seen_at, true) : '-'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty2">회원이 없어요.</td></tr>'}</tbody></table></div>
        <p class="note">흐린 줄 = 이 기간 활동 없음 · 주로 하는 시간 · 끝까지 한 판 · 푼 문제는 엑셀(CSV)에 있어요</p>

        <h3 id="sec-items">📝 문항 분석 · 회원들이 자주 틀리는 문제</h3>
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
`
          : '<p class="empty2">아직 3번 넘게 풀린 문제가 없어요.</p>'}

        <h3>🔀 회원들이 자주 헷갈리는 짝 TOP 20</h3>
        ${it.confuse.length ? (() => { const mx = Math.max(1, ...it.confuse.map(c => c.n));
          return `<div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>문제 (정답)</th><th></th><th>대신 고른 것</th>${A.game ? '' : '<th>게임</th>'}<th style="min-width:120px">횟수</th><th class="num">회원</th></tr></thead>
          <tbody>${it.confuse.map(c => `<tr><td class="st-item"><span class="st-clamp">${esc(c.item)}</span></td><td class="st-vs">↔</td><td class="st-item"><span class="st-clamp">${esc(c.picked)}</span></td>
            ${A.game ? '' : `<td>${esc(G[c.game] ? G[c.game].ko : c.game)}</td>`}
            <td><span class="st-hbar"><i style="width:${(c.n / mx * 100).toFixed(1)}%"></i><b>${n(c.n)}번</b></span></td><td class="num">${n(c.users)}</td></tr>`).join('')}</tbody></table></div>`; })()
          : '<p class="empty2">아직 기록이 없어요.</p>'}

        ${!A.game || A.game === 'wizard' ? `<h3>🎤 음성 인식 점검 (뭐라구요!?)</h3>
          ${(() => { const w = it.games.find(g => g.game === 'wizard');
            return `<p class="sub" style="margin-top:0">🎤 못 들음 <b>${n(w ? w.no_voice : 0)}번</b> (정답률에서 뺌) · 아래 표 = 틀렸을 때 들린 말</p>`; })()}
          ${it.voice.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>정답 용어</th><th>들린 말</th><th class="num">횟수</th></tr></thead><tbody>${it.voice.map(v =>
            `<tr><td>${esc(v.item)}</td><td>“${esc(v.heard)}”</td><td class="num">${n(v.n)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty2">아직 기록이 없어요.</p>'}` : ''}`;
    },
    bind() {
      const pg = K.pg;
      pg.querySelectorAll('[data-ag]').forEach(b => b.addEventListener('click', () => { A.game = b.dataset.ag || null; Account.page('data'); }));
      pg.querySelectorAll('[data-as]').forEach(b => b.addEventListener('click', () => { A.sort = b.dataset.as; Account.page('data'); }));
      const c = pg.querySelector('#stCsv');
      if (c) c.addEventListener('click', () => {
        if (!A.csv) return;
        download(`samgongyuk_members_${K.fmtDate(new Date())}_${A.days}d.csv`, '﻿' + A.csv.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
      });
    },
  };
})();
