/* ============================================================================
 * BRAIN BEAT · beat finder — finds the beat of any song, right in the browser.
 *   analyzeSong(audioBuffer, onProgress) → { bpm, beat0, start, light, reasons, ... }
 * 1. Mix to mono at 11 kHz, spectral flux (how much new sound starts each 11.6 ms).
 * 2. Tempo: autocorrelation of that flux, 60–200 BPM, leaning toward ~120.
 * 3. Exact BPM + first beat: grid search over the whole song.
 * 4. Downbeat and "where the intro ends": low drums + loudness jumps per bar.
 * 5. Warnings: tempo changes between parts, drifting beat, weak beat, unclear tempo, short song.
 * The file never leaves the computer; everything runs here.
 * ========================================================================== */
'use strict';
(function () {
  const SR = 11025, N = 512, HOP = 128, FPS = SR / HOP;
  // a new sound shows up in the flux as soon as it enters the 46 ms window, i.e. ~32 ms before it
  // really starts (checked against EDM Detection Mode, whose first beat is at 0.010 s)
  const FLUX_LEAD = (N * 0.7) / SR;

  function fft(re, im) {   // in-place radix-2
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  const tick = () => new Promise(r => setTimeout(r, 0));
  const at = (env, f) => { const i = Math.floor(f), a = f - i; return i + 1 < env.length && i >= 0 ? env[i] * (1 - a) + env[i + 1] * a : 0; };

  /** autocorrelation strength of a beat period (in frames) over env[from..to) */
  function acf(env, period, from, to) {
    let s = 0, n = 0;
    for (let i = from; i + period * 2 < to; i += 1) { s += env[i] * (at(env, i + period) + 0.5 * at(env, i + period * 2)); n++; }
    return n ? s / n : 0;
  }
  const prior = (bpm) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.8, 2));

  /** sum of env on a beat grid (period, phase) over [from, to) frames */
  function grid(env, period, phase, from, to) {
    let s = 0, n = 0;
    const k0 = Math.ceil((from - phase) / period);
    for (let k = Math.max(0, k0); ; k++) { const f = phase + k * period; if (f >= to) break; s += at(env, f); n++; }
    return n ? s / n : 0;
  }
  /** on-beat or off-beat? Hi-hats and off-beat bass can out-score the beat itself;
   *  the kick drum (low band) almost always sits on the beat, so let it decide. */
  function kickSide(low, period, phase, from, to) {
    const on = grid(low, period, phase, from, to), off = grid(low, period, phase + period / 2, from, to);
    return off > on * 1.15 ? (phase + period / 2) % period : phase;
  }
  function bestPhase(env, period, from, to) {
    let best = 0, bp = 0, sum = 0, cnt = 0;
    for (let p = 0; p < period; p += 0.5) { const g = grid(env, period, p, from, to); sum += g; cnt++; if (g > best) { best = g; bp = p; } }
    return { phase: bp, score: best, mean: sum / cnt };
  }

  async function analyzeSong(buf, onProgress = () => {}) {
    const dur = Math.min(buf.duration, 360);
    const off = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
    const x = (await off.startRendering()).getChannelData(0);
    const frames = Math.max(0, Math.floor((x.length - N) / HOP));
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const re = new Float32Array(N), im = new Float32Array(N);
    let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
    const flux = new Float32Array(frames), low = new Float32Array(frames), loud = new Float32Array(frames);
    const LOWK = Math.round(160 / (SR / N));
    for (let f = 0; f < frames; f++) {
      const o = f * HOP; let e = 0;
      for (let i = 0; i < N; i++) { const v = x[o + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
      fft(re, im);
      let fl = 0, lo = 0;
      for (let k = 1; k < N / 2; k++) {
        const m = Math.log1p(1000 * Math.hypot(re[k], im[k])); cur[k] = m;
        const d = m - prev[k]; if (d > 0) { fl += d; if (k <= LOWK) lo += d; }
      }
      flux[f] = fl; low[f] = lo; loud[f] = Math.sqrt(e / N);
      const t = prev; prev = cur; cur = t;
      if (f % 3000 === 0) { onProgress(f / frames * 0.6); await tick(); }
    }
    // onset envelope: flux minus its local average, so steady noise doesn't count
    const env = new Float32Array(frames), W = Math.round(FPS * 0.4);
    let acc = 0;
    for (let f = 0; f < frames; f++) {
      acc += flux[f]; if (f >= W) acc -= flux[f - W];
      const mean = acc / Math.min(f + 1, W);
      env[f] = Math.max(0, flux[f] - mean);
    }
    // where the music actually is (skip silence at both ends)
    const peakLoud = loud.reduce((a, b) => Math.max(a, b), 0) || 1;
    let a = 0, b = frames - 1;
    while (a < frames && loud[a] < peakLoud * 0.05) a++;
    while (b > a && loud[b] < peakLoud * 0.05) b--;
    const res = { duration: buf.duration, reasons: [], light: 'green' };
    if (b - a < FPS * 20) { res.light = 'red'; res.reasons.push({ lv: 'red', t: '노래가 너무 짧거나 거의 조용해요' }); res.bpm = 120; res.beat0 = 0; res.start = 0; return res; }

    // 1) tempo candidates from autocorrelation
    onProgress(0.65); await tick();
    const cands = [];
    for (let bpm = 60; bpm <= 200; bpm += 0.5) cands.push({ bpm, s: acf(env, FPS * 60 / bpm, a, b) });
    const maxS = Math.max(...cands.map(c => c.s)) || 1;
    for (const c of cands) c.w = c.s / maxS * prior(c.bpm);
    const sorted = cands.slice().sort((p, q) => q.w - p.w);
    let bpm = sorted[0].bpm;
    // fold into the range a game can use (70–180)
    while (bpm > 180) bpm /= 2; while (bpm < 70) bpm *= 2;
    const related = (p, q) => [1, 2, 0.5, 3, 1 / 3, 1.5, 2 / 3].some(r => Math.abs(p / q - r) < 0.03);
    const rival = sorted.find(c => !related(c.bpm, bpm));
    const ambiguity = rival ? rival.w / sorted[0].w : 0;

    // 2) exact BPM and phase: grid search over the whole song
    onProgress(0.75); await tick();
    let best = { score: -1 };
    for (let t = bpm - 2; t <= bpm + 2; t += 0.02) {
      const P = FPS * 60 / t, ph = bestPhase(env, P, a, b);
      if (ph.score > best.score) best = { bpm: t, ...ph };
    }
    if (Math.abs(best.bpm - Math.round(best.bpm)) < 0.07) {   // most songs are made at a whole BPM
      const t = Math.round(best.bpm), ph = bestPhase(env, FPS * 60 / t, a, b);
      if (ph.score > best.score * 0.97) best = { bpm: t, ...ph };
    }
    bpm = best.bpm;
    const P = FPS * 60 / bpm;
    best.phase = kickSide(low, P, best.phase, a, b);
    const beatTime = (k) => (best.phase + k * P) / FPS + FLUX_LEAD;
    let beat0 = beatTime(0); while (beat0 < 0) beat0 += 60 / bpm;
    const clarity = best.score / (best.mean || 1);
    const envSorted = Array.from(env.subarray(a, b)).sort((p, q) => p - q);
    const strong = envSorted[Math.floor(envSorted.length * 0.98)] || 1;   // a clear hit in this song
    let hits = 0, nb = 0;
    for (let f = best.phase; f < b; f += P) { if (f < a) continue; nb++; let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, env[Math.round(f) + d] || 0); if (m > strong * 0.25) hits++; }
    const hitRate = nb ? hits / nb : 0;

    // 3) does the tempo hold? check three parts of the song separately
    onProgress(0.85); await tick();
    const partBpm = [], partFit = [];
    for (let s = 0; s < 3; s++) {
      const pa = a + Math.floor((b - a) * s / 3), pb = a + Math.floor((b - a) * (s + 1) / 3);
      let bb = { score: -1 };
      for (let t = bpm * 0.94; t <= bpm * 1.06; t += 0.1) { const ph = bestPhase(env, FPS * 60 / t, pa, pb); if (ph.score > bb.score) bb = { bpm: t, ...ph }; }
      partBpm.push(bb.bpm);
      // does the whole-song grid still fit this part? (an off-beat bass section is fine too)
      const own = bestPhase(env, P, pa, pb).score || 1;
      partFit.push(Math.max(grid(env, P, best.phase, pa, pb), grid(env, P, best.phase + P / 2, pa, pb)) / own);
    }
    const tempoDev = Math.max(...partBpm.map(t => Math.abs(t - bpm) / bpm));
    const drift = 1 - Math.min(...partFit);   // 0 = the grid fits every part

    // 4) downbeat (which beat starts a bar) and where the intro ends
    const beatLen = 60 / bpm, barLen = beatLen * 4;
    const nBeats = Math.floor((dur - beat0) / beatLen);
    const beatLoud = [], beatLow = [];
    for (let k = 0; k < nBeats; k++) {
      const f0 = Math.floor((beat0 + k * beatLen) * FPS), f1 = Math.floor((beat0 + (k + 1) * beatLen) * FPS);
      let s = 0; for (let f = f0; f < f1 && f < frames; f++) s += loud[f]; beatLoud.push(s / Math.max(1, f1 - f0));
      let l = 0; for (let f = f0 - 2; f <= f0 + 4; f++) if (f >= 0 && f < frames) l = Math.max(l, low[f]); beatLow.push(l);
    }
    // downbeat: big loudness jumps (intro → drop, verse → chorus) land on the first beat of a bar
    const lowMax = Math.max(...beatLow) || 1;
    const ph4 = [0, 1, 2, 3].map(p => {
      let s = 0;
      for (let k = p + 4; k < nBeats - 4; k += 4) {
        let before = 0, after = 0; for (let j = 1; j <= 4; j++) { before += beatLoud[k - j]; after += beatLoud[k + j - 1]; }
        const jump = Math.max(0, after - before) / (before + after + 1e-9);
        s += jump * jump * 100 + 0.02 * beatLow[k] / lowMax;
      }
      return s;
    });
    const down = ph4.indexOf(Math.max(...ph4));
    const barT = (i) => beat0 + (down + i * 4) * beatLen;
    const nBars = Math.floor((dur - barT(0)) / barLen);
    const barLoud = [];
    for (let i = 0; i < nBars; i++) { let s = 0; for (let k = 0; k < 4; k++) s += beatLoud[down + i * 4 + k] || 0; barLoud.push(s / 4); }
    const ref = barLoud.slice().sort((p, q) => p - q)[Math.floor(barLoud.length * 0.8)] || 1;
    let startBar = -1;
    for (let i = 2; i < nBars - 1 && barT(i) < 60; i++) if (barLoud[i] >= ref * 0.72 && barLoud[i + 1] >= ref * 0.72) { startBar = i; break; }
    if (startBar < 0) startBar = 2;
    // the intro should be a whole number of 4-bar phrases if it's close
    const start = barT(startBar);

    // 5) warnings
    const R = res.reasons;
    if (tempoDev > 0.03 || (tempoDev > 0.015 && drift > 0.25)) R.push({ lv: 'red', t: '노래 중간에 빨라지거나 느려져요' });
    else if (drift > 0.4) R.push({ lv: 'red', t: '박이 점점 밀려요 (라이브 녹음 같아요)' });
    else if (drift > 0.25 || tempoDev > 0.015) R.push({ lv: 'yellow', t: '박이 살짝씩 흔들려요' });
    if (clarity < 1.35 || hitRate < 0.35) R.push({ lv: 'red', t: '쿵쿵 하는 박이 거의 안 들려요' });
    else if (clarity < 1.7 || hitRate < 0.6) R.push({ lv: 'yellow', t: '박이 조금 약해요' });
    if (ambiguity > 0.92) R.push({ lv: 'yellow', t: '빠르기가 두 가지로 들려요' });
    if (bpm < 75 || bpm > 170) R.push({ lv: 'yellow', t: bpm < 75 ? '아주 느린 곡이에요' : '아주 빠른 곡이에요' });
    const gameBars = (dur - start) / barLen;
    if (gameBars < 20) R.push({ lv: 'red', t: '전주 뒤가 너무 짧아요' });
    else if (gameBars < 36) R.push({ lv: 'yellow', t: '노래가 짧아서 문제 수를 줄여요' });
    res.light = R.some(r => r.lv === 'red') ? 'red' : R.length ? 'yellow' : 'green';
    Object.assign(res, { bpm: Math.round(bpm * 100) / 100, beat0, start, startBar, down, clarity, ambiguity, tempoDev, drift, hitRate, partBpm, maxBars: Math.floor(gameBars) });
    onProgress(1);
    return res;
  }
  window.analyzeSong = analyzeSong;

  /* ── live beat tracker ──────────────────────────────────────────────────────
   * For sound we can't load as a file (a YouTube video heard through tab sharing, live streams):
   *   const lb = new LiveBeat(ac); await lb.connect(sourceNode);   // starts listening
   *   lb.estimate()  → { bpm, beatT (AudioContext time of a beat), down, clarity, hitRate, secs } or null
   * It keeps the last ~40 s of onset envelope with exact AudioContext timestamps (AudioWorklet),
   * so the beat it finds can be scheduled against ac.currentTime directly. Call estimate() every
   * second or so: before the beat is "locked" it searches 60–200 BPM, afterwards it follows the
   * song within ±4 % so a live band that speeds up or slows down is followed bar by bar. */
  const TAP_WORKLET = `class BBTap extends AudioWorkletProcessor {
    constructor() { super(); this.b = new Float32Array(2048); this.n = 0; this.t = 0; }
    process(inputs) {
      const ch = inputs[0];
      if (ch && ch.length) {
        const a = ch[0], c = ch[1];
        if (this.n === 0) this.t = currentTime;
        for (let i = 0; i < a.length; i++) this.b[this.n++] = c ? (a[i] + c[i]) * 0.5 : a[i];
        if (this.n >= 2048) { this.port.postMessage({ t: this.t, x: this.b }, [this.b.buffer]); this.b = new Float32Array(2048); this.n = 0; }
      }
      return true;
    }
  }
  registerProcessor('bb-tap', BBTap);`;
  const KEEP = 40;   // seconds of envelope kept

  class LiveBeat {
    constructor(ac) {
      this.ac = ac; this.D = Math.max(1, Math.round(ac.sampleRate / SR)); this.fs = ac.sampleRate / this.D; this.fps = this.fs / HOP;
      this.win = new Float32Array(N); for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
      this.re = new Float32Array(N); this.im = new Float32Array(N); this.prev = new Float32Array(N / 2); this.cur = new Float32Array(N / 2);
      this.reset(); this.locked = null; this.lowK = Math.round(160 / (this.fs / N));
    }
    reset() { this.x = new Float32Array(0); this.xT = 0; this.flux = []; this.low = []; this.env = []; this.f0T = null; this.nextT = null; this.accN = 0; this.acc = 0; }
    async connect(node) {
      if (!this.node) {
        const url = URL.createObjectURL(new Blob([TAP_WORKLET], { type: 'text/javascript' }));
        await this.ac.audioWorklet.addModule(url);
        this.node = new AudioWorkletNode(this.ac, 'bb-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
        this.node.port.onmessage = (e) => this.feed(e.data.t, e.data.x);
        const mute = this.ac.createGain(); mute.gain.value = 0; this.node.connect(mute); mute.connect(this.ac.destination);
      }
      if (this.src) try { this.src.disconnect(this.node); } catch {}
      this.src = node; node.connect(this.node);
    }
    disconnect() { if (this.src) try { this.src.disconnect(this.node); } catch {} this.src = null; }
    /** a block of raw samples that started at AudioContext time t */
    feed(t, raw) {
      if (this.nextT !== null && Math.abs(t - this.nextT) > 0.05) this.reset();   // gap → start over
      this.nextT = t + raw.length / this.ac.sampleRate;
      const D = this.D, n = Math.floor(raw.length / D), dec = new Float32Array(n);
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < D; j++) s += raw[i * D + j]; dec[i] = s / D; }
      if (!this.x.length) this.xT = t;
      const x = new Float32Array(this.x.length + n); x.set(this.x); x.set(dec, this.x.length); this.x = x;
      // spectral flux for every full frame
      while (this.x.length >= N) {
        let fl = 0, lo = 0;
        for (let i = 0; i < N; i++) { this.re[i] = this.x[i] * this.win[i]; this.im[i] = 0; }
        fft(this.re, this.im);
        for (let k = 1; k < N / 2; k++) {
          const m = Math.log1p(1000 * Math.hypot(this.re[k], this.im[k])); this.cur[k] = m;
          const d = m - this.prev[k]; if (d > 0) { fl += d; if (k <= this.lowK) lo += d; }
        }
        const tmp = this.prev; this.prev = this.cur; this.cur = tmp;
        if (this.f0T === null) this.f0T = this.xT;
        this.flux.push(fl); this.low.push(lo);
        const W = Math.round(this.fps * 0.4);
        this.acc += fl; if (this.flux.length > W) this.acc -= this.flux[this.flux.length - 1 - W];
        this.env.push(Math.max(0, fl - this.acc / Math.min(this.flux.length, W)));
        this.x = this.x.subarray(HOP); this.xT += HOP / this.fs;
      }
      const max = Math.round(KEEP * this.fps);
      if (this.env.length > max * 1.25) {   // drop the oldest part
        const cut = this.env.length - max;
        this.env = this.env.slice(cut); this.flux = this.flux.slice(cut); this.low = this.low.slice(cut); this.f0T += cut / this.fps;
      }
    }
    get secs() { return this.env.length / this.fps; }
    /** current beat estimate from the last `win` seconds (null until there's enough sound) */
    estimate(win = 12) {
      const fps = this.fps, total = this.env.length;
      if (total < fps * 6) return null;
      const env = Float32Array.from(this.env), b = total, a = Math.max(0, total - Math.round(win * fps));
      let bpm;
      if (this.locked) bpm = this.locked.bpm;
      else {
        let bestW = -1;
        for (let t = 60; t <= 200; t += 0.5) { const w = acf(env, fps * 60 / t, a, b) * prior(t); if (w > bestW) { bestW = w; bpm = t; } }
        while (bpm > 180) bpm /= 2; while (bpm < 70) bpm *= 2;
      }
      const span = this.locked ? 0.04 : 0.025;
      let best = { score: -1 };
      for (let t = bpm * (1 - span); t <= bpm * (1 + span); t += 0.05) {
        const ph = bestPhase(env, fps * 60 / t, a, b);
        if (ph.score > best.score) best = { bpm: t, ...ph };
      }
      const P = fps * 60 / best.bpm;
      best.phase = kickSide(Float32Array.from(this.low), P, best.phase, a, b);
      let lastF = best.phase; while (lastF + P < b) lastF += P;   // newest beat in the window
      const beatT = this.f0T + lastF / fps + FLUX_LEAD;
      // how clear is it?
      const sorted = Array.from(env.subarray(a, b)).sort((p, q) => p - q), strong = sorted[Math.floor(sorted.length * 0.98)] || 1;
      let hits = 0, nb = 0;
      for (let f = best.phase; f < b; f += P) { if (f < a) continue; nb++; let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, env[Math.round(f) + d] || 0); if (m > strong * 0.25) hits++; }
      // which beat of 4 is the strongest kick → bar start
      const k4 = [0, 0, 0, 0];
      for (let f = lastF, k = 0; f >= a; f -= P, k++) { let l = 0; for (let d = -2; d <= 3; d++) l = Math.max(l, this.low[Math.round(f) + d] || 0); k4[k % 4] += l; }
      const downBack = k4.indexOf(Math.max(...k4));   // that many beats before the newest beat
      return { bpm: best.bpm, beatT, down: beatT - downBack * 60 / best.bpm, clarity: best.score / (best.mean || 1), hitRate: nb ? hits / nb : 0, secs: this.secs };
    }
  }
  window.LiveBeat = LiveBeat;
})();
