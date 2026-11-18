/* 시그널 다이브 — 게임 본체 (three.js 0.160, MIT)
 *  화면: 신경섬유 안쪽 터널을 앞으로 달려요. 플레이어(나리, Na⁺)는 터널 벽을 따라 빙 돌며 이동.
 *  문제가 뜨면 앞에서 다가오는 게이트 중 정답 쪽으로 들어가요. 모든 시간은 게임 시계(clock)로 재서
 *  ⏸ 일시정지하면 전부 같이 멈춰요.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const STAGES = window.SD_STAGES;
const R = 6;                         // tube radius
const SEG = 11, GAP = 2.4, NSEG = 18; // myelin band length, node gap, bands in view
const SPAN = SEG + GAP;
const LIMIT = [-Math.PI * 0.9, -Math.PI * 0.1];   // where the player can go (lower half of the tube)
const LAYOUT = { 2: [-125, -55], 3: [-146, -90, -34] };
const DEG = Math.PI / 180;
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ── renderer & scene ─────────────────────────────────────────────────── */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020b11);
scene.fog = new THREE.FogExp2(0x03141c, 0.012);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x08202b, 0.55));
const headLight = new THREE.PointLight(0x9ffff0, 16, 34, 1.7); scene.add(headLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.45, 0.42);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 86 : 72; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ── the nerve fibre (tunnel) ─────────────────────────────────────────── */
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#0b3a4a'); grd.addColorStop(.5, '#0e4c5c'); grd.addColorStop(1, '#0b3a4a');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(160,240,255,${Math.random() * .12})`; g.fillRect(Math.random() * 64, Math.random() * 512, 1 + Math.random() * 2, 20 + Math.random() * 80); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const wallTex = stripeTexture(); wallTex.repeat.set(10, 18);
const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 300, 64, 1, true),
  new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: .9, metalness: 0, emissive: 0x06303a, emissiveIntensity: .25 }));
wall.rotation.x = Math.PI / 2; wall.position.z = -130; scene.add(wall);

const bands = [], nodes = [];
const bandMat = new THREE.MeshStandardMaterial({ color: 0xcff7ff, transparent: true, opacity: .1, side: THREE.BackSide, roughness: .35, emissive: 0x5fd8ff, emissiveIntensity: .12, depthWrite: false });
const bandEdgeMat = new THREE.MeshBasicMaterial({ color: 0x9feaff, transparent: true, opacity: .55 });
const nodeMat = () => new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: .9 });
for (let i = 0; i < NSEG; i++) {
  const g = new THREE.Group();
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(R, R, SEG, 56, 1, true), bandMat); sheath.rotation.x = Math.PI / 2; g.add(sheath);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 6, 72), bandEdgeMat); e.position.z = s * SEG / 2; g.add(e); }
  g.position.z = -i * SPAN; scene.add(g); bands.push(g);
  const n = new THREE.Mesh(new THREE.TorusGeometry(R + 0.15, 0.13, 8, 80), nodeMat());   // node of Ranvier
  n.position.z = -i * SPAN - SEG / 2 - GAP / 2; n.userData.lit = 0; scene.add(n); nodes.push(n);
}

// floating ions in the axoplasm
const DUST = 700, dustPos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (R - .4); dustPos.set([Math.cos(a) * r, Math.sin(a) * r, -Math.random() * 220 + 20], i * 3); }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x8ff6ff, size: .07, transparent: true, opacity: .7, depthWrite: false }));
scene.add(dust);

/* ── 나리 (the Na⁺ ion) ───────────────────────────────────────────────── */
function glowSprite(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.25, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); return s;
}
const nari = new THREE.Group();
const core = new THREE.Mesh(new THREE.SphereGeometry(.34, 32, 16), new THREE.MeshStandardMaterial({ color: 0xe8fff8, emissive: 0x5effc4, emissiveIntensity: 1.6, roughness: .2 }));
nari.add(core, glowSprite('rgba(94,255,196,.5)', 1.5));
const orbitA = new THREE.Mesh(new THREE.TorusGeometry(.62, .025, 6, 48), new THREE.MeshBasicMaterial({ color: 0xbffff0 }));
const orbitB = orbitA.clone(); orbitB.rotation.x = Math.PI / 2.6; nari.add(orbitA, orbitB);
scene.add(nari);
const TRAIL = 40, trailPos = new Float32Array(TRAIL * 3), trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: 0x5effc4, size: .16, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(trail);

/* ── things on the wall: Na⁺ pickups, inhibitory spikes, answer gates ── */
const onWall = (o, ang, r, z) => { o.position.set(Math.cos(ang) * r, Math.sin(ang) * r, z); o.rotation.z = ang + Math.PI / 2; };
const pickMat = new THREE.MeshStandardMaterial({ color: 0xd8fff2, emissive: 0x5effc4, emissiveIntensity: 1.3 });
const spikeMat = new THREE.MeshStandardMaterial({ color: 0x3a0610, emissive: 0xff3b5c, emissiveIntensity: 1.2, flatShading: true });
const pickGeo = new THREE.OctahedronGeometry(.32), spikeGeo = new THREE.IcosahedronGeometry(.55, 0);
let things = [];   // { kind, mesh, ang, z, ... }

function addPickup(ang, z) {
  const m = new THREE.Mesh(pickGeo, pickMat); m.add(glowSprite('rgba(94,255,196,.5)', 1.6));
  onWall(m, ang, R - .9, z); scene.add(m); things.push({ kind: 'pick', mesh: m, ang, z });
}
function addSpike(ang, z) {
  const m = new THREE.Mesh(spikeGeo, spikeMat); m.add(glowSprite('rgba(255,59,92,.45)', 2));
  onWall(m, ang, R - .95, z); scene.add(m); things.push({ kind: 'spike', mesh: m, ang, z });
}

function textTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(3,16,24,.82)'; roundRect(g, 8, 8, 1008, 404, 48); g.fill();
  g.lineWidth = 10; g.strokeStyle = color; roundRect(g, 8, 8, 1008, 404, 48); g.stroke();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 96, lines;
  for (;;) {   // shrink until it fits in two lines
    g.font = `800 ${size}px "Pretendard Variable", "Malgun Gothic", sans-serif`;
    lines = wrap(g, text, 920);
    if ((lines.length <= 2 && lines.every(l => g.measureText(l).width <= 920)) || size <= 44) break;
    size -= 6;
  }
  const lh = size * 1.18, y0 = 210 - (lines.length - 1) * lh / 2;
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 512, y0 + i * lh));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function wrap(g, text, max) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function addGate(q, z, color) {
  const opts = shuffle([{ t: q.a, ok: true }, ...q.w.slice(0, 2).map(t => ({ t, ok: false }))]);
  const angs = LAYOUT[opts.length].map(d => d * DEG);
  const group = new THREE.Group(); group.position.z = z;
  const panels = opts.map((o, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.48), new THREE.MeshBasicMaterial({ map: textTexture(o.t, color), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    onWall(p, angs[i], R - 1.25, 0); group.add(p);
    const halo = glowSprite(color === '#ff6b6b' ? 'rgba(255,107,107,.35)' : 'rgba(127,212,255,.3)', 3.6);
    halo.position.copy(p.position); halo.position.z -= .2; group.add(halo);
    return { ...o, ang: angs[i], mesh: p };
  });
  // light beams between lanes
  for (let i = 0; i < angs.length - 1; i++) {
    const a = (angs[i] + angs[i + 1]) / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.05, 2.4, .05), new THREE.MeshBasicMaterial({ color: 0x9feaff, fog: false }));
    onWall(beam, a, R - 1.25, 0); group.add(beam);
  }
  scene.add(group);
  const gate = { kind: 'gate', mesh: group, z, q, opts: panels, judged: false };
  things.push(gate);
  return gate;
}
function remove(t) { scene.remove(t.mesh); t.mesh.traverse(o => { if (o.material && o.material.map && o.material.map.isCanvasTexture && t.kind === 'gate') o.material.map.dispose(); }); }

/* ── sound (Web Audio, made here — no files) ──────────────────────────── */
let ac = null, master = null, muted = false;
function audio() {
  if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .5; master.connect(ac.destination); } catch { ac = null; }
}
function tone(f, d = .12, type = 'sine', v = .2, slide = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
}
const SFX = {
  pick: () => tone(1320 + Math.random() * 200, .08, 'triangle', .12),
  ok: () => { tone(660, .12, 'triangle', .2); setTimeout(() => tone(990, .18, 'triangle', .2), 90); setTimeout(() => tone(1320, .3, 'sine', .16), 180); },
  ng: () => { tone(180, .32, 'sawtooth', .16, .5); },
  hit: () => tone(120, .2, 'square', .12, .6),
  node: () => tone(70, .14, 'sine', .22, .5),
  gate: () => tone(520, .1, 'sine', .08),
};
addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') muted = !muted; });

/* ── game state ───────────────────────────────────────────────────────── */
const S = {
  mode: 'title', paused: false, clock: 0, stage: null, queue: [], qi: 0, results: [], wrong: [],
  score: 0, combo: 0, best: 0, energy: 60, theta: -Math.PI / 2, camTheta: -Math.PI / 2, steer: 0,
  speed: 14, boostUntil: 0, slowUntil: 0, nextGateAt: 0, gate: null, events: [], shake: 0, fovKick: 0, done: false,
};
const at = (t, fn) => S.events.push({ t: S.clock + t, fn });

/* ── screens ─────────────────────────────────────────────────────────── */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); document.body.classList.toggle('playing', id === null); }
const STARS_KEY = 'signal-dive/stars';
const stars = () => { try { return JSON.parse(localStorage.getItem(STARS_KEY) || '{}'); } catch { return {}; } };
function drawGrid() {
  const st = stars();
  $('grid').innerHTML = STAGES.map(s => `<button class="stg${s.boss ? ' boss' : ''}" data-id="${s.id}" style="--c:${s.color}">
    <span class="no">${s.boss ? 'BOSS' : 'ZONE ' + s.no}</span><b>${s.title}</b><span>${s.sub} · ${s.qs.length}문제</span>
    <span class="stars">${[0, 1, 2].map(i => i < (st[s.id] || 0) ? '★' : '☆').join('')}</span></button>`).join('');
  $('grid').querySelectorAll('.stg').forEach(b => b.addEventListener('click', () => openStage(STAGES.find(s => s.id === b.dataset.id))));
}
$('goStages').onclick = () => { audio(); drawGrid(); show('stages'); };
$('goHow').onclick = () => show('how');
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show('title'));

let pending = null;
async function openStage(stage) {
  audio();
  let saved = null;
  if (window.GameMenu) saved = await GameMenu.askResume();
  if (saved && saved.stage) { const s2 = STAGES.find(s => s.id === saved.stage); if (s2) { start(s2, saved); return; } }
  pending = stage;
  $('introCard').style.setProperty('--c', stage.color);
  $('iNo').textContent = stage.boss ? 'BOSS ZONE' : `ZONE ${stage.no}`;
  $('iTitle').textContent = stage.title;
  $('iText').textContent = `${stage.intro} (문제 ${stage.qs.length}개)`;
  show('intro');
}
$('iGo').onclick = () => pending && start(pending);
$('iBack').onclick = () => { drawGrid(); show('stages'); };

/* ── a run ───────────────────────────────────────────────────────────── */
function clearThings() { things.forEach(remove); things = []; }
function start(stage, saved = null) {
  clearThings();
  Object.assign(S, { mode: 'play', paused: false, clock: 0, stage, events: [], done: false, gate: null,
    queue: saved ? saved.order.map(i => stage.qs[i]).filter(Boolean) : shuffle(stage.qs.map((q, i) => ({ ...q, _i: i }))),
    qi: saved ? saved.qi : 0, results: saved ? saved.results.slice() : [], wrong: saved ? saved.wrong.map(i => stage.qs[i]).filter(Boolean) : [],
    score: saved ? saved.score : 0, combo: saved ? saved.combo : 0, best: saved ? saved.best : 0, energy: saved ? saved.energy : 60,
    theta: -Math.PI / 2, steer: 0, speed: 14, boostUntil: 0, slowUntil: 0, nextGateAt: 2.2, shake: 0 });
  if (saved) S.queue.forEach((q, k) => { q._i = saved.order[k]; });
  $('hStage').innerHTML = `${stage.boss ? 'BOSS' : 'ZONE ' + stage.no}<b>${stage.title}</b>`;
  $('qcard').style.setProperty('--qc', stage.color);
  drawDots(); hud();
  show(null);
  scatter(-30, -90);
}
function baseSpeed() { return 24 + (S.stage ? S.stage.no : 1) * 1.4; }
function drawDots() {
  $('hDots').innerHTML = S.queue.map((_, i) => `<i class="${S.results[i] === true ? 'ok' : S.results[i] === false ? 'ng' : i === S.qi ? 'now' : ''}"></i>`).join('');
}
function hud() {
  if (S.gate && !S.gate.judged) {
    const near = S.gate.opts.reduce((a, b) => angDiff(b.ang, S.theta) < angDiff(a.ang, S.theta) ? b : a);
    $('qOpts').querySelectorAll('span').forEach(el => el.classList.toggle('near', S.gate.opts[+el.dataset.k] === near));
  }
  $('hScore').textContent = Math.round(S.score).toLocaleString('en-US');
  $('hSpeed').textContent = `${Math.round(S.speed * 3.6)} m/s`;
  $('hEnergy').style.width = Math.max(2, S.energy) + '%';
  const c = $('hCombo'); c.textContent = S.combo > 1 ? `COMBO ×${S.combo}` : ''; c.classList.toggle('on', S.combo > 1);
}
function toast(kind, head, text, dur) {
  const t = $('toast'); t.className = 'toast on ' + kind; $('tHead').textContent = head; $('tText').innerHTML = text;
  at(dur, () => { t.className = 'toast'; });
}
function flash(kind) { const f = $('flash'); f.className = 'flash ' + kind; requestAnimationFrame(() => requestAnimationFrame(() => { f.className = 'flash'; })); }

// Na⁺ lines and a few spikes between gates
function scatter(z0, z1) {
  for (let z = z0; z > z1; z -= 9 + Math.random() * 6) {
    const lane = (LIMIT[0] + .15) + Math.random() * (LIMIT[1] - LIMIT[0] - .3);
    if (Math.random() < .72) for (let k = 0; k < 5; k++) addPickup(lane + Math.sin(k * .7) * .12, z - k * 1.6);
    else addSpike(lane, z);
  }
}

function spawnGate() {
  if (S.qi >= S.queue.length) return;
  const q = S.queue[S.qi];
  const lead = S.stage.boss ? 8.4 : 6.6;                    // seconds to read and steer
  S.gate = addGate(q, -S.speed * lead - 6, S.stage.color);
  $('qNo').textContent = `${S.stage.boss ? 'DIAGNOSIS' : 'GATE'} ${S.qi + 1} / ${S.queue.length}`;
  $('qText').textContent = q.q;
  // the same answers, left → right as they sit in the tunnel; the one you're heading for lights up
  const lanes = S.gate.opts.slice().sort((a, b) => a.ang - b.ang);
  $('qOpts').innerHTML = lanes.map((o, i) => `<span data-k="${S.gate.opts.indexOf(o)}">${['◀', '▲', '▶'][lanes.length === 2 ? i * 2 : i]} ${o.t}</span>`).join('');
  $('qcard').classList.add('on');
  SFX.gate(); drawDots();
}

function judge(gate) {
  gate.judged = true;
  const pick = gate.opts.reduce((a, b) => angDiff(b.ang, S.theta) < angDiff(a.ang, S.theta) ? b : a);
  const q = gate.q, ok = pick.ok;
  S.results[S.qi] = ok;
  $('qcard').classList.remove('on');
  if (ok) {
    S.combo++; S.best = Math.max(S.best, S.combo);
    const gain = Math.round(300 * (1 + .15 * Math.min(S.combo - 1, 10)) * (S.energy > 70 ? 1.2 : 1));
    S.score += gain; S.energy = Math.min(100, S.energy + 12);
    S.boostUntil = S.clock + 1.4; S.fovKick = 1;
    SFX.ok(); flash('ok');
    toast('ok', `도약! +${gain}`, `<b>${q.a}</b> — ${q.e}`, 2.4);
  } else {
    S.combo = 0; S.energy = Math.max(0, S.energy - 18);
    S.slowUntil = S.clock + 2.6; S.shake = .5;
    S.wrong.push(q);
    SFX.ng(); flash('ng');
    toast('ng', '신호 약화…', `정답은 <b>${q.a}</b><br>${q.e}`, 3.6);
  }
  gate.opts.forEach(o => { o.mesh.material.opacity = o.ok ? 1 : .25; });
  S.qi++; drawDots(); hud();
  if (S.qi >= S.queue.length) at(ok ? 2.6 : 3.8, finish);
  else { S.nextGateAt = S.clock + (ok ? 2.8 : 3.9); scatter(-60, -60 - S.speed * 3.4); }
}

function finish() {
  if (S.done) return;
  S.done = true; S.mode = 'result';
  const right = S.results.filter(Boolean).length, total = S.queue.length;
  const acc = Math.round(right / total * 100);
  const star = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 40 ? 1 : 0;
  const st = stars(); st[S.stage.id] = Math.max(st[S.stage.id] || 0, star);
  try { localStorage.setItem(STARS_KEY, JSON.stringify(st)); } catch { /* private mode */ }
  if (window.GameMenu) GameMenu.clear();
  if (window.SamAuth && SamAuth.record) SamAuth.record({ game: 'signal', mode: S.stage.id, score: Math.round(S.score), accuracy: acc, detail: { right, total, bestCombo: S.best } });
  $('result').querySelector('.card').style.setProperty('--c', S.stage.color);
  $('rNo').textContent = S.stage.boss ? 'BOSS ZONE' : `ZONE ${S.stage.no}`;
  $('rTitle').textContent = star === 3 ? `${S.stage.title} 완전 복구!` : star ? `${S.stage.title} 복구 성공` : '신호가 약했어요… 다시!';
  $('rStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < star ? '' : 'off'}">★</span>`).join('');
  $('rScore').textContent = Math.round(S.score).toLocaleString('en-US');
  $('rAcc').textContent = acc + '%'; $('rCombo').textContent = S.best;
  $('rWrong').innerHTML = S.wrong.map(q => `<div>${q.q}<br>→ <b>${q.a}</b> · ${q.e}</div>`).join('');
  $('rWrongWrap').style.display = S.wrong.length ? '' : 'none';
  $('rNote').textContent = window.SamAuth && SamAuth.joined ? '기록이 계정에 저장돼요.' : '로그인하면 기록이 계정에 저장되고 랭킹에 올라가요.';
  const idx = STAGES.indexOf(S.stage);
  $('rNext').style.display = idx < STAGES.length - 1 ? '' : 'none';
  show('result');
}
$('rNext').onclick = () => { const i = STAGES.indexOf(S.stage); if (STAGES[i + 1]) openStage(STAGES[i + 1]); };
$('rAgain').onclick = () => start(S.stage);
$('rStages').onclick = () => { S.mode = 'title'; clearThings(); drawGrid(); show('stages'); };

/* ── input ───────────────────────────────────────────────────────────── */
const keys = new Set();
addEventListener('keydown', (e) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) { keys.add(e.key.toLowerCase()); e.preventDefault(); } });
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let touchDir = 0;
addEventListener('pointerdown', (e) => {
  if (S.mode !== 'play' || e.target.closest('button, a, .gm-root')) return;
  touchDir = e.clientX < innerWidth / 2 ? -1 : 1;
});
addEventListener('pointerup', () => { touchDir = 0; });
addEventListener('pointercancel', () => { touchDir = 0; });
function steerInput() {
  let d = touchDir;
  if (keys.has('arrowleft') || keys.has('a')) d -= 1;
  if (keys.has('arrowright') || keys.has('d')) d += 1;
  return Math.max(-1, Math.min(1, d));
}

/* ── main loop ───────────────────────────────────────────────────────── */
let last = performance.now(), attract = 0;
const tmpV = new THREE.Vector3(), up = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(.05, (now - last) / 1000); last = now;
  const playing = S.mode === 'play';
  const dt = playing && !S.paused ? rdt : (S.mode === 'title' ? rdt : 0);

  if (playing && !S.paused) {
    S.clock += dt;
    // events
    S.events = S.events.filter(ev => { if (S.clock >= ev.t) { ev.fn(); return false; } return true; });
    // speed
    let target = baseSpeed() * (.75 + .5 * S.energy / 100);
    if (S.clock < S.boostUntil) target *= 1.75;
    if (S.clock < S.slowUntil) target *= .55;
    S.speed += (target - S.speed) * Math.min(1, dt * 3);
    S.energy = Math.max(0, S.energy - dt * 1.4);
    // steering (screen-left = clockwise along the bottom of the tube)
    const d = steerInput();
    S.steer += (d - S.steer) * Math.min(1, dt * 10);
    S.theta = Math.max(LIMIT[0], Math.min(LIMIT[1], S.theta + S.steer * dt * 2.3));
    // gates
    if (!S.gate && S.clock >= S.nextGateAt && S.qi < S.queue.length) spawnGate();
    hud();
  } else if (S.mode === 'title') {
    attract += rdt; S.speed = 10; S.theta = -Math.PI / 2 + Math.sin(attract * .5) * .9;
  }
  const move = S.speed * dt;

  // tunnel scroll
  wallTex.offset.y -= move / 300 * 18 / 1;
  bands.forEach(b => { b.position.z += move; if (b.position.z > SPAN) b.position.z -= NSEG * SPAN; });
  nodes.forEach(n => {
    const before = n.position.z; n.position.z += move;
    if (before < 0 && n.position.z >= 0) { n.userData.lit = 1; if (playing) SFX.node(); }
    if (n.position.z > SPAN) n.position.z -= NSEG * SPAN;
    n.userData.lit = Math.max(0, n.userData.lit - rdt * 2.2);
    n.material.color.setRGB(1, .48 + .4 * n.userData.lit, .35 + .5 * n.userData.lit);
    n.scale.setScalar(1 + .06 * n.userData.lit);
  });
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < DUST; i++) { let z = dp.getZ(i) + move * .7; if (z > 20) z -= 240; dp.setZ(i, z); }
  dp.needsUpdate = true;

  // things
  if (dt > 0) {
    for (const t of things) {
      t.z += move; t.mesh.position.z = t.kind === 'gate' ? t.z : t.z;
      if (t.kind !== 'gate') t.mesh.rotation.y += rdt * 2;
      if (playing && t.kind === 'pick' && !t.got && Math.abs(t.z) < .9 && angDiff(t.ang, S.theta) < .2) {
        t.got = true; t.z = 99; S.energy = Math.min(100, S.energy + 4); S.score += 10; SFX.pick();
      }
      if (playing && t.kind === 'spike' && !t.got && Math.abs(t.z) < .8 && angDiff(t.ang, S.theta) < .2) {
        t.got = true; t.z = 99; S.energy = Math.max(0, S.energy - 12); S.combo = 0; S.score = Math.max(0, S.score - 30); S.shake = .35; SFX.hit(); flash('ng');
      }
      if (playing && t.kind === 'gate' && !t.judged && t.z >= 0) { judge(t); S.gate = null; }
    }
    things = things.filter(t => { if (t.z > 14) { remove(t); return false; } return true; });
  }

  // nari + camera
  S.camTheta += (S.theta - S.camTheta) * Math.min(1, rdt * 6);
  const pr = R - .95;
  nari.position.set(Math.cos(S.theta) * pr, Math.sin(S.theta) * pr, 0);
  orbitA.rotation.y += rdt * 3.2; orbitB.rotation.z += rdt * 2.4;
  core.material.emissiveIntensity = 1.4 + Math.sin(now / 160) * .3;
  for (let i = TRAIL - 1; i > 0; i--) { trailPos[i * 3] = trailPos[(i - 1) * 3]; trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1]; trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2] + move; }
  trailPos[0] = nari.position.x; trailPos[1] = nari.position.y; trailPos[2] = .2;
  trailGeo.attributes.position.needsUpdate = true;

  up.set(-Math.cos(S.camTheta), -Math.sin(S.camTheta), 0);          // "up" = towards the middle of the tube
  const base = tmpV.set(Math.cos(S.camTheta) * pr, Math.sin(S.camTheta) * pr, 0);
  S.shake = Math.max(0, S.shake - rdt);
  const sh = S.shake * .4;
  camera.position.copy(base).addScaledVector(up, 2.1).add(new THREE.Vector3((Math.random() - .5) * sh, (Math.random() - .5) * sh, 5.6));
  camera.up.copy(up);
  camera.lookAt(base.clone().addScaledVector(up, 1.1).add(new THREE.Vector3(0, 0, -14)));
  S.fovKick = Math.max(0, S.fovKick - rdt * 1.4);
  const fov0 = innerWidth / innerHeight < 1 ? 86 : 72;
  camera.fov = fov0 + 14 * S.fovKick + (S.speed - baseSpeed()) * .15; camera.updateProjectionMatrix();
  headLight.position.copy(camera.position);
  bloom.strength = .55 + .5 * S.fovKick;

  composer.render();
}
requestAnimationFrame(frame);

/* ── login badge, ⏸ menu ─────────────────────────────────────────────── */
if (window.SamAuth) SamAuth.onChange(a => { $('who').textContent = a.joined ? `👤 ${a.displayName}` : '로그인 안 함 · 기록은 이 기기에만'; });
if (window.GameMenu) GameMenu.mount({
  game: 'signal',
  parent: document.body, style: { position: 'fixed', top: 'max(14px, env(safe-area-inset-top))', left: 'max(16px, env(safe-area-inset-left))' },
  btnText: '일시정지',
  theme: { font: "'Pretendard Variable', 'Malgun Gothic', sans-serif", bg: 'rgba(6,36,51,.92)', ink: '#eafcff', accent: '#5effc4', accentInk: '#032a24',
    line: '1px solid rgba(127,212,255,.45)', radius: '14px', btnSize: '40px', shadow: '0 18px 50px rgba(0,0,0,.45)', overlay: 'rgba(2,11,17,.6)',
    title: "400 30px 'Black Han Sans', sans-serif" },
  playing: () => S.mode === 'play' && !S.done,
  pause: () => { S.paused = true; keys.clear(); touchDir = 0; return true; },
  resume: () => { S.paused = false; },
  quit: () => { S.mode = 'title'; S.paused = false; clearThings(); $('qcard').classList.remove('on'); $('toast').className = 'toast'; drawGrid(); show('stages'); },
  snapshot: () => S.mode === 'play' && S.qi < S.queue.length ? {
    stage: S.stage.id, order: S.queue.map(q => q._i), qi: S.qi, results: S.results, wrong: S.wrong.map(q => q._i ?? S.stage.qs.indexOf(q)),
    score: Math.round(S.score), combo: S.combo, best: S.best, energy: Math.round(S.energy) } : null,
  label: (d) => { const s = STAGES.find(x => x.id === d.stage) || {}; return `${s.boss ? 'BOSS' : 'ZONE ' + s.no} ${s.title || ''}<br>${d.qi} / ${d.order.length} 게이트 · ${Number(d.score).toLocaleString('en-US')}점`; },
});
