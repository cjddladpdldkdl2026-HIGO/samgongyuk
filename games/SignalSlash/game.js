/* 시그널 슬래시 — 게임 본체 (three.js 0.160, MIT)  2026-11-18
 *  신경 터널 저편에서 '상태창'(문제)이 날아와 눈앞에 멈춰요. 5초 안에 정답을 말하면(음성인식)
 *  검사가 베고 창이 두 동강 나요. 빨리 맞힐수록 점수가 크고 다음 창이 바로 날아와요.
 *  문제는 시그널 다이브와 같은 파일(stages.js)을 써요.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

/* ── 검사 자세 사진 목록 ─────────────────────────────────────────────
 *  사진을 더 넣으면 여기에 파일 이름만 추가하면 돼요. 한 칸에 여러 장이면 번갈아 써요.
 *  idle   = 기본 자세 (허리 위 뒷모습)
 *  ready  = 말소리가 들리기 시작하면 칼을 잡는 자세
 *  strike = 정답! 베는 자세
 *  hurt   = 틀렸거나 시간이 끝났을 때 (비어 있으면 기본 자세)
 */
const HERO = {
  idle:   ['img/pose-ready.webp'],
  ready:  ['img/pose-wind.webp'],
  strike: ['img/pose-strike.webp'],
  hurt:   [],
};

/* ── 3D 검사 (VRM 캐릭터) ────────────────────────────────────────────
 *  file 을 다른 .vrm 으로 바꾸면 캐릭터가 바뀌어요. 못 불러오면 위 사진 자세로 돌아가요.
 *  지금 캐릭터: 'オーガロン (오가론)' by Vain — VRoid Hub, 사용·폭력·수정·재배포 모두 허용 (models/README.md)
 */
const HERO3D = { file: 'models/ogreron.vrm', pos: [-1.3, -0.06, 1.5], scale: 0.85, turn: 0.18 };

const TIME = 5;          // 한 문제 제한 시간(초)
const LIVES = 5;
const MIX_COUNT = 15;    // '랜덤 믹스' 문제 수
const BPM = 140;

const $ = (id) => document.getElementById(id);
const STAGES = window.SD_STAGES || [];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* ── renderer ─────────────────────────────────────────────────────── */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030f);
scene.fog = new THREE.FogExp2(0x070418, 0.011);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 92 : 70; camera.updateProjectionMatrix();
}

/* ── 무대 (비트 세이버식 뒷모습 시점) ───────────────────────────────
 *  카메라는 검사 '등 뒤'에 있고, 검사와 같은 쪽(앞)을 봐요. 앞으로 길게 뻗은 길(트랙)을 따라
 *  상태창이 저 멀리서 검사에게 날아와, 검사 칼끝 앞에서 멈춰요. 육각 링은 저 멀리 끝에만 있어요.
 */
const TILT = { roll: 0 };
const AXIS = new THREE.Vector3(0, 0, -1);           // 상태창이 오는 쪽 = 검사 정면
const FLOOR_Y = -1.7, LANE_W = 6.4;
const neon = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: op < 1, opacity: op, fog: true });
const ringMat = neon(0x5effc4), ringMat2 = neon(0xff3d7f);
const edgeMat = neon(0x5effc4), markMat = neon(0xffffff, .35);
edgeMat.depthWrite = false; markMat.depthWrite = false;   // 바닥 쪽은 상태창을 가리지 않게 (상태창이 바닥에 파묻혀 잘리지 않아요)
// floor + lane
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 420), new THREE.MeshBasicMaterial({ color: 0x07051a, fog: true, depthWrite: false }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y - .01, -200); floor.renderOrder = -2; scene.add(floor);
const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W, 420), new THREE.MeshBasicMaterial({ color: 0x120c34, fog: true, depthWrite: false }));
lane.rotation.x = -Math.PI / 2; lane.position.set(0, FLOOR_Y, -200); lane.renderOrder = -1; scene.add(lane);
for (const x of [-LANE_W / 2, LANE_W / 2]) {
  const e = new THREE.Mesh(new THREE.BoxGeometry(.07, .05, 420), edgeMat); e.position.set(x, FLOOR_Y + .02, -200); scene.add(e);
}
// things that rush toward the swordswoman (z goes up; wrap at the back)
const movers = [];
function mover(m, span, start) { m.position.z = start; m.userData.span = span; scene.add(m); movers.push(m); return m; }
const MARK_N = 30, MARK_SP = 8;
for (let i = 0; i < MARK_N; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(LANE_W - .4, .02, .18), markMat); m.position.y = FLOOR_Y + .015;
  mover(m, MARK_N * MARK_SP, -i * MARK_SP);
}
const PIL_N = 22, PIL_SP = 12;
for (let i = 0; i < PIL_N; i++) for (const side of [-1, 1]) {
  const h = 6 + Math.random() * 10;
  const m = new THREE.Mesh(new THREE.BoxGeometry(.12, h, .12), i % 3 === 0 ? ringMat2 : ringMat);
  m.position.set(side * (9 + Math.random() * 5), FLOOR_Y + h / 2, 0);
  mover(m, PIL_N * PIL_SP, -i * PIL_SP - (side > 0 ? PIL_SP / 2 : 0));
}
// 육각 문: 짝대기들과 같은 속도로 검사에게 달려와 머리 위로 지나가요 (바닥에 딱 붙어 서 있어요)
const NR = 10, RSP = 20, RING_R = 7;
const rings = [];
for (let i = 0; i < NR; i++) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(RING_R, i % 3 === 0 ? 0.14 : 0.07, 4, 6), i % 3 === 0 ? ringMat2 : ringMat);
  m.position.y = FLOOR_Y + RING_R * Math.sin(Math.PI / 3);   // 아래 변이 바닥에 닿게
  mover(m, NR * RSP, -24 - i * RSP); rings.push(m);
}
// sky lasers that sweep with the beat
const lasers = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 260), i % 2 ? ringMat2 : ringMat);
  const side = i < 3 ? -1 : 1;
  m.position.set(side * (14 + i % 3 * 4), 10 + (i % 3) * 3, -120);
  m.userData = { side, base: side * (.35 + (i % 3) * .12), ph: i };
  scene.add(m); lasers.push(m);
}
// light streaks flying past along the track
const NS = 160;
const streakGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
const streakMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, toneMapped: false, transparent: true, opacity: .7, fog: true });
const streaks = new THREE.InstancedMesh(streakGeo, streakMat, NS);
const sData = [];
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const streakSpot = (d) => { const side = Math.random() < .5 ? -1 : 1; d.x = side * (4 + Math.random() * 12); d.y = FLOOR_Y + Math.random() * 12; };
for (let i = 0; i < NS; i++) { const d = { z: -Math.random() * 250, len: 2 + Math.random() * 6 }; streakSpot(d); sData.push(d); }
scene.add(streaks);
// glow at the end of the track
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5effc4, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
glow.scale.set(140, 140, 1); glow.position.set(0, 3, -280); scene.add(glow);

/* ── the status window (문제 상태창) ──────────────────────────────── */
const CW = 1024, CH = 640, W = 11, H = 6.875;   // 상태창 크기 (가로·세로 비율 1.6 유지)
const WIN_POS = new THREE.Vector3(0.75, 2.1, -6.2); // 검사 칼끝 앞 (오른쪽 앞) 에서 멈춰요
const SZ = W / 5.6;   // 처음 크기 대비 몇 배인지 — 갈라지는 효과도 같이 커져요
const pCanvas = document.createElement('canvas'); pCanvas.width = CW; pCanvas.height = CH;
const pg = pCanvas.getContext('2d');
const pTex = new THREE.CanvasTexture(pCanvas); pTex.colorSpace = THREE.SRGBColorSpace; pTex.anisotropy = 4;
const panelMat = new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false, color: 0xd0d0d0, fog: false });   // 검사보다 뒤(멀리)에 있으니 검사·칼에 가려져요
const win = new THREE.Group();
const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), panelMat); panel.renderOrder = 5;
win.add(panel);
const barMat = new THREE.MeshBasicMaterial({ color: 0x5effc4, toneMapped: false, fog: false });
const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), barMat);
bar.position.z = 0.01; bar.renderOrder = 6; win.add(bar);
win.visible = false; scene.add(win);
const OPT_W = 364, OPT_H = 108;   // 보기 칸: 왼쪽은 캐릭터에 가리지 않게 가운데 쪽으로 모으고, 두 칸 너비는 같게
const OPT_BOX = [[228, 330], [616, 330], [228, 460], [616, 460]]; // x,y of option boxes

function rr(x, y, w, h, r) { pg.beginPath(); pg.moveTo(x + r, y); pg.arcTo(x + w, y, x + w, y + h, r); pg.arcTo(x + w, y + h, x, y + h, r); pg.arcTo(x, y + h, x, y, r); pg.arcTo(x, y, x + w, y, r); pg.closePath(); }
function fitText(t, maxW, size, weight = 800) {
  let s = size; do { pg.font = `${weight} ${s}px "Pretendard Variable", "Malgun Gothic", sans-serif`; s -= 2; } while (pg.measureText(t).width > maxW && s > 14);
}
function wrapLines(t, maxW) {
  const words = t.split(' '); const lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (pg.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}
function drawPanel(state = 'ask', chosen = -1) {
  const c = S.color, q = S.q;
  pg.clearRect(0, 0, CW, CH);
  rr(8, 8, CW - 16, CH - 16, 26); pg.fillStyle = 'rgba(10, 8, 34, .9)'; pg.fill();
  pg.save(); pg.shadowColor = c; pg.shadowBlur = 24; pg.lineWidth = 5; pg.strokeStyle = c; pg.stroke(); pg.restore();
  // corner brackets
  pg.strokeStyle = '#ffffff'; pg.lineWidth = 6;
  for (const [x, y, dx, dy] of [[22, 22, 1, 1], [CW - 22, 22, -1, 1], [22, CH - 22, 1, -1], [CW - 22, CH - 22, -1, -1]]) {
    pg.beginPath(); pg.moveTo(x, y + dy * 40); pg.lineTo(x, y); pg.lineTo(x + dx * 40, y); pg.stroke();
  }
  // header
  pg.fillStyle = c; pg.font = '700 28px Rajdhani, sans-serif'; pg.textBaseline = 'middle';
  pg.fillText('◆ STATUS  ·  QUEST ' + String(S.qi + 1).padStart(2, '0'), 52, 62);
  pg.textAlign = 'right'; pg.fillStyle = '#a3a9cf'; pg.font = '700 24px "Pretendard Variable", sans-serif';
  pg.fillText(S.q.stage, CW - 52, 62); pg.textAlign = 'left';
  pg.fillStyle = c; pg.globalAlpha = .5; pg.fillRect(52, 92, CW - 104, 2); pg.globalAlpha = 1;
  // question
  pg.fillStyle = '#ffffff'; pg.textAlign = 'center';
  fitText(q.q, 2 * (CW - 120), 52);
  const lines = wrapLines(q.q, CW - 120).slice(0, 2);
  lines.forEach((l, i) => pg.fillText(l, CW / 2, (lines.length === 1 ? 208 : 178) + i * 62));
  // options
  q.opts.forEach((o, i) => {
    const [x, y] = OPT_BOX[i], w = OPT_W, h = OPT_H;
    const right = i === q.ans, picked = i === chosen;
    let bg = 'rgba(255,255,255,.07)', bd = 'rgba(180,190,255,.35)';
    if (state === 'reveal' && right) { bg = 'rgba(94,255,196,.32)'; bd = '#5effc4'; }
    else if (state === 'reveal' && picked) { bg = 'rgba(255,71,87,.35)'; bd = '#ff4757'; }
    rr(x, y, w, h, 16); pg.fillStyle = bg; pg.fill(); pg.lineWidth = 3; pg.strokeStyle = bd; pg.stroke();
    rr(x + 14, y + 22, 64, 64, 12); pg.fillStyle = state === 'reveal' && right ? '#5effc4' : c; pg.fill();
    pg.fillStyle = '#0a0822'; pg.font = '700 44px Rajdhani, sans-serif'; pg.fillText(String(i + 1), x + 46, y + 56);
    pg.fillStyle = '#ffffff'; pg.textAlign = 'left'; fitText(o, w - 112, 40);
    pg.fillText(o, x + 96, y + 56); pg.textAlign = 'center';
  });
  pg.textAlign = 'left';
  pTex.needsUpdate = true;
}

/* halves: the window split along the slash line */
function halfGeo(nx, ny, side) {
  // keep the corners on one side of the line through the centre (normal n), clip edges
  const pts = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
  const d = (p) => (p[0] * nx + p[1] * ny) * side;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], da = d(a), db = d(b);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(out.map(([x, y]) => new THREE.Vector2(x, y))));
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + .5, pos.getY(i) / H + .5);
  return g;
}
const halves = [];
const slashFx = [];
function faceCam(spin) { win.quaternion.copy(camera.quaternion); win.rotateZ(-TILT.roll * .6 + spin); }
function fxMesh(geo, color, op) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
  m.userData.op = op; return m;
}
function cutWindow() {
  // 위에서 아래로 내려 긋는 대각선 한 칼 (좌↘ 또는 우↙)
  const ang = (Math.random() < .5 ? -1 : 1) * (0.32 + Math.random() * 0.3);
  const dir = new THREE.Vector2(Math.cos(ang), Math.sin(ang)), nx = -dir.y, ny = dir.x;
  const snap = document.createElement('canvas'); snap.width = CW; snap.height = CH; snap.getContext('2d').drawImage(pCanvas, 0, 0);
  const tex = new THREE.CanvasTexture(snap); tex.colorSpace = THREE.SRGBColorSpace;
  const q = win.quaternion.clone();
  const toWorld = (x, y, z = 0) => new THREE.Vector3(x, y, z).applyQuaternion(q);
  const col = new THREE.Color(S.color);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(halfGeo(nx, ny, side), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xd0d0d0, fog: false }));
    m.position.copy(win.position); m.quaternion.copy(q); m.renderOrder = 5;
    // glowing cut edge on each half
    const edge = fxMesh(new THREE.PlaneGeometry(W * 1.25, .03 * SZ), 0xffffff, .9); edge.renderOrder = 6;
    edge.rotation.z = ang; edge.position.z = .02; m.add(edge);
    const edge2 = fxMesh(new THREE.PlaneGeometry(W * 1.25, .14 * SZ), col, .35); edge2.renderOrder = 6;
    edge2.rotation.z = ang; edge2.position.z = .015; m.add(edge2);
    m.userData = { // 먼저 잘린 선을 따라 미끄러지고, 그다음 위아래로 확 벌어져요
      push: toWorld(nx * side, ny * side), slide: toWorld(dir.x * side, dir.y * side),
      spin: side * (0.9 + Math.random() * .6), t: 0, tex, edges: [edge, edge2], v: new THREE.Vector3(),
    };
    scene.add(m); halves.push(m);
  }
  // the slash streak across the whole screen
  for (const [h, op, c] of [[.035, 1, 0xffffff], [.16, .35, col]]) {
    const m = fxMesh(new THREE.PlaneGeometry(26 * SZ, h * SZ), c, op); m.renderOrder = 7;
    m.position.copy(win.position).addScaledVector(toWorld(0, 0, 1), .25); m.quaternion.copy(q); m.rotateZ(ang); m.scale.x = .01;
    m.userData.t = 0; m.userData.kind = 'streak'; scene.add(m); slashFx.push(m);
  }
  // shockwave ring
  const ring = fxMesh(new THREE.RingGeometry(.96, 1, 48), col, .5);
  ring.position.copy(win.position); ring.quaternion.copy(q); ring.userData.t = 0; ring.userData.kind = 'ring'; scene.add(ring); slashFx.push(ring);
  // sparks spray out along the cut line
  for (let i = 0; i < 40; i++) {
    const u = (Math.random() - .5) * W * 1.1, side = Math.random() < .5 ? 1 : -1;
    const at = win.position.clone().add(toWorld(dir.x * u, dir.y * u, .05));
    const sp = 3 + Math.random() * 10;
    const v = toWorld(nx * side * sp + dir.x * (Math.random() - .5) * 6, ny * side * sp + dir.y * (Math.random() - .5) * 6, Math.random() * 4);
    spark(at, v, Math.random() < .5 ? 0xffffff : col);
  }
  win.visible = false;
}
function stepHalves(dt) {
  for (let i = halves.length - 1; i >= 0; i--) {
    const m = halves[i], u = m.userData; u.t += dt;
    if (u.t < .06) { // 칼이 지나간 직후 아주 잠깐 붙어 있다가
      m.position.addScaledVector(u.slide, dt * 3 * SZ);
    } else {
      if (!u.go) { u.go = true; u.v.copy(u.push).multiplyScalar(11 * SZ).addScaledVector(u.slide, 6 * SZ); }
      u.v.y -= 6 * SZ * dt;
      m.position.addScaledVector(u.v, dt);
      m.rotateZ(u.spin * dt); m.rotateX(u.spin * .25 * dt);
    }
    m.material.opacity = clamp(1 - (u.t - .3) / .3, 0, 1);
    u.edges.forEach(e => e.material.opacity = e.userData.op * clamp(1 - u.t / .35, 0, 1));
    if (u.t > .62) {
      scene.remove(m); m.geometry.dispose(); m.material.dispose(); u.edges.forEach(e => { e.geometry.dispose(); e.material.dispose(); });
      if (i % 2 === 0) u.tex.dispose(); halves.splice(i, 1);
    }
  }
  for (let i = slashFx.length - 1; i >= 0; i--) {
    const m = slashFx[i], u = m.userData; u.t += dt;
    let end;
    if (u.kind === 'ring') { m.scale.setScalar(1 + u.t * 14 * SZ); m.material.opacity = u.op * clamp(1 - u.t / .35, 0, 1); end = .35; }
    else { m.scale.x = clamp(u.t / .05, .01, 1); m.material.opacity = u.op * clamp(1 - (u.t - .08) / .22, 0, 1); end = .3; }
    if (u.t > end) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); slashFx.splice(i, 1); }
  }
}

/* shards / sparks */
const sparkGeo = new THREE.PlaneGeometry(0.16, 0.05);
const sparks = [];
function spark(at, v, color) {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
  m.position.copy(at); m.quaternion.copy(camera.quaternion); m.rotateZ(Math.random() * Math.PI); m.scale.x = 1 + Math.random() * 3;
  m.userData = { v, t: 0, life: .35 + Math.random() * .35 };
  scene.add(m); sparks.push(m);
}

/* ── hero (검사) ──────────────────────────────────────────────────── */
const heroEl = $('hero');
const heroImgs = {};
for (const src of new Set(Object.values(HERO).flat())) {
  const im = document.createElement('img'); im.src = src; im.alt = ''; heroEl.appendChild(im); heroImgs[src] = im;
}
const poseTurn = {};
let poseNow = '';
function setPose(name) {
  const list = HERO[name] && HERO[name].length ? HERO[name] : HERO.idle;
  poseTurn[name] = ((poseTurn[name] ?? -1) + 1) % list.length;
  const src = list[poseTurn[name]];
  hero3dPose(name, name === 'strike' ? 34 : name === 'ready' ? 14 : name === 'hurt' ? 18 : 9);
  if (src === poseNow) return;
  for (const s in heroImgs) heroImgs[s].classList.toggle('on', s === src);
  poseNow = src;
}
function heroAnim(cls) {
  heroEl.classList.remove('idle', 'dash', 'hurt'); void heroEl.offsetWidth; heroEl.classList.add(cls);
}

/* 3D 검사: 뼈(관절)마다 자세를 정해 두고 부드럽게 옮겨 가요.
 * 숫자 = [앞뒤로 숙이기(x), 좌우로 비틀기(y), 옆으로 기울이기(z)] (라디안, VRM0 = 캐릭터가 화면 안쪽을 봐요, 오른쪽 = +x) */
const POSES = {
  idle: {
    spine: [-.06, -.12, 0], chest: [-.04, -.08, 0], neck: [0, .1, 0], head: [.06, .12, 0],
    rightUpperArm: [0, .45, -1.05], rightLowerArm: [0, .75, 0], rightHand: [0, 0, .25],
    leftUpperArm: [0, -.25, 1.2], leftLowerArm: [0, -.45, 0], leftHand: [0, 0, 0],
    rightUpperLeg: [-.15, 0, -.08], leftUpperLeg: [.12, 0, .08],
  },
  ready: {
    spine: [-.04, -.32, .04], chest: [-.06, -.22, .04], neck: [0, .3, 0], head: [.05, .25, 0],
    rightUpperArm: [0, .25, .95], rightLowerArm: [0, -.3, 1.5], rightHand: [0, 0, 0],
    leftUpperArm: [0, -.9, .9], leftLowerArm: [0, -1.2, 0], leftHand: [0, 0, 0],
    rightUpperLeg: [-.2, 0, -.1], leftUpperLeg: [.15, 0, .1],
  },
  strike: {
    spine: [-.22, .42, -.05], chest: [-.12, .3, -.04], neck: [.05, -.3, 0], head: [.1, -.3, 0],
    rightUpperArm: [0, 1.35, -.55], rightLowerArm: [0, .12, 0], rightHand: [0, 0, .7],
    leftUpperArm: [0, .2, 1.35], leftLowerArm: [0, -.2, 0], leftHand: [0, 0, 0],
    rightUpperLeg: [-.35, 0, -.1], leftUpperLeg: [.25, 0, .1],
  },
  hurt: {
    spine: [.22, .1, .06], chest: [.12, 0, 0], neck: [0, 0, 0], head: [.25, 0, .1],
    rightUpperArm: [0, .2, -1.25], rightLowerArm: [0, .4, 0], rightHand: [0, 0, 0],
    leftUpperArm: [0, -.1, 1.25], leftLowerArm: [0, -.3, 0], leftHand: [0, 0, 0],
    rightUpperLeg: [0, 0, -.06], leftUpperLeg: [0, 0, .06],
  },
};
const hero3d = { vrm: null, root: new THREE.Group(), pose: 'idle', speed: 12, lunge: 0, hurtT: 0, blinkT: 2 };
hero3d.root.position.fromArray(HERO3D.pos); hero3d.root.rotation.y = HERO3D.turn; hero3d.root.scale.setScalar(HERO3D.scale);
scene.add(hero3d.root);
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x302050, .7));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0); keyLight.position.set(-2, 3, 3); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xff3d7f, 1.6); rimLight.position.set(2, 1.5, -4); scene.add(rimLight);
// 칼: 빛나는 날 (색은 스테이지 색을 따라가요)
const bladeMat = new THREE.MeshBasicMaterial({ color: 0xff3d7f, toneMapped: false, fog: false });
const sword = new THREE.Group();
{
  const dark = new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: .5, metalness: .6 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .24, 8), dark); grip.position.y = .02; sword.add(grip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.09, .012, .05), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: .9, roughness: .3 }));
  guard.position.y = .14; sword.add(guard);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.03, .95, .008), bladeMat); blade.position.y = .14 + .475; sword.add(blade);
  const core = new THREE.Mesh(new THREE.BoxGeometry(.012, .93, .01), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false }));
  core.position.y = .14 + .47; sword.add(core);
}
// 자세마다 칼날이 가리키는 방향 (캐릭터 기준: +x 오른쪽, +y 위, -z 앞)
const BLADE = { idle: [.45, -.3, -.85], ready: [.25, .85, .45], strike: [-.65, -.55, -.5], hurt: [.5, -.85, -.1] };
const bladeQ = {};
for (const k in BLADE) bladeQ[k] = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...BLADE[k]).normalize());
sword.quaternion.copy(bladeQ.idle);
const poseQ = {};
for (const [name, bones] of Object.entries(POSES)) {
  poseQ[name] = {};
  for (const [b, e] of Object.entries(bones)) poseQ[name][b] = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
}
function hero3dPose(name, speed) {
  hero3d.pose = POSES[name] ? name : 'idle'; hero3d.speed = speed;
  if (name === 'strike') hero3d.lunge = 1;
  if (name === 'hurt') hero3d.hurtT = 1;
}
const bobQ = new THREE.Quaternion(), X_AXIS = new THREE.Vector3(1, 0, 0);
function hero3dUpdate(dt) {
  const vrm = hero3d.vrm; if (!vrm) return;
  const k = 1 - Math.exp(-hero3d.speed * dt), tgt = poseQ[hero3d.pose];
  const cur = hero3d.cur || (hero3d.cur = {});
  bobQ.setFromAxisAngle(X_AXIS, Math.sin(S.gt * 2.4) * .012 - S.pulse * .02);   // 숨쉬기 + 비트에 맞춰 살짝 들썩
  for (const b in tgt) {
    const n = vrm.humanoid.getNormalizedBoneNode(b); if (!n) continue;
    (cur[b] || (cur[b] = tgt[b].clone())).slerp(tgt[b], k);
    n.quaternion.copy(cur[b]); if (b === 'chest') n.quaternion.multiply(bobQ);
  }
  sword.quaternion.slerp(bladeQ[hero3d.pose] || bladeQ.idle, k);
  hero3d.lunge = Math.max(0, hero3d.lunge - dt * 3.2); hero3d.hurtT = Math.max(0, hero3d.hurtT - dt * 3);
  const l = Math.sin(hero3d.lunge * Math.PI) * .18;
  hero3d.root.position.set(HERO3D.pos[0] + l * .4, HERO3D.pos[1] - S.pulse * .012 - l * .1, HERO3D.pos[2] - l + hero3d.hurtT * .12);
  // 눈 깜빡
  hero3d.blinkT -= dt;
  const em = vrm.expressionManager;
  if (em) { const b = hero3d.blinkT < 0 ? 1 - Math.abs(hero3d.blinkT / .07 + 1) : 0; em.setValue('blink', clamp(b, 0, 1)); if (hero3d.blinkT < -.14) hero3d.blinkT = 2 + Math.random() * 3; }
  vrm.update(dt);
  // 칼은 오른손 주먹 위치를 따라가요
  const hand = vrm.humanoid.getRawBoneNode('rightHand');
  if (hand) { hand.getWorldPosition(sword.position); hero3d.root.worldToLocal(sword.position); }
}
{
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(HERO3D.file, (gltf) => {
    const vrm = gltf.userData.vrm; if (!vrm) return;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    (VRMUtils.combineSkeletons || VRMUtils.removeUnnecessaryJoints)?.(gltf.scene);
    vrm.scene.traverse((o) => { o.frustumCulled = false; o.renderOrder = 10; });   // 검사는 항상 상태창보다 앞에 그려요
    for (const b in poseQ.idle) { const n = vrm.humanoid.getNormalizedBoneNode(b); if (n) n.quaternion.copy(poseQ.idle[b]); }
    sword.traverse((o) => { o.renderOrder = 11; }); hero3d.root.add(sword);
    hero3d.root.add(vrm.scene); hero3d.vrm = vrm;
    document.body.classList.add('vrm');
    vrm.update(0);
  }, undefined, (err) => console.warn('3D 검사를 못 불러왔어요 — 사진 자세로 할게요', err));
}
setPose('idle');

/* ── audio: built-in beat + sfx (or the player's own song) ─────────── */
let ac = null, master, musicBus, sfxBus, noiseBuf, analyser, aData;
let seqOn = false, nextT = 0, stepI = 0;
const kickQ = [];
let customAudio = null;
function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
  master.connect(comp).connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = .9; sfxBus.connect(master);
  analyser = ac.createAnalyser(); analyser.fftSize = 512; musicBus.connect(analyser); aData = new Uint8Array(analyser.frequencyBinCount);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noise(t, dur, type, f, peak, bus, q = 1, f2) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain(); env(g, t, .004, peak, dur);
  s.connect(fl).connect(g).connect(bus); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
function tone(t, type, f, f2, dur, peak, bus, lp) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ac.createGain(); env(g, t, .005, peak, dur);
  let n = o; if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
  n.connect(g).connect(bus); o.start(t); o.stop(t + dur + .05);
}
// Am – F – C – G, one chord per bar
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 2];
function playStep(i, t) {
  const s = i % 16, bar = Math.floor(i / 16) % 4, ch = PROG[bar];
  const fever = S.fever;
  if (s % 4 === 0) { tone(t, 'sine', 150, 42, .32, 1, musicBus); kickQ.push(t); }
  if (s === 4 || s === 12) { noise(t, .16, 'bandpass', 1900, .55, musicBus, .8); tone(t, 'triangle', 220, 160, .08, .25, musicBus); }
  if (s % 4 === 2) noise(t, .09, 'highpass', 7000, .32, musicBus);
  else if (fever || s % 2 === 1) noise(t, .03, 'highpass', 9000, .12, musicBus);
  if (s % 2 === 1 || (fever && s % 4 === 2)) tone(t, 'sawtooth', mtof(ch[0] - 24), 0, .17, .32, musicBus, 700);
  tone(t, 'square', mtof(ch[ARP[s]] + 12), 0, .11, fever ? .1 : .065, musicBus, 2600);
  if (s === 0) for (const n of ch) tone(t, 'sawtooth', mtof(n), 0, .5, .05, musicBus, 1800);
}
function scheduler() {
  if (!ac || !seqOn || ac.state !== 'running') return;
  const step = 60 / BPM / 4;
  while (nextT < ac.currentTime + .12) { playStep(stepI, nextT); nextT += step; stepI++; }
}
setInterval(scheduler, 25);
function startMusic() {
  initAudio();
  if (customAudio) { customAudio.currentTime = 0; customAudio.play(); seqOn = false; }
  else { seqOn = true; stepI = 0; nextT = ac.currentTime + .06; }
}
function stopMusic() { seqOn = false; kickQ.length = 0; if (customAudio) customAudio.pause(); }
const SFX = {
  whoosh() { const t = ac.currentTime; noise(t, .3, 'bandpass', 500, .3, sfxBus, 1.2, 4000); },
  lock() { const t = ac.currentTime; tone(t, 'square', 1320, 0, .05, .12, sfxBus, 4000); noise(t, .05, 'highpass', 3000, .2, sfxBus); },
  slash() {
    const t = ac.currentTime;
    noise(t, .2, 'highpass', 1800, .9, sfxBus, .7, 9000);
    tone(t, 'sawtooth', 1600, 180, .16, .25, sfxBus, 5000);
    tone(t + .02, 'sine', 120, 40, .25, .9, sfxBus);
    noise(t + .03, .35, 'bandpass', 2500, .35, sfxBus, .5, 600);
  },
  bad() { const t = ac.currentTime; tone(t, 'sawtooth', 110, 70, .35, .4, sfxBus, 900); noise(t, .25, 'lowpass', 900, .6, sfxBus); },
  ding(n) { const t = ac.currentTime; [0, 4, 7, 12].slice(0, n).forEach((k, i) => tone(t + i * .06, 'triangle', mtof(76 + k), 0, .2, .25, sfxBus)); },
  tick() { const t = ac.currentTime; tone(t, 'square', 1800, 0, .03, .08, sfxBus); },
};

/* ── speech recognition ───────────────────────────────────────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false, wantRec = false, qBase = 0, seenLen = 0, micErr = '';
// 마이크가 안 될 때 이유를 화면에 계속 보여 줘요 (다음 문제가 와도 안 지워요)
const MIC_ERR = {
  'not-allowed': '마이크가 막혀 있어요 · 주소창 왼쪽 아이콘 → 마이크 "허용" → 새로고침 (또는 1~4 키)',
  'service-not-allowed': '마이크가 막혀 있어요 · 주소창 왼쪽 아이콘 → 마이크 "허용" → 새로고침 (또는 1~4 키)',
  'audio-capture': '마이크를 못 찾았어요 · 마이크·이어폰이 꽂혀 있는지 확인해요 (또는 1~4 키)',
  'network': '음성인식 서버에 연결이 안 돼요 · 인터넷 연결 확인, 크롬에서 해 주세요 (또는 1~4 키)',
  'language-not-supported': '이 브라우저는 한국어 음성인식이 안 돼요 · 크롬에서 해 주세요 (또는 1~4 키)',
  'bad-grammar': '음성인식 설정 오류예요 · 크롬에서 해 주세요 (또는 1~4 키)',
};
// 점검 모드: 주소 끝에 ?mic 를 붙이면 음성인식이 지금 뭘 하는지 화면 왼쪽 위에 보여 줘요
const MIC_DEBUG = /[?&]mic\b/.test(location.search);
const micLogEl = MIC_DEBUG ? Object.assign(document.createElement('pre'), { id: 'micLog' }) : null;
if (micLogEl) {
  micLogEl.style.cssText = 'position:fixed;left:12px;top:110px;z-index:99;max-width:46vw;margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.78);color:#9fffd0;font:12px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(micLogEl);
}
const micLines = [];
function micLog(t) {
  if (!micLogEl) return;
  const d = new Date(); micLines.push(`${d.toTimeString().slice(0, 8)} ${t}`); if (micLines.length > 16) micLines.shift();
  micLogEl.textContent = `[마이크 점검] ${navigator.userAgent.includes('Edg/') ? '엣지' : navigator.userAgent.includes('Chrome/') ? '크롬' : '기타 브라우저'} · 음성인식 ${SR ? '있음' : '없음'}\n` + micLines.join('\n');
}
let heardSound = false, liveSince = 0;
// 엣지는 가끔 말소리를 듣고도 빈 글자("")만 줘요 → 두 번 그러면 더 단순한 방식(한 번에 한 마디)으로 바꿔요
let simpleRec = false, emptyFinals = 0;
function startRec() {
  if (!SR) { micErr = '이 브라우저는 음성인식이 안 돼요 · 크롬에서 열거나 1~4 키를 써요'; $('heardTxt').textContent = micErr; return; }
  wantRec = true;
  if (recOn) return;
  rec = new SR(); rec.lang = 'ko-KR'; rec.continuous = !simpleRec; rec.interimResults = true; rec.maxAlternatives = simpleRec ? 1 : 3;
  rec.onstart = () => { recOn = true; micErr = ''; qBase = 0; seenLen = 0; $('heard').classList.add('live'); liveSince = liveSince || performance.now(); micLog('시작 (듣기 켜짐)'); };
  rec.onaudiostart = () => micLog('마이크 소리 받기 시작');
  rec.onsoundstart = () => { heardSound = true; micLog('소리 들림'); };
  rec.onspeechstart = () => micLog('말소리 들림');
  rec.onnomatch = () => micLog('말은 들렸는데 글자로 못 바꿈');
  rec.onend = () => { recOn = false; $('heard').classList.remove('live'); micLog('끝남' + (wantRec ? ' → 다시 켜기' : '')); if (wantRec) setTimeout(startRec, 60); };
  rec.onerror = (e) => {
    console.warn('음성인식 오류:', e.error);
    micLog('오류: ' + e.error + (e.message ? ' (' + e.message + ')' : ''));
    if (MIC_ERR[e.error]) { wantRec = false; micErr = MIC_ERR[e.error]; const ht = $('heardTxt'); ht.textContent = micErr; ht.classList.remove('got'); }
  };
  rec.onresult = onSpeech;
  try { rec.start(); } catch (e) { /* already starting */ }
}
function stopRec() { wantRec = false; try { rec && rec.abort(); } catch (e) { /* */ } }
function onSpeech(e) {
  seenLen = e.results.length;
  { const r = e.results[e.results.length - 1]; micLog(`글자: "${r[0].transcript}"${r.isFinal ? ' (확정)' : ''}`);
    if (r.isFinal && !r[0].transcript.trim() && !simpleRec && ++emptyFinals >= 2) {
      simpleRec = true; micLog('빈 글자가 계속 와요 → 단순 방식으로 바꿔요'); try { rec.abort(); } catch (er) { /* 끝나면 다시 켜져요 */ }
      return;
    } }
  if (!(S.phase === 'ask' || S.phase === 'fly')) return;
  const cands = []; let joined = ''; let anyFinal = false;
  for (let i = qBase; i < e.results.length; i++) {
    const r = e.results[i]; joined += r[0].transcript;
    for (let j = 0; j < r.length; j++) cands.push({ t: r[j].transcript, fin: r.isFinal });
    if (r.isFinal) anyFinal = true;
  }
  joined = joined.trim();
  if (!joined) return;
  cands.unshift({ t: joined, fin: anyFinal });
  const ht = $('heardTxt'); ht.textContent = '“' + joined + '”'; ht.classList.add('got');
  if (S.phase === 'ask' && !S.readied) { S.readied = true; setPose('ready'); }
  let wrong = -1;
  for (const c of cands) {
    const k = matchOption(c.t, S.q.opts);
    if (k === S.q.ans) return answer(k, 'voice');
    if (k >= 0 && c.fin && wrong < 0) wrong = k;
  }
  if (wrong >= 0) answer(wrong, 'voice');
}

/* matching what was said against the 4 options */
const ALIAS = {
  'na⁺': ['나트륨', '소듐', '엔에이', '나트륨이온'], 'k⁺': ['칼륨', '포타슘', '케이'], 'ca²⁺': ['칼슘'], 'cl⁻': ['염소', '클로라이드', '염화'],
  'gaba': ['가바'], 'atp': ['에이티피'],
};
const KO_NUM = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
function norm(s) {
  return s.toLowerCase().replace(/[−–—]/g, '-').replace(/마이너스/g, '-').replace(/플러스/g, '+').replace(/밀리볼트|mv/g, '')
    .replace(/[\s.,!?·~'"“”()[\]⁺⁻²³]/g, '');
}
function variants(opt) {
  const v = new Set([norm(opt)]);
  const low = opt.toLowerCase().replace(/\s/g, '');
  if (ALIAS[low]) ALIAS[low].forEach(a => v.add(norm(a)));
  const m = opt.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (m) { v.add(norm(m[1])); v.add(norm(m[2])); }
  const rn = opt.match(/^[IVX]+\s+(.+)$/); if (rn) v.add(norm(rn[1]));
  return [...v].filter(x => x.length >= 2 || /\d/.test(x));
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function simIn(t, v) {
  if (t.includes(v)) return 1;
  if (v.length < 3) return 0;
  let best = 0;
  for (const L of [v.length - 1, v.length, v.length + 1]) {
    if (L < 2 || L > t.length) continue;
    for (let i = 0; i + L <= t.length; i++) best = Math.max(best, 1 - lev(t.slice(i, i + L), v) / v.length);
  }
  return best;
}
function matchOption(said, opts) {
  const t = norm(said);
  if (!t) return -1;
  let bi = -1, bs = 0;
  opts.forEach((o, i) => {
    for (const v of variants(o)) {
      const s = simIn(t, v);
      if (s >= .75 && s * v.length > bs) { bs = s * v.length; bi = i; }
    }
  });
  if (bi >= 0) return bi;
  // "1번" / "일 번" / "첫 번째"
  const n = t.match(/([1-4])번/) || t.match(/^([일이삼사])번/) ;
  if (n) { const k = /\d/.test(n[1]) ? +n[1] : KO_NUM.indexOf(n[1]); return k - 1; }
  const ord = ['첫번째', '두번째', '세번째', '네번째'].findIndex(x => t.includes(x));
  return ord;
}

/* ── game state ───────────────────────────────────────────────────── */
const S = {
  mode: 'title', phase: 'none', t: 0, color: '#5effc4', stageId: 'mix',
  qs: [], qi: 0, q: null, score: 0, combo: 0, best: 0, lives: LIVES, right: 0, times: [], misses: [],
  askT: TIME, speed: 60, boost: 0, fever: false, readied: false, flyDur: .5, hitstop: 0, shake: 0, pulse: 0, gt: 0,
};

function buildChips() {
  const box = $('chips'); box.innerHTML = '';
  const list = [{ id: 'mix', title: '랜덤 믹스', sub: `전 구역에서 ${MIX_COUNT}문제`, color: '#ff3d7f' }, ...STAGES];
  for (const st of list) {
    const b = document.createElement('button'); b.className = 'chip' + (st.id === S.stageId ? ' sel' : '');
    b.style.setProperty('--k', st.color);
    b.innerHTML = `<b>${st.title}</b><span>${st.sub}${st.qs ? ` · ${st.qs.length}문제` : ''}</span>`;
    b.onclick = () => { S.stageId = st.id; buildChips(); setColor(st.color); };
    box.appendChild(b);
  }
}
function setColor(c) {
  S.color = c; document.documentElement.style.setProperty('--c', c);
  ringMat.color.set(c).multiplyScalar(2.2); edgeMat.color.set(c).multiplyScalar(2); glow.material.color.set(c); bladeMat.color.set(c).multiplyScalar(1.6); rimLight.color.set(c); barMat.color.set(c).multiplyScalar(1.6);
}
function makeQs() {
  let pool;
  if (S.stageId === 'mix') pool = shuffle(STAGES.flatMap(st => st.qs.map(q => ({ ...q, stage: st.title })))).slice(0, MIX_COUNT);
  else { const st = STAGES.find(s => s.id === S.stageId); pool = shuffle(st.qs.map(q => ({ ...q, stage: st.title }))); }
  return pool.map(q => {
    const opts = shuffle([q.a, ...q.w.slice(0, 3)]);
    return { ...q, opts, ans: opts.indexOf(q.a) };
  });
}

function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function hud() {
  $('score').textContent = Math.round(S.score).toLocaleString();
  $('qNo').textContent = Math.min(S.qi + 1, S.qs.length); $('qAll').textContent = S.qs.length;
  $('life').innerHTML = Array.from({ length: LIVES }, (_, i) => `<i class="${i < S.lives ? '' : 'off'}"></i>`).join('');
  const cb = $('combo'); cb.classList.toggle('on', S.combo >= 2); $('comboN').textContent = S.combo;
}
function judge(txt, sub, color) {
  const j = $('judge'); j.innerHTML = txt + (sub ? `<em>${sub}</em>` : ''); j.style.color = color || '#fff';
  j.style.textShadow = `0 0 26px ${color || S.color}`;
  j.classList.remove('show'); void j.offsetWidth; j.classList.add('show');
}
function flash(op = .55) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = op; requestAnimationFrame(() => { f.style.transition = 'opacity .22s'; f.style.opacity = 0; }); }

async function startGame() {
  initAudio(); if (ac.state === 'suspended') await ac.resume();
  S.qs = makeQs(); S.qi = 0; S.score = 0; S.combo = 0; S.best = 0; S.lives = LIVES; S.right = 0; S.times = []; S.misses = [];
  S.fever = false; setColor(S.stageId === 'mix' ? '#ff3d7f' : STAGES.find(s => s.id === S.stageId).color);
  show(''); document.body.classList.add('playing'); S.mode = 'count'; S.phase = 'none';
  heroAnim('idle'); setPose('idle'); hud();
  startRec(); startMusic();
  const beat = 60 / BPM, cnt = $('count'); cnt.classList.add('on');
  for (const s of ['3', '2', '1', 'GO!']) {
    cnt.textContent = s; cnt.animate([{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 160 });
    await new Promise(r => setTimeout(r, beat * 1000));
  }
  cnt.classList.remove('on');
  if (S.mode !== 'count') return;
  S.mode = 'play'; spawn();
}
function spawn() {
  if (S.qi >= S.qs.length || S.lives <= 0) return endGame();
  S.q = S.qs[S.qi]; S.readied = false; S.askT = TIME;
  qBase = seenLen;
  drawPanel('ask'); hud();
  S.flyDur = clamp(.5 - S.combo * .012, .28, .5);
  win.visible = true; win.position.copy(WIN_POS).addScaledVector(AXIS, 165); S.spin = (Math.random() - .5) * .8; win.scale.setScalar(1);
  bar.visible = false;
  S.phase = 'fly'; S.t = 0;
  const quiet = recOn && !heardSound && liveSince && performance.now() - liveSince > 8000;   // 8초 넘게 듣는데 소리가 한 번도 안 들어옴
  const ht = $('heardTxt'); ht.textContent = micErr || (quiet ? '마이크에 소리가 안 들어와요 · 윈도우 설정 → 소리 → 입력 장치 확인 (또는 1~4 키)' : '정답을 말하세요'); ht.classList.remove('got');
  setPose('idle'); heroAnim('idle');
  SFX.whoosh();
}
function answer(k, src) {
  if (!(S.phase === 'ask' || (S.phase === 'fly' && S.t > S.flyDur * .5))) return;
  if (k === S.q.ans) cut(); else miss(k);
}
function cut() {
  const rt = TIME - S.askT; S.times.push(rt);
  S.combo++; S.best = Math.max(S.best, S.combo); S.right++;
  const mult = 1 + Math.min(S.combo, 20) * .1;
  const pts = Math.round((500 + 1500 * (S.askT / TIME)) * mult);
  S.score += pts;
  const [txt, col] = rt < 1.3 ? ['PERFECT', '#ffffff'] : rt < 2.6 ? ['GREAT', S.color] : ['GOOD', '#a3a9cf'];
  judge(txt, `+${pts.toLocaleString()}`, col);
  setPose('strike'); heroAnim('dash');
  setTimeout(() => { if (S.phase !== 'fly') { setPose('idle'); heroAnim('idle'); } }, 420);
  cutWindow(); SFX.slash(); flash(.22);
  S.hitstop = .09; S.shake = .45; S.boost = 1;
  if (S.combo % 5 === 0) SFX.ding(4);
  if (S.combo >= 10 && !S.fever) { S.fever = true; setColor('#ff3d7f'); judge('FEVER!!', '콤보 10 · 점수 UP', '#ff3d7f'); }
  const c = $('combo'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  S.qi++; hud();
  S.phase = 'gap'; S.t = 0; S.gapDur = .16;
}
function miss(k) {
  S.lives--; S.combo = 0; S.times.push(TIME - S.askT);
  S.misses.push(S.q);
  if (S.fever) { S.fever = false; setColor(S.stageId === 'mix' ? '#ff3d7f' : STAGES.find(s => s.id === S.stageId).color); }
  drawPanel('reveal', k);
  setPose('hurt'); heroAnim('hurt');
  SFX.bad(); S.shake = .5;
  const v = $('vign'); v.classList.add('on'); setTimeout(() => v.classList.remove('on'), 60);
  const at = $('answerToast'); at.textContent = (k < 0 ? '시간 끝! ' : '') + '정답: ' + S.q.a; at.classList.add('on');
  judge(k < 0 ? 'TIME OVER' : 'MISS', '', '#ff4757');
  bar.visible = false;
  S.qi++; hud();
  S.phase = 'miss'; S.t = 0;
}
function endGame() {
  S.mode = 'result'; S.phase = 'none'; stopRec(); stopMusic(); win.visible = false;
  document.body.classList.remove('playing');
  const total = S.right + S.misses.length;
  const acc = total ? S.right / total : 0;
  const avg = S.times.length ? S.times.reduce((a, b) => a + b, 0) / S.times.length : 0;
  $('rScore').textContent = Math.round(S.score).toLocaleString(); $('rAcc').textContent = Math.round(acc * 100) + '%';
  $('rCombo').textContent = S.best; $('rTime').textContent = avg.toFixed(1) + 's';
  $('rRank').textContent = acc >= .95 && avg < 2.2 ? 'S' : acc >= .85 ? 'A' : acc >= .7 ? 'B' : 'C';
  $('rTitle').textContent = S.lives <= 0 ? '쓰러졌어요… 다시 한 판!' : '전부 베었어요!';
  $('rStage').textContent = S.qs[0] ? (S.stageId === 'mix' ? 'RANDOM MIX' : S.qs[0].stage) : 'RESULT';
  $('rMissWrap').style.display = S.misses.length ? '' : 'none';
  $('rMiss').innerHTML = S.misses.map(q => `<li>${q.q} → <b>${q.a}</b><br><span style="color:var(--dim)">${q.e || ''}</span></li>`).join('');
  show('result');
}
function pause(on) {
  if (S.mode !== 'play' && S.mode !== 'pause') return;
  if (on) { S.mode = 'pause'; show('pause'); stopRec(); if (ac) ac.suspend(); if (customAudio) customAudio.pause(); }
  else { S.mode = 'play'; show(''); if (ac) ac.resume(); if (customAudio) customAudio.play(); startRec(); }
}
function quit() { S.mode = 'title'; S.phase = 'none'; stopRec(); stopMusic(); if (ac) ac.resume(); win.visible = false; document.body.classList.remove('playing'); show('title'); }

/* ── main loop ────────────────────────────────────────────────────── */
let last = performance.now();
const camBase = new THREE.Vector3(-.6, 1.4, 2.5), look = new THREE.Vector3(.3, .9, -40); // 검사 등 뒤, 조금 위
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = Math.min(.05, (now - last) / 1000); last = now;
  const playing = S.mode === 'play';
  let dt = S.mode === 'pause' ? 0 : rdt;
  if (S.hitstop > 0) { S.hitstop -= rdt; dt *= .06; }
  S.gt += dt;

  // beat pulse
  if (ac && seqOn) { while (kickQ.length && kickQ[0] <= ac.currentTime) { kickQ.shift(); S.pulse = 1; } }
  else if (ac && customAudio && !customAudio.paused) {
    analyser.getByteFrequencyData(aData); let e = 0; for (let i = 1; i < 8; i++) e += aData[i];
    e /= 7; S.bassAvg = (S.bassAvg || e) * .92 + e * .08; if (e > S.bassAvg * 1.18 && e > 120 && S.pulse < .3) S.pulse = 1;
  }
  S.pulse = Math.max(0, S.pulse - rdt * 4);

  // speed: always rushing, extra burst after each cut
  S.boost = Math.max(0, S.boost - dt * 1.6);
  const target = (playing || S.mode === 'count' ? 70 : 34) * (S.fever ? 1.45 : 1);
  S.speed += (target - S.speed) * Math.min(1, dt * 2);
  const v = S.speed + S.boost * 150;
  for (const m of movers) { m.position.z += v * dt; if (m.position.z > 4) m.position.z -= m.userData.span; }
  for (const l of lasers) { const u = l.userData; l.rotation.y = u.base + Math.sin(S.gt * .8 + u.ph) * .18; l.rotation.x = Math.sin(S.gt * .6 + u.ph) * .08; }
  ringMat2.color.set(0xff3d7f).multiplyScalar(1.4 + S.pulse * 1.6);
  for (let i = 0; i < NS; i++) {
    const d = sData[i]; d.z += v * dt * 1.5;
    if (d.z > 4) { d.z -= 250; streakSpot(d); }
    tmpP.set(d.x, d.y, d.z); tmpS.set(1, 1, d.len * (1 + v / 60));
    tmpM.compose(tmpP, tmpQ, tmpS); streaks.setMatrixAt(i, tmpM);
  }
  streaks.instanceMatrix.needsUpdate = true;
  streakMat.opacity = .35 + clamp(v / 200, 0, .45);
  bloom.strength = .85 + S.pulse * .35 + (S.fever ? .3 : 0);
  glow.material.opacity = .55 + S.pulse * .45;

  // window phases
  if (playing) {
    S.t += dt;
    if (S.phase === 'fly') {
      const k = clamp(S.t / S.flyDur, 0, 1), e = easeOut(k);
      win.position.copy(WIN_POS).addScaledVector(AXIS, 165 * (1 - e));
      faceCam(S.spin * (1 - e));
      if (k >= 1) { S.phase = 'ask'; S.t = 0; faceCam(0); SFX.lock(); S.shake = Math.max(S.shake, .12); bar.visible = true; }
    } else if (S.phase === 'ask') {
      S.askT -= dt;
      const f = clamp(S.askT / TIME, 0, 1);
      bar.scale.set(W * .9 * f, .08, 1); bar.position.set(-W * .45 + W * .45 * f, -H / 2 + .08, .01);
      barMat.color.set(f > .5 ? S.color : f > .25 ? '#ffd166' : '#ff4757').multiplyScalar(1.6);
      win.position.copy(WIN_POS); win.position.y += Math.sin(S.gt * 2.2) * .05; faceCam(0);
      const sec = Math.ceil(S.askT); if (sec !== S.lastSec && sec <= 2 && sec > 0) SFX.tick(); S.lastSec = sec;
      if (S.askT <= 0) miss(-1);
    } else if (S.phase === 'miss') {
      if (S.t > .8) { // the window smashes into the camera
        win.position.addScaledVector(AXIS, -dt * 60); win.scale.multiplyScalar(1 + dt * 2);
        if (S.t > .95) { $('answerToast').classList.remove('on'); win.visible = false; spawn(); }
      }
    } else if (S.phase === 'gap') {
      if (S.t > S.gapDur) spawn();
    }
  }

  // halves / slash / sparks
  stepHalves(dt);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const m = sparks[i], u = m.userData; u.t += dt;
    m.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 2.5);
    m.material.opacity = clamp(1 - u.t / u.life, 0, 1);
    if (u.t > u.life) { scene.remove(m); m.material.dispose(); sparks.splice(i, 1); }
  }

  // camera: slight sway + shake
  S.shake = Math.max(0, S.shake - rdt * 1.8);
  const sh = S.shake * S.shake;
  camera.position.set(camBase.x + Math.sin(S.gt * .7) * .12 + (Math.random() - .5) * sh, camBase.y + Math.sin(S.gt * .9) * .08 + (Math.random() - .5) * sh, camBase.z);
  camera.lookAt(look);
  hero3dUpdate(dt);
  camera.rotation.z += TILT.roll + Math.sin(S.gt * .5) * .03;
  composer.render();
}

/* ── input ────────────────────────────────────────────────────────── */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') { if (S.mode === 'play') pause(true); else if (S.mode === 'pause') pause(false); return; }
  if (S.mode === 'play' && /^[1-4]$/.test(e.key)) answer(+e.key - 1, 'key');
  if (S.mode === 'title' && e.key === 'Enter') startGame();
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => {
  if (S.mode !== 'play' || !win.visible) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(panel)[0]; if (!hit) return;
  const x = hit.uv.x * CW, y = (1 - hit.uv.y) * CH;
  const k = OPT_BOX.findIndex(([bx, by]) => x >= bx && x <= bx + OPT_W && y >= by && y <= by + OPT_H);
  if (k >= 0) answer(k, 'tap');
});
$('startBtn').onclick = startGame;
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = quit;
$('againBtn').onclick = startGame;
$('backBtn').onclick = () => { S.mode = 'title'; show('title'); };
$('musicBtn').onclick = () => $('musicFile').click();
$('musicFile').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  initAudio();
  if (!customAudio) { customAudio = new Audio(); customAudio.loop = true; ac.createMediaElementSource(customAudio).connect(musicBus); }
  customAudio.src = URL.createObjectURL(f);
  $('musicName').textContent = '🎵 ' + f.name;
};
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') pause(true); });

buildChips(); setColor('#ff3d7f'); resize(); addEventListener('resize', resize);
requestAnimationFrame(frame);
window.__ss = { S, answer, matchOption, hero3d, HERO3D, POSES, poseQ, hero3dPose, THREE, camera, tick: (n = 1) => { for (let i = 0; i < n; i++) frame(last + 1000 / 60); } }; // for testing
