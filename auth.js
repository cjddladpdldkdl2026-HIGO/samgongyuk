/* 삼공육 로그인 — 모든 페이지가 같이 쓰는 파일 (Supabase 프로젝트 samgongyuk, 서울)
 *
 *  쓰기 전에: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
 *
 *  SamAuth.ready                → Promise, 로그인 상태를 다 읽으면 끝나요
 *  SamAuth.user / .profile      → 구글 로그인한 사람 / 가입(학번·닉네임)까지 마친 사람의 { nickname }
 *  SamAuth.signIn()             → 구글 로그인 (지금 페이지로 돌아와요)
 *  SamAuth.signOut()
 *  SamAuth.join(학번, 닉네임, 동의) → { ok, error?, nickname? }
 *  SamAuth.setNickname(닉네임)
 *  SamAuth.record({ game, mode, score, accuracy, detail })  → 가입한 사람만 저장, 실패해도 게임은 그대로
 *  SamAuth.ranking(game, mode)  → { top: [{ nickname, score, accuracy }], myBest, myRank, total }
 *  SamAuth.onChange(fn)         → 로그인·가입 상태가 바뀔 때마다 fn(SamAuth)
 *
 *  키는 Supabase 의 공개용(publishable) 키예요. 웹 페이지에 넣는 용도이고, 표마다 RLS 로 막혀 있어요.
 *  DB 구조: supabase/schema.sql
 */
(function () {
  const URL_ = 'https://ptlhjxtvwcoyrhemimjw.supabase.co';
  const KEY_ = 'sb_publishable_cuv4DoFYqHSJFiL2FF28aQ_B03qGNkl';
  const GAMES = ['landmark', 'ddan', 'wizard', 'neoege'];

  const listeners = [];
  const A = {
    client: null, user: null, profile: null,
    get loggedIn() { return !!this.user; },
    get joined() { return !!this.profile; },
    onChange(fn) { listeners.push(fn); try { fn(A); } catch { /* ignore */ } },
  };
  const emit = () => listeners.forEach(fn => { try { fn(A); } catch { /* ignore */ } });
  window.SamAuth = A;

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[SamAuth] supabase-js 가 없어요');
    A.ready = Promise.resolve(A);
    A.signIn = A.signOut = async () => {};
    A.join = A.setNickname = async () => ({ ok: false, error: '로그인 기능을 불러오지 못했어요' });
    A.record = async () => null;
    A.ranking = async () => { throw new Error('auth unavailable'); };
    return;
  }

  const sb = A.client = window.supabase.createClient(URL_, KEY_, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'samgongyuk-auth' },
  });

  async function loadProfile() {
    if (!A.user) { A.profile = null; return; }
    const { data } = await sb.from('profiles').select('nickname, banned').eq('id', A.user.id).maybeSingle();
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

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return;
    const was = A.user && A.user.id;
    A.user = session ? session.user : null;
    if ((A.user && A.user.id) !== was || event === 'SIGNED_OUT') { await loadProfile(); emit(); }
  });

  A.signIn = () => sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.href.split('#')[0], queryParams: { prompt: 'select_account' } },
  });
  A.signOut = async () => { await sb.auth.signOut(); A.user = null; A.profile = null; emit(); };

  A.join = async (studentNo, nickname, agree) => {
    const { data, error } = await sb.rpc('join_club', { p_student_no: studentNo, p_nickname: nickname, p_agree: !!agree });
    if (error) return { ok: false, error: '저장하지 못했어요. 잠시 후 다시 해 주세요' };
    if (data && data.ok) { await loadProfile(); emit(); }
    return data;
  };
  A.setNickname = async (nickname) => {
    const { data, error } = await sb.rpc('set_nickname', { p_nickname: nickname });
    if (error) return { ok: false, error: '저장하지 못했어요' };
    if (data && data.ok) { await loadProfile(); emit(); }
    return data;
  };

  A.leave = async () => {
    const { data, error } = await sb.rpc('leave_club');
    if (error || !data || !data.ok) return { ok: false, error: (data && data.error) || '탈퇴하지 못했어요' };
    await sb.auth.signOut(); A.user = null; A.profile = null; emit();
    return { ok: true };
  };

  A.record = async (row) => {
    try {
      await A.ready;
      if (!A.profile || A.profile.banned || GAMES.indexOf(row.game) < 0) return null;
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
})();
