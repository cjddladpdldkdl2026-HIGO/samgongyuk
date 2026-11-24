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

  Account.addPage({
    id: 'weak', ic: '📚', label: '내 약점 분석', login: true,
    async render() {
      let d;
      try { d = await rpc('my_weak', { p_game: M.game, p_days: M.days }); }
      catch (e) { return '<h2>📚 내 약점 분석</h2>' + (MISSING(e) ? missingMsg : `<p class="empty2">${esc(K.KO_ERR(e))}</p>`); }
      const tabs = filt('wg', M.game, [[null, '전체'], ...GAMES.map(g => [g.id, `${g.ic} ${g.ko}`])]);
      const per = filt('wd', M.days, [[null, '전체 기간'], [30, '최근 30일'], [7, '최근 7일']]).replace('class="filt"', 'class="filt sm"');
      const head = `<h2>📚 내 약점 분석</h2>
        <p class="sub">게임에서 푼 문제를 하나하나 모아서, 내가 어느 부분을 자주 틀리는지 보여 줘요. 로그인한 채로 게임을 하면 쌓여요.</p>${tabs}${per}`;
      if (!d.total) {
        return head + `<p class="empty2">${M.game || M.days ? '이 조건에는' : '아직'} 푼 문제 기록이 없어요.<br>로그인한 채로 게임을 하면 문제마다 맞았는지 틀렸는지가 쌓여요 🎮</p>`;
      }
      const rate = pct(d.right, d.total);
      const weakestCat = d.cats.filter(c => c.tries >= 3)[0] || d.cats[0];
      const game = M.game && G[M.game];
      const days = d.days || [];
      const maxT = Math.max(1, ...days.map(x => x.tries));

      return head + `
        <div class="kpis">
          <div class="kpi c1"><small>정답률</small><b>${rate}%</b><span>${n(d.total)}문제 중 ${n(d.right)}개 맞힘</span></div>
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
            <th class="num">틀림</th><th class="num">정답률</th><th>마지막</th></tr></thead><tbody>${d.weak.map(w => `<tr>
            <td class="st-item">${esc(w.item)}</td>${M.game ? '' : `<td>${esc(G[w.game] ? G[w.game].ko : w.game)}</td>`}<td>${esc(w.cat || '-')}</td>
            <td class="num">${n(w.wrong)} / ${n(w.tries)}</td><td class="num"><span class="st-pill ${tone(w.rate)}">${w.rate}%</span></td>
            <td>${w.last_ok ? '✅ 맞힘' : '❌ 틀림'} <small style="color:var(--ink-faint)">${K.fmtDate(w.last_at)}</small></td></tr>`).join('')}</tbody></table></div>
          <p class="note">✅ 최근엔 맞힌 문제는 거의 다 익힌 거예요. ❌ 인 문제부터 다시 보세요.</p>`
          : '<p class="empty2">틀린 문제가 없어요! 👏</p>'}

        ${d.strong.length ? `<h3>💪 잘하는 문제</h3><div class="st-chips">${d.strong.map(s =>
          `<span class="chip update" title="${n(s.tries)}번 중 ${s.rate}%">${esc(s.item)}</span>`).join(' ')}</div>` : ''}

        ${days.length ? `<h3>📈 최근 14일 정답률</h3>
          <div class="ops-cols">${days.map(x => `<div class="c" title="${esc(x.day)}: ${x.rate}% (${x.tries}문제)">
            <i class="${tone(x.rate)}" style="height:${Math.max(4, x.rate)}%;opacity:${(0.45 + 0.55 * x.tries / maxT).toFixed(2)}"></i>
            <span>${esc(x.day.slice(5).replace('-', '/'))}</span></div>`).join('')}</div>
          <p class="note">막대 높이 = 정답률, 진할수록 그날 많이 풀었어요.</p>` : ''}`;
    },
    bind() {
      const pg = K.pg;
      pg.querySelectorAll('[data-wg]').forEach(b => b.addEventListener('click', () => { M.game = b.dataset.wg || null; Account.page('weak'); }));
      pg.querySelectorAll('[data-wd]').forEach(b => b.addEventListener('click', () => { M.days = b.dataset.wd ? +b.dataset.wd : null; Account.page('weak'); }));
    },
  });

  /* ═════════ 🧑‍🎓 회원 활동 · 문항 분석 (관리자) ═════════ */
  const A = { days: 30, game: null, sort: 'plays', csv: null };

  Account.addPage({
    id: 'activity', ic: '🧑‍🎓', label: '회원 활동 · 문항 분석', admin: true,
    async render() {
      let act, it;
      try { [act, it] = await Promise.all([rpc('admin_activity', { p_days: A.days }), rpc('admin_items', { p_game: A.game, p_days: A.days })]); }
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
      const sorters = { plays: (a, b) => b.plays - a.plays, rate: (a, b) => (a.rate ?? 101) - (b.rate ?? 101), days: (a, b) => b.active_days - a.active_days, seen: (a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')) };
      const users = act.users.slice().sort(sorters[A.sort] || sorters.plays);
      const gameCols = [...new Set(act.users.flatMap(u => Object.keys(u.by_game || {})))];
      A.csv = [['구분', '아이디/학번', '이름', '학년', '게임 실행', ...gameCols, '활동한 날', '주로 하는 시간', '끝까지 한 판', '푼 문제', '정답률(%)', '최근 접속'],
        ...users.map(u => [u.kind === 'admin' ? '관리자' : '학생', u.login_id, u.name, u.kind === 'admin' ? '' : u.grade, u.plays,
          ...gameCols.map(g => (u.by_game || {})[g] || 0), u.active_days, u.top_hour == null ? '' : `${u.top_hour}시`, u.runs, u.answers, u.rate ?? '',
          u.last_seen_at ? K.fmtDate(u.last_seen_at, true) : ''])];
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
        </div>

        <h3>🗓 요일 × 시간 (게임 실행 수)</h3>
        ${act.heat.length ? heatHtml + '<p class="note">진할수록 많이 했어요. 칸에 마우스를 올리면 숫자가 보여요. 로그인 안 한 실행도 포함돼요.</p>'
          : '<p class="empty2">이 기간에는 게임 실행 기록이 없어요.</p>'}

        <h3>👥 회원별 활동</h3>
        <div class="filt sm">${sortBtn('plays', '많이 한 순')}${sortBtn('days', '자주 온 순')}${sortBtn('rate', '정답률 낮은 순')}${sortBtn('seen', '최근 접속 순')}</div>
        <div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>이름</th><th>학번</th><th>학년</th><th class="num">게임 실행</th><th>게임별</th>
          <th class="num">활동한 날</th><th>주로 하는 시간</th><th class="num">끝까지 한 판</th><th class="num">푼 문제</th><th class="num">정답률</th><th>최근 접속</th></tr></thead>
          <tbody>${users.map(u => `<tr${u.plays || u.answers || u.runs ? '' : ' class="st-idle"'}>
            <td>${esc(u.name)}${u.kind === 'admin' ? ' <span class="tag admin">관리자</span>' : ''}</td><td class="num">${esc(u.login_id)}</td>
            <td>${u.kind === 'admin' ? '-' : `${u.grade}학년`}</td><td class="num">${n(u.plays)}</td>
            <td><small>${Object.entries(u.by_game || {}).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${esc(g)} ${n(c)}`).join(' · ') || '-'}</small></td>
            <td class="num">${n(u.active_days)}</td><td>${u.top_hour == null ? '-' : `${u.top_hour}시대`}</td><td class="num">${n(u.runs)}</td>
            <td class="num">${n(u.answers)}</td><td class="num">${u.rate == null ? '-' : `<span class="st-pill ${tone(u.rate)}">${u.rate}%</span>`}</td>
            <td>${u.last_seen_at ? K.fmtDate(u.last_seen_at, true) : '-'}</td></tr>`).join('') || '<tr><td colspan="11" class="empty2">회원이 없어요.</td></tr>'}</tbody></table></div>
        <p class="note">흐리게 보이는 줄은 이 기간에 활동이 없는 회원이에요. 게임 실행은 허브에서 ▶ 플레이를 누른 횟수예요.</p>

        <h3>📝 문항 분석 · 회원들이 자주 틀리는 문제</h3>
        ${tabs}
        <div class="two">
          <div><h3 style="margin-top:4px">🧩 부분별 정답률 (낮은 순)</h3>
            <div class="bars2">${it.cats.slice(0, 15).map(c => rateBar(`${esc(c.cat)}${A.game ? '' : ` <small class="st-g">${esc(G[c.game] ? G[c.game].ko : c.game)}</small>`}`,
              c.rate, `${n(c.tries)}문제 · 👤${n(c.users)}`)).join('') || '<p class="empty2">기록이 아직 없어요.</p>'}</div></div>
          <div><h3 style="margin-top:4px">🎮 게임별</h3>
            <div class="bars2">${it.games.map(g => rateBar(esc(gname(g.game)), pct(g.right, g.tries), `${n(g.tries)}문제 · 👤${n(g.users)}`)).join('')
              || '<p class="empty2">기록이 아직 없어요.</p>'}</div></div>
        </div>
        <h3>❗ 정답률 낮은 문제 TOP 30 <small class="st-hint">3번 넘게 풀린 문제만</small></h3>
        ${it.hard.length ? `<div class="tbl-wrap ops-tall"><table class="tbl"><thead><tr><th>문제</th>${A.game ? '' : '<th>게임</th>'}<th>부분</th>
            <th class="num">푼 횟수</th><th class="num">회원</th><th class="num">정답률</th></tr></thead><tbody>${it.hard.map(h => `<tr>
            <td class="st-item">${esc(h.item)}</td>${A.game ? '' : `<td>${esc(G[h.game] ? G[h.game].ko : h.game)}</td>`}<td>${esc(h.cat || '-')}</td>
            <td class="num">${n(h.tries)}</td><td class="num">${n(h.users)}</td><td class="num"><span class="st-pill ${tone(h.rate)}">${h.rate}%</span></td></tr>`).join('')}</tbody></table></div>
          <p class="note">정답률이 낮은 문제는 수업에서 한 번 더 짚거나, 문제 · 보기가 헷갈리게 되어 있지 않은지 확인해 보세요.</p>`
          : '<p class="empty2">아직 3번 넘게 풀린 문제가 없어요.</p>'}`;
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
