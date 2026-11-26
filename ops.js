/* 삼공육 part3 — 데이터베이스 관리 (2026-11-18)
 *   🏆 랭킹               누구나        게임·모드별 랭킹 + 종합 랭킹, 기간(전체·7일·30일)
 *   🗂 관리자 전력 분석 자료 (예전 이름: 데이터 관리)  관리자        날짜 × 콘텐츠 표, 시간대·학년별, 지금 접속자, CSV 내려받기
 *   🛠 서버 점검 · 백업    관리자        매일 보고서, 지금 점검, 자동 백업(동시 접속 기준) · 지금 백업 · 내려받기
 *
 *  ☰ 사이드바(account.js)에 Account.addPage 로 붙어요. 허브(highgo.html)에서 account.js 다음에 불러요.
 *  DB: supabase/ops.sql 을 Supabase SQL Editor 에서 한 번 실행해야 열려요 (안 돌렸으면 "준비 중" 안내만 보여요).
 */
(function () {
  if (!window.Account || !Account.addPage) return;
  const K = Account.kit, sb = K.sb, esc = K.esc, n = K.n;

  const GAMES = [
    { id: 'landmark', ko: 'LandMark', ic: '🎯' },
    { id: 'ddan', ko: '딴딴/딴', ic: '🎤' },
    { id: 'neoege', ko: '너에게 닿기를', ic: '💘' },
    { id: 'wizard', ko: '뭐라구요!?', ic: '🧙' },
    { id: 'golf', ko: '사랑하는 그대에게 기대세요', ic: '⛳' },
  ];
  const DIFF = { easy: '쉬움', normal: '보통', medium: '보통', hard: '어려움' };
  const REGION = { arm: '어깨·위팔', forearm: '아래팔', hip: '엉덩이·넙다리', leg: '종아리·발' };
  const modeKo = (game, m) => {
    if (!m) return '기본';
    if (game === 'neoege') { const [r, d] = m.split(':'); return `${REGION[r] || r}${d ? ' · ' + (DIFF[d] || d) : ''}`; }
    return DIFF[m] || m;
  };
  const MISSING = (e) => /PGRST202|42883|Could not find the function/i.test(`${e && e.code} ${e && e.message}`);
  const missingMsg = '<p class="empty2">아직 준비 중이에요.<br>관리자가 Supabase SQL Editor 에서 <b>supabase/ops.sql</b> 을 한 번 실행하면 열려요.</p>';
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  const medal = (r) => ['🥇', '🥈', '🥉'][r - 1] || r;
  const mb = (b) => { const x = Number(b || 0); return x < 1048576 ? `${Math.max(1, Math.round(x / 1024))} KB` : `${(x / 1048576).toFixed(1)} MB`; };
  const W = ['일', '월', '화', '수', '목', '금', '토'];
  const dow = (day) => new Date(day + 'T00:00:00').getDay();
  const dayLab = (day) => `${day.slice(5).replace('-', '/')} ${W[dow(day)]}`;
  const errBox = (e, title) => `<h2>${title}</h2>` + (MISSING(e) ? missingMsg : `<p class="empty2">${esc(K.KO_ERR(e))}</p>`);

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCSV = (rows) => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');   // BOM: 엑셀에서 한글이 안 깨지게
  const bar = (label, v, max, unit, extra) =>   // 숫자는 막대 밖 오른쪽에 (막대 색 위 글씨는 잘 안 보여서)
    `<div class="bar2 out"><span class="lab">${label}</span><div class="track"><div class="fill" style="width:${Math.max(1, v / Math.max(1, max) * 100).toFixed(1)}%"></div></div>
      <span class="v"><b>${n(v)}${unit}</b>${extra ? `<i>${extra}</i>` : ''}</span></div>`;
  const cols = (arr, val, label, tip) => {
    const mx = Math.max(1, ...arr.map(val));
    return `<div class="ops-cols">${arr.map(x => `<div class="c" title="${esc(tip(x))}"><i style="height:${(val(x) / mx * 100).toFixed(1)}%"></i><span>${esc(label(x))}</span></div>`).join('')}</div>`;
  };

  /* ═════════ 🏆 랭킹 (누구나) ═════════ */
  const R = { tab: 'overall', period: 'week', mode: {} };   // 기간: day 일일 · week 주간 · month 월별 · all 전체
  const PERIODS = [['all', '🏆 전체'], ['day', '📅 일일'], ['week', '🗓 주간'], ['month', '📆 월별']];
  const PERIOD_KO = { day: '일일', week: '주간', month: '월별', all: '전체' };
  const periodLine = (r) => {
    const t = SamAuth.periodText(R.period);
    return `<p class="ops-period">${esc(PERIOD_KO[R.period])} 순위 · ${esc(t.range)}${t.left ? ` · 새로 시작까지 <b>${esc(t.left)}</b>` : ''}
      ${r && r._approx ? `<br><small>지금은 최근 ${R.period === 'day' ? 1 : R.period === 'week' ? 7 : 30}일 기록으로 보여요 (관리자가 answers.sql 을 실행하면 정확한 기간으로 바뀌어요)</small>` : ''}</p>`;
  };

  function myLine(rank, total, extra) {
    if (!K.me()) return `<p class="ops-my">로그인하면 내 순위가 보여요 · 지금 ${n(total)}명 참여</p>`;
    return rank
      ? `<p class="ops-my">내 순위 <b>${n(rank)}위</b> / ${n(total)}명${extra ? ` · ${extra}` : ''}</p>`
      : `<p class="ops-my">아직 이 랭킹에 내 기록이 없어요 · ${n(total)}명 참여</p>`;
  }
  // 🏆 시상대 (모양은 허브 highgo.html 의 .podium 스타일) — 왼쪽 2위 · 가운데 1위 · 오른쪽 3위
  // 내 기록 카드 (모양 · 내용은 허브 highgo.html 의 rankMineCard)
  const mineCard = (r, kind) => (window.rankMineCard
    ? window.rankMineCard(r, kind, { day: '오늘은', week: '이번 주에는', month: '이번 달에는', all: '' }[R.period] || '')
    : myLine(r.myRank, r.total, ''));
  const trophy = (place) => (window.rankTrophy ? window.rankTrophy(place) : `<span class="face">${['🥇', '🥈', '🥉'][place - 1]}</span>`);
  const podium = (top, val, sub) => {
    if (!top.length) return '';
    const slot = (t, place) => t
      ? `<div class="pod p${place}${t.me ? ' me' : ''}">${trophy(place)}<span class="nm">${esc(t.nickname)}${t.me ? ' (나)' : ''}</span>
          <span class="pt">${val(t)}</span><span class="sub">${sub(t)}</span><div class="step">${place}</div></div>`
      : `<div class="pod p${place} empty">${trophy(place)}<span class="nm">도전!</span><span class="pt">&nbsp;</span><span class="sub">비어 있어요</span><div class="step">${place}</div></div>`;
    return `<div class="podium ops-podium">${slot(top[1], 2)}${slot(top[0], 1)}${slot(top[2], 3)}</div>`;
  };
  const who = (t) => `${esc(t.nickname)}${t.me ? ' <span class="chip update">나</span>' : ''}`;

  async function overallHtml() {
    const r = await SamAuth.rankPeriod('overall', { p_limit: 50 }, R.period);
    const rows = r.top.map(t => `<tr class="${t.me ? 'me' : ''}"><td class="rk">${medal(t.rank)}</td><td>${who(t)}</td>
      <td class="num">${n(t.points)}</td><td class="num">${t.games}</td><td class="num">${t.boards}</td><td class="num">${n(t.plays)}</td></tr>`).join('');
    return `${periodLine(r)}${mineCard(r, 'overall')}${podium(r.top, t => `${n(t.points)}<small>점</small>`, t => `게임 ${t.games}개 · ${n(t.plays)}판`)}
      <div class="tbl-wrap"><table class="tbl ops-rank"><thead><tr><th>순위</th><th>이름</th><th class="num">종합 점수</th><th class="num">게임</th><th class="num">종목</th><th class="num">판 수</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="empty2">${R.period !== 'all' ? `이번 ${PERIOD_KO[R.period]} 순위는 아직 비어 있어요. 지금 한 판 하면 1등! 🏆` : '아직 기록이 없어요. 로그인하고 게임을 끝까지 해 보세요!'}</td></tr>`}</tbody></table></div>
      <p class="note">종합 점수 = 게임·난이도(종목)마다 내 최고 기록이 상위 몇 %인지를 점수로 바꿔서 더한 값이에요 (1등 100점, 참여만 해도 점수가 있어요). 여러 게임을 골고루 할수록 올라가요.</p>`;
  }

  async function boardHtml(game) {
    const modes = await rpc('ranking_modes', { p_game: game });
    if (!modes.length) return '<p class="empty2">아직 이 게임의 기록이 없어요. 로그인하고 끝까지 해 보세요!</p>';
    if (!modes.some(m => m.mode === R.mode[game])) R.mode[game] = modes[0].mode;
    const mode = R.mode[game];
    const r = await SamAuth.rankPeriod('board', { p_game: game, p_mode: mode, p_limit: 50 }, R.period);
    const sel = `<label class="ops-sel">난이도 · 맵 <select data-rm>${modes.map(m =>
      `<option value="${esc(m.mode)}" ${m.mode === mode ? 'selected' : ''}>${esc(modeKo(game, m.mode))} (${n(m.players)}명)</option>`).join('')}</select></label>`;
    const rows = r.top.map(t => `<tr class="${t.me ? 'me' : ''}"><td class="rk">${medal(t.rank)}</td><td>${who(t)}</td>
      <td class="num">${n(t.score)}</td><td class="num">${t.accuracy == null ? '-' : Math.round(t.accuracy) + '%'}</td><td>${K.fmtDate(t.at)}</td></tr>`).join('');
    return `<div class="row">${sel}</div>${periodLine(r)}${mineCard(r, 'board')}${podium(r.top, t => n(t.score), t => (t.accuracy == null ? K.fmtDate(t.at) : `정확도 ${Math.round(t.accuracy)}%`))}
      <div class="tbl-wrap"><table class="tbl ops-rank"><thead><tr><th>순위</th><th>이름</th><th class="num">최고 점수</th><th class="num">정확도</th><th>날짜</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="empty2">${R.period !== 'all' ? `이번 ${PERIOD_KO[R.period]} 순위는 아직 비어 있어요. 지금 한 판 하면 1등! 🏆` : '아직 기록이 없어요.'}</td></tr>`}</tbody></table></div>
      ${game === 'wizard' ? '<p class="note">뭐라구요!? 는 몬스터마다 이기면 1점으로 기록돼요.</p>' : ''}`;
  }

  Account.addPage({
    id: 'rank', ic: '🏆', label: '순위',
    async render() {
      const tabs = [{ id: 'overall', ko: '종합', ic: '👑' }, ...GAMES]
        .map(t => `<button type="button" data-rt="${t.id}" class="${R.tab === t.id ? 'on' : ''}">${t.ic} ${esc(t.ko)}</button>`).join('');
      const per = PERIODS.map(([d, l]) => `<button type="button" data-rd="${d}" class="${R.period === d ? 'on' : ''}">${l}</button>`).join('');
      let body;
      try { body = R.tab === 'overall' ? await overallHtml() : await boardHtml(R.tab); }
      catch (e) { body = MISSING(e) ? missingMsg : `<p class="empty2">${esc(K.KO_ERR(e))}</p>`; }
      return `<h2>🏆 순위</h2>
        <p class="sub">로그인한 회원이 게임을 끝까지 한 기록으로 순위를 매겨요. 일일 · 주간 · 월별 순위는 기간이 바뀌면 새로 시작해요 (한국 시간). 이름은 가운데를 가려서 보여요.</p>
        <div class="filt">${per}</div><div class="filt sm">${tabs}</div>${body}`;
    },
    bind() {
      const pg = K.pg;
      pg.querySelectorAll('[data-rt]').forEach(b => b.addEventListener('click', () => { R.tab = b.dataset.rt; Account.page('rank'); }));
      pg.querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', () => { R.period = b.dataset.rd; Account.page('rank'); }));
      const s = pg.querySelector('[data-rm]');
      if (s) s.addEventListener('change', () => { R.mode[R.tab] = s.value; Account.page('rank'); });
    },
  });

  /* 날짜별 게임 실행 그래프 — 쌓은 막대 (게임마다 고정 색) + 허브 방문 선. dataviz 규칙:
   * 색은 게임에 고정(순위 X), 8색 안에서만, 나머지는 기타(회색). 축 하나. 범례 + 마우스 올리면 툴팁. 90일 넘으면 주 단위로 묶어요. */
  const SERIES = [   // 다크 배경용 범주 색 (validate_palette.js 통과: 이 화면 배경 #160632 기준)
    ['딴딴/딴', '#338ced'], ['너에게 닿기를', '#e76624'], ['LandMark', '#00a888'], ['뭐라구요!? 안들려요', '#d28e05'],
    ['사랑하는 그대에게 기대세요', '#e24d8b'], ['말해 YES OR NO', '#0aac23'], ['시그널 슬래시', '#9887ef'],
  ];
  const ALIAS = { '롱드라이브': '사랑하는 그대에게 기대세요', '뭐라구요!?': '뭐라구요!? 안들려요' };   // 이름이 바뀐 게임은 하나로
  const OTHER = ['기타', '#8a86a3'];
  function usageChart(s, games, cell) {
    let days = s.daily.map(d => d.day);
    if (!days.length) return '<p class="empty2">아직 기록이 없어요.</p>';
    const keyOf = (g) => { const t = ALIAS[g] || g; return SERIES.some(x => x[0] === t) ? t : '기타'; };
    const keys = [...SERIES.map(x => x[0]).filter(k => games.some(g => keyOf(g) === k)), ...(games.some(g => keyOf(g) === '기타') ? ['기타'] : [])];
    const color = (k) => (SERIES.find(x => x[0] === k) || OTHER)[1];
    // 90일 넘으면 주 단위로
    const weekly = days.length > 90;
    const buckets = [];
    days.forEach((day, i) => {
      const b = weekly ? Math.floor(i / 7) : i;
      if (!buckets[b]) buckets[b] = { from: day, to: day, v: {}, hub: 0 };
      const B = buckets[b]; B.to = day;
      games.forEach(g => { const k = keyOf(g); B.v[k] = (B.v[k] || 0) + (cell[day + '|' + g] || 0); });
      B.hub += cell[day + '|hub'] || 0;
    });
    buckets.forEach(B => { B.total = keys.reduce((a, k) => a + (B.v[k] || 0), 0); });
    const maxV = Math.max(1, ...buckets.map(B => Math.max(B.total, B.hub)));
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(x => maxV / x <= 5) || 2000;
    const top = Math.ceil(maxV / step) * step;
    const W = 1000, H = 260, L = 34, R = 8, T = 10, B = 26, iw = W - L - R, ih = H - T - B;
    const band = iw / buckets.length, bw = Math.max(2, Math.min(30, band * 0.68));
    const y = (v) => T + ih - (v / top) * ih;
    let svg = '';
    for (let v = 0; v <= top; v += step) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g${v ? '' : ' base'}"/><text x="${L - 6}" y="${y(v) + 4}" class="yt">${v}</text>`;
    const lab = (B) => { const d = B.from.slice(5).replace('-', '/'); return weekly ? `${d}~` : d; };
    const every = Math.ceil(buckets.length / 12);
    buckets.forEach((Bk, i) => {
      const cx = L + band * i + band / 2, x = cx - bw / 2;
      let acc = 0; const segs = keys.filter(k => Bk.v[k]);
      segs.forEach((k, j) => {
        const v = Bk.v[k], y0 = y(acc), y1 = y(acc + v), h = Math.max(0, y0 - y1);
        if (j === segs.length - 1 && h > 4) {   // 맨 위 칸만 위쪽 모서리 둥글게
          svg += `<path d="M${x},${y0} V${y1 + 4} Q${x},${y1} ${x + 4},${y1} H${x + bw - 4} Q${x + bw},${y1} ${x + bw},${y1 + 4} V${y0} Z" fill="${color(k)}" class="seg"/>`;
        } else svg += `<rect x="${x}" y="${y1}" width="${bw}" height="${h}" fill="${color(k)}" class="seg"/>`;
        acc += v;
      });
      if (i % every === 0 || i === buckets.length - 1) svg += `<text x="${cx}" y="${H - 8}" class="xt">${esc(lab(Bk))}</text>`;
      svg += `<rect x="${L + band * i}" y="${T}" width="${band}" height="${ih}" class="hit" data-i="${i}"/>`;
    });
    const pts = buckets.map((Bk, i) => `${(L + band * i + band / 2).toFixed(1)},${y(Bk.hub).toFixed(1)}`).join(' ');
    svg += `<polyline points="${pts}" class="hub"/>`;
    D.chart = { buckets, keys, color, weekly };
    return `<div class="ops-chart" id="opsChart">
      <div class="lg">${keys.map(k => `<span><i style="background:${color(k)}"></i>${esc(k)}</span>`).join('')}<span><i class="hubk"></i>허브 방문 (선)</span></div>
      <div class="plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="날짜별 게임 실행 쌓은 막대 그래프">${svg}</svg><div class="tip" hidden></div></div>
      ${weekly ? '<p class="note">기간이 길어서 7일씩 묶어 보여 줘요.</p>' : ''}</div>`;
  }
  function bindUsageChart() {
    const box = K.pg.querySelector('#opsChart'); if (!box || !D.chart) return;
    const tip = box.querySelector('.tip'), plot = box.querySelector('.plot'), { buckets, keys, color, weekly } = D.chart;
    const hide = () => { tip.hidden = true; box.querySelectorAll('.hit.on').forEach(h => h.classList.remove('on')); };
    box.querySelectorAll('.hit').forEach(h => {
      const show = () => {
        const Bk = buckets[+h.dataset.i]; box.querySelectorAll('.hit.on').forEach(x => x.classList.remove('on')); h.classList.add('on');
        const rows = keys.filter(k => Bk.v[k]).sort((a, b) => Bk.v[b] - Bk.v[a]);
        tip.innerHTML = `<b>${weekly ? `${esc(Bk.from)} ~ ${esc(Bk.to)}` : `${esc(dayLab(Bk.from))}`}</b>
          <div class="r tot"><span>게임 실행 합계</span><b>${n(Bk.total)}회</b></div>
          ${rows.map(k => `<div class="r"><span><i style="background:${color(k)}"></i>${esc(k)}</span><b>${n(Bk.v[k])}</b></div>`).join('') || '<div class="r"><span>게임 실행 없음</span></div>'}
          <div class="r hubr"><span><i class="hubk"></i>허브 방문</span><b>${n(Bk.hub)}</b></div>`;
        tip.hidden = false;
        const pr = plot.getBoundingClientRect(), hr = h.getBoundingClientRect();
        const left = hr.left - pr.left + hr.width / 2;
        tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), pr.width - tip.offsetWidth) + 'px';
      };
      h.addEventListener('mouseenter', show); h.addEventListener('click', show);
    });
    plot.addEventListener('mouseleave', hide);
  }

  /* ═════════ 🗂 관리자 전력 분석 자료 (관리자, 예전 이름: 데이터 관리) ═════════ */
  const D = { days: 30, csv: null };

  Account.addPage({
    id: 'data', ic: '🗂', label: '관리자 전력 분석 자료', admin: true,
    async render() {
      let s;
      try { s = await rpc('admin_data', { p_days: D.days }); } catch (e) { return errBox(e, '🗂 관리자 전력 분석 자료'); }
      // 이름이 바뀐 게임은 하나로 (롱드라이브 → 사랑하는 그대에게 기대세요)
      const alias = (g) => ALIAS[g] || g, mergedC = new Map(), mergedM = new Map();
      s.contents.forEach(c => { const k = alias(c.game), o = mergedC.get(k) || { game: k, plays: 0, users: 0 }; o.plays += c.plays; o.users = Math.max(o.users, c.users); mergedC.set(k, o); });
      s.matrix.forEach(m => { const k = m.day + '|' + alias(m.game), o = mergedM.get(k) || { day: m.day, game: alias(m.game), plays: 0 }; o.plays += m.plays; mergedM.set(k, o); });
      s.contents = [...mergedC.values()].sort((a, b) => b.plays - a.plays); s.matrix = [...mergedM.values()];
      const tot = Object.fromEntries(s.contents.map(c => [c.game, c]));
      const games = s.contents.filter(c => c.game !== 'hub').map(c => c.game);
      const cell = {};
      s.matrix.forEach(m => { cell[m.day + '|' + m.game] = m.plays; });
      const daily = [...s.daily].reverse();   // 최근 날짜가 위
      const sum = (k) => s.daily.reduce((a, d) => a + Number(d[k] || 0), 0);
      const peakAll = Math.max(0, ...s.daily.map(d => d.peak));
      const L = s.live;

      // 표 (화면 + CSV 같은 내용)
      const head = ['날짜', '허브 방문', ...games, '게임 합계', '로그인 회원', '새 회원', '게임 기록', '최대 동시 접속'];
      const rowOf = (d) => [d.day, cell[d.day + '|hub'] || 0, ...games.map(g => cell[d.day + '|' + g] || 0), d.plays, d.users, d.joins, d.runs, d.peak];
      const sumRow = ['합계', tot.hub ? tot.hub.plays : 0, ...games.map(g => tot[g].plays), sum('plays'), '-', sum('joins'), sum('runs'), peakAll];
      D.csv = { name: `samgongyuk_usage_${s.from}_${s.to}.csv`, rows: [head, ...daily.map(rowOf), sumRow] };

      const tr = (d) => `<tr><td class="${dow(d.day) % 6 === 0 ? 'we' : ''}">${dayLab(d.day)}</td>${rowOf(d).slice(1).map((v, i) =>
        `<td class="num">${!v ? '<span class="z">·</span>' : i === games.length + 1 ? `<b>${n(v)}</b>` : n(v)}</td>`).join('')}</tr>`;
      const per = [7, 14, 30, 90, 365].map(d => `<button type="button" data-dd="${d}" class="${D.days === d ? 'on' : ''}">${d === 365 ? '1년' : `${d}일`}</button>`).join('');
      const maxC = Math.max(1, ...games.map(g => tot[g].plays));
      const maxG = Math.max(1, ...s.grades.map(g => g.users));

      return `<h2>🗂 관리자 전력 분석 자료</h2>
        <p class="sub">이용자 현황을 날짜별 · 콘텐츠별로 모아 봐요. ${s.from} ~ ${s.to} (한국 시간) · 불러온 시각 ${K.fmtDate(new Date(), true)}</p>
        <div class="row"><div class="filt" style="margin:0">${per}</div><span class="spacer"></span>
          <button class="abtn sm" type="button" id="opsReload">↻ 새로고침</button>
          <button class="abtn sm pri" type="button" id="opsCsv">⬇ 엑셀(CSV) 내려받기</button></div>

        <div class="kpis" style="margin-top:14px">
          <div class="kpi c1"><small>🟢 지금 접속 중</small><b>${n(L.now)}</b><span>그중 로그인 회원 ${n(L.users)}명 · 최근 2분</span></div>
          <div class="kpi c3"><small>오늘 최대 동시 접속</small><b>${n(L.peak_today)}</b><span>자동 백업 기준 ${n(L.threshold)}명</span></div>
          <div class="kpi c2"><small>기간 게임 실행</small><b>${n(sum('plays'))}</b><span>허브 방문 ${n(tot.hub ? tot.hub.plays : 0)}회</span></div>
          <div class="kpi c4"><small>기간 새 회원 · 게임 기록</small><b>${n(sum('joins'))}</b><span>끝까지 한 판 ${n(sum('runs'))}개</span></div>
        </div>
        ${L.pages.length ? `<p class="note">지금 보고 있는 화면: ${L.pages.map(p => `<span class="chip">${esc(p.page || '?')} ${n(p.n)}</span>`).join(' ')}</p>` : ''}

        <nav class="ops-toc" aria-label="바로 가기">${[['sec-day', '📊 날짜별'], ['sec-content', '🕹 콘텐츠 · 학년'], ['sec-time', '🕘 시간대'], ['sec-runs', '🏁 게임 기록'],
          ['sec-members', '👥 회원'], ['sec-items', '📝 문항']].map(([id, t]) => `<button type="button" data-goto="${id}">${t}</button>`).join('')}</nav>
        <h3 id="sec-day">📊 날짜별 게임 실행 <small class="st-hint">막대에 마우스를 올리면 게임별 숫자</small></h3>
        ${usageChart(s, games, cell)}

        <details class="ops-more"><summary>📅 날짜 × 콘텐츠 표로 보기 <small>그래프와 같은 숫자 · 엑셀로도 받을 수 있어요</small></summary>
        <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${daily.map(tr).join('')}</tbody>
          <tfoot><tr class="sum">${sumRow.map((v, i) => `<td class="${i ? 'num' : ''}">${typeof v === 'number' ? n(v) : esc(v)}</td>`).join('')}</tr></tfoot></table></div></details>


        <div class="two">
          <div><h3 id="sec-content">🕹 콘텐츠별 (기간 합계)</h3>
            <div class="bars2">${games.map(g => bar(`<span class="lab" style="width:auto">${esc(g)}</span>`, tot[g].plays, maxC, '회', tot[g].users ? `👤 ${n(tot[g].users)}명` : '')).join('')
              || '<p class="empty2">아직 게임 실행 기록이 없어요.</p>'}</div></div>
          <div><h3>🎓 학년별 (로그인 회원)</h3>
            <div class="bars2">${s.grades.map(g => bar(`<span class="lab">${esc(g.label)}</span>`, g.users, maxG, '명', `게임 ${n(g.plays)}회`)).join('')
              || '<p class="empty2">로그인한 회원의 기록이 아직 없어요.</p>'}</div></div>
        </div>

        <div class="two">
          <div><h3 id="sec-time">🕘 시간대별 게임 실행</h3>
            ${cols(s.hours, x => x.plays, x => (x.h % 3 === 0 ? String(x.h) : ''), x => `${x.h}시: ${x.plays}회`)}</div>
          <div><h3>📶 최근 24시간 동시 접속 (1시간 최대)</h3>
            ${L.last24.length ? cols(L.last24, x => x.live, x => x.h.slice(-2), x => `${x.h}시: ${x.live}명`)
              : '<p class="empty2">아직 기록이 없어요. (5분마다 자동으로 재요 — 서버 점검 화면에서 자동 작업이 켜져 있는지 확인)</p>'}</div>
        </div>

        <h3 id="sec-runs">🏁 게임 기록 (점수 저장된 판)</h3>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>게임</th><th class="num">판 수</th><th class="num">플레이한 회원</th><th class="num">최고 점수</th><th class="num">평균 정확도</th></tr></thead>
          <tbody>${s.runs.map(r => `<tr><td>${esc((GAMES.find(g => g.id === r.game) || {}).ko || r.game)}</td><td class="num">${n(r.runs)}</td><td class="num">${n(r.players)}</td>
            <td class="num">${n(r.best)}</td><td class="num">${r.avg_acc == null ? '-' : r.avg_acc + '%'}</td></tr>`).join('')
            || '<tr><td colspan="5" class="empty2">이 기간에는 기록이 없어요.</td></tr>'}</tbody></table></div>
        ${window.StudyAdmin ? await window.StudyAdmin.render(D.days).catch(e => `<p class="empty2">${esc(K.KO_ERR(e))}</p>`) : ''}`;
    },
    bind() {
      const pg = K.pg;
      if (window.StudyAdmin) window.StudyAdmin.bind();   // 회원 활동 · 문항 분석 부분 (study.js)
      pg.querySelectorAll('[data-dd]').forEach(b => b.addEventListener('click', () => { D.days = +b.dataset.dd; Account.page('data'); }));
      pg.querySelector('#opsReload').addEventListener('click', () => Account.page('data'));
      bindUsageChart();
      pg.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
        const t = pg.querySelector('#' + b.dataset.goto); if (!t) return;
        pg.scrollTo({ top: t.getBoundingClientRect().top - pg.getBoundingClientRect().top + pg.scrollTop - 60, behavior: 'smooth' });
      }));
      pg.querySelector('#opsCsv').addEventListener('click', () => { if (D.csv) download(D.csv.name, toCSV(D.csv.rows), 'text/csv;charset=utf-8'); });
    },
  });

  /* ═════════ 🛠 서버 점검 · 백업 (관리자) ═════════ */
  const LV = { ok: '정상', warn: '주의', bad: '문제' };
  const lv = (l) => `<span class="lv ${esc(l)}">${LV[l] || esc(l)}</span>`;
  const KIND = { load: '⚡ 동시 접속 초과', weekly: '🗓 매주 정기', manual: '✋ 직접' };
  const JOB = {
    'samgongyuk-tick': ['5분마다', '접속자 세기 · 기준을 넘으면 자동 백업'],
    'samgongyuk-daily-report': ['매일 09:05', '서버 점검 보고서 만들기'],
    'samgongyuk-weekly-backup': ['매주 일 04:00', '정기 백업'],
  };
  const TABLE_KO = { profiles: '회원', posts: '게시판 글', visits: '방문 · 게임 실행', runs: '게임 기록', settings: '설정', game_saves: '게임 저장',
    live_sessions: '지금 접속', ops_presence: '동시 접속 기록', ops_backups: '백업', ops_reports: '점검 보고서' };
  const checksHtml = (checks) => `<div class="ops-checks">${(checks || []).map(c =>
    `<div class="ck ${esc(c.level)}">${lv(c.level)}<b>${esc(c.name)}</b><span>${esc(c.msg)}</span></div>`).join('')}</div>`;
  const dbBar = (used, limit) => {
    const p = Math.min(100, used * 100 / limit);
    return `<div class="ops-meter ${p >= 90 ? 'bad' : p >= 70 ? 'warn' : ''}"><i style="width:${p.toFixed(1)}%"></i><span>DB 용량 ${mb(used)} / ${mb(limit)} (${p.toFixed(1)}%) · 무료 요금제 한도</span></div>`;
  };

  function reportText(r) {
    const L = [];
    L.push(`삼공육 서버 점검 보고서 — ${r.day} (한국 시간)`, `만든 시각: ${K.fmtDate(r.made_at, true)}`, `종합 상태: ${LV[r.status] || r.status}`, '');
    L.push('[점검 항목]');
    (r.checks || []).forEach(c => L.push(`- [${LV[c.level] || c.level}] ${c.name}: ${c.msg}`));
    L.push('', '[하루 이용]', `방문 ${r.visits}회 · 게임 실행 ${r.plays}회 · 로그인 회원 ${r.users}명 · 새 회원 ${r.new_members}명`,
      `게임 기록 ${r.runs}판 · 새 글 ${r.posts}개 · 최대 동시 접속 ${r.peak_live}명${r.peak_at ? ` (${K.fmtDate(r.peak_at, true)})` : ''}`);
    (r.games || []).forEach(g => L.push(`- ${g.game}: ${g.plays}회, 회원 ${g.users}명`));
    L.push('', '[DB]', `용량 ${mb(r.db_bytes)} / ${mb(r.db_limit)}`);
    Object.entries(r.tables || {}).forEach(([k, v]) => L.push(`- ${TABLE_KO[k] || k} (${k}): ${v.rows}줄, ${mb(v.bytes)}`));
    L.push('', `백업: ${r.backups ? r.backups.count : 0}개${r.backups && r.backups.last ? `, 마지막 ${K.fmtDate(r.backups.last, true)}` : ''}`);
    return L.join('\r\n');
  }

  async function reportDetail(day) {
    const r = await rpc('admin_report', { p_day: day });
    if (!r) return `<button class="abtn sm" type="button" data-back>← 목록</button><p class="empty2">${esc(day)} 보고서가 없어요.</p>`;
    O.report = r;
    const maxG = Math.max(1, ...(r.games || []).map(g => g.plays));
    return `<button class="abtn sm" type="button" data-back>← 목록</button>
      <h2 style="margin-top:14px">📋 ${esc(r.day)} 점검 보고서 ${lv(r.status)}</h2>
      <p class="sub">만든 시각 ${K.fmtDate(r.made_at, true)} · 매일 아침 9시 5분에 전날 것을 자동으로 만들어요.</p>
      <div class="row"><button class="abtn sm pri" type="button" id="repDl">⬇ 보고서 내려받기 (.txt)</button></div>
      <h3>점검 항목</h3>${checksHtml(r.checks)}
      <h3>하루 이용</h3>
      <div class="kpis">
        <div class="kpi c1"><small>게임 실행</small><b>${n(r.plays)}</b><span>방문 ${n(r.visits)}회</span></div>
        <div class="kpi c2"><small>로그인 회원</small><b>${n(r.users)}</b><span>새 회원 ${n(r.new_members)}명</span></div>
        <div class="kpi c3"><small>최대 동시 접속</small><b>${n(r.peak_live)}</b><span>${r.peak_at ? K.fmtDate(r.peak_at, true) : '기록 없음'}</span></div>
        <div class="kpi c4"><small>게임 기록 · 새 글</small><b>${n(r.runs)}</b><span>새 글 ${n(r.posts)}개</span></div>
      </div>
      ${(r.games || []).length ? `<h3>콘텐츠별</h3><div class="bars2">${r.games.map(g => bar(`<span class="lab" style="width:auto">${esc(g.game)}</span>`, g.plays, maxG, '회', `👤 ${n(g.users)}명`)).join('')}</div>` : ''}
      <h3>DB</h3>${dbBar(r.db_bytes, r.db_limit)}
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>표</th><th class="num">줄 수</th><th class="num">크기</th></tr></thead>
        <tbody>${Object.entries(r.tables || {}).map(([k, v]) => `<tr><td>${esc(TABLE_KO[k] || k)} <small style="color:var(--ink-faint)">${esc(k)}</small></td>
          <td class="num">${n(v.rows)}</td><td class="num">${mb(v.bytes)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  const O = { report: null };
  Account.addPage({
    id: 'ops', ic: '🛠', label: '서버 점검 · 백업', admin: true,
    async render(arg) {
      try {
        if (arg && arg.day) return await reportDetail(arg.day);
        const o = await rpc('admin_ops');
        const latest = o.reports[0];
        const jobs = o.jobs.length ? o.jobs.map(j => `<tr><td>${esc((JOB[j.jobname] || [])[1] || j.jobname)}</td><td>${esc((JOB[j.jobname] || [j.schedule])[0])}</td>
            <td>${j.active ? '켜짐' : '꺼짐'}</td><td>${j.last_run ? K.fmtDate(j.last_run, true) : '-'}</td>
            <td>${j.last_status ? lv(j.last_status === 'succeeded' ? 'ok' : j.last_status === 'failed' ? 'bad' : 'warn') : '-'}</td></tr>`).join('')
          : '';
        return `<h2>🛠 서버 점검 · 백업</h2>
          <p class="sub">매일 아침 서버 상태를 점검해 보고서를 남기고, 동시 접속이 기준을 넘으면 자동으로 백업해요.</p>
          <div class="row"><button class="abtn pri" type="button" id="opsCheck">🔍 지금 점검</button>
            <button class="abtn" type="button" id="opsBackup">💾 지금 백업</button></div>

          <h3>최근 점검 ${latest ? `<small style="color:var(--ink-faint);font-weight:500">${esc(latest.day)} ${lv(latest.status)}</small>` : ''}</h3>
          ${latest ? checksHtml(latest.checks) : '<p class="empty2">아직 보고서가 없어요. 위의 🔍 지금 점검을 눌러 보세요.</p>'}
          <div style="margin-top:12px">${dbBar(o.db_bytes, o.db_limit)}</div>

          <h3>⚙️ 자동 작업</h3>
          ${o.cron ? (jobs ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>하는 일</th><th>언제</th><th>상태</th><th>마지막 실행</th><th>결과</th></tr></thead><tbody>${jobs}</tbody></table></div>`
              : '<p class="empty2">pg_cron 은 켜져 있는데 작업이 없어요. supabase/ops.sql 을 다시 한 번 실행해 주세요.</p>')
            : '<div class="ops-checks"><div class="ck warn">' + lv('warn') + '<b>자동 작업 꺼짐</b><span>Supabase → Database → Extensions 에서 <b>pg_cron</b> 을 켜고 supabase/ops.sql 을 다시 실행하면 5분마다 · 매일 · 매주 작업이 돌아요. 그 전에는 위의 버튼으로 직접 해 주세요.</span></div></div>'}
          <form class="acc-form ops-set" id="opsSet">
            <label>자동 백업 기준 (동시 접속, 명)<input class="acc-in" name="th" type="number" min="1" max="10000000" value="${o.threshold}" required></label>
            <label>백업 몇 개까지 남길까요 (1~50)<input class="acc-in" name="keep" type="number" min="1" max="50" value="${o.keep}" required></label>
            <button class="abtn" type="submit">저장</button><p class="acc-msg" id="opsMsg"></p>
          </form>

          <h3>💾 백업 (${o.backups.length}개)</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>만든 시각</th><th>종류</th><th>내용</th><th class="num">크기</th><th></th></tr></thead>
            <tbody>${o.backups.map(b => `<tr><td class="num">${b.id}</td><td>${K.fmtDate(b.created_at, true)}</td><td>${KIND[b.kind] || esc(b.kind)}<br><small style="color:var(--ink-faint)">${esc(b.reason)}</small></td>
              <td><small>회원 ${n(b.rows.profiles)} · 글 ${n(b.rows.posts)} · 기록 ${n(b.rows.runs)} · 저장 ${n(b.rows.game_saves)} · 방문(30일) ${n(b.rows.visits_30d)}</small></td>
              <td class="num">${mb(b.bytes)}</td>
              <td><div class="acts"><button class="abtn sm" type="button" data-bdl="${b.id}">⬇ 내려받기</button><button class="abtn sm warn" type="button" data-bdel="${b.id}">삭제</button></div></td></tr>`).join('')
              || '<tr><td colspan="6" class="empty2">아직 백업이 없어요.</td></tr>'}</tbody></table></div>
          <p class="note">백업은 같은 Supabase 안에 저장돼요. 프로젝트가 통째로 사라지는 경우를 대비해 가끔 ⬇ 내려받아 동아리 드라이브에 보관해 주세요. 비밀번호는 들어가지 않아요. 가입 동의문에 따라 30일 지난 백업은 자동으로 지워져요 (answers.sql).</p>

          <h3>📋 매일 점검 보고서</h3>
          <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>날짜</th><th>상태</th><th class="num">게임 실행</th><th class="num">방문</th><th class="num">로그인 회원</th><th class="num">최대 동시</th><th>주의 · 문제</th></tr></thead>
            <tbody>${o.reports.map(r => {
              const bad = (r.checks || []).filter(c => c.level !== 'ok').map(c => c.name);
              return `<tr class="click" data-rday="${esc(r.day)}"><td>${dayLab(r.day)}</td><td>${lv(r.status)}</td><td class="num">${n(r.plays)}</td><td class="num">${n(r.visits)}</td>
                <td class="num">${n(r.users)}</td><td class="num">${n(r.peak_live)}</td><td><small>${esc(bad.join(', ') || '-')}</small></td></tr>`;
            }).join('') || '<tr><td colspan="7" class="empty2">아직 보고서가 없어요.</td></tr>'}</tbody></table></div>
          <p class="note">줄을 누르면 자세히 볼 수 있어요. 보고서는 180일 동안 남아요.</p>`;
      } catch (e) { return errBox(e, '🛠 서버 점검 · 백업'); }
    },
    bind(arg) {
      const pg = K.pg, on = (sel, fn) => { const el = pg.querySelector(sel); if (el) el.addEventListener('click', fn); };
      if (arg && arg.day) {
        pg.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => Account.page('ops')));
        on('#repDl', () => { if (O.report) download(`samgongyuk_report_${O.report.day}.txt`, '﻿' + reportText(O.report), 'text/plain;charset=utf-8'); });
        return;
      }
      on('#opsCheck', async (e) => {
        e.target.disabled = true;
        try { const r = await rpc('admin_report_now'); Account.page('ops', { day: r.day }); }
        catch (err) { e.target.disabled = false; K.say(K.KO_ERR(err)); }
      });
      on('#opsBackup', async (e) => {
        if (!await K.ask('지금 백업할까요?\n회원 · 글 · 설정 · 게임 기록 · 게임 저장 · 방문 요약을 사본으로 남겨요.')) return;
        e.target.disabled = true;
        try { const id = await rpc('admin_backup_now'); await K.say(`백업 #${id} 을 만들었어요.`); Account.page('ops'); }
        catch (err) { e.target.disabled = false; K.say(K.KO_ERR(err)); }
      });
      const f = pg.querySelector('#opsSet');
      if (f) f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const m = pg.querySelector('#opsMsg');
        try { await rpc('admin_set_ops', { p_threshold: Math.round(+f.th.value), p_keep: Math.round(+f.keep.value) }); m.classList.add('ok'); m.textContent = '저장했어요.'; }
        catch (err) { m.classList.remove('ok'); m.textContent = K.KO_ERR(err); }
      });
      pg.querySelectorAll('[data-bdl]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const data = await rpc('admin_backup_get', { p_id: +b.dataset.bdl });
          if (!data) return K.say('백업이 없어요. 새로고침해 주세요.');
          download(`samgongyuk_backup_${b.dataset.bdl}_${K.fmtDate(data.made_at)}.json`, JSON.stringify(data, null, 1), 'application/json');
        } catch (err) { K.say(K.KO_ERR(err)); } finally { b.disabled = false; }
      }));
      pg.querySelectorAll('[data-bdel]').forEach(b => b.addEventListener('click', async () => {
        if (!await K.ask(`백업 #${b.dataset.bdel} 을 지울까요? 되살릴 수 없어요.`)) return;
        try { await rpc('admin_backup_delete', { p_id: +b.dataset.bdel }); Account.page('ops'); } catch (err) { K.say(K.KO_ERR(err)); }
      }));
      pg.querySelectorAll('[data-rday]').forEach(tr => tr.addEventListener('click', () => Account.page('ops', { day: tr.dataset.rday })));
    },
  });
})();
