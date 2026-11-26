/* 삼공육 공용 캐쉬 지갑 — 문제풀기에서 벌고, 게임마다 아이템 사는 데 써요 (2026-11-26)
 *
 *  쓰기 전에: supabase-js → auth.js → wallet.js 순서로 불러오기
 *  저장: 이 기기(localStorage "samgongyuk-wallet/v1/<회원id|guest>") + 로그인했으면 계정 game_saves (game = 'wallet')
 *        서버 쪽은 supabase/wallet.sql 을 한 번 실행해야 돼요. 실행 전에는 이 기기에만 저장돼요.
 *
 *  await Wallet.ready           → 지갑을 다 읽으면 끝나요 (로그인 상태도 같이 기다려요)
 *  Wallet.cash                  → 지금 캐쉬
 *  Wallet.add(n, why)           → 캐쉬 주기 (문제 맞힘 등)
 *  Wallet.spend(n, why)         → 캐쉬 쓰기. 모자라면 false, 쓰면 true
 *  Wallet.onChange(fn)          → 캐쉬가 바뀔 때마다 fn(cash)
 */
(function () {
  const A = () => window.SamAuth;
  const member = () => !!(A() && A().joined && A().user);
  const keyOf = () => `samgongyuk-wallet/v1/${member() ? A().user.id : "guest"}`;
  const blank = () => ({ v: 1, cash: 0, earned: 0, spent: 0, updated: 0 });
  const listeners = [];
  let W = blank(), timer = null, remoteOK = true, who;   // who = 지금 지갑 주인 (회원 id 또는 null)

  function readLocal(k) { try { const d = JSON.parse(localStorage.getItem(k) || "null"); return d && d.v === 1 ? d : null; } catch { return null; } }
  function writeLocal() { try { localStorage.setItem(keyOf(), JSON.stringify(W)); } catch { /* 저장 공간 없음 */ } }
  function emit() { listeners.forEach(fn => { try { fn(W.cash); } catch (e) { console.warn(e); } }); }

  async function push() {
    if (!member() || !remoteOK) return;
    try {
      const { error } = await A().client.from("game_saves").upsert({ user_id: A().user.id, game: "wallet", data: W, updated_at: new Date().toISOString() }, { onConflict: "user_id,game" });
      if (error) { remoteOK = false; console.warn("[지갑] 계정 저장 안 됨 (supabase/wallet.sql 을 실행했나요?)", error.message); }
    } catch { /* 오프라인 */ }
  }
  function save() { W.updated = Date.now(); writeLocal(); emit(); if (member() && remoteOK) { clearTimeout(timer); timer = setTimeout(push, 800); } }

  async function load() {
    try { if (A() && A().ready) await A().ready; } catch { /* 로그인 서버 안 됨 */ }
    who = member() ? A().user.id : null;
    let best = readLocal(keyOf());
    if (member()) {
      remoteOK = true;
      try {
        const { data, error } = await A().client.from("game_saves").select("data").eq("game", "wallet").maybeSingle();
        if (error) remoteOK = false;
        else if (data && data.data && data.data.v === 1 && (!best || (data.data.updated || 0) > (best.updated || 0))) best = data.data;
      } catch { /* 오프라인 */ }
      // 처음 로그인했으면 로그인 전에 이 기기에서 번 캐쉬를 이어받고, 손님 지갑은 비워요 (두 번 받기 방지)
      if (!best) {
        const g = readLocal("samgongyuk-wallet/v1/guest");
        if (g && g.cash > 0) { best = g; try { localStorage.setItem("samgongyuk-wallet/v1/guest", JSON.stringify(blank())); } catch {} }
      }
    }
    W = Object.assign(blank(), best || {});
    W.cash = Math.max(0, Math.round(+W.cash || 0));
    writeLocal(); emit();
    if (member() && remoteOK) push();
  }

  const Wallet = {
    get cash() { return W.cash; },
    get earned() { return W.earned; },
    add(n, why) { n = Math.round(+n || 0); if (n <= 0) return W.cash; W.cash += n; W.earned += n; save(); return W.cash; },
    spend(n, why) { n = Math.round(+n || 0); if (n < 0 || W.cash < n) return false; W.cash -= n; W.spent += n; save(); return true; },
    onChange(fn) { listeners.push(fn); },
    reload: () => (Wallet.ready = load()),
    ready: null,
  };
  window.Wallet = Wallet;
  Wallet.ready = load();
  // 로그인 · 로그아웃으로 사람이 바뀌면 그 사람 지갑을 다시 읽어요 (onChange 는 등록할 때 한 번 바로 불려서, 사람이 바뀔 때만)
  if (A() && A().onChange) A().onChange((a) => {
    if (who === undefined) return;   // 아직 처음 읽는 중
    const id = a.joined && a.user ? a.user.id : null;
    if (id !== who) Wallet.reload();
  });
})();
